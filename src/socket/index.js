const { Server } = require("socket.io");
const config = require("../config");
const { agentAuth, controllerAuth } = require("../middleware/auth");
const agentHandler = require("./agentHandler");
const controllerHandler = require("./controllerHandler");
const logger = require("../utils/logger");

/**
 * Initialize Socket.IO with two namespaces:
 *   /agent      — for Agent (Windows C# app) connections
 *   /controller — for Controller (web browser) connections
 *
 * @param {import("http").Server} httpServer
 * @returns {import("socket.io").Server}
 */
function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: config.corsOrigin,
      methods: ["GET", "POST"],
    },
    // Allow large payloads for screenshots, file chunks, etc.
    maxHttpBufferSize: 10 * 1024 * 1024, // 10 MB
  });

  //  Agent Namespace (/agent) 
  const agentNs = io.of("/agent");
  agentNs.use(agentAuth());
  agentNs.on("connection", (socket) => {
    agentHandler(socket, controllerNs);
  });

  //  Controller Namespace (/controller) 
  const controllerNs = io.of("/controller");
  controllerNs.use(controllerAuth());
  controllerNs.on("connection", (socket) => {
    controllerHandler(socket, agentNs);
  });

  logger.info("Socket.IO initialized with /agent and /controller namespaces");

  return io;
}

module.exports = initSocket;
