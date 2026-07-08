const agentStore = require("../store/agentStore");
const logger = require("../utils/logger");

/**
 * Handle events from Agent namespace (/agent).
 *
 * @param {import("socket.io").Socket} socket - The Agent socket
 * @param {import("socket.io").Namespace} controllerNs - The Controller namespace (to forward events)
 */
function agentHandler(socket, controllerNs) {
  logger.info(`Agent socket connected: ${socket.id}`, {
    address: socket.handshake.address,
  });

  // * Agent Registration 
  socket.on("agent:register", (data) => {
    try {
      const { agentId, hostname, ip, os } = data;

      if (!agentId) {
        socket.emit("agent:error", { message: "agentId is required" });
        return;
      }

      // Check if this agentId is already registered (reconnect case)
      const existing = agentStore.get(agentId);
      if (existing) {
        agentStore.remove(agentId);
        logger.info(`Agent re-registered (replaced old connection): ${agentId}`);
      }

      const agent = agentStore.add(agentId, socket.id, { hostname, ip, os });

      // Join a room named by agentId for targeted messaging
      socket.join(agentId);

      // Confirm registration to Agent
      socket.emit("agent:registered", {
        success: true,
        agentId: agent.agentId,
      });

      // Broadcast to all Controllers that a new Agent is online
      controllerNs.emit("controller:agent-online", {
        agentId: agent.agentId,
        hostname: agent.hostname,
        ip: agent.ip,
        os: agent.os,
        connectedAt: agent.connectedAt,
      });

      logger.info(`Agent registered successfully: ${agentId} (${hostname})`);
    } catch (err) {
      logger.error(`Error in agent:register: ${err.message}`);
      socket.emit("agent:error", { message: "Registration failed" });
    }
  });

  // * Permission Response (Agent accepts/denies Controller request) 
  socket.on("agent:permission-response", (data) => {
    try {
      const { controllerId, module, granted } = data;
      const agent = agentStore.getBySocketId(socket.id);

      if (!agent) {
        socket.emit("agent:error", { message: "Agent not registered" });
        return;
      }

      // Update permission in store
      agentStore.updatePermission(agent.agentId, module, granted);

      // Forward result to the requesting Controller
      controllerNs.to(controllerId).emit("controller:permission-result", {
        agentId: agent.agentId,
        module,
        granted,
      });

      logger.info(
        `Permission ${granted ? "GRANTED" : "DENIED"}: ${agent.agentId} -> ${module}`,
        { controllerId }
      );
    } catch (err) {
      logger.error(`Error in agent:permission-response: ${err.message}`);
    }
  });

  // * Module Data (Agent sends result data back) 
  // Used for: applications list, processes list, screenshot, file list,
  //           file content, power ack, etc.
  socket.on("agent:module-data", (data) => {
    try {
      const { controllerId, type, payload } = data;
      const agent = agentStore.getBySocketId(socket.id);

      if (!agent) {
        socket.emit("agent:error", { message: "Agent not registered" });
        return;
      }

      // Forward to the requesting Controller
      controllerNs.to(controllerId).emit("controller:module-data", {
        agentId: agent.agentId,
        type,
        payload,
      });

      logger.debug(`Module data relayed: ${agent.agentId} -> ${type}`, {
        controllerId,
      });
    } catch (err) {
      logger.error(`Error in agent:module-data: ${err.message}`);
    }
  });

  // * Keylog Data (separate event for continuous key data) 
  socket.on("agent:keylog-data", (data) => {
    try {
      const { controllerId, keys } = data;
      const agent = agentStore.getBySocketId(socket.id);

      if (!agent) return;

      controllerNs.to(controllerId).emit("controller:keylog-data", {
        agentId: agent.agentId,
        keys,
      });

      logger.debug(`Keylog data relayed: ${agent.agentId} (${keys.length} keys)`);
    } catch (err) {
      logger.error(`Error in agent:keylog-data: ${err.message}`);
    }
  });

  // * Stream Frame (for future Live Screen / Webcam) 
  socket.on("agent:stream-frame", (data) => {
    try {
      const { controllerId, type, frame } = data;
      const agent = agentStore.getBySocketId(socket.id);

      if (!agent) return;

      controllerNs.to(controllerId).emit("controller:stream-frame", {
        agentId: agent.agentId,
        type,
        frame,
      });
    } catch (err) {
      logger.error(`Error in agent:stream-frame: ${err.message}`);
    }
  });

  // * Module Error (Agent reports an error executing a command) 
  socket.on("agent:module-error", (data) => {
    try {
      const { controllerId, module, message } = data;
      const agent = agentStore.getBySocketId(socket.id);

      if (!agent) return;

      controllerNs.to(controllerId).emit("controller:module-error", {
        agentId: agent.agentId,
        module,
        message,
      });

      logger.warn(`Module error from ${agent.agentId}: [${module}] ${message}`);
    } catch (err) {
      logger.error(`Error in agent:module-error: ${err.message}`);
    }
  });

  // * Disconnect 
  socket.on("disconnect", (reason) => {
    const agent = agentStore.removeBySocketId(socket.id);
    if (agent) {
      // Notify all Controllers
      controllerNs.emit("controller:agent-offline", {
        agentId: agent.agentId,
        hostname: agent.hostname,
      });
      logger.info(`Agent disconnected: ${agent.agentId} (${reason})`);
    }
  });
}

module.exports = agentHandler;
