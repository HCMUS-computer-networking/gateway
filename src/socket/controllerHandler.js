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
      const { agentId, module } = data;
      const agent = agentStore.get(agentId);

      if (!agent) {
        socket.emit("controller:error", {
          message: `Agent ${agentId} not found or offline`,
        });
        return;
      }

      // Forward permission request to Agent, include Controller's socketId
      // so Agent can respond to the right Controller
      agentNs.to(agent.socketId).emit("agent:permission-request", {
        controllerId: socket.id,
        module,
        gatewayKey: config.gatewaySecret,
      });

      logger.info(
        `Permission request: Controller ${socket.id} -> Agent ${agentId} [${module}]`
      );
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
      const { agentId, module, command, params } = data;
      const agent = agentStore.get(agentId);

      if (!agent) {
        socket.emit("controller:error", {
          message: `Agent ${agentId} not found or offline`,
        });
        return;
      }

      // Check if permission is granted for this module
      if (!agentStore.hasPermission(agentId, module)) {
        socket.emit("controller:error", {
          message: `Permission not granted for module "${module}" on Agent ${agentId}. Request permission first.`,
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
        `Module command: Controller ${socket.id} -> Agent ${agentId} [${module}:${command}]`
      );
    } catch (err) {
      logger.error(`Error in controller:module-command: ${err.message}`);
      socket.emit("controller:error", { message: "Failed to send command" });
    }
  });

  // * Stop Module 
  socket.on("controller:stop-module", (data) => {
    try {
      const { agentId, module } = data;
      const agent = agentStore.get(agentId);

      if (!agent) {
        socket.emit("controller:error", {
          message: `Agent ${agentId} not found or offline`,
        });
        return;
      }

      agentNs.to(agent.socketId).emit("agent:stop-module", {
        controllerId: socket.id,
        module,
        gatewayKey: config.gatewaySecret,
      });

      logger.info(
        `Stop module: Controller ${socket.id} -> Agent ${agentId} [${module}]`
      );
    } catch (err) {
      logger.error(`Error in controller:stop-module: ${err.message}`);
    }
  });

  // * Revoke Permission 
  socket.on("controller:revoke-permission", (data) => {
    try {
      const { agentId, module } = data;
      agentStore.updatePermission(agentId, module, false);

      const agent = agentStore.get(agentId);
      if (agent) {
        agentNs.to(agent.socketId).emit("agent:permission-revoked", {
          controllerId: socket.id,
          module,
          gatewayKey: config.gatewaySecret,
        });
      }

      logger.info(
        `Permission revoked: Controller ${socket.id} -> Agent ${agentId} [${module}]`
      );
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
