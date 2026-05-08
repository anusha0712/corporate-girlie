# Corporate Beauty Lingo Generator — Spec

## What we're building

A playful Y2K-styled webpage that generates corporate lingo reframed through **beauty metaphors** — makeup, skincare, haircare, nails, fragrance, tools, technique. The point: replace male-coded sports/war business language ("let's circle back," "boots on the ground," "moving the needle") with beauty-coded equivalents — but where the beauty technique *genuinely illuminates* the business concept, not just girly words slapped on jargon.

The site works for any visitor with no setup, like a real app. Two modes:

1. **Generate** — produces a fresh corporate-beauty phrase from scratch, optionally with a topic hint.
2. **Reframe** — takes the user's normal business sentence and translates it into beauty-speak.

## Architecture

The whole project — webpage + backend — lives in one repo and deploys to **Vercel**. Vercel deploys automatically every time you push to GitHub. It's free for personal use. The webpage is static HTML/CSS/JS; the backend is a single serverless function in the same repo at `/api/generate.js`.

The Anthropic API key lives in Vercel's environment variables — never sent to the browser.

**Request flow:**
1. Browser → `/api/generate` with mode and input.
2. Function checks origin, method, input length, rate limit.
3. Function calls Anthropic API with system prompt + user input.
4. Function returns the generated phrase.
5. Browser displays it as a card with a copy button.

**Why not GitHub Pages:** static-only, no place for a backend, no place for a key.

## The prompt — this is the whole project

The intelligence lives in `prompt.js`. Build it as an exported string (`SYSTEM_PROMPT`) plus a `PROMPT_VERSION` string so editing and versioning is trivial.

### The principle to encode

**The beauty technique in the metaphor must genuinely map to the business dynamic.** That's what makes a phrase land instead of feeling like girlboss jargon. The technique should illuminate something about the business situation that a sports or war metaphor would obscure.

Examples that work, with the mapping made explicit:

- **"We can't dry shampoo our way out of this"** — dry shampoo is a quick cosmetic fix that doesn't actually clean → quick business fix that doesn't address the underlying issue.
- **"Are we color correcting or just concealing?"** — color correction neutralizes the underlying tone; concealer covers it → root-cause fix vs. cover-up.
- **"Let me touch up before the 10am"** — quick prep before being seen → quick prep before a meeting.
- **"We're over-blending and it's getting muddy"** — too much blending ruins the look → iterating past the point of improvement.
- **"We're hitting pan on the budget"** — you can see the metal bottom of a pressed powder → running out of a finite resource.
- **"Let it bake and we'll dust off tomorrow"** — setting powder sits, then excess is brushed away → let a decision settle, revisit.

The full beauty vocabulary is fair game — the AI should choose whichever sub-domain fits best:

- **Skincare**: patch test, double cleanse, slugging, barrier repair, exfoliation, sheet mask, retinol uglies, purging.
- **Haircare**: deep conditioning, split ends, blowout, leave-in, gloss vs. dye, protein treatment.
- **Nails**: base coat, top coat, chip vs. full redo, cuticle care, gel vs. regular.
- **Fragrance**: top notes, heart notes, base notes, dry-down, sillage.
- **Tools/technique**: wrong brush for the job, beauty blender vs. flat brush, setting spray, primer.

### Anti-patterns the prompt must forbid

- Inserting beauty words into existing jargon ("let's lipstick this up," "let's gloss this over").
- Tired clichés ("put lipstick on a pig").
- Hashtag-girlboss / slay energy ("slay the deck, queen").
- Anything that mocks femininity or treats beauty as frivolous.
- Phrases that don't translate to a real business situation.
- Forced rhymes or puns at the cost of meaning.
- Brand names (no "let's Sephora this").

### Prompt structure (`prompt.js`)

Two separate prompts, exported individually. Splitting prevents the model from juggling both modes at once.

```js
export const PROMPT_VERSION = "v0.3";
export const GENERATE_PROMPT = `...`;
export const REFRAME_PROMPT  = `...`;
```

**`GENERATE_PROMPT` structure:**
1. Identity — one short paragraph.
2. Reasoning procedure — six explicit steps the model works through before writing: (a) name the business mechanism (cause-and-effect, not surface situation); (b) search beauty knowledge for the same mechanism; (c) if no genuine match, abandon and try a different angle — do not force; (d) state the beauty fact as a standalone sentence with no business context and verify it is literally true; (e) write the phrase; (f) verify it makes sense without the original input.
3. Output format — three lines: `CATEGORY:`, `PHRASE:`, `USAGE:`. The CATEGORY is a specific subcategory and technique (e.g. "skincare — skin cycling"), used by the app layer to enforce rotation.
4. Rotation instruction — if `recentCategories` is provided, every category on that list is off-limits. `/api/generate.js` appends this dynamically when present.
5. Starter seeds — a short list showing the specificity level expected (slugging, skin cycling, cast, sillage, dry-down, hitting pan, etc.). Explicit instruction: "Your beauty knowledge is much larger than this list. Search it. This is not the menu."
6. Four examples chosen for reasoning-pattern diversity, not topic diversity: (1) specific product knowledge, (2) technique-as-verb, (3) failure-state mapping, (4) two-depth-intervention distinction. Each example is labeled with its pattern. Explicit instruction: "These teach the reasoning pattern. Do not reuse the phrasing, vocabulary, or sentence structure from any of them."
7. Do not produce list.

**`REFRAME_PROMPT` structure:**
1. Identity.
2. Reasoning procedure — four steps: identify the original claim, search for a beauty equivalent with the same dynamic, verify the original meaning survives, verify the beauty version is decodable without the original.
3. Output format — single phrase only, no prefix.
4. Two examples labeled by reasoning pattern.
5. Do not produce list (shorter).

For Generate mode, user message is `"Topic: <topic>"` or `"Generate a phrase."` For Reframe mode, user message is `"Reframe this: \"<sentence>\""`.

### Category rotation (app layer)

The frontend keeps a rolling list of the last 10 `CATEGORY` values returned from `/api/generate`. On every Generate request it sends `recentCategories: [...]` in the request body. `/api/generate.js` appends these to `GENERATE_PROMPT` before the API call:

```js
if (recentCategories?.length) {
  systemPrompt += `\n\nCategories used recently — do not use any of these:\n${recentCategories.join('\n')}`;
}
```

This is the primary variety enforcement mechanism. It is mechanical, not hoped-for.

## The serverless function (`/api/generate.js`)

This is where the API key lives and where all four abuse protections happen. Order:

1. **Origin check.** Read `Origin` header. Reject anything not the Vercel deployment URL or `localhost`. Stops other sites from using your endpoint.
2. **Method check.** Only POST.
3. **Input length cap.** If `input` > 500 characters, reject with a friendly error.
4. **Rate limit.** 20 requests per IP per hour. v1: in-memory `Map` keyed by IP from `x-forwarded-for`. Resets on deploy — fine for a toy. Bypass for `localhost` so evals work.
5. **Call Anthropic.** Use `@anthropic-ai/sdk`. Model: `claude-sonnet-4-6` (current Sonnet as of writing — verify at the docs link in CLAUDE.md if much time has passed). `max_tokens: 300`. Select `GENERATE_PROMPT` or `REFRAME_PROMPT` from `prompt.js` based on `mode`. For generate requests, if `recentCategories` is present in the body, append them to the system prompt before the call (see rotation section in prompt spec above).
6. **Return** `{ phrase, usage, category }` for generate; `{ phrase }` for reframe. Parse `CATEGORY:`, `PHRASE:`, and `USAGE:` lines from the model response. On error, return a friendly message like "the mirror's a little foggy, try again in a sec" with the right HTTP status.

### The fifth protection — manual but critical

The Anthropic console lets you set a hard monthly spending limit. **Set it to $5/month** before deploying. This is the real safety net. Document this prominently in the README.

## Evals — how the prompt actually gets good

