// Tracr — trust score calculator
// Computes a single 0-100 "trust score" per repo from real
// stored data: AI risk rate, bug rate, and revert rate.

function calculateTrustScore(blocks) {
  const total = blocks.length;
  if (total === 0) return { score: 100, breakdown: null };

  const aiBlocks = blocks.filter((b) => b.is_ai_generated);
  const humanBlocks = blocks.filter((b) => !b.is_ai_generated);

  const riskyAiBlocks = aiBlocks.filter((b) => b.is_risky);
  const totalBugs = blocks.reduce((sum, b) => sum + (b.bugs_found || 0), 0);
  const totalReverts = blocks.reduce((sum, b) => sum + (b.reverted || 0), 0);

  const riskPenalty = aiBlocks.length > 0 ? (riskyAiBlocks.length / aiBlocks.length) * 40 : 0;
  const bugPenalty = (totalBugs / total) * 30;
  const revertPenalty = (totalReverts / total) * 30;

  const score = Math.max(0, Math.round(100 - (riskPenalty + bugPenalty + revertPenalty)));

  return {
    score,
    breakdown: {
      total_blocks: total,
      ai_percentage: Math.round((aiBlocks.length / total) * 100),
      human_percentage: Math.round((humanBlocks.length / total) * 100),
      ai_bugs: aiBlocks.reduce((s, b) => s + (b.bugs_found || 0), 0),
      ai_reverts: aiBlocks.reduce((s, b) => s + (b.reverted || 0), 0),
      human_bugs: humanBlocks.reduce((s, b) => s + (b.bugs_found || 0), 0),
      human_reverts: humanBlocks.reduce((s, b) => s + (b.reverted || 0), 0),
    },
  };
}

module.exports = { calculateTrustScore };