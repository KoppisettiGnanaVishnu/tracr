require("dotenv").config();

const express = require("express");

const apiRoutes = require("./routes/api");
const webhookRoutes = require("./routes/webhook");

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