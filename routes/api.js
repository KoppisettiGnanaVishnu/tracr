import express from "express";

import db, {
  getRecentScans,
  getScanById,
  getFindingsByScanId,
  getScansByRepo,
  insertScan,
  upsertInstallation,
} from "../database/db.js";

import { scanForRisk } from "../services/riskScanner.js";
import { calculateTrustScoreFromBlocks } from "../services/trustScore.js";
import { scanPullRequest } from "../github/scanner.js";

const router = express.Router();

// ==========================================
// Health Check
// ==========================================

router.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "Tracr",
    version: "1.0.0-phase1",
    timestamp: new Date().toISOString(),
  });
});

/* =========================================================
   Code Block API (original — kept for compatibility)
========================================================= */

router.post("/api/code-block", (req, res) => {
  const { repo_name, file_path, code_snippet, is_ai_generated } = req.body;

  const { isRisky, issues } = scanForRisk(code_snippet);

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
    issues,
  });
});

router.get("/api/code-blocks", (req, res) => {
  const rows = db.prepare("SELECT * FROM code_blocks").all();
  res.json(rows);
});

/* =========================================================
   Manual PR Scan
========================================================= */

router.post("/api/scan-pr", async (req, res) => {
  const { owner, repo, pull_number, installation_id } = req.body;

  if (!owner || !repo || !pull_number) {
    return res.status(400).json({ error: "owner, repo, and pull_number are required" });
  }

  try {
    const report = await scanPullRequest(owner, repo, pull_number, installation_id);

    res.json({
      status: "scanned",
      scanId: report.scanId,
      repository: report.repository,
      pullRequest: report.pullRequest,
      filesScanned: report.filesScanned,
      findingsCount: report.findings.length,
      riskLevel: report.riskLevel,
      trustScore: report.trustScoreResult,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/* =========================================================
   PR Scans — list and detail
========================================================= */

// GET /api/scans?limit=20
router.get("/api/scans", (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const scans = getRecentScans.all(limit);
  res.json({ scans });
});

// GET /api/scans/:id
router.get("/api/scans/:id", (req, res) => {
  const scan = getScanById.get(req.params.id);

  if (!scan) {
    return res.status(404).json({ error: "Scan not found" });
  }

  const findings = getFindingsByScanId.all(scan.id);

  res.json({ scan, findings });
});

// GET /api/scans/:id/findings
router.get("/api/scans/:id/findings", (req, res) => {
  const scan = getScanById.get(req.params.id);

  if (!scan) {
    return res.status(404).json({ error: "Scan not found" });
  }

  const findings = getFindingsByScanId.all(scan.id);
  res.json({ scanId: scan.id, findings });
});

/* =========================================================
   Repository — scans + trust score
========================================================= */

// GET /api/repos/:owner/:repo/scans
router.get("/api/repos/:owner/:repo/scans", (req, res) => {
  const { owner, repo } = req.params;
  const scans = getScansByRepo.all(owner, repo);
  res.json({ owner, repo, scans });
});

// GET /api/repos/:owner/:repo/trust-score
router.get("/api/repos/:owner/:repo/trust-score", (req, res) => {
  const { owner, repo } = req.params;
  const scans = getScansByRepo.all(owner, repo);

  if (scans.length === 0) {
    return res.json({
      owner,
      repo,
      trust_score: 100,
      grade: "A",
      scans_analyzed: 0,
      message: "No scans recorded for this repository.",
    });
  }

  // Average trust score across the last 10 scans
  const recent = scans.slice(0, 10);
  const avgScore = Math.round(
    recent.reduce((sum, s) => sum + s.trust_score, 0) / recent.length
  );

  const grade =
    avgScore >= 90 ? "A" :
    avgScore >= 75 ? "B" :
    avgScore >= 60 ? "C" :
    avgScore >= 40 ? "D" : "F";

  res.json({
    owner,
    repo,
    trust_score: avgScore,
    grade,
    scans_analyzed: recent.length,
    latest_scan: scans[0],
  });
});

/* =========================================================
   Legacy Trust Score (code_blocks based)
========================================================= */

router.get("/api/trust-score/:repo_name", (req, res) => {
  const { repo_name } = req.params;

  const blocks = db
    .prepare("SELECT * FROM code_blocks WHERE repo_name = ?")
    .all(repo_name);

  const result = calculateTrustScoreFromBlocks(blocks);

  res.json({
    repo_name,
    ...result,
  });
});

/* =========================================================
   Analytics
========================================================= */

// GET /api/stats — overall usage metrics
router.get("/api/stats", (req, res) => {
  const totalScans = db.prepare("SELECT COUNT(*) as count FROM pr_scans").get();
  const totalFindings = db.prepare("SELECT COUNT(*) as count FROM findings").get();
  const totalInstallations = db.prepare("SELECT COUNT(*) as count FROM installations WHERE uninstalled_at IS NULL").get();
  const highFindings = db.prepare("SELECT COUNT(*) as count FROM findings WHERE severity = 'HIGH'").get();
  const recentScans = getRecentScans.all(5);

  res.json({
    total_scans: totalScans.count,
    total_findings: totalFindings.count,
    total_high_findings: highFindings.count,
    active_installations: totalInstallations.count,
    recent_scans: recentScans,
  });
});

export default router;