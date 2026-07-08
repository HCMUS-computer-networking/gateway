require("dotenv").config();

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  corsOrigin: process.env.CORS_ORIGIN || "*",
  agentAuthKey: process.env.AGENT_AUTH_KEY || "",
  controllerAuthKey: process.env.CONTROLLER_AUTH_KEY || "",
  gatewaySecret: process.env.GATEWAY_SECRET || "",
  logLevel: process.env.LOG_LEVEL || "info",
};

module.exports = config;
