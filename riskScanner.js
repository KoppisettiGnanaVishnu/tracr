// Tracr — risk scanner
// Looks at a code snippet and decides if it touches something
// sensitive enough that AI-written, unreviewed code here is dangerous.

const RISKY_PATTERNS = [
  { pattern: /password/i, label: "password handling" },
  { pattern: /token/i, label: "auth token handling" },
  { pattern: /auth/i, label: "authentication logic" },
  { pattern: /login/i, label: "login logic" },
  { pattern: /payment/i, label: "payment handling" },
  { pattern: /delete\s+from/i, label: "database deletion (SQL)" },
  { pattern: /drop\s+table/i, label: "database table deletion" },
  { pattern: /process\.env/i, label: "environment/secret variables" },
  { pattern: /api[_-]?key/i, label: "API key handling" },
];

function scanForRisk(codeSnippet) {
  const matches = RISKY_PATTERNS.filter(({ pattern }) => pattern.test(codeSnippet));

  return {
    isRisky: matches.length > 0,
    reasons: matches.map((m) => m.label),
  };
}

module.exports = { scanForRisk };