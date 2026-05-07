// Vercel serverless function — writes eval session to GitHub repo
// Browser → this function → GitHub API → eval-sessions/latest.json committed

const ALLOWED_ORIGINS = [
  "https://corporate-girlie-85ts.vercel.app",
  "https://corporate-girlie.vercel.app",
];

export default async function handler(req, res) {

  // 1. Origin check
  const origin      = req.headers.origin || "";
  const isLocalhost = origin.startsWith("http://localhost") ||
                      origin.startsWith("http://127.0.0.1");
  const isAllowed   = ALLOWED_ORIGINS.includes(origin);
  if (!isLocalhost && !isAllowed) {
    return res.status(403).json({ error: "nice try bestie" });
  }

  // 2. Method check
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "POST only" });
  }

  // 3. Validate body
  const { session } = req.body || {};
  if (!session || !Array.isArray(session.results) || session.results.length === 0) {
    return res.status(400).json({ error: "invalid session data" });
  }

  // 4. Check required env vars
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER || "anusha0712";
  const repo  = "corporate-girlie";
  const path  = "eval-sessions/latest.json";
  const branch = "main";

  if (!token) {
    return res.status(500).json({ error: "GITHUB_TOKEN not configured" });
  }

  const ghHeaders = {
    Authorization:         `Bearer ${token}`,
    "Content-Type":        "application/json",
    "User-Agent":          "corporate-girlie-evals",
    Accept:                "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  // 5. Get existing file SHA (required to update an existing file)
  let sha;
  try {
    const existing = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      { headers: ghHeaders }
    );
    if (existing.ok) {
      const data = await existing.json();
      sha = data.sha;
    }
  } catch {
    // File doesn't exist yet — that's fine, sha stays undefined
  }

  // 6. Commit the session JSON
  const content = Buffer.from(JSON.stringify(session, null, 2)).toString("base64");

  const putBody = {
    message: `eval: ${session.results.length} phrases rated (${session.version})`,
    content,
    branch,
    committer: { name: "Corporate Girlie Evals", email: "evals@corporate-girlie.app" },
    ...(sha ? { sha } : {}),
  };

  try {
    const put = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      { method: "PUT", headers: ghHeaders, body: JSON.stringify(putBody) }
    );

    if (!put.ok) {
      const err = await put.json();
      console.error("GitHub API error:", err);
      return res.status(500).json({ error: "GitHub commit failed", detail: err.message });
    }

    return res.status(200).json({ ok: true, rated: session.results.length });
  } catch (err) {
    console.error("save-eval error:", err);
    return res.status(500).json({ error: "unexpected error saving session" });
  }
}