Build `evals.html` as a developer tool, linked from the main page footer in tiny text. Without this, you're vibes-checking outputs one at a time and can't tell if a prompt change helped.

**What it does:**

1. **No hardcoded topic list.** Topics are generated fresh from the API on demand — the eval session calls `/api/generate` with a randomly constructed or open-ended prompt, just as the main app does. This makes variety infinite and prevents the evals from training the model against a finite scenario set that it eventually saturates.
2. **Session-based rating.** The user generates phrases one at a time, rates each (good / eh / bad), optionally adds a note, and the session accumulates until sent.
3. **Category tracking.** The eval frontend tracks returned `CATEGORY` values and sends `recentCategories` with every generate call — same rotation enforcement as the main app.
4. **Send session** commits the rated results to the repo via `/api/save-eval`, so sessions are preserved for prompt analysis.
5. Prompt version label at the top, read from `prompt.js`.

The human running the project rates, because their taste is the actual training signal. The iteration loop: generate → rate → cluster the failures → update `prompt.js` → bump version → repeat.

### The iteration loop

1. Run all evals.
2. Read every 👎 output. Cluster the failures — too generic? Same cliché? Not actually usable in a meeting? Forced metaphors?
3. Update `prompt.js`: bump version (`v0.1` → `v0.2`), add an anti-pattern note or a new few-shot targeting the failure mode.
4. Re-run, compare to previous version.
5. Repeat until 👍 rate is consistently high across diverse inputs.

## UI / aesthetic — Y2K playful

- **Palette**: chrome silver, holographic gradients (silver → lilac → baby blue → cotton-candy pink), iridescent button surfaces. Lisa Frank meets a CD-ROM installer.
- **Decorations**: sparkles, four-point stars, hearts — inline SVG or pure CSS, no image files.
- **Type**: chunky display font for the title (e.g. "Bagel Fat One" or "Rubik Mono One" from Google Fonts), readable sans-serif (e.g. "DM Sans") for body.
- **Buttons**: chunky, rounded, hover state adds shimmer.
- **Vibe**: playful, maximalist, never sterile.

### Page layout

- **Header**: title, one-line tagline ("corporate language, finally beat to the gods"), decorative sparkles.
- **Mode toggle**: two big buttons — "Generate ✨" and "Reframe 💄". Reframe reveals a textarea with a 500-char counter.
- **Submit button**: chunky, holographic. Loading state shows a spinning sparkle and disables the button.
- **Output area**: stack of phrase cards, newest on top. Each card has a "Copy" button that briefly says "copied! ✨" then reverts after ~1.5s.
- **Footer**: tiny credit + near-invisible link to `evals.html`.

## Build order

Pause after each numbered phase and summarize what was built before continuing.

1. **Set up the repo.** File structure, `package.json` with `@anthropic-ai/sdk`, `.gitignore` with `.env.local` and `node_modules`.
2. **Build the static UI.** `index.html` + `style.css` with Y2K aesthetic. Hardcoded sample phrases, no API yet. Get the look right first.
3. **Build the serverless function** at `/api/generate.js` with all four protections. Stub the Anthropic call to return a fixed string for now.
4. **Test locally** with `vercel dev`. Confirm browser → function → response loop works.
5. **Wire in Anthropic.** Replace the stub with a real call using the SDK + env-var key. Use a minimal `prompt.js`.
6. **Deploy to Vercel.** Push to GitHub, connect to Vercel, set `ANTHROPIC_API_KEY` env var, set $5/month cap in Anthropic console.
7. **Add Reframe mode.** Textarea, counter, same call path with different user message.
8. **Add copy-to-clipboard** with the "copied! ✨" feedback.
9. **Flesh out `prompt.js`** with full principle, examples, vocabulary, anti-patterns. Mark `v0.1`.
10. **Build `evals.html` + `evals.js`.** Bypass rate limit for localhost.
11. **Run evals. Iterate. Bump versions. Repeat** until outputs are consistently good.
12. **Write `README.md`** with deploy instructions and the spending cap reminder.
