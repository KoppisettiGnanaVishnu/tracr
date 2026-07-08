const express = require("express");

const router = express.Router();

const db = require("../database/db");
const { scanForRisk } = require("../services/riskScanner");
const { calculateTrustScore } = require("../services/trustScore");
const { scanPullRequest } = require("../github/scanner");

/* =========================================================
   Health Check
========================================================= */

router.get("/", (req, res) => {
  res.send("Tracr backend is running ✅");
});

/* =========================================================
   Receive a tagged code block
========================================================= */

router.post("/api/code-block", (req, res) => {
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

router.get("/api/code-blocks", (req, res) => {
  const rows = db.prepare("SELECT * FROM code_blocks").all();
  res.json(rows);
});

/* =========================================================
   Scan an existing Pull Request
========================================================= */

router.post("/api/scan-pr", async (req, res) => {
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
   Trust Score
========================================================= */

router.get("/api/trust-score/:repo_name", (req, res) => {
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

module.exports = router;