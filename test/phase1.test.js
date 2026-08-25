// ==========================================
// TRACR Phase 1 — Test Suite
// Tests all scanner logic without needing GitHub
//
// Run with: node test/phase1.test.js
// ==========================================

import { scanPatch, summarizeRisk } from "../services/riskScanner.js";
import { calculateTrustScore } from "../services/trustScore.js";
import { formatInlineComment, formatSummaryComment } from "../services/commentFormatter.js";

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ❌ ${name}`);
    console.log(`     → ${err.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed");
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected "${expected}", got "${actual}"`);
  }
}

// ==========================================
// Helper: build a minimal git patch
// ==========================================
function makePatch(lines, startLine = 1) {
  const body = lines.map(l => `+${l}`).join("\n");
  return `@@ -0,0 +${startLine},${lines.length} @@\n${body}`;
}

// ==========================================
// SUITE 1: riskScanner — line detection
// ==========================================

console.log("\n══════════════════════════════════════════");
console.log("  Suite 1: riskScanner — Line Detection");
console.log("══════════════════════════════════════════");

test("Detects hardcoded password on correct line", () => {
  const patch = makePatch([
    "const express = require('express');",
    "const db = require('./db');",
    "const password = \"admin123\";",   // line 3
  ]);
  const findings = scanPatch("src/auth.js", patch);
  const pw = findings.find(f => f.ruleId === "hardcoded-password");
  assert(pw, "No hardcoded-password finding");
  assertEqual(pw.line, 3, "line number");
  assertEqual(pw.file, "src/auth.js", "file name");
  assert(pw.matchedText.includes("admin123"), "matchedText should include the value");
});

test("Detects hardcoded API key", () => {
  const patch = makePatch(['const apiKey = "sk-abc123xyz789DEF";']);
  const findings = scanPatch("config.js", patch);
  const f = findings.find(f => f.ruleId === "hardcoded-api-key");
  assert(f, "No hardcoded-api-key finding");
  assertEqual(f.severity, "HIGH", "severity");
  assert(f.cwe === "CWE-798", "CWE should be CWE-798");
});

test("Detects SQL injection via string concatenation", () => {
  const patch = makePatch([
    'const q = "SELECT * FROM users WHERE id = " + userId;',
  ]);
  const findings = scanPatch("db.js", patch);
  const f = findings.find(f => f.ruleId === "sql-injection");
  assert(f, "No sql-injection finding");
  assertEqual(f.severity, "HIGH", "severity");
});

test("Detects SQL injection via template literal", () => {
  const patch = makePatch([
    "const q = `SELECT * FROM orders WHERE user = ${req.params.id}`;",
  ]);
  const findings = scanPatch("db.js", patch);
  const f = findings.find(f => f.ruleId === "sql-injection");
  assert(f, "No sql-injection finding for template literal");
});

test("Detects eval() usage", () => {
  const patch = makePatch(["eval(userInput);"]);
  const findings = scanPatch("util.js", patch);
  const f = findings.find(f => f.ruleId === "eval-usage");
  assert(f, "No eval-usage finding");
  assertEqual(f.confidence, 0.95, "confidence should be 0.95");
});

test("Detects exec() command injection", () => {
  const patch = makePatch(["const result = exec(userInput);"]);
  const findings = scanPatch("shell.js", patch);
  const f = findings.find(f => f.ruleId === "command-injection");
  assert(f, "No command-injection finding");
});

test("Detects JWT decode without verify", () => {
  const patch = makePatch(["const payload = jwt.decode(token);"]);
  const findings = scanPatch("auth.js", patch);
  const f = findings.find(f => f.ruleId === "jwt-no-verify");
  assert(f, "No jwt-no-verify finding");
  assertEqual(f.severity, "MEDIUM", "severity should be MEDIUM");
});

test("Detects DROP TABLE", () => {
  const patch = makePatch(["DROP TABLE users;"]);
  const findings = scanPatch("migration.js", patch);
  const f = findings.find(f => f.ruleId === "drop-table");
  assert(f, "No drop-table finding");
  assertEqual(f.confidence, 0.98, "confidence");
});

test("Detects weak MD5 hash", () => {
  const patch = makePatch(["const hash = md5(password);"]);
  const findings = scanPatch("crypto.js", patch);
  const f = findings.find(f => f.ruleId === "weak-hash-md5");
  assert(f, "No weak-hash-md5 finding");
});

test("Detects HTTP (non-HTTPS) URL", () => {
  const patch = makePatch(['const API = "http://api.example.com/v1";']);
  const findings = scanPatch("api.js", patch);
  const f = findings.find(f => f.ruleId === "http-not-https");
  assert(f, "No http-not-https finding");
});

test("Detects CORS wildcard", () => {
  const patch = makePatch(['app.use(cors({ origin: "*" }));']);
  const findings = scanPatch("server.js", patch);
  const f = findings.find(f => f.ruleId === "cors-wildcard");
  assert(f, "No cors-wildcard finding");
});

test("Does NOT flag localhost HTTP URLs", () => {
  const patch = makePatch(['const API = "http://localhost:3000/api";']);
  const findings = scanPatch("dev.js", patch);
  const f = findings.find(f => f.ruleId === "http-not-https");
  assert(!f, "localhost HTTP should NOT be flagged");
});

test("Does NOT flag process.env usage as risky", () => {
  const patch = makePatch(["const pw = process.env.DB_PASSWORD;"]);
  const findings = scanPatch("config.js", patch);
  const risky = findings.filter(f => f.severity === "HIGH" || f.severity === "MEDIUM");
  assert(risky.length === 0, "process.env should not produce HIGH/MEDIUM findings");
});

test("Does NOT flag removed lines (- lines in patch)", () => {
  const patch = `@@ -1,3 +1,2 @@
-const password = "old_secret";
+const password = process.env.DB_PASSWORD;
 const user = "admin";`;
  const findings = scanPatch("auth.js", patch);
  const pw = findings.find(f => f.ruleId === "hardcoded-password");
  assert(!pw, "Removed lines should not produce findings");
});

test("Correctly tracks line numbers across multiple hunks", () => {
  const patch = `@@ -1,3 +1,3 @@
 const a = 1;
 const b = 2;
+const password = "secret1";
@@ -20,3 +20,3 @@
 function foo() {
+const apiKey = "key-xyz-123456";
 }`;
  const findings = scanPatch("multi.js", patch);
  const pw = findings.find(f => f.ruleId === "hardcoded-password");
  const ak = findings.find(f => f.ruleId === "hardcoded-api-key");
  assert(pw, "Should detect password in first hunk");
  assertEqual(pw.line, 3, "Password should be on line 3");
  assert(ak, "Should detect API key in second hunk");
  assertEqual(ak.line, 21, "API key should be on line 21");
});

test("Returns empty array for null/empty patch", () => {
  assertEqual(scanPatch("x.js", null).length, 0, "null patch");
  assertEqual(scanPatch("x.js", "").length, 0, "empty patch");
});

test("No duplicate findings for same rule on same line", () => {
  const patch = makePatch(['const password = "abc123"; // password = "xyz"']);
  const findings = scanPatch("dup.js", patch);
  const pwFindings = findings.filter(f => f.ruleId === "hardcoded-password");
  assert(pwFindings.length === 1, `Expected 1 finding, got ${pwFindings.length}`);
});

// ==========================================
// SUITE 2: summarizeRisk
// ==========================================

console.log("\n══════════════════════════════════════════");
console.log("  Suite 2: summarizeRisk");
console.log("══════════════════════════════════════════");

test("Empty findings → LOW risk", () => {
  const { riskLevel, hasFindings } = summarizeRisk([]);
  assertEqual(riskLevel, "LOW", "riskLevel");
  assertEqual(hasFindings, false, "hasFindings");
});

test("Only MEDIUM findings → MEDIUM risk", () => {
  const { riskLevel } = summarizeRisk([{ severity: "MEDIUM" }, { severity: "MEDIUM" }]);
  assertEqual(riskLevel, "MEDIUM", "riskLevel");
});

test("Mix of HIGH and MEDIUM → HIGH risk", () => {
  const { riskLevel } = summarizeRisk([{ severity: "MEDIUM" }, { severity: "HIGH" }]);
  assertEqual(riskLevel, "HIGH", "riskLevel");
});

// ==========================================
// SUITE 3: calculateTrustScore
// ==========================================

console.log("\n══════════════════════════════════════════");
console.log("  Suite 3: calculateTrustScore");
console.log("══════════════════════════════════════════");

test("No findings → score 100, grade A", () => {
  const result = calculateTrustScore([], 5);
  assertEqual(result.score, 100, "score");
  assertEqual(result.grade, "A", "grade");
});

test("One HIGH finding (confidence 1.0) → score 85, grade B", () => {
  const result = calculateTrustScore([{ severity: "HIGH", confidence: 1.0, file: "a.js" }], 1);
  assertEqual(result.score, 85, "score"); // 100 - 15
  assertEqual(result.grade, "B", "grade");
});

test("Confidence dampening: HIGH at 0.5 confidence → score 92", () => {
  const result = calculateTrustScore([{ severity: "HIGH", confidence: 0.5, file: "a.js" }], 1);
  assertEqual(result.score, 92, "score"); // 100 - (15 * 0.5) = 92.5 → 92
});

test("Multiple HIGH findings → score drops significantly", () => {
  const findings = Array(5).fill({ severity: "HIGH", confidence: 1.0, file: "a.js" });
  const result = calculateTrustScore(findings, 1);
  assert(result.score <= 30, `Score ${result.score} should be ≤ 30 for 5 HIGH findings`);
  assertEqual(result.grade, "F", "grade should be F");
});

test("Mixed findings → correct weighted score", () => {
  const findings = [
    { severity: "HIGH", confidence: 1.0, file: "a.js" },   // -15
    { severity: "MEDIUM", confidence: 1.0, file: "a.js" }, // -8
    { severity: "LOW", confidence: 1.0, file: "a.js" },    // -3
  ];
  const result = calculateTrustScore(findings, 1);
  assertEqual(result.score, 74, "score"); // 100 - 26 = 74
});

test("Breakdown counts are correct", () => {
  const findings = [
    { severity: "HIGH", confidence: 1.0, file: "a.js" },
    { severity: "HIGH", confidence: 1.0, file: "a.js" },
    { severity: "MEDIUM", confidence: 1.0, file: "a.js" },
  ];
  const { breakdown } = calculateTrustScore(findings, 1);
  assertEqual(breakdown.high_count, 2, "high_count");
  assertEqual(breakdown.medium_count, 1, "medium_count");
  assertEqual(breakdown.low_count, 0, "low_count");
});

// ==========================================
// SUITE 4: Comment Formatters
// ==========================================

console.log("\n══════════════════════════════════════════");
console.log("  Suite 4: Comment Formatters");
console.log("══════════════════════════════════════════");

const sampleFinding = {
  ruleId: "hardcoded-password",
  file: "src/auth.js",
  line: 42,
  matchedText: 'password = "admin123"',
  severity: "HIGH",
  icon: "🔴",
  title: "Hardcoded Password",
  message: "A hardcoded password was found in source code.",
  confidence: 0.9,
  cwe: "CWE-259",
  aiExplanation: null,
  aiFix: null,
};

test("Inline comment includes severity, title, CWE, and confidence", () => {
  const comment = formatInlineComment(sampleFinding);
  assert(comment.includes("HIGH"), "should include severity");
  assert(comment.includes("Hardcoded Password"), "should include title");
  assert(comment.includes("CWE-259"), "should include CWE");
  assert(comment.includes("90%"), "should include confidence %");
  assert(comment.includes('password = "admin123"'), "should include matched text");
});

test("Inline comment includes fix hint for known rule", () => {
  const comment = formatInlineComment(sampleFinding);
  assert(comment.includes("process.env"), "should include fix hint mentioning process.env");
});

test("Inline comment shows AI explanation when present", () => {
  const finding = { ...sampleFinding, aiExplanation: "This is inside login() function." };
  const comment = formatInlineComment(finding);
  assert(comment.includes("Context-aware analysis"), "should show AI section header");
  assert(comment.includes("login()"), "should include AI explanation");
});

test("Summary comment includes all expected sections", () => {
  const report = {
    repository: "org/repo",
    pullRequest: 7,
    filesScanned: 4,
    findings: [sampleFinding],
    riskLevel: "HIGH",
    trustScoreResult: {
      score: 85,
      grade: "B",
      breakdown: { penalty: 15, high_count: 1, medium_count: 0, low_count: 0, info_count: 0, spread_penalty: 0 },
    },
  };
  const summary = formatSummaryComment(report);
  assert(summary.includes("Tracr Security Review"), "should have header");
  assert(summary.includes("Files Scanned"), "should have summary table");
  assert(summary.includes("85/100"), "should include trust score");
  assert(summary.includes("Grade **B**"), "should include grade");
  assert(summary.includes("src/auth.js"), "should list the file");
  assert(summary.includes("Line 42"), "should include line number");
});

test("Summary comment shows clean message when no findings", () => {
  const report = {
    repository: "org/repo",
    pullRequest: 1,
    filesScanned: 2,
    findings: [],
    riskLevel: "LOW",
    trustScoreResult: { score: 100, grade: "A", breakdown: null },
  };
  const summary = formatSummaryComment(report);
  assert(summary.includes("No Security Findings"), "should show clean message");
  assert(summary.includes("100/100"), "should show 100 score");
});

// ==========================================
// RESULTS
// ==========================================

console.log("\n══════════════════════════════════════════");
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log("══════════════════════════════════════════\n");

if (failed > 0) {
  console.log("❌ Some tests failed. Fix issues before committing.\n");
  process.exit(1);
} else {
  console.log("✅ All tests passed! Safe to commit.\n");
  process.exit(0);
}
