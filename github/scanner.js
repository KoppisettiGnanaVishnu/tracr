import "dotenv/config";

import { getInstallationOctokit } from "./auth.js";
import { scanForRisk } from "../services/riskScanner.js";
import { formatReviewComment } from "../services/commentFormatter.js";

export async function scanPullRequest(
  owner,
  repo,
  pullNumber,
  installationId
) {
  const octokit = await getInstallationOctokit(installationId);

  const { data: files } = await octokit.rest.pulls.listFiles({
    owner,
    repo,
    pull_number: pullNumber,
  });

  let issues = [];

  for (const file of files) {
    if (!file.patch) continue;

    const addedLines = file.patch
      .split("\n")
      .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
      .join("\n");

    const result = scanForRisk(addedLines);

    if (result.isRisky) {
      result.issues.forEach((issue) => {
        issues.push({
          ...issue,
          file: file.filename,
        });
      });
    }
  }

  // ---------- Summary ----------
  const filesScanned = files.length;

  let riskLevel = "LOW";

  if (issues.some((i) => i.severity === "HIGH")) {
    riskLevel = "HIGH";
  } else if (issues.some((i) => i.severity === "MEDIUM")) {
    riskLevel = "MEDIUM";
  }

  // Temporary trust score (Phase 2 will calculate this properly)
  const trustScore = Math.max(100 - issues.length * 5, 0);

  const report = {
    repository: repo,
    pullRequest: pullNumber,
    filesScanned,
    issues,
    riskLevel,
    trustScore,
  };

  const commentBody = formatReviewComment(report);

  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: pullNumber,
    body: commentBody,
  });

  console.log("\n===== REVIEW REPORT =====");
  console.log(report);
  console.log("=========================\n");

  return report;
}