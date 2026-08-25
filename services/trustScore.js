// Tracr — Trust Score Calculator (Phase 1)
//
// Computes a weighted risk score per PR from its findings array.
// Severity weights are calibrated to real-world security impact:
//   HIGH   → -15 pts  (credential leak, injection, RCE)
//   MEDIUM → -8  pts  (weak crypto, insecure config, unverified JWT)
//   LOW    → -3  pts  (informational concerns)
//   INFO   →  0  pts  (good-practice observations, no penalty)
//
// Confidence dampening: a HIGH finding with 0.5 confidence
// contributes 7.5 pts penalty instead of 15, proportionally.
//
// File-spread penalty: findings spread across many files indicate
// a systemic issue rather than an isolated mistake.

const SEVERITY_WEIGHTS = {
  HIGH: 15,
  MEDIUM: 8,
  LOW: 3,
  INFO: 0,
};

/**
 * Calculate a 0–100 trust score from an array of findings.
 *
 * @param {Array<Finding>} findings
 * @param {number} filesScanned  - Total files changed in the PR
 * @returns {{ score: number, breakdown: object }}
 */
export function calculateTrustScore(findings, filesScanned = 1) {
  if (!findings || findings.length === 0) {
    return {
      score: 100,
      grade: "A",
      breakdown: {
        penalty: 0,
        high_count: 0,
        medium_count: 0,
        low_count: 0,
        info_count: 0,
        spread_penalty: 0,
      },
    };
  }

  // Base penalty: sum of weighted penalties dampened by confidence
  let basePenalty = 0;

  const counts = { HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };

  for (const finding of findings) {
    const weight = SEVERITY_WEIGHTS[finding.severity] ?? 0;
    const confidence = finding.confidence ?? 1.0;
    basePenalty += weight * confidence;
    counts[finding.severity] = (counts[finding.severity] ?? 0) + 1;
  }

  // File-spread penalty: only applies when HIGH findings span multiple files
  // in a PR that touched more than one file. Max +10 pts penalty.
  const affectedFiles = new Set(findings.map((f) => f.file)).size;
  const spreadPenalty =
    counts.HIGH > 0 && filesScanned > 1 && affectedFiles > 1
      ? Math.round((affectedFiles / filesScanned) * 10)
      : 0;

  const totalPenalty = Math.round(basePenalty) + spreadPenalty;
  const score = Math.max(0, Math.min(100, 100 - totalPenalty));
  const grade = scoreToGrade(score);

  return {
    score,
    grade,
    breakdown: {
      penalty: totalPenalty,
      high_count: counts.HIGH,
      medium_count: counts.MEDIUM,
      low_count: counts.LOW,
      info_count: counts.INFO,
      spread_penalty: spreadPenalty,
    },
  };
}

function scoreToGrade(score) {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 40) return "D";
  return "F";
}

/**
 * Legacy interface used by api.js /api/trust-score endpoint.
 * Accepts the old code_blocks row format.
 * Also exported as calculateTrustScore for backwards compatibility.
 */
export function calculateTrustScoreFromBlocks(blocks) {
  const total = blocks.length;

  if (total === 0) {
    return { score: 100, breakdown: null };
  }

  const aiBlocks = blocks.filter((b) => b.is_ai_generated);
  const humanBlocks = blocks.filter((b) => !b.is_ai_generated);
  const riskyAiBlocks = aiBlocks.filter((b) => b.is_risky);

  const totalBugs = blocks.reduce((sum, b) => sum + (b.bugs_found || 0), 0);
  const totalReverts = blocks.reduce((sum, b) => sum + (b.reverted || 0), 0);

  const riskPenalty =
    aiBlocks.length > 0 ? (riskyAiBlocks.length / aiBlocks.length) * 40 : 0;

  const bugPenalty = (totalBugs / total) * 30;
  const revertPenalty = (totalReverts / total) * 30;

  const score = Math.max(
    0,
    Math.round(100 - (riskPenalty + bugPenalty + revertPenalty))
  );

  return {
    score,
    breakdown: {
      total_blocks: total,
      ai_percentage: Math.round((aiBlocks.length / total) * 100),
      human_percentage: Math.round((humanBlocks.length / total) * 100),
      ai_bugs: aiBlocks.reduce((sum, b) => sum + (b.bugs_found || 0), 0),
      ai_reverts: aiBlocks.reduce((sum, b) => sum + (b.reverted || 0), 0),
      human_bugs: humanBlocks.reduce((sum, b) => sum + (b.bugs_found || 0), 0),
      human_reverts: humanBlocks.reduce((sum, b) => sum + (b.reverted || 0), 0),
    },
  };
}

// Named alias — used by older code that imports calculateTrustScore
// (api.js now explicitly imports calculateTrustScoreFromBlocks)
export { calculateTrustScoreFromBlocks as calculateTrustScoreLegacy };