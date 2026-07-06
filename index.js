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

app.post("/webhook", (req, res) => {

  console.log("\n======================================");
  console.log("📩 GitHub Webhook Received");
  console.log("======================================");

  console.log("Event:", req.headers["x-github-event"]);

  if (req.body.action) {
    console.log("Action:", req.body.action);
  }

  if (req.body.repository) {
    console.log("Repository:", req.body.repository.full_name);
  }

  if (req.body.sender) {
    console.log("Sender:", req.body.sender.login);
  }

  if (req.body.pull_request) {
    console.log("PR:", req.body.pull_request.html_url);
  }

  console.log("======================================\n");

  res.status(200).send("Webhook received");
});

/* =========================================================
   Start Server
========================================================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Tracr backend listening on port ${PORT}`);
});