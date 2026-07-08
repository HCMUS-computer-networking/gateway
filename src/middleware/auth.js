const config = require("../config");
const logger = require("../utils/logger");

/**
 * Socket.IO middleware for authenticating connections.
 * Agent namespace requires AGENT_AUTH_KEY.
 * Controller namespace requires CONTROLLER_AUTH_KEY.
 *
 * Client must pass { auth: { key: "..." } } when connecting.
 */
function createAuthMiddleware(expectedKey, role) {
  return (socket, next) => {
    const clientKey = socket.handshake.auth && socket.handshake.auth.key;

    // If no auth key is configured on server, skip authentication
    if (!expectedKey) {
      logger.warn(`No auth key configured for ${role} — allowing all connections`);
      return next();
    }

    if (!clientKey) {
      logger.warn(`${role} connection rejected: no auth key provided`, {
        address: socket.handshake.address,
      });
      return next(new Error("Authentication required: provide auth.key"));
    }

    if (clientKey !== expectedKey) {
      logger.warn(`${role} connection rejected: invalid auth key`, {
        address: socket.handshake.address,
      });
      return next(new Error("Authentication failed: invalid key"));
    }

    logger.debug(`${role} authenticated`, { address: socket.handshake.address });
    next();
  };
}

/**
 * Create auth middleware for Agent namespace.
 */
function agentAuth() {
  return createAuthMiddleware(config.agentAuthKey, "Agent");
}

/**
 * Create auth middleware for Controller namespace.
 */
function controllerAuth() {
  return createAuthMiddleware(config.controllerAuthKey, "Controller");
}

module.exports = { agentAuth, controllerAuth };
