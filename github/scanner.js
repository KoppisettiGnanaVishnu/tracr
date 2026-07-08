// Tracr — GitHub integration
// Reads a Pull Request's changed files, runs them through our
// risk scanner, and posts a warning comment back on the PR.

require("dotenv").config();

const { getInstallationOctokit } = require("./auth");
const { scanForRisk } = require("../services/riskScanner");

async function scanPullRequest(owner, repo, pullNumber, installationId) {

  // Create an authenticated GitHub client for THIS installation
  const octokit = await getInstallationOctokit(installationId);

  // 1. Get the list of files changed in this PR
  const { data: files } = await octokit.rest.pulls.listFiles({
    owner,
    repo,
    pull_number: pullNumber,
  });

  let findings = [];

  // 2. Run each changed file's added code through the risk scanner
  for (const file of files) {
    if (!file.patch) continue;

    // Only scan added lines
    const addedLines = file.patch
      .split("\n")
      .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
      .join("\n");

    const { isRisky, reasons } = scanForRisk(addedLines);

    if (isRisky) {
      findings.push({
        file: file.filename,
        reasons,
      });
    }
  }

  // 3. Build the PR comment
  let commentBody;

  if (findings.length === 0) {
    commentBody =
      "✅ **Tracr scan:** No high-risk patterns detected in this PR's changes.";
  } else {
    commentBody =
      "⚠️ **Tracr Risk Warning**\n\n" +
      "This Pull Request contains changes that touch sensitive areas:\n\n";

    findings.forEach((finding) => {
      commentBody += `- **${finding.file}** — ${finding.reasons.join(", ")}\n`;
    });

    commentBody +=
      "\nPlease ensure these changes have been reviewed by a human before merging.";
  }

  // 4. Post the comment on the Pull Request
  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: pullNumber,
    body: commentBody,
  });

  console.log("Posted comment on PR:");
  console.log(commentBody);

  return findings;
}

module.exports = {
  scanPullRequest,
};