const agentStore = require("../store/agentStore");
const config = require("../config");
const logger = require("../utils/logger");

/**
 * Handle events from Controller namespace (/controller).
 *
 * @param {import("socket.io").Socket} socket - The Controller socket
 * @param {import("socket.io").Namespace} agentNs - The Agent namespace (to forward events)
 */
function controllerHandler(socket, agentNs) {
  logger.info(`Controller connected: ${socket.id}`, {
    address: socket.handshake.address,
  });

  // Helper to resolve target agents from data payload
  const getTargetAgents = (data) => {
    let targets = [];
    if (data.agentId === "ALL") {
      targets = agentStore.getAll().map(a => agentStore.get(a.agentId));
    } else if (Array.isArray(data.agentIds)) {
      targets = data.agentIds.map(id => agentStore.get(id)).filter(Boolean);
    } else if (data.agentId) {
      const agent = agentStore.get(data.agentId);
      if (agent) targets.push(agent);
    }
    return targets;
  };

  // * Get Agent List 
  socket.on("controller:get-agents", (callback) => {
    const agents = agentStore.getAll();
    logger.debug(`Agent list requested by ${socket.id}: ${agents.length} agents`);

    // Support both callback and emit patterns
    if (typeof callback === "function") {
      callback({ agents });
    } else {
      socket.emit("controller:agent-list", { agents });
    }
  });

  // Request Permission for a Module 
  socket.on("controller:request-permission", (data) => {
    try {
      const { module } = data;
      const targets = getTargetAgents(data);

      if (targets.length === 0) {
        socket.emit("controller:error", {
          message: `No valid agents found for permission request`,
        });
        return;
      }

      targets.forEach((agent) => {
        // Forward permission request to Agent, include Controller's socketId
        // so Agent can respond to the right Controller
        agentNs.to(agent.socketId).emit("agent:permission-request", {
          controllerId: socket.id,
          module,
          gatewayKey: config.gatewaySecret,
        });

        logger.info(
          `Permission request: Controller ${socket.id} -> Agent ${agent.agentId} [${module}]`
        );
      });
    } catch (err) {
      logger.error(`Error in controller:request-permission: ${err.message}`);
      socket.emit("controller:error", { message: "Failed to request permission" });
    }
  });

  // * Send Module Command 
  // Commands: list-apps, list-processes, kill-process, take-screenshot,
  //           start-keylog, stop-keylog, list-files, download-file,
  //           shutdown, restart, logoff
  socket.on("controller:module-command", (data) => {
    try {
      const { module, command, params } = data;
      const targets = getTargetAgents(data);

      if (targets.length === 0) {
        socket.emit("controller:error", {
          message: `No valid agents found for the command`,
        });
        return;
      }

      targets.forEach((agent) => {
        // Check if permission is granted for this module
        if (!agentStore.hasPermission(agent.agentId, module)) {
          socket.emit("controller:error", {
            message: `Permission not granted for module "${module}" on Agent ${agent.agentId}. Request permission first.`,
          });
          return;
        }

        // Forward command to Agent
        agentNs.to(agent.socketId).emit("agent:module-command", {
          controllerId: socket.id,
          module,
          command,
          params: params || {},
          gatewayKey: config.gatewaySecret,
        });

        logger.info(
          `Module command: Controller ${socket.id} -> Agent ${agent.agentId} [${module}:${command}]`
        );
      });
    } catch (err) {
      logger.error(`Error in controller:module-command: ${err.message}`);
      socket.emit("controller:error", { message: "Failed to send command" });
    }
  });

  // * Stop Module 
  socket.on("controller:stop-module", (data) => {
    try {
      const { module } = data;
      const targets = getTargetAgents(data);

      if (targets.length === 0) {
        socket.emit("controller:error", {
          message: `No valid agents found`,
        });
        return;
      }

      targets.forEach((agent) => {
        agentNs.to(agent.socketId).emit("agent:stop-module", {
          controllerId: socket.id,
          module,
          gatewayKey: config.gatewaySecret,
        });

        logger.info(
          `Stop module: Controller ${socket.id} -> Agent ${agent.agentId} [${module}]`
        );
      });
    } catch (err) {
      logger.error(`Error in controller:stop-module: ${err.message}`);
    }
  });

  // * Revoke Permission 
  socket.on("controller:revoke-permission", (data) => {
    try {
      const { module } = data;
      const targets = getTargetAgents(data);

      targets.forEach((agent) => {
        agentStore.updatePermission(agent.agentId, module, false);

        agentNs.to(agent.socketId).emit("agent:permission-revoked", {
          controllerId: socket.id,
          module,
          gatewayKey: config.gatewaySecret,
        });

        logger.info(
          `Permission revoked: Controller ${socket.id} -> Agent ${agent.agentId} [${module}]`
        );
      });
    } catch (err) {
      logger.error(`Error in controller:revoke-permission: ${err.message}`);
    }
  });

  // * Disconnect 
  socket.on("disconnect", (reason) => {
    logger.info(`Controller disconnected: ${socket.id} (${reason})`);
  });
}

module.exports = controllerHandler;
