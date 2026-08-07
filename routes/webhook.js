import express from "express";

import { scanPullRequest } from "../github/scanner.js";
import { createReview } from "../github/reviewer.js";

const router = express.Router();

/* =========================================================
   GitHub Webhook
========================================================= */

router.post("/webhook", async (req, res) => {
  // Respond immediately so GitHub knows we received the event
  res.sendStatus(200);

  console.log("\n========================================");
  console.log("🚀 Webhook Received");
  console.log("========================================");

  const event = req.headers["x-github-event"];

  console.log("Event :", event);
  console.log("Action:", req.body.action);

  // Only process Pull Request events
  if (event !== "pull_request") {
    console.log("❌ Ignored (Not a pull_request event)");
    return;
  }

  // Process only these PR actions
  const allowedActions = [
    "opened",
    "synchronize",
    "reopened",
  ];

  if (!allowedActions.includes(req.body.action)) {
    console.log(`❌ Ignored (Unsupported action: ${req.body.action})`);
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

    console.log("🚀 Starting PR scan...");

    // Scan Pull Request
    const findings = await scanPullRequest(
      owner,
      repo,
      pullNumber,
      installationId
    );

    console.log("\n========== REVIEW REPORT ==========");
    console.log(findings);
    console.log("===================================");

    // Post review comment on GitHub
    console.log("💬 Posting review to GitHub...");

    await createReview(
      owner,
      repo,
      pullNumber,
      installationId,
      findings
    );

    console.log("✅ GitHub review posted successfully.");
    console.log("✅ Scan completed successfully.");

  } catch (err) {
    console.error("\n❌ WEBHOOK ERROR");
    console.error("--------------------------------");

    console.error("Message:");
    console.error(err.message);

    if (err.status) {
      console.error("Status:");
      console.error(err.status);
    }

    if (err.response?.data) {
      console.error("GitHub Response:");
      console.error(err.response.data);
    }

    console.error("Stack:");
    console.error(err.stack);

    console.error("--------------------------------");
  }
});

export default router;