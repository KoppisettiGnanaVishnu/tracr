// Tracr — AST Context Engine (Phase 2)
//
// Extracts rich code context around a finding's line number using Babel's
// AST parser. For each finding, returns:
//   - enclosingFunction: name + params of the function containing the line
//   - variableUsages: other places the matched variable appears in the file
//   - fileCategory: heuristic label (auth / db / api / payment / test / util)
//   - surroundingLines: 3 lines before and after the finding for context
//   - imports: top-level imports in the file

import * as babelParser from "@babel/parser";
import babelTraverse from "@babel/traverse";

const traverse = babelTraverse.default ?? babelTraverse;

// ─────────────────────────────────────────────
// File category heuristic (from filename)
// ─────────────────────────────────────────────

const FILE_CATEGORIES = [
  { label: "authentication", patterns: [/auth/i, /login/i, /session/i, /passport/i, /jwt/i, /oauth/i] },
  { label: "database",       patterns: [/db/i, /database/i, /model/i, /schema/i, /migration/i, /query/i] },
  { label: "payment",        patterns: [/pay/i, /stripe/i, /billing/i, /checkout/i, /invoice/i] },
  { label: "admin",          patterns: [/admin/i, /management/i, /panel/i, /dashboard/i] },
  { label: "api",            patterns: [/route/i, /router/i, /controller/i, /api/i, /endpoint/i, /handler/i] },
  { label: "test",           patterns: [/test/i, /spec/i, /mock/i, /fixture/i, /__tests__/i] },
  { label: "config",         patterns: [/config/i, /env/i, /settings/i, /constants/i] },
  { label: "crypto",         patterns: [/crypt/i, /hash/i, /cipher/i, /encrypt/i, /decrypt/i, /sign/i] },
];

function classifyFile(filename) {
  for (const { label, patterns } of FILE_CATEGORIES) {
    if (patterns.some((p) => p.test(filename))) return label;
  }
  return "general";
}

// ─────────────────────────────────────────────
// Extract surrounding source lines
// ─────────────────────────────────────────────

function getSurroundingLines(sourceLines, targetLine, radius = 3) {
  const start = Math.max(0, targetLine - 1 - radius);
  const end = Math.min(sourceLines.length - 1, targetLine - 1 + radius);
  return sourceLines.slice(start, end + 1).map((text, i) => ({
    lineNumber: start + i + 1,
    text: text.trimEnd(),
    isFinding: start + i + 1 === targetLine,
  }));
}

// ─────────────────────────────────────────────
// Parse imports from AST
// ─────────────────────────────────────────────

function extractImports(ast) {
  const imports = [];
  try {
    for (const node of ast.program.body) {
      if (node.type === "ImportDeclaration") {
        imports.push(node.source.value);
      } else if (
        node.type === "VariableDeclaration" &&
        node.declarations?.[0]?.init?.type === "CallExpression" &&
        node.declarations?.[0]?.init?.callee?.name === "require"
      ) {
        const arg = node.declarations[0].init.arguments?.[0];
        if (arg?.value) imports.push(arg.value);
      }
    }
  } catch (_) {
    // non-fatal
  }
  return imports;
}

// ─────────────────────────────────────────────
// Find the enclosing function for a given line
// ─────────────────────────────────────────────

function findEnclosingFunction(ast, targetLine) {
  let result = null;
  let smallestRange = Infinity;

  try {
    traverse(ast, {
      "FunctionDeclaration|FunctionExpression|ArrowFunctionExpression|ClassMethod|ObjectMethod"(path) {
        const { start, end } = path.node.loc ?? {};
        if (!start || !end) return;

        const startLine = start.line;
        const endLine = end.line;

        if (startLine <= targetLine && targetLine <= endLine) {
          const range = endLine - startLine;
          if (range < smallestRange) {
            smallestRange = range;

            // Get function name
            let name = "(anonymous)";
            const node = path.node;

            if (node.type === "FunctionDeclaration" && node.id?.name) {
              name = node.id.name;
            } else if (node.type === "ClassMethod" || node.type === "ObjectMethod") {
              name = node.key?.name ?? node.key?.value ?? "(method)";
            } else if (path.parent?.type === "VariableDeclarator" && path.parent.id?.name) {
              name = path.parent.id.name;
            } else if (path.parent?.type === "AssignmentExpression" && path.parent.left?.name) {
              name = path.parent.left.name;
            } else if (path.parent?.type === "Property" && path.parent.key?.name) {
              name = path.parent.key.name;
            }

            // Get params
            const params = (node.params ?? []).map((p) => {
              if (p.type === "Identifier") return p.name;
              if (p.type === "AssignmentPattern") return p.left?.name ?? "?";
              if (p.type === "RestElement") return `...${p.argument?.name ?? "args"}`;
              if (p.type === "ObjectPattern") return "{ ... }";
              if (p.type === "ArrayPattern") return "[ ... ]";
              return "?";
            });

            result = {
              name,
              params,
              startLine,
              endLine,
              isAsync: node.async ?? false,
              isExported: path.parent?.type === "ExportDefaultDeclaration" ||
                           path.parentPath?.parent?.type === "ExportNamedDeclaration",
            };
          }
        }
      },
    });
  } catch (_) {
    // non-fatal — AST traversal can fail on unusual syntax
  }

  return result;
}

// ─────────────────────────────────────────────
// Find all usages of a variable name in the AST
// ─────────────────────────────────────────────

function findVariableUsages(ast, variableName) {
  if (!variableName) return [];
  const usageLines = new Set();

  try {
    traverse(ast, {
      Identifier(path) {
        if (path.node.name === variableName) {
          const line = path.node.loc?.start?.line;
          if (line) usageLines.add(line);
        }
      },
    });
  } catch (_) {
    // non-fatal
  }

  return [...usageLines].sort((a, b) => a - b);
}

// ─────────────────────────────────────────────
// Guess the variable name from matched text
// ─────────────────────────────────────────────

function guessVariableName(matchedText) {
  // e.g. "password = \"admin\"" → "password"
  const eqMatch = matchedText.match(/^\s*(?:const|let|var)?\s*(\w+)\s*=/);
  if (eqMatch) return eqMatch[1];

  // e.g. "apiKey" → just the identifier if short
  const wordMatch = matchedText.match(/\b([a-zA-Z_][a-zA-Z0-9_]{2,30})\b/);
  return wordMatch?.[1] ?? null;
}

// ─────────────────────────────────────────────
// Main export — getContext(finding, sourceCode)
// ─────────────────────────────────────────────

/**
 * Extracts AST-based context around a finding.
 *
 * @param {object} finding  — { file, line, matchedText, severity, ruleId, ... }
 * @param {string} source   — Full source code of the file (not the patch, the full file)
 * @returns {object}        — Context object for use by aiExplainer
 */
export function getContext(finding, source) {
  const defaultContext = {
    fileCategory: classifyFile(finding.file),
    enclosingFunction: null,
    variableName: null,
    variableUsageLines: [],
    imports: [],
    surroundingLines: [],
    astAvailable: false,
  };

  if (!source || source.trim().length === 0) {
    return defaultContext;
  }

  const sourceLines = source.split("\n");

  // Surrounding lines — always available even if AST fails
  const surroundingLines = getSurroundingLines(sourceLines, finding.line);

  let ast = null;

  try {
    ast = babelParser.parse(source, {
      sourceType: "module",
      plugins: [
        "typescript",
        "jsx",
        ["decorators", { decoratorsBeforeExport: true }],
        "classProperties",
        "classPrivateProperties",
        "classPrivateMethods",
        "dynamicImport",
        "importAttributes",         // replaces deprecated importAssertions (Babel 8)
        "optionalChaining",
        "nullishCoalescingOperator",
        "logicalAssignment",
      ],
      errorRecovery: true, // don't throw on partial syntax errors
    });
  } catch (parseErr) {
    // AST parse failed — return what we can without it
    console.warn(`  ⚠️  AST parse failed for ${finding.file}: ${parseErr.message}`);
    return {
      ...defaultContext,
      surroundingLines,
    };
  }

  const variableName = guessVariableName(finding.matchedText);
  const enclosingFunction = findEnclosingFunction(ast, finding.line);
  const variableUsageLines = findVariableUsages(ast, variableName);
  const imports = extractImports(ast);
  const fileCategory = classifyFile(finding.file);

  return {
    fileCategory,
    enclosingFunction,
    variableName,
    variableUsageLines,
    imports,
    surroundingLines,
    astAvailable: true,
  };
}
