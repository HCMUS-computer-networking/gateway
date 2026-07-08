const http = require("http");
const express = require("express");
const cors = require("cors");
const config = require("./config");
const logger = require("./utils/logger");
const initSocket = require("./socket");
const agentStore = require("./store/agentStore");

// Express App 
const app = express();
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

// Health check in route
app.get("/", (req, res) => {
  res.json({
    service: "Gateway Server",
    status: "running",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// REST endpoint: get online agents (fallback for non-socket clients)
app.get("/api/agents", (req, res) => {
  res.json({ agents: agentStore.getAll() });
});

//  HTTP Server + Socket.IO 
const httpServer = http.createServer(app);
const io = initSocket(httpServer);

//  Start Server 
httpServer.listen(config.port, () => {
  logger.info(`   Gateway server running on port ${config.port}`);
  logger.info(`   Health check: http://localhost:${config.port}/`);
  logger.info(`   Agent namespace: ws://localhost:${config.port}/agent`);
  logger.info(`   Controller namespace: ws://localhost:${config.port}/controller`);
});

//  Graceful Shutdown 
process.on("SIGINT", () => {
  logger.info("Shutting down Gateway...");
  io.close();
  httpServer.close(() => {
    logger.info("Gateway shut down.");
    process.exit(0);
  });
});

process.on("SIGTERM", () => {
  logger.info("Shutting down Gateway...");
  io.close();
  httpServer.close(() => {
    logger.info("Gateway shut down.");
    process.exit(0);
  });
});
