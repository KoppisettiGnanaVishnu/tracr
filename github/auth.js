const fs = require("fs");
const path = require("path");
const { App } = require("@octokit/app");

const privateKey = fs.readFileSync(
  path.resolve(process.env.GITHUB_PRIVATE_KEY_PATH),
  "utf8"
);

const app = new App({
  appId: process.env.GITHUB_APP_ID,
  privateKey,
});

module.exports = app;