// Tracr — AI Explainer (Phase 2)
//
// Uses the Gemini API to generate context-aware explanations and fix
// suggestions for each security finding. The deterministic scanner provides
// the evidence; the LLM converts it into developer-friendly reasoning.
//
// Model: gemini-3.7-flash (fast, cheap, 1M context)
// Output: structured JSON via response_mime_type = "application/json"
//
// The AI is called per-finding (not per-PR) to keep prompts focused.
// If GEMINI_API_KEY is missing, the module degrades gracefully — findings
// still get posted but without AI explanations.

import { GoogleGenAI } from "@google/genai";

// ─────────────────────────────────────────────
// Client — lazy-initialized so missing key is non-fatal
// ─────────────────────────────────────────────

let ai = null;

function getClient() {
  if (ai) return ai;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("⚠️  GEMINI_API_KEY not set — AI explanations disabled.");
    return null;
  }

  ai = new GoogleGenAI({ apiKey });
  return ai;
}

// ─────────────────────────────────────────────
// Build the prompt for a single finding
// ─────────────────────────────────────────────

function buildPrompt(finding, context) {
  const {
    fileCategory,
    enclosingFunction,
    variableName,
    variableUsageLines,
    imports,
    surroundingLines,
  } = context;

  // Surrounding code context block
  const codeBlock = surroundingLines
    .map((l) => `${l.isFinding ? ">>>" : "   "} ${l.lineNumber}: ${l.text}`)
    .join("\n");

  // Function context string
  const fnContext = enclosingFunction
    ? `Inside function \`${enclosingFunction.name}(${enclosingFunction.params.join(", ")})\` ` +
      `(lines ${enclosingFunction.startLine}–${enclosingFunction.endLine}` +
      `${enclosingFunction.isAsync ? ", async" : ""}` +
      `${enclosingFunction.isExported ? ", exported" : ""})`
    : "Not inside a named function (top-level or anonymous scope)";

  // Variable usage string
  const usageCtx =
    variableUsageLines.length > 1
      ? `The variable \`${variableName}\` also appears on lines: ${variableUsageLines.filter((l) => l !== finding.line).join(", ")}.`
      : "";

  // Imports string
  const importCtx =
    imports.length > 0
      ? `File imports: ${imports.slice(0, 10).join(", ")}${imports.length > 10 ? " ..." : ""}`
      : "";

  return `You are a senior security engineer reviewing a Pull Request. A deterministic scanner flagged the following security finding. Generate a concise, developer-friendly explanation.

## Finding
- **Rule**: ${finding.ruleId}
- **Title**: ${finding.title}
- **Severity**: ${finding.severity}
- **CWE**: ${finding.cwe ?? "N/A"}
- **File**: \`${finding.file}\` (${fileCategory} module)
- **Line**: ${finding.line}
- **Matched text**: \`${finding.matchedText}\`
- **Scanner confidence**: ${Math.round((finding.confidence ?? 1) * 100)}%

## Code Context
${fnContext}
${usageCtx}
${importCtx}

\`\`\`
${codeBlock}
\`\`\`

## Instructions
Respond ONLY with a valid JSON object matching this exact schema. No markdown, no extra text.

{
  "explanation": "1–2 sentence explanation of exactly what was found and why it is dangerous in this specific context (mention the function name, file category, and any data flow you can infer). Be concrete, not generic.",
  "whyRisky": "1–2 sentences explaining the real-world impact if exploited.",
  "fix": "A short, actionable code-level fix suggestion specific to this context. Include a before/after snippet if helpful. Use markdown code fences.",
  "confidence": <number between 0 and 1 — your adjusted confidence that this is a real vulnerability, not a false positive>
}`;
}

// ─────────────────────────────────────────────
// Call Gemini for one finding
// ─────────────────────────────────────────────

async function explainOne(finding, context) {
  const client = getClient();
  if (!client) return null;

  const prompt = buildPrompt(finding, context);

  try {
    const response = await client.models.generateContent({
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.2,       // low temperature for consistent, factual output
        maxOutputTokens: 1024,
      },
    });

    const raw = response.text?.trim();
    if (!raw) return null;

    // Strip accidental markdown fences if the model adds them
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    const parsed = JSON.parse(cleaned);

    return {
      explanation: parsed.explanation ?? null,
      whyRisky:    parsed.whyRisky ?? null,
      fix:         parsed.fix ?? null,
      confidence:  typeof parsed.confidence === "number" ? parsed.confidence : finding.confidence,
    };
  } catch (err) {
    console.warn(`  ⚠️  AI explain failed for [${finding.ruleId}] L${finding.line}: ${err.message}`);
    return null;
  }
}

// ─────────────────────────────────────────────
// Batch explain all findings in a report
//
// Strategy:
//   - Prioritize HIGH findings (always explain)
//   - Explain MEDIUM findings if ≤ 5 total
//   - Skip LOW/INFO to save cost
//   - Concurrency cap: 5 parallel API calls
// ─────────────────────────────────────────────

const CONCURRENCY = 5;

async function runBatch(tasks) {
  const results = [];
  for (let i = 0; i < tasks.length; i += CONCURRENCY) {
    const chunk = tasks.slice(i, i + CONCURRENCY);
    const chunkResults = await Promise.all(chunk.map((t) => t()));
    results.push(...chunkResults);
  }
  return results;
}

/**
 * Enriches all findings in a report with AI explanations.
 *
 * @param {Array} findings        — Array of finding objects from riskScanner
 * @param {Map}   contextMap      — Map<findingIndex, context> from astContext.getContext()
 * @returns {Array}               — Same findings array with aiExplanation, aiFix, confidence updated
 */
export async function enrichFindings(findings, contextMap) {
  if (!getClient()) {
    // No API key — return as-is with a placeholder
    return findings.map((f) => ({
      ...f,
      aiExplanation: null,
      aiFix: null,
    }));
  }

  // Decide which findings to explain
  const highFindings = findings.filter((f, i) => f.severity === "HIGH"      ? i : null).map((_, i) => findings.indexOf(_));
  const toExplain = new Set();
  
  findings.forEach((f, i) => {
    if (f.severity === "HIGH") toExplain.add(i);
  });
  
  // Also explain MEDIUM if total findings ≤ 8
  if (findings.length <= 8) {
    findings.forEach((f, i) => {
      if (f.severity === "MEDIUM") toExplain.add(i);
    });
  }

  console.log(`  🤖 AI explaining ${toExplain.size}/${findings.length} findings...`);

  // Build tasks
  const tasks = [...toExplain].map((idx) => async () => {
    const finding = findings[idx];
    const context = contextMap.get(idx) ?? {
      fileCategory: "general",
      enclosingFunction: null,
      variableName: null,
      variableUsageLines: [],
      imports: [],
      surroundingLines: [],
      astAvailable: false,
    };
    const result = await explainOne(finding, context);
    return { idx, result };
  });

  const results = await runBatch(tasks);

  // Merge AI results back into findings
  const enriched = findings.map((f, i) => ({ ...f, aiExplanation: null, aiFix: null }));

  for (const { idx, result } of results) {
    if (result) {
      enriched[idx] = {
        ...enriched[idx],
        aiExplanation: result.explanation,
        aiWhyRisky:    result.whyRisky,
        aiFix:         result.fix,
        // Use AI confidence if it's meaningfully different (>5% adjustment)
        confidence: Math.abs((result.confidence ?? enriched[idx].confidence) - enriched[idx].confidence) > 0.05
          ? result.confidence
          : enriched[idx].confidence,
      };
    }
  }

  const explained = results.filter((r) => r.result !== null).length;
  console.log(`  ✅ AI enrichment complete: ${explained}/${toExplain.size} findings explained`);

  return enriched;
}
