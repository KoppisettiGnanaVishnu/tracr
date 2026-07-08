const { App } = require("@octokit/app");
const { Octokit } = require("octokit");
const fs = require("fs");
const path = require("path");

const app = new App({
  appId: process.env.GITHUB_APP_ID,

  privateKey: fs.readFileSync(
    path.join(__dirname, "../private/tracr-ai.2026-07-06.private-key.pem"),
    "utf8"
  ),

  clientId: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
});

async function getInstallationOctokit(installationId) {
  const installationOctokit = await app.getInstallationOctokit(
    installationId
  );

  return installationOctokit;
}

module.exports = {
  getInstallationOctokit,
};