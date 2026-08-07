import { getInstallationOctokit } from "./auth.js";

export async function createReview(
  owner,
  repo,
  pullNumber,
  installationId,
  findings
) {
  const octokit = await getInstallationOctokit(installationId);

  if (!findings || findings.length === 0) {
    console.log("✅ No issues found.");
    return;
  }

  let body = "## 🤖 TRACR AI Review\n\n";

  body += `Found **${findings.length}** potential issue(s).\n\n`;

  findings.forEach((finding, index) => {
    body += `### ${index + 1}. ${finding.icon} ${finding.title}\n`;
    body += `**Severity:** ${finding.severity}\n\n`;
    body += `${finding.message}\n\n`;

    if (finding.file) {
      body += `📄 File: \`${finding.file}\`\n\n`;
    }

    body += "---\n";
  });

  await octokit.rest.pulls.createReview({
    owner,
    repo,
    pull_number: pullNumber,
    event: "COMMENT",
    body,
  });

  console.log("✅ Review successfully posted to GitHub.");
}