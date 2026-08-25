import { getInstallationOctokit } from "./auth.js";
import { formatInlineComment, formatSummaryComment } from "../services/commentFormatter.js";

// ==========================================
// Tracr — GitHub Reviewer (Phase 1)
//
// Posts two types of comments on a Pull Request:
//   1. Inline review comments — one per finding, on the exact diff line
//   2. PR-level summary review — overall risk, trust score, findings table
// ==========================================

/**
 * Post inline review comments + summary review for all findings.
 *
 * @param {string}  owner
 * @param {string}  repo
 * @param {number}  pullNumber
 * @param {string}  installationId
 * @param {object}  report  — { repository, pullRequest, filesScanned, findings, riskLevel, trustScoreResult, commitSha }
 */
export async function createReview(
  owner,
  repo,
  pullNumber,
  installationId,
  report
) {
  const octokit = await getInstallationOctokit(installationId);

  const findings = report.findings || [];
  const commitSha = report.commitSha;

  // ── 1. Build inline comments for HIGH/MEDIUM findings ──────────────────────
  // GitHub only accepts inline comments on lines that appear in the PR diff.
  // We only post inline comments for HIGH and MEDIUM severity to avoid noise.
  const inlineComments = [];

  const inlineCandidates = findings.filter(
    (f) => f.severity === "HIGH" || f.severity === "MEDIUM"
  );

  for (const finding of inlineCandidates) {
    if (!finding.line || !commitSha) continue;

    inlineComments.push({
      path: finding.file,
      line: finding.line,
      side: "RIGHT",
      body: formatInlineComment(finding),
    });
  }

  // ── 2. Build PR-level summary body ─────────────────────────────────────────
  const summaryBody = formatSummaryComment(report);

  // ── 3. Post the full review (summary + inline comments in one API call) ────
  // Using pulls.createReview allows us to post inline comments atomically
  // with the review body, which is cleaner than separate API calls.
  try {
    const reviewPayload = {
      owner,
      repo,
      pull_number: pullNumber,
      commit_id: commitSha,
      body: summaryBody,
      event: "COMMENT",
    };

    if (inlineComments.length > 0) {
      reviewPayload.comments = inlineComments;
    }

    await octokit.rest.pulls.createReview(reviewPayload);

    console.log(
      `✅ Review posted: ${inlineComments.length} inline comment(s) + summary.`
    );
  } catch (err) {
    // If inline comments fail (e.g. line not in diff), fall back to summary-only
    console.warn(
      "⚠️  Inline comments failed, falling back to summary-only review."
    );
    console.warn(err.message);

    await octokit.rest.pulls.createReview({
      owner,
      repo,
      pull_number: pullNumber,
      commit_id: commitSha,
      body: summaryBody,
      event: "COMMENT",
    });

    console.log("✅ Summary-only review posted.");
  }
}