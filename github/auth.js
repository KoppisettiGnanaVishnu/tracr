import { App } from "@octokit/app";
import { Octokit } from "octokit";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Re-create __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = new App({
  appId: process.env.GITHUB_APP_ID,

  privateKey: fs.readFileSync(
    path.join(
      __dirname,
      "../private/tracr-ai.2026-07-06.private-key.pem"
    ),
    "utf8"
  ),

  clientId: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,

  // ⭐ This is the important addition
  Octokit,
});

export async function getInstallationOctokit(installationId) {
  return await app.getInstallationOctokit(installationId);
}