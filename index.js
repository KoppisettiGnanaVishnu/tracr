import "dotenv/config";

import express from "express";

import apiRoutes from "./routes/api.js";
import webhookRoutes from "./routes/webhook.js";

const app = express();

app.use(express.json());
app.use(express.static("public"));

// API Routes
app.use("/", apiRoutes);

// GitHub Webhook
app.use("/", webhookRoutes);

// Start Server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Tracr backend listening on port ${PORT}`);
});