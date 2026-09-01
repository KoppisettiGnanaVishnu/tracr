import "dotenv/config";

import { getInstallationOctokit } from "./auth.js";
import { scanPatch, summarizeRisk } from "../services/riskScanner.js";
import { calculateTrustScore } from "../services/trustScore.js";
import { insertScan, insertFinding } from "../database/db.js";
import { getContext } from "../services/astContext.js";
import { enrichFindings } from "../services/aiExplainer.js";

// ==========================================
// Tracr — PR Scanner (Phase 2)
//
// Pipeline:
//   1. Fetch PR metadata (commit SHA, changed files + patches)
//   2. Scan each file's patch line-by-line → per-line findings
//   3. Fetch full file source → extract AST context per finding
//   4. AI explain findings (Gemini) — async, batched, graceful fallback
//   5. Calculate weighted trust score
//   6. Persist scan + enriched findings to DB
//   7. Return full report for reviewer to post
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

  // ── 1. Fetch PR head SHA ────────────────────────────────────────────────────
  const { data: pr } = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: pullNumber,
  });

  const commitSha = pr.head.sha;
  const baseSha   = pr.base.sha;

  console.log(`\n📋 PR #${pullNumber} — Head: ${commitSha.slice(0, 7)} / Base: ${baseSha.slice(0, 7)}`);

  // ── 2. Fetch changed files with patches ─────────────────────────────────────
  const { data: files } = await octokit.rest.pulls.listFiles({
    owner,
    repo,
    pull_number: pullNumber,
    per_page: 100,
  });

  console.log(`📁 Files in PR: ${files.length}`);

  // ── 3. Scan each file line-by-line ──────────────────────────────────────────
  let allFindings = [];

  for (const file of files) {
    if (!file.patch) {
      console.log(`  ⏭  Skipping ${file.filename} (no patch — binary or empty)`);
      continue;
    }

    const fileFindings = scanPatch(file.filename, file.patch);

    if (fileFindings.length > 0) {
      console.log(`  🔍 ${file.filename} → ${fileFindings.length} finding(s)`);
      fileFindings.forEach((f) =>
        console.log(`     Line ${f.line}: [${f.severity}] ${f.title}`)
      );
    } else {
      console.log(`  ✅ ${file.filename} — clean`);
    }

    allFindings = allFindings.concat(fileFindings);
  }

  // ── 4. AST context extraction ───────────────────────────────────────────────
  // Fetch the full source of each file that has findings, then extract context
  // around each finding's line number.
  //
  // We only fetch source for files that actually have findings to avoid
  // unnecessary API calls.

  const contextMap = new Map(); // Map<findingIndex, context>

  if (allFindings.length > 0) {
    console.log(`\n🔬 Extracting AST context for ${allFindings.length} finding(s)...`);

    // Build a set of files we need to fetch
    const filesWithFindings = new Set(allFindings.map((f) => f.file));

    // Fetch source for each file in parallel (max 5 concurrent)
    const sourceCache = new Map(); // filename → source string

    const filesToFetch = files.filter(
      (f) => filesWithFindings.has(f.filename) && f.status !== "removed"
    );

    await Promise.all(
      filesToFetch.map(async (file) => {
        try {
          const { data: content } = await octokit.rest.repos.getContent({
            owner,
            repo,
            path: file.filename,
            ref:  commitSha, // fetch from the PR head commit
          });

          // content.content is base64-encoded
          if (content.encoding === "base64" && content.content) {
            const source = Buffer.from(content.content, "base64").toString("utf8");
            sourceCache.set(file.filename, source);
            console.log(`  📄 Fetched source for ${file.filename} (${source.split("\n").length} lines)`);
          }
        } catch (err) {
          // Non-fatal — file may be too large or unavailable; AST context simply won't be available
          console.warn(`  ⚠️  Could not fetch source for ${file.filename}: ${err.message}`);
        }
      })
    );

    // Now extract context for each finding
    for (let i = 0; i < allFindings.length; i++) {
      const finding = allFindings[i];
      const source  = sourceCache.get(finding.file) ?? null;
      const context = getContext(finding, source);
      contextMap.set(i, context);

      if (context.enclosingFunction) {
        console.log(
          `  🔬 [${finding.file}:${finding.line}] → inside \`${context.enclosingFunction.name}()\` (${context.fileCategory})`
        );
      }
    }
  }

  // ── 5. AI enrichment ────────────────────────────────────────────────────────
  // Call Gemini to generate context-aware explanations and fix suggestions.
  // This step is fully async and degrades gracefully if GEMINI_API_KEY is missing.

  console.log(`\n🤖 Starting AI enrichment...`);
  const enrichedFindings = await enrichFindings(allFindings, contextMap);

  // ── 6. Risk summary & trust score ───────────────────────────────────────────
  const { riskLevel } = summarizeRisk(enrichedFindings);
  const trustScoreResult = calculateTrustScore(enrichedFindings, files.length);

  const severityCounts = { HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };
  for (const f of enrichedFindings) {
    severityCounts[f.severity] = (severityCounts[f.severity] ?? 0) + 1;
  }

  console.log(
    `\n📊 Risk: ${riskLevel} | Trust Score: ${trustScoreResult.score}/100 (${trustScoreResult.grade})`
  );
  console.log(
    `   Findings: ${enrichedFindings.length} total (HIGH: ${severityCounts.HIGH}, MEDIUM: ${severityCounts.MEDIUM}, LOW: ${severityCounts.LOW})`
  );

  // ── 7. Persist to database ──────────────────────────────────────────────────
  let scanId = null;

  try {
    const scanRow = insertScan.run({
      installation_id: installationId ?? null,
      owner,
      repo,
      pull_number:    pullNumber,
      commit_sha:     commitSha,
      files_scanned:  files.length,
      findings_count: enrichedFindings.length,
      high_count:     severityCounts.HIGH,
      medium_count:   severityCounts.MEDIUM,
      low_count:      severityCounts.LOW,
      info_count:     severityCounts.INFO,
      risk_level:     riskLevel,
      trust_score:    trustScoreResult.score,
    });

    scanId = scanRow.lastInsertRowid;
    console.log(`💾 Scan persisted (id=${scanId})`);

    for (const finding of enrichedFindings) {
      insertFinding.run({
        scan_id:        scanId,
        rule_id:        finding.ruleId,
        file:           finding.file,
        line:           finding.line,
        matched_text:   finding.matchedText,
        severity:       finding.severity,
        title:          finding.title,
        message:        finding.message,
        confidence:     finding.confidence,
        cwe:            finding.cwe ?? null,
        ai_explanation: finding.aiExplanation ?? null,
        ai_fix:         finding.aiFix ?? null,
      });
    }

    console.log(`💾 ${enrichedFindings.length} finding(s) persisted.`);
  } catch (dbErr) {
    console.error("⚠️  DB write failed:", dbErr.message);
  }

  // ── 8. Build and return the full report ─────────────────────────────────────
  return {
    scanId,
    repository:       `${owner}/${repo}`,
    pullRequest:      pullNumber,
    commitSha,
    filesScanned:     files.length,
    findings:         enrichedFindings,
    riskLevel,
    trustScoreResult,
    // Legacy fields
    issues:     enrichedFindings,
    trustScore: trustScoreResult.score,
  };
}