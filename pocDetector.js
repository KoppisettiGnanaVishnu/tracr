// Tracr — burst-typing detection proof of concept
//
// This is a standalone test, completely separate from the main Tracr
// server. It does NOT use VS Code's API yet. It just proves out the
// core detection idea: can we tell "typed" apart from "pasted/AI-inserted"
// using only timing?
//
// HOW TO TEST:
//   1. Run: node pocDetector.js
//   2. Slowly type a short sentence, character by character, then press Enter.
//      -> It should say "HUMAN-TYPED"
//   3. Then copy a chunk of code (10+ characters) from anywhere,
//      paste it in, then press Enter.
//      -> It should say "BURST / LIKELY AI OR PASTE"
//
// The logic: track the time gap between each keystroke. If a large
// number of characters arrive within a very short time window, it's
// not humanly typeable one key at a time.

const readline = require("readline");

process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.setEncoding("utf8");

let buffer = "";
let keyTimestamps = [];

console.log("Type slowly, OR paste a code snippet, then press Enter.");
console.log("Press Ctrl+C to quit.\n");

process.stdin.on("data", (chunk) => {
  if (chunk === "\u0003") process.exit(); // Ctrl+C

  const now = Date.now();

  if (chunk === "\r" || chunk === "\n") {
    analyze(buffer, keyTimestamps);
    buffer = "";
    keyTimestamps = [];
    return;
  }

  // Handle backspace
  if (chunk === "\u007f") {
    buffer = buffer.slice(0, -1);
    return;
  }

  // IMPORTANT: chunk can be MORE THAN ONE CHARACTER if it arrived as a paste/burst.
  // We record how many characters arrived, and at what single timestamp.
  buffer += chunk;
  keyTimestamps.push({ time: now, length: chunk.length });

  process.stdout.write(chunk);
});

function analyze(text, timestamps) {
  console.log("\n---");
  console.log("Input:", JSON.stringify(text));

  if (timestamps.length === 0) {
    console.log("(empty)\n");
    return;
  }

  // Find the single largest "chunk" that arrived in one event
  const biggestChunk = Math.max(...timestamps.map((t) => t.length));

  // Find the fastest rate: characters per millisecond across the whole input
  const totalChars = text.length;
  const totalTimeMs =
    timestamps.length > 1
      ? timestamps[timestamps.length - 1].time - timestamps[0].time
      : 1;
  const charsPerSecond = totalTimeMs > 0 ? (totalChars / totalTimeMs) * 1000 : Infinity;

  console.log(`Largest single burst: ${biggestChunk} characters at once`);
  console.log(`Overall typing speed: ${charsPerSecond.toFixed(1)} chars/sec`);

  // Detection rule:
  // - If any single event delivered 12+ characters at once -> definitely a paste/insert
  // - If overall speed is above ~25 chars/sec sustained -> faster than realistic typing
  const isBurst = biggestChunk >= 12 || charsPerSecond > 25;

  if (isBurst) {
    console.log(">>> RESULT: BURST / LIKELY AI OR PASTE <<<\n");
  } else {
    console.log(">>> RESULT: HUMAN-TYPED <<<\n");
  }
}