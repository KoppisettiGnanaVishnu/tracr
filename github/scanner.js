import "dotenv/config";

import { getInstallationOctokit } from "./auth.js";
import { scanPatch, summarizeRisk } from "../services/riskScanner.js";
import { calculateTrustScore } from "../services/trustScore.js";
import { insertScan, insertFinding } from "../database/db.js";

// ==========================================
// Tracr — PR Scanner (Phase 1)
//
// Orchestrates the full analysis pipeline for a Pull Request:
//   1. Fetch PR metadata (commit SHA, changed files + patches)
//   2. Scan each file's patch line-by-line for security findings
//   3. Calculate trust score from findings
//   4. Persist scan + findings to the database
//   5. Return the full report for the reviewer to post
// ==========================================

/**
 * Scan a Pull Request and return a complete report.
 *
 * @param {string} owner
 * @param {string} repo
 * @param {number} pullNumber
 * @param {string} installationId
 * @returns {Promise<Report>}
 */
export async function scanPullRequest(owner, repo, pullNumber, installationId) {
  const octokit = await getInstallationOctokit(installationId);

  // ── 1. Fetch the PR to get the head commit SHA ──────────────────────────────
  // The commit SHA is required for posting inline review comments.
  const { data: pr } = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: pullNumber,
  });

  const commitSha = pr.head.sha;

  console.log(`\n📋 PR #${pullNumber} — Head SHA: ${commitSha}`);

  // ── 2. Fetch all changed files with their patches ──────────────────────────
  const { data: files } = await octokit.rest.pulls.listFiles({
    owner,
    repo,
    pull_number: pullNumber,
    per_page: 100,
  });

  console.log(`📁 Files in PR: ${files.length}`);

  // ── 3. Scan each file line-by-line ─────────────────────────────────────────
  let allFindings = [];

  for (const file of files) {
    // Binary files and deletions have no patch
    if (!file.patch) {
      console.log(`  ⏭  Skipping ${file.filename} (no patch)`);
      continue;
    }

    const fileFindings = scanPatch(file.filename, file.patch);

    if (fileFindings.length > 0) {
      console.log(
        `  🔍 ${file.filename} → ${fileFindings.length} finding(s)`
      );
      fileFindings.forEach((f) =>
        console.log(`     Line ${f.line}: [${f.severity}] ${f.title}`)
      );
    } else {
      console.log(`  ✅ ${file.filename} — clean`);
    }

    allFindings = allFindings.concat(fileFindings);
  }

  // ── 4. Risk summary & trust score ──────────────────────────────────────────
  const { riskLevel } = summarizeRisk(allFindings);
  const trustScoreResult = calculateTrustScore(allFindings, files.length);

  const severityCounts = { HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };
  for (const f of allFindings) {
    severityCounts[f.severity] = (severityCounts[f.severity] ?? 0) + 1;
  }

  console.log(`\n📊 Risk: ${riskLevel} | Trust Score: ${trustScoreResult.score}/100 (${trustScoreResult.grade})`);
  console.log(`   Findings: ${allFindings.length} total (HIGH: ${severityCounts.HIGH}, MEDIUM: ${severityCounts.MEDIUM}, LOW: ${severityCounts.LOW}, INFO: ${severityCounts.INFO})`);

  // ── 5. Persist to database ─────────────────────────────────────────────────
  let scanId = null;

  try {
    const scanRow = insertScan.run({
      installation_id: installationId ?? null,
      owner,
      repo,
      pull_number: pullNumber,
      commit_sha: commitSha,
      files_scanned: files.length,
      findings_count: allFindings.length,
      high_count: severityCounts.HIGH,
      medium_count: severityCounts.MEDIUM,
      low_count: severityCounts.LOW,
      info_count: severityCounts.INFO,
      risk_level: riskLevel,
      trust_score: trustScoreResult.score,
    });

    scanId = scanRow.lastInsertRowid;
    console.log(`💾 Scan persisted (id=${scanId})`);

    for (const finding of allFindings) {
      insertFinding.run({
        scan_id: scanId,
        rule_id: finding.ruleId,
        file: finding.file,
        line: finding.line,
        matched_text: finding.matchedText,
        severity: finding.severity,
        title: finding.title,
        message: finding.message,
        confidence: finding.confidence,
        cwe: finding.cwe ?? null,
      });
    }

    console.log(`💾 ${allFindings.length} finding(s) persisted.`);
  } catch (dbErr) {
    // DB errors should not block the GitHub review from being posted
    console.error("⚠️  DB write failed:", dbErr.message);
  }

  // ── 6. Build and return the full report ────────────────────────────────────
  return {
    scanId,
    repository: `${owner}/${repo}`,
    pullRequest: pullNumber,
    commitSha,
    filesScanned: files.length,
    findings: allFindings,
    riskLevel,
    trustScoreResult,
    // Legacy fields kept so existing routes don't break
    issues: allFindings,
    trustScore: trustScoreResult.score,
  };
}