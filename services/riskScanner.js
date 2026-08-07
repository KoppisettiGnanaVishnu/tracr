// ==========================================
// TRACR Security Rule Engine (Phase 2)
// ==========================================

const RULES = [
  {
    regex: /password\s*[:=]\s*["'`][^"'`]+["'`]/i,
    severity: "HIGH",
    icon: "🔴",
    title: "Hardcoded Password",
    message:
      "Hardcoded password detected. Move credentials to environment variables.",
  },

  {
    regex: /api[_-]?key\s*[:=]\s*["'`][^"'`]+["'`]/i,
    severity: "HIGH",
    icon: "🔴",
    title: "Hardcoded API Key",
    message:
      "Hardcoded API key detected. Never commit API keys into source code.",
  },

  {
    regex: /select\s+.*from.*\+\s*\w+/is,
    severity: "HIGH",
    icon: "🔴",
    title: "Possible SQL Injection",
    message:
      "SQL query appears to concatenate user input. Use parameterized queries.",
  },

  {
    regex: /\beval\s*\(/i,
    severity: "MEDIUM",
    icon: "🟠",
    title: "Dangerous use of eval()",
    message:
      "Avoid eval(). It can execute arbitrary code supplied by an attacker.",
  },

  {
    regex: /\bexec\s*\(/i,
    severity: "HIGH",
    icon: "🔴",
    title: "Possible Command Injection",
    message:
      "exec() can execute arbitrary shell commands. Validate all inputs.",
  },

  {
    regex: /jwt\.decode\s*\(/i,
    severity: "MEDIUM",
    icon: "🟠",
    title: "JWT decoded without verification",
    message:
      "Use jwt.verify() instead of jwt.decode() when validating authentication tokens.",
  },

  {
    regex: /drop\s+table/i,
    severity: "HIGH",
    icon: "🔴",
    title: "Database Table Deletion",
    message:
      "DROP TABLE statement detected. Verify this operation carefully.",
  },

  {
    regex: /delete\s+from/i,
    severity: "MEDIUM",
    icon: "🟠",
    title: "Database Delete Operation",
    message:
      "DELETE statement detected. Ensure authorization and backup policies are followed.",
  },

  {
    regex: /process\.env/i,
    severity: "LOW",
    icon: "🟢",
    title: "Environment Variables",
    message:
      "Uses environment variables, which is generally a secure practice.",
  }
];

export function scanForRisk(codeSnippet) {

  const issues = [];

  for (const rule of RULES) {
    if (rule.regex.test(codeSnippet)) {

      issues.push({
        severity: rule.severity,
        icon: rule.icon,
        title: rule.title,
        message: rule.message,
      });

    }
  }

  return {
    isRisky: issues.length > 0,
    issues,
  };
}