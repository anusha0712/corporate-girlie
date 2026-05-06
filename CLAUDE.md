# Corporate Beauty Lingo Generator

A web app that generates corporate lingo reframed through beauty metaphors (makeup, skincare, hair, nails, fragrance). Users get a fresh phrase, or paste in normal business language and have it reframed.

**Read `SPEC.md` for the full product spec, prompt principles, and build order. Always check `SPEC.md` before starting a new build phase.**

## Tech stack

- Vanilla HTML/CSS/JavaScript on the frontend (no React, no build tools)
- Vercel serverless function in `/api/generate.js` for the backend (Node, not Edge)
- `@anthropic-ai/sdk` for the API call (only used in the function, never on the frontend)
- Hosted on Vercel; auto-deploys from GitHub

## Project structure

```
/
├── index.html              # main page
├── style.css               # Y2K aesthetic
├── app.js                  # frontend logic, calls /api/generate
├── prompt.js               # SYSTEM_PROMPT and PROMPT_VERSION exports
├── evals.html, evals.js    # dev-only eval/rating page
├── /api/generate.js        # serverless function — only place the API key is touched
├── package.json
├── .env.local              # gitignored, holds ANTHROPIC_API_KEY for local dev
├── .gitignore              # must include .env.local and node_modules
└── README.md
```

## Commands

- `npm install` — install dependencies
- `vercel dev` — run locally (requires the Vercel CLI)
- `git push` — auto-deploys to Vercel

## Code style

- Beginner-readable. Comments welcome. No clever one-liners.
- No frontend dependencies beyond Google Fonts.
- No build step. What ships is what's in the repo.
- Handle API errors with friendly user-facing messages, never raw errors.

## Workflow rules

- **Pause between numbered build phases in SPEC.md.** After finishing a phase, summarize what was done and wait for confirmation before starting the next.
- **Use `claude-sonnet-4-6` as the model string** in `/api/generate.js`. If much time has passed since this spec was written, verify it's still current at https://docs.claude.com/en/docs/about-claude/models/overview — model strings change.
- **Never commit `.env.local`** or any file containing an API key.
- The origin check in `/api/generate.js` must be updated to the real Vercel URL after first deploy. Leave a clearly-marked TODO comment until then.
- All four abuse protections (origin check, method check, input length cap, rate limit) must be in place before the first real Anthropic call goes live. Details in SPEC.md.
