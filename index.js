// Tracr — backend entry point

const express = require("express");
const db = require("./db");
const { scanForRisk } = require("./riskScanner");
const { scanPullRequest } = require("./githubIntegration");
const { calculateTrustScore } = require("./trustScore");

const app = express();
app.use(express.json());

// Health check
app.get("/", (req, res) => {
  res.send("Tracr backend is running ✅");
});

// Receive a tagged code block, scan it for risk, and store it
app.post("/api/code-block", (req, res) => {
  const { repo_name, file_path, code_snippet, is_ai_generated } = req.body;

  const { isRisky, reasons } = scanForRisk(code_snippet);

  const stmt = db.prepare(`
    INSERT INTO code_blocks (repo_name, file_path, code_snippet, is_ai_generated, is_risky)
    VALUES (?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    repo_name,
    file_path,
    code_snippet,
    is_ai_generated ? 1 : 0,
    isRisky ? 1 : 0
  );

  res.json({ status: "saved", id: result.lastInsertRowid, isRisky, reasons });
});

// View everything stored so far
app.get("/api/code-blocks", (req, res) => {
  const rows = db.prepare("SELECT * FROM code_blocks").all();
  res.json(rows);
});

// Scan a real GitHub PR and post a risk comment on it
app.post("/api/scan-pr", async (req, res) => {
  const { owner, repo, pull_number } = req.body;
  try {
    const findings = await scanPullRequest(owner, repo, pull_number);
    res.json({ status: "scanned", findings });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Get the trust score for a given repo, based on real stored data
app.get("/api/trust-score/:repo_name", (req, res) => {
  const { repo_name } = req.params;
  const blocks = db.prepare("SELECT * FROM code_blocks WHERE repo_name = ?").all(repo_name);
  const result = calculateTrustScore(blocks);
  res.json({ repo_name, ...result });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Tracr backend listening on http://localhost:${PORT}`);
});