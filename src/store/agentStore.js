const logger = require("../utils/logger");

/**
 * In-memory store for connected Agents.
 * Key: agentId (string, unique per Agent app)
 * Value: Agent info object
 */
class AgentStore {
  constructor() {
    /** @type {Map<string, object>} */
    this.agents = new Map();
  }

  /**
   * Register a new Agent.
   * @param {string} agentId - Unique agent identifier (e.g., machine GUID)
   * @param {string} socketId - Socket.IO socket ID
   * @param {object} info - Agent metadata (hostname, ip, os, etc.)
   */
  add(agentId, socketId, info = {}) {
    const agent = {
      agentId,
      socketId,
      hostname: info.hostname || "Unknown",
      ip: info.ip || "Unknown",
      os: info.os || "Unknown",
      status: "online",
      connectedAt: new Date().toISOString(),
      permissions: {},
    };
    this.agents.set(agentId, agent);
    logger.info(`Agent registered: ${agentId} (${agent.hostname})`, { socketId });
    return agent;
  }

  /**
   * Remove Agent by agentId.
   */
  remove(agentId) {
    const agent = this.agents.get(agentId);
    if (agent) {
      this.agents.delete(agentId);
      logger.info(`Agent removed: ${agentId} (${agent.hostname})`);
    }
  }

  /**
   * Remove Agent by socketId (used on disconnect).
   * @returns {object|null} The removed agent, or null if not found.
   */
  removeBySocketId(socketId) {
    for (const [agentId, agent] of this.agents) {
      if (agent.socketId === socketId) {
        this.agents.delete(agentId);
        logger.info(`Agent disconnected: ${agentId} (${agent.hostname})`);
        return agent;
      }
    }
    return null;
  }

  /**
   * Get Agent by agentId.
   */
  get(agentId) {
    return this.agents.get(agentId) || null;
  }

  /**
   * Get Agent by socketId.
   */
  getBySocketId(socketId) {
    for (const agent of this.agents.values()) {
      if (agent.socketId === socketId) return agent;
    }
    return null;
  }

  /**
   * Get all Agents as array (for sending to Controller).
   * Returns a sanitized list (no socketId exposed).
   */
  getAll() {
    return Array.from(this.agents.values()).map((a) => ({
      agentId: a.agentId,
      hostname: a.hostname,
      ip: a.ip,
      os: a.os,
      status: a.status,
      connectedAt: a.connectedAt,
      permissions: a.permissions,
    }));
  }

  /**
   * Update an Agent's granted permissions for a module.
   */
  updatePermission(agentId, module, granted) {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.permissions[module] = granted;
      logger.info(`Permission updated: ${agentId} -> ${module} = ${granted}`);
    }
  }

  /**
   * Check if a module permission is granted.
   */
  hasPermission(agentId, module) {
    const agent = this.agents.get(agentId);
    return agent ? !!agent.permissions[module] : false;
  }
}

// Singleton instance
module.exports = new AgentStore();
