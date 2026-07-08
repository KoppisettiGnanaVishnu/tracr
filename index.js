// Tracr — backend entry point

const express = require("express");
const db = require("./db");
const { scanForRisk } = require("./riskScanner");
const { scanPullRequest } = require("./githubIntegration");
const { calculateTrustScore } = require("./trustScore");

const app = express();

app.use(express.json());
app.use(express.static("public"));

/* =========================================================
   Health Check
========================================================= */

app.get("/", (req, res) => {
  res.send("Tracr backend is running ✅");
});

/* =========================================================
   Receive a tagged code block
========================================================= */

app.post("/api/code-block", (req, res) => {
  const { repo_name, file_path, code_snippet, is_ai_generated } = req.body;

  const { isRisky, reasons } = scanForRisk(code_snippet);

  const stmt = db.prepare(`
    INSERT INTO code_blocks
    (repo_name, file_path, code_snippet, is_ai_generated, is_risky)
    VALUES (?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    repo_name,
    file_path,
    code_snippet,
    is_ai_generated ? 1 : 0,
    isRisky ? 1 : 0
  );

  res.json({
    status: "saved",
    id: result.lastInsertRowid,
    isRisky,
    reasons,
  });
});

/* =========================================================
   View all tracked code
========================================================= */

app.get("/api/code-blocks", (req, res) => {
  const rows = db.prepare("SELECT * FROM code_blocks").all();
  res.json(rows);
});

/* =========================================================
   Scan an existing GitHub Pull Request
========================================================= */

app.post("/api/scan-pr", async (req, res) => {
  const { owner, repo, pull_number } = req.body;

  try {
    const findings = await scanPullRequest(owner, repo, pull_number);

    res.json({
      status: "scanned",
      findings,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: err.message,
    });
  }
});

/* =========================================================
   Repository Trust Score
========================================================= */

app.get("/api/trust-score/:repo_name", (req, res) => {
  const { repo_name } = req.params;

  const blocks = db
    .prepare("SELECT * FROM code_blocks WHERE repo_name = ?")
    .all(repo_name);

  const result = calculateTrustScore(blocks);

  res.json({
    repo_name,
    ...result,
  });
});

/* =========================================================
   GitHub Webhook
========================================================= */
app.post("/webhook", async (req, res) => {
  // Respond to GitHub immediately
  res.sendStatus(200);

  const event = req.headers["x-github-event"];

  if (event !== "pull_request") return;
  if (req.body.action !== "opened") return;

  try {
    const owner = req.body.repository.owner.login;
    const repo = req.body.repository.name;
    const pullNumber = req.body.pull_request.number;

    console.log("🚀 New Pull Request");
    console.log(`${owner}/${repo}`);
    console.log("PR #" + pullNumber);

    const findings = await scanPullRequest(owner, repo, pullNumber);

    console.log("Scan complete:", findings);

  } catch (err) {
    console.error("Webhook Error:");
    console.error(err);
  }
});

/* =========================================================
   Start Server
========================================================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Tracr backend listening on port ${PORT}`);
});