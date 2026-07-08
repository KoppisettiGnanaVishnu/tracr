require("dotenv").config();

const app = require("./github/auth");

async function main() {
  try {
    const jwt = await app.getSignedJsonWebToken();

    console.log("✅ GitHub App authenticated!");
    console.log(jwt.substring(0, 40) + "...");
  } catch (err) {
    console.error(err);
  }
}

main();