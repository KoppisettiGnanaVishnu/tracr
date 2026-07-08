const express = require("express");

const router = express.Router();

const { scanPullRequest } = require("../github/scanner");

/* =========================================================
   GitHub Webhook
========================================================= */

router.post("/webhook", async (req, res) => {
  // Respond to GitHub immediately
  res.sendStatus(200);

  const event = req.headers["x-github-event"];

  if (event !== "pull_request") return;
  if (req.body.action !== "opened") return;

  try {
    const owner = req.body.repository.owner.login;
    const repo = req.body.repository.name;
    const pullNumber = req.body.pull_request.number;

    console.log("🚀 New Pull Request");
    console.log(`${owner}/${repo}`);
    console.log("PR #" + pullNumber);

    const findings = await scanPullRequest(owner, repo, pullNumber);

    console.log("Scan complete:", findings);
  } catch (err) {
    console.error("Webhook Error:");
    console.error(err);
  }
});

module.exports = router;