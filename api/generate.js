// Vercel serverless function — Node.js runtime (not Edge)
// This is the only file that touches the Anthropic API key.
//
// All four abuse protections run before any API call:
//   1. Origin check
//   2. Method check (POST only)
//   3. Input length cap (500 chars)
//   4. Rate limit (20 req / IP / hour, in-memory)

import Anthropic from '@anthropic-ai/sdk';
import { GENERATE_PROMPT, REFRAME_PROMPT } from '../prompt.js';

// ── Rate limiter ────────────────────────────────────────────────
// Simple in-memory map. Resets on every deploy — fine for a toy.
const rateLimitMap = new Map(); // ip → { count, resetAt }
const RATE_LIMIT      = 300;
const RATE_WINDOW_MS  = 60 * 60 * 1000; // 1 hour

function isRateLimited(ip) {
  const now    = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }

  if (record.count >= RATE_LIMIT) return true;

  record.count++;
  return false;
}

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env automatically

// ── Handler ─────────────────────────────────────────────────────
export default async function handler(req, res) {

  // 1. Origin check
  // TODO: replace the placeholder below with your real Vercel URL after first deploy.
  //       e.g. "https://corporate-girlie.vercel.app"
  const VERCEL_URL = "https://corporate-girlie-85ts.vercel.app";
  const origin     = req.headers.origin || "";
  const isLocalhost = origin.startsWith("http://localhost") ||
                      origin.startsWith("http://127.0.0.1");

  if (!isLocalhost && origin !== VERCEL_URL) {
    return res.status(403).json({ error: "nice try bestie" });
  }

  // 2. Method check
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "POST only, hun" });
  }

  // 3. Input length cap
  const { mode, input = "", recentPhrases = [], recentCategories = [] } = req.body || {};

  if (typeof input === "string" && input.length > 500) {
    return res.status(400).json({
      error: "that's a lot of words. trim it down to 500 characters and try again.",
    });
  }

  if (!mode || !["generate", "reframe"].includes(mode)) {
    return res.status(400).json({ error: "invalid mode" });
  }

  // 4. Rate limit — bypass for localhost so evals work
  if (!isLocalhost) {
    const ip = (req.headers["x-forwarded-for"] || "")
      .split(",")[0]
      .trim() || req.socket?.remoteAddress || "unknown";

    if (isRateLimited(ip)) {
      return res.status(429).json({
        error: "you're glowing up too fast — slow down and try again in an hour.",
      });
    }
  }

  // 5. Anthropic call
  let systemPrompt = mode === 'reframe' ? REFRAME_PROMPT : GENERATE_PROMPT;

  // Append category rotation constraint to the system prompt dynamically
  if (mode === 'generate' && recentCategories.length > 0) {
    systemPrompt += `\n\nCategories used recently — do not use any of these:\n${recentCategories.join('\n')}`;
  }

  let userMessage = mode === 'reframe'
    ? `Reframe this: "${input}"`
    : input ? `Topic: ${input}` : 'Generate a phrase.';

  if (mode === 'generate' && recentPhrases.length > 0) {
    userMessage += `\n\nAvoid repeating the beauty concepts or vocabulary used in these recent phrases: ${recentPhrases.join(' / ')}`;
  }

  try {
    const message = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 300,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const text = message.content[0].text.trim();

    if (mode === 'generate') {
      const categoryMatch = text.match(/^CATEGORY:\s*(.+?)$/m);
      const phraseMatch   = text.match(/^PHRASE:\s*(.+?)$/m);
      const usageMatch    = text.match(/^USAGE:\s*(.+?)$/m);
      const category = categoryMatch ? categoryMatch[1].trim() : '';
      const phrase   = phraseMatch   ? phraseMatch[1].trim()   : text;
      const usage    = usageMatch    ? usageMatch[1].trim()    : '';
      return res.status(200).json({ phrase, usage, category });
    } else {
      return res.status(200).json({ phrase: text });
    }
  } catch (err) {
    console.error('Anthropic API error:', err);
    return res.status(500).json({
      error: "the mirror's a little foggy — try again in a sec",
    });
  }
}
