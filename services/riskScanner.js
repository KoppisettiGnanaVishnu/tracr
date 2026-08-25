// ==========================================
// TRACR Security Rule Engine (Phase 1)
// ==========================================
//
// This module parses a raw git patch (the "patch" field from GitHub's
// PR files API) and returns one finding per vulnerable line, with:
//   - exact file line number (tracked from hunk headers)
//   - the matched text snippet
//   - severity, title, message, and confidence

// ==========================================
// Rule Definitions
// ==========================================

const RULES = [
  {
    id: "hardcoded-password",
    regex: /password\s*[:=]\s*["'`][^"'`]{2,}["'`]/i,
    severity: "HIGH",
    icon: "🔴",
    title: "Hardcoded Password",
    message:
      "A hardcoded password was found in source code. Credentials committed to a repository are permanently visible in git history, even after deletion. Move this to an environment variable.",
    confidence: 0.9,
    cwe: "CWE-259",
  },

  {
    id: "hardcoded-api-key",
    regex: /api[_-]?key\s*[:=]\s*["'`][^"'`]{6,}["'`]/i,
    severity: "HIGH",
    icon: "🔴",
    title: "Hardcoded API Key",
    message:
      "An API key was found hardcoded in source code. API keys in version control are frequently discovered by automated scanners. Use environment variables or a secrets manager.",
    confidence: 0.9,
    cwe: "CWE-798",
  },

  {
    id: "hardcoded-secret",
    regex: /secret\s*[:=]\s*["'`][^"'`]{4,}["'`]/i,
    severity: "HIGH",
    icon: "🔴",
    title: "Hardcoded Secret",
    message:
      "A hardcoded secret value was detected. Secrets embedded in source code can be extracted from repositories and used to compromise systems.",
    confidence: 0.85,
    cwe: "CWE-798",
  },

  {
    id: "hardcoded-token",
    regex: /token\s*[:=]\s*["'`][A-Za-z0-9_\-\.]{10,}["'`]/i,
    severity: "HIGH",
    icon: "🔴",
    title: "Hardcoded Token",
    message:
      "A hardcoded token was detected. Access tokens committed to repositories expose authentication and authorization controls to anyone with read access.",
    confidence: 0.85,
    cwe: "CWE-798",
  },

  {
    id: "sql-injection",
    regex: /(?:select|insert|update|delete)\s+.{0,60}(?:\+\s*\w+|\$\{[^}]+\}|`[^`]*\$\{)/is,
    severity: "HIGH",
    icon: "🔴",
    title: "Possible SQL Injection",
    message:
      "A SQL query appears to concatenate or interpolate a variable directly into the query string. This allows an attacker to manipulate the query. Use parameterized queries or prepared statements.",
    confidence: 0.8,
    cwe: "CWE-89",
  },

  {
    id: "eval-usage",
    regex: /\beval\s*\(/i,
    severity: "HIGH",
    icon: "🔴",
    title: "Dangerous eval() Usage",
    message:
      "eval() executes arbitrary JavaScript code from a string. If the input is controlled by an attacker, this is a direct code execution vulnerability. Avoid eval() in all production code.",
    confidence: 0.95,
    cwe: "CWE-95",
  },

  {
    id: "command-injection",
    regex: /\b(?:exec|execSync|spawn|spawnSync)\s*\(/i,
    severity: "HIGH",
    icon: "🔴",
    title: "Possible Command Injection",
    message:
      "A shell execution function was detected. If user-supplied input reaches this call without strict validation and sanitization, an attacker can execute arbitrary OS commands.",
    confidence: 0.75,
    cwe: "CWE-78",
  },

  {
    id: "jwt-no-verify",
    regex: /jwt\.decode\s*\(/i,
    severity: "MEDIUM",
    icon: "🟠",
    title: "JWT Decoded Without Verification",
    message:
      "jwt.decode() only decodes the token payload without verifying the signature, allowing a forged token to pass authentication. Use jwt.verify() with the shared secret or public key.",
    confidence: 0.95,
    cwe: "CWE-347",
  },

  {
    id: "drop-table",
    regex: /\bdrop\s+table\b/i,
    severity: "HIGH",
    icon: "🔴",
    title: "Destructive DDL — DROP TABLE",
    message:
      "A DROP TABLE statement was detected. This permanently deletes a database table and all its data. Verify this is intentional and is protected by appropriate authorization checks and a backup strategy.",
    confidence: 0.98,
    cwe: "CWE-89",
  },

  {
    id: "delete-without-where",
    regex: /delete\s+from\s+\w+\s*(?:;|$)/i,
    severity: "HIGH",
    icon: "🔴",
    title: "DELETE Without WHERE Clause",
    message:
      "A DELETE statement was detected with no WHERE clause, which will delete every row in the table. Add a WHERE condition to scope the deletion.",
    confidence: 0.85,
    cwe: "CWE-89",
  },

  {
    id: "delete-statement",
    regex: /delete\s+from/i,
    severity: "MEDIUM",
    icon: "🟠",
    title: "Database DELETE Operation",
    message:
      "A DELETE statement was detected. Ensure this operation is protected by authorization checks and that your backup and recovery policies are in place.",
    confidence: 0.7,
    cwe: "CWE-89",
  },

  {
    id: "weak-hash-md5",
    regex: /\b(?:md5|sha1)\s*\(/i,
    severity: "MEDIUM",
    icon: "🟠",
    title: "Weak Cryptographic Hash",
    message:
      "MD5 and SHA-1 are cryptographically broken and must not be used for passwords, signatures, or security-sensitive data. Use SHA-256, SHA-3, or bcrypt/argon2 for passwords.",
    confidence: 0.85,
    cwe: "CWE-327",
  },

  {
    id: "http-not-https",
    regex: /['"`]http:\/\/(?!localhost|127\.0\.0\.1)/i,
    severity: "MEDIUM",
    icon: "🟠",
    title: "Insecure HTTP URL",
    message:
      "A non-HTTPS URL was detected for an external host. HTTP transmits data in plaintext and is vulnerable to interception. Use HTTPS for all external communications.",
    confidence: 0.8,
    cwe: "CWE-319",
  },

  {
    id: "cors-wildcard",
    regex: /cors\s*\(\s*\{[^}]*origin\s*:\s*['"]\*['"]/i,
    severity: "MEDIUM",
    icon: "🟠",
    title: "CORS Wildcard Origin",
    message:
      "CORS is configured to allow all origins (*). This allows any website to make cross-origin requests to this API. Restrict origins to trusted domains in production.",
    confidence: 0.9,
    cwe: "CWE-942",
  },

  {
    id: "env-var-good-practice",
    regex: /process\.env\.[A-Z_]{3,}/,
    severity: "INFO",
    icon: "🟢",
    title: "Environment Variable Usage",
    message:
      "Environment variables are being used for configuration — this is good practice for keeping secrets out of source code.",
    confidence: 1.0,
    cwe: null,
  },
];

// ==========================================
// Hunk Header Parser
// ==========================================
// Git patch hunk headers look like: @@ -10,7 +14,8 @@
// The "+14" tells us the starting line number in the new file.

function parseHunkHeader(line) {
  const match = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
  if (match) {
    return parseInt(match[1], 10);
  }
  return null;
}

// ==========================================
// Main Scanner
// ==========================================

/**
 * Scans a single file's git patch and returns an array of per-line findings.
 *
 * @param {string} filename - The file path (e.g. "src/auth.js")
 * @param {string} patch    - The raw git patch string from GitHub API
 * @returns {Array<Finding>}
 */
export function scanPatch(filename, patch) {
  if (!patch) return [];

  const findings = [];
  const lines = patch.split("\n");
  let currentNewLine = 0;

  for (const line of lines) {
    // Track line numbers from hunk headers
    const hunkStart = parseHunkHeader(line);
    if (hunkStart !== null) {
      currentNewLine = hunkStart;
      continue;
    }

    // Skip removed lines and context lines — only scan additions
    if (line.startsWith("-")) continue;

    if (line.startsWith("+") && !line.startsWith("+++")) {
      // Strip the leading '+' before scanning
      const codeLine = line.slice(1);

      for (const rule of RULES) {
        const match = codeLine.match(rule.regex);
        if (match) {
          // Avoid duplicate findings for the same rule on the same line
          const alreadyFound = findings.some(
            (f) => f.file === filename && f.line === currentNewLine && f.ruleId === rule.id
          );

          if (!alreadyFound) {
            findings.push({
              ruleId: rule.id,
              file: filename,
              line: currentNewLine,
              matchedText: match[0].trim(),
              severity: rule.severity,
              icon: rule.icon,
              title: rule.title,
              message: rule.message,
              confidence: rule.confidence,
              cwe: rule.cwe,
              // These fields will be populated by the AI layer in Phase 2
              aiExplanation: null,
              aiFix: null,
            });
          }
        }
      }

      currentNewLine++;
    } else if (!line.startsWith("-")) {
      // Context lines (no leading + or -) also advance the new-file line counter
      currentNewLine++;
    }
  }

  return findings;
}

/**
 * Quick risk summary from an array of findings.
 *
 * @param {Array<Finding>} findings
 * @returns {{ riskLevel: string, hasFindings: boolean }}
 */
export function summarizeRisk(findings) {
  if (findings.length === 0) {
    return { riskLevel: "LOW", hasFindings: false };
  }

  const severities = findings.map((f) => f.severity);

  if (severities.includes("HIGH")) return { riskLevel: "HIGH", hasFindings: true };
  if (severities.includes("MEDIUM")) return { riskLevel: "MEDIUM", hasFindings: true };
  return { riskLevel: "LOW", hasFindings: true };
}

// Keep the old export for backwards compatibility with api.js (Phase 1 bridge)
export function scanForRisk(codeSnippet) {
  const fakePatch = codeSnippet
    .split("\n")
    .map((l) => `+${l}`)
    .join("\n");

  const findings = scanPatch("unknown", fakePatch);

  return {
    isRisky: findings.length > 0,
    issues: findings.map((f) => ({
      severity: f.severity,
      icon: f.icon,
      title: f.title,
      message: f.message,
    })),
  };
}