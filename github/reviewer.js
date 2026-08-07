import { getInstallationOctokit } from "./auth.js";

export async function createReview(
  owner,
  repo,
  pullNumber,
  installationId,
  findings
) {
  const octokit = await getInstallationOctokit(installationId);

  const issues = findings.issues || [];

  if (issues.length === 0) {
    console.log("✅ No issues found.");
    return;
  }

  let body = "# 🤖 TRACR AI Review\n\n";

  body += `## Repository Summary\n\n`;

  body += `- **Files Scanned:** ${findings.filesScanned}\n`;
  body += `- **Issues Found:** ${issues.length}\n`;
  body += `- **Risk Level:** ${findings.riskLevel}\n`;
  body += `- **Trust Score:** ${findings.trustScore}/100\n\n`;

  body += "---\n\n";

  body += "## Findings\n\n";

  issues.forEach((issue, index) => {
    body += `### ${index + 1}. ${issue.icon} ${issue.title}\n\n`;
    body += `**Severity:** ${issue.severity}\n\n`;
    body += `${issue.message}\n\n`;

    if (issue.file) {
      body += `📄 File: \`${issue.file}\`\n\n`;
    }

    body += "---\n\n";
  });

  body += "_Generated automatically by **TRACR AI**._";

  await octokit.rest.pulls.createReview({
    owner,
    repo,
    pull_number: pullNumber,
    event: "COMMENT",
    body,
  });

  console.log("✅ GitHub Review posted successfully.");
}