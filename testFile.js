// Tracr — test helper script
// Reads a real local file and sends its contents through the
// /api/code-block endpoint, so you can test against real code
// instead of typing snippets into curl by hand.
//
// Usage:
//   node testFile.js <path-to-file> <repo_name> <is_ai_generated: true|false>
//
// Example:
//   node testFile.js ./githubIntegration.js my-own-code true

const fs = require("fs");
const path = require("path");

const [, , filePath, repoName, isAiArg] = process.argv;

if (!filePath || !repoName) {
  console.log("Usage: node testFile.js <path-to-file> <repo_name> <is_ai_generated: true|false>");
  process.exit(1);
}

const codeSnippet = fs.readFileSync(filePath, "utf8");
const isAiGenerated = isAiArg === "true";

async function send() {
  const res = await fetch("http://localhost:3000/api/code-block", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      repo_name: repoName,
      file_path: path.basename(filePath),
      code_snippet: codeSnippet,
      is_ai_generated: isAiGenerated,
    }),
  });

  const data = await res.json();
  console.log("Result:", data);
}

send();