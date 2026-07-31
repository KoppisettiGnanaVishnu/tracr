import express from "express";

import { scanPullRequest } from "../github/scanner.js";

const router = express.Router();

/* =========================================================
   GitHub Webhook
========================================================= */

router.post("/webhook", async (req, res) => {
  // Respond immediately so GitHub knows we received the event
  res.sendStatus(200);

  const event = req.headers["x-github-event"];

  // Only process Pull Request events
  if (event !== "pull_request") return;

  // Only process newly opened PRs
  if (req.body.action !== "opened") return;

  try {
    const owner = req.body.repository.owner.login;
    const repo = req.body.repository.name;
    const pullNumber = req.body.pull_request.number;
    const installationId = req.body.installation?.id;

    console.log("\n======================================");
    console.log("🚀 New Pull Request Detected");
    console.log("Repository      :", `${owner}/${repo}`);
    console.log("PR Number       :", pullNumber);
    console.log("Installation ID :", installationId);
    console.log("Sender          :", req.body.sender.login);
    console.log("======================================\n");

    const findings = await scanPullRequest(
      owner,
      repo,
      pullNumber,
      installationId
    );

    console.log("✅ Scan completed");
    console.log(findings);

  } catch (err) {
    console.error("\n❌ Webhook Error");
    console.error(err);
  }
});

export default router;