// Tracr — Comment Formatter (Phase 2)
//
// Two formatters:
//   formatInlineComment(finding)  → rich markdown for a single inline line comment
//                                    Includes AI explanation, why-risky, and fix when available
//   formatSummaryComment(report)  → PR-level summary posted as the review body

// ==========================================
// Risk level display helpers
// ==========================================

const RISK_COLORS = {
  HIGH: "🔴",
  MEDIUM: "🟠",
  LOW: "🟡",
  INFO: "🟢",
};

const GRADE_LABELS = {
  A: "Excellent",
  B: "Good",
  C: "Fair",
  D: "Poor",
  F: "Critical",
};

// ==========================================
// Inline comment — one per finding, posted on the exact line
// ==========================================

/**
 * Formats a rich inline comment for a single finding.
 * This is posted directly on the vulnerable line in the GitHub diff.
 *
 * @param {object} finding
 * @returns {string} GitHub Markdown comment body
 */
export function formatInlineComment(finding) {
  const icon = RISK_COLORS[finding.severity] || "⚪";
  const cweInfo = finding.cwe
    ? ` · [${finding.cwe}](https://cwe.mitre.org/data/definitions/${finding.cwe.replace("CWE-", "")}.html)`
    : "";
  const confidencePct = Math.round((finding.confidence ?? 1) * 100);
  const hasAI = !!(finding.aiExplanation || finding.aiFix);

  let body = "";

  // ── Header ──
  body += `## ${icon} ${finding.title}\n`;
  body += `**Severity:** \`${finding.severity}\`${cweInfo} &nbsp;·&nbsp; **Confidence:** ${confidencePct}%`;
  if (hasAI) body += ` &nbsp;·&nbsp; 🤖 *AI-analyzed*`;
  body += `\n\n`;

  // ── What was detected ──
  body += `**What was detected:**\n`;
  body += `\`\`\`\n${finding.matchedText}\n\`\`\`\n\n`;

  // ── Context-aware AI explanation (Phase 2) ──
  if (finding.aiExplanation) {
    body += `**Why this is risky (AI analysis):**\n`;
    body += `${finding.aiExplanation}\n\n`;
  } else {
    // Fallback to static rule message
    body += `**Why this is risky:**\n`;
    body += `${finding.message}\n\n`;
  }

  // ── AI real-world impact (Phase 2) ──
  if (finding.aiWhyRisky) {
    body += `**Real-world impact:**\n`;
    body += `${finding.aiWhyRisky}\n\n`;
  }

  // ── Fix suggestion ──
  if (finding.aiFix) {
    body += `**Recommended fix:**\n`;
    body += `${finding.aiFix}\n\n`;
  } else {
    body += `**How to fix:**\n`;
    body += `${getGenericFix(finding.ruleId)}\n\n`;
  }

  body += `---\n*🛡️ [Tracr](https://github.com/apps/tracr-ai) · Automated Security Review*`;

  return body;
}

// ==========================================
// PR-level summary — posted as the review body
// ==========================================

/**
 * Formats the overall PR review summary.
 *
 * @param {object} report
 * @param {string} report.repository
 * @param {number} report.pullRequest
 * @param {number} report.filesScanned
 * @param {Array}  report.findings
 * @param {string} report.riskLevel
 * @param {object} report.trustScoreResult  { score, grade, breakdown }
 * @returns {string} GitHub Markdown review body
 */
export function formatSummaryComment(report) {
  const { repository, pullRequest, filesScanned, findings, riskLevel, trustScoreResult } = report;

  const riskIcon = RISK_COLORS[riskLevel] || "⚪";
  const { score, grade, breakdown } = trustScoreResult;
  const gradeLabel = GRADE_LABELS[grade] || "";
  const hasFindings = findings.length > 0;

  // ── Header ──
  let md = `# 🛡️ Tracr Security Review\n\n`;
  md += `> Automated security analysis for **${repository}** · PR #${pullRequest}\n\n`;
  md += `---\n\n`;

  // ── Summary table ──
  md += `## 📊 Summary\n\n`;
  md += `| Metric | Value |\n`;
  md += `|--------|-------|\n`;
  md += `| Files Scanned | **${filesScanned}** |\n`;
  md += `| Findings | **${findings.length}** |\n`;
  md += `| Overall Risk | ${riskIcon} **${riskLevel}** |\n`;
  md += `| Trust Score | **${score}/100** (Grade **${grade}** — ${gradeLabel}) |\n`;

  if (breakdown) {
    if (breakdown.high_count > 0)   md += `| 🔴 HIGH | **${breakdown.high_count}** |\n`;
    if (breakdown.medium_count > 0) md += `| 🟠 MEDIUM | **${breakdown.medium_count}** |\n`;
    if (breakdown.low_count > 0)    md += `| 🟡 LOW | **${breakdown.low_count}** |\n`;
    if (breakdown.info_count > 0)   md += `| 🟢 INFO | **${breakdown.info_count}** |\n`;
  }

  md += `\n`;

  // ── Findings section ──
  if (!hasFindings) {
    md += `## ✅ No Security Findings\n\n`;
    md += `No security vulnerabilities were detected in the changes introduced by this Pull Request.\n\n`;
  } else {
    md += `## 🔍 Findings\n\n`;
    md += `> Inline comments have been posted directly on each vulnerable line in the diff.\n\n`;

    // Group findings by file
    const byFile = {};
    for (const f of findings) {
      if (!byFile[f.file]) byFile[f.file] = [];
      byFile[f.file].push(f);
    }

    for (const [file, fileFindings] of Object.entries(byFile)) {
      md += `### 📄 \`${file}\`\n\n`;

      for (const f of fileFindings) {
        const icon = RISK_COLORS[f.severity] || "⚪";
        md += `- ${icon} **${f.title}** — Line ${f.line} · \`${f.severity}\` · Confidence ${Math.round((f.confidence ?? 1) * 100)}%\n`;
      }

      md += `\n`;
    }
  }

  // ── Trust score explanation ──
  md += `---\n\n`;
  md += `## 🏆 Trust Score: ${score}/100 (${grade})\n\n`;

  if (score === 100) {
    md += `This PR has no security findings. The codebase maintains a clean security posture for these changes.\n\n`;
  } else {
    md += `The trust score reflects the severity and confidence of detected findings.\n\n`;
    md += `| Component | Value |\n`;
    md += `|-----------|-------|\n`;
    md += `| Base Penalty | -${breakdown?.penalty ?? 0} pts |\n`;
    if (breakdown?.spread_penalty > 0) {
      md += `| Spread Penalty (findings across multiple files) | -${breakdown.spread_penalty} pts |\n`;
    }
    md += `| Final Score | **${score}/100** |\n`;
    md += `\n`;
  }

  md += `---\n`;
  md += `*🛡️ Generated by [Tracr](https://github.com/apps/tracr-ai) · AI-assisted PR security analysis*`;

  return md;
}

// ==========================================
// Generic fix hints (until Phase 2 AI fixes)
// ==========================================

function getGenericFix(ruleId) {
  const hints = {
    "hardcoded-password":   "Move the value to an environment variable (e.g., `process.env.DB_PASSWORD`).",
    "hardcoded-api-key":    "Store API keys in environment variables or a secrets manager, never in source code.",
    "hardcoded-secret":     "Use environment variables or a secrets manager for all secret values.",
    "hardcoded-token":      "Store tokens in environment variables. Rotate any exposed token immediately.",
    "sql-injection":        "Use parameterized queries or an ORM to prevent SQL injection.",
    "eval-usage":           "Replace `eval()` with safer alternatives such as JSON.parse() or a sandboxed evaluator.",
    "command-injection":    "Validate and sanitize all inputs before passing them to shell commands. Use allowlists.",
    "jwt-no-verify":        "Replace `jwt.decode()` with `jwt.verify(secret)` to cryptographically validate the token.",
    "drop-table":           "Ensure DROP TABLE operations are guarded by authorization checks and transaction safety.",
    "delete-without-where": "Add a WHERE clause to scope the deletion. A DELETE without WHERE removes all rows.",
    "delete-statement":     "Verify that authorization checks protect this DELETE path.",
    "weak-hash-md5":        "Replace MD5/SHA-1 with SHA-256 for data integrity, or bcrypt/argon2 for passwords.",
    "http-not-https":       "Use HTTPS for all external connections to prevent plaintext interception.",
    "cors-wildcard":        "Restrict CORS origins to a known allowlist of trusted domains.",
  };
  return hints[ruleId] || "Review the flagged code against secure coding best practices.";
}

// ==========================================
// Legacy export — kept for compatibility
// ==========================================

export function formatReviewComment(report) {
  return formatSummaryComment({
    ...report,
    findings: report.issues || [],
    trustScoreResult: {
      score: report.trustScore ?? 100,
      grade: "B",
      breakdown: null,
    },
  });
}