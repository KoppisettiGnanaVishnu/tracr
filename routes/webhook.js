import express from "express";
import crypto from "crypto";

import { scanPullRequest } from "../github/scanner.js";
import { createReview } from "../github/reviewer.js";
import { upsertInstallation, markUninstalled } from "../database/db.js";

const router = express.Router();

// ==========================================
// Webhook Signature Verification
// ==========================================

/**
 * Verifies the X-Hub-Signature-256 header sent by GitHub.
 * This ensures the request genuinely comes from GitHub and not
 * an arbitrary third party posting to our /webhook endpoint.
 *
 * Returns true if valid, false otherwise.
 */
function verifyWebhookSignature(req) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;

  // If no secret is configured, skip verification in development
  if (!secret) {
    console.warn("⚠️  GITHUB_WEBHOOK_SECRET not set — skipping signature verification");
    return true;
  }

  const signature = req.headers["x-hub-signature-256"];

  if (!signature) {
    console.error("❌ No X-Hub-Signature-256 header present");
    return false;
  }

  const payload = JSON.stringify(req.body);
  const expected = `sha256=${crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex")}`;

  // Use timingSafeEqual to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    );
  } catch {
    return false;
  }
}

/* =========================================================
   GitHub Webhook — Main Entry Point
   Handles: pull_request, installation, installation_repositories
========================================================= */

router.post("/webhook", async (req, res) => {
  // ── 0. Verify webhook signature ─────────────────────────────────────────────
  if (!verifyWebhookSignature(req)) {
    console.error("❌ Webhook signature verification FAILED — request rejected");
    return res.status(401).json({ error: "Invalid webhook signature" });
  }

  // Respond immediately so GitHub doesn't retry the delivery
  res.sendStatus(200);

  const event = req.headers["x-github-event"];
  const action = req.body.action;

  console.log("\n========================================");
  console.log("🚀 Webhook Received");
  console.log("========================================");
  console.log("Event :", event);
  console.log("Action:", action);

  // ──────────────────────────────────────────────────────────────────────────
  // Handle: installation events — track installs/uninstalls
  // ──────────────────────────────────────────────────────────────────────────
  if (event === "installation") {
    const installationId = req.body.installation?.id;
    const owner = req.body.installation?.account?.login;
    const ownerType = req.body.installation?.account?.type;

    if (action === "created") {
      try {
        upsertInstallation.run({
          installation_id: installationId,
          owner,
          owner_type: ownerType,
        });
        console.log(`✅ Installation recorded: ${owner} (id=${installationId})`);
      } catch (err) {
        console.error("⚠️  Failed to record installation:", err.message);
      }
    } else if (action === "deleted") {
      try {
        markUninstalled.run(installationId);
        console.log(`🗑️  Installation marked as removed: ${owner} (id=${installationId})`);
      } catch (err) {
        console.error("⚠️  Failed to update installation:", err.message);
      }
    }

    return;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Handle: pull_request events — the main scan flow
  // ──────────────────────────────────────────────────────────────────────────
  if (event !== "pull_request") {
    console.log(`❌ Ignored (Unhandled event: ${event})`);
    return;
  }

  const allowedActions = ["opened", "synchronize", "reopened"];

  if (!allowedActions.includes(action)) {
    console.log(`❌ Ignored (Unsupported PR action: ${action})`);
    return;
  }

  try {
    const owner = req.body.repository.owner.login;
    const repo = req.body.repository.name;
    const pullNumber = req.body.pull_request.number;
    const installationId = req.body.installation?.id;

    console.log("\n========== Pull Request ==========");
    console.log("Repository      :", `${owner}/${repo}`);
    console.log("PR Number       :", pullNumber);
    console.log("Installation ID :", installationId);
    console.log("Sender          :", req.body.sender.login);
    console.log("==================================");

    console.log("\n🔍 Starting PR scan...");

    // ── Scan the PR ─────────────────────────────────────────────────────────
    const report = await scanPullRequest(
      owner,
      repo,
      pullNumber,
      installationId
    );

    console.log("\n========== SCAN COMPLETE ==========");
    console.log(`Files:     ${report.filesScanned}`);
    console.log(`Findings:  ${report.findings.length}`);
    console.log(`Risk:      ${report.riskLevel}`);
    console.log(`Score:     ${report.trustScoreResult.score}/100 (${report.trustScoreResult.grade})`);
    console.log("===================================");

    // ── Post review to GitHub ────────────────────────────────────────────────
    console.log("\n💬 Posting review to GitHub...");

    await createReview(
      owner,
      repo,
      pullNumber,
      installationId,
      report
    );

    console.log("✅ Review posted. Scan complete.");

  } catch (err) {
    console.error("\n❌ WEBHOOK PROCESSING ERROR");
    console.error("--------------------------------");
    console.error("Message:", err.message);
    if (err.status)          console.error("Status:", err.status);
    if (err.response?.data)  console.error("GitHub Response:", err.response.data);
    console.error("Stack:", err.stack);
    console.error("--------------------------------");
  }
});

export default router;