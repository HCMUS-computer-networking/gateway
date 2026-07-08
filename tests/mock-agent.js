/**
 * Mock Agent — simulates a Windows C# Agent connecting to Gateway.
 *
 * Usage: node tests/mock-agent.js
 *
 * This script:
 * 1. Connects to Gateway /agent namespace
 * 2. Registers with fake machine info
 * 3. Listens for permission requests and auto-accepts them
 * 4. Responds to module commands with fake data
 */

const { io } = require("socket.io-client");

const GATEWAY_URL = "http://localhost:3000/agent";
const AUTH_KEY = "agent-secret-key-change-me";
const GATEWAY_SECRET = "gateway-secret-key-change-me";

const AGENT_ID = `MOCK-AGENT-${Date.now()}`;

const socket = io(GATEWAY_URL, {
  auth: { key: AUTH_KEY },
  transports: ["websocket"],
});

// Helper: verify that the event comes from a legitimate Gateway
function verifyGateway(data, eventName) {
  if (!data.gatewayKey || data.gatewayKey !== GATEWAY_SECRET) {
    console.error(`\u274C [${eventName}] Rejected: invalid gatewayKey`);
    return false;
  }
  return true;
}

// ─── Connection ────────────────────────────────────────────────────────
socket.on("connect", () => {
  console.log(`✅ Connected to Gateway as socket: ${socket.id}`);

  // Register
  socket.emit("agent:register", {
    agentId: AGENT_ID,
    hostname: "DESKTOP-MOCK-001",
    ip: "192.168.1.100",
    os: "Windows 11 Pro",
  });
});

socket.on("agent:registered", (data) => {
  console.log(`✅ Registered: ${JSON.stringify(data)}`);
});

// ─── Permission Requests (auto-accept for testing) ─────────────────────
socket.on("agent:permission-request", (data) => {
  if (!verifyGateway(data, "permission-request")) return;

  console.log(`🔐 Permission request: module="${data.module}" from controller=${data.controllerId}`);
  console.log(`   ➡ Auto-accepting for testing...`);

  socket.emit("agent:permission-response", {
    controllerId: data.controllerId,
    module: data.module,
    granted: true,
  });
});

// ─── Module Commands ───────────────────────────────────────────────────
socket.on("agent:module-command", (data) => {
  if (!verifyGateway(data, "module-command")) return;

  console.log(`📦 Module command: [${data.module}:${data.command}]`, data.params);

  const { controllerId, module, command, params } = data;

  switch (module) {
    case "applications":
      socket.emit("agent:module-data", {
        controllerId,
        type: "applications",
        payload: [
          { name: "Google Chrome", version: "126.0.6478.127", publisher: "Google LLC" },
          { name: "Visual Studio Code", version: "1.91.0", publisher: "Microsoft" },
          { name: "Discord", version: "1.0.9035", publisher: "Discord Inc." },
          { name: "Notepad++", version: "8.6.9", publisher: "Notepad++ Team" },
        ],
      });
      break;

    case "processes":
      if (command === "list-processes") {
        socket.emit("agent:module-data", {
          controllerId,
          type: "processes",
          payload: [
            { pid: 1234, name: "chrome.exe", cpu: 12.5, memory: 350000 },
            { pid: 5678, name: "code.exe", cpu: 5.2, memory: 200000 },
            { pid: 9012, name: "explorer.exe", cpu: 1.0, memory: 85000 },
            { pid: 3456, name: "discord.exe", cpu: 3.8, memory: 180000 },
          ],
        });
      } else if (command === "kill-process") {
        socket.emit("agent:module-data", {
          controllerId,
          type: "process-killed",
          payload: { pid: params.pid, success: true },
        });
      }
      break;

    case "screenshot":
      // Send a tiny 1x1 pixel PNG as base64 (placeholder)
      socket.emit("agent:module-data", {
        controllerId,
        type: "screenshot",
        payload: {
          image: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
          timestamp: new Date().toISOString(),
          width: 1920,
          height: 1080,
        },
      });
      break;

    case "keylogger":
      if (command === "start-keylog") {
        console.log("   ⌨ Keylogger started (simulating keypresses...)");
        // Simulate keypresses every 2 seconds
        const interval = setInterval(() => {
          socket.emit("agent:keylog-data", {
            controllerId,
            keys: [
              { key: "H", timestamp: Date.now() },
              { key: "e", timestamp: Date.now() + 50 },
              { key: "l", timestamp: Date.now() + 100 },
              { key: "l", timestamp: Date.now() + 150 },
              { key: "o", timestamp: Date.now() + 200 },
            ],
          });
        }, 2000);
        // Store interval for cleanup
        socket._keylogInterval = interval;
      }
      break;

    case "file-download":
      if (command === "list-files") {
        socket.emit("agent:module-data", {
          controllerId,
          type: "file-list",
          payload: {
            path: params.path || "C:\\",
            items: [
              { name: "Users", type: "directory", size: 0 },
              { name: "Program Files", type: "directory", size: 0 },
              { name: "Windows", type: "directory", size: 0 },
              { name: "pagefile.sys", type: "file", size: 4294967296 },
            ],
          },
        });
      } else if (command === "download-file") {
        socket.emit("agent:module-data", {
          controllerId,
          type: "file-content",
          payload: {
            path: params.path,
            filename: params.path.split("\\").pop(),
            content: Buffer.from("Hello, this is mock file content!").toString("base64"),
            size: 33,
          },
        });
      }
      break;

    case "power-control":
      console.log(`   ⚡ Power command: ${command}`);
      socket.emit("agent:module-data", {
        controllerId,
        type: "power-ack",
        payload: { command, scheduled: true, message: `${command} will execute in 5 seconds` },
      });
      break;

    default:
      socket.emit("agent:module-error", {
        controllerId,
        module,
        message: `Unknown module: ${module}`,
      });
  }
});

// ─── Stop Module ───────────────────────────────────────────────────────
socket.on("agent:stop-module", (data) => {
  if (!verifyGateway(data, "stop-module")) return;

  console.log(`🛑 Stop module: ${data.module}`);
  if (data.module === "keylogger" && socket._keylogInterval) {
    clearInterval(socket._keylogInterval);
    socket._keylogInterval = null;
    console.log("   ⌨ Keylogger stopped");
  }
});

// ─── Permission Revoked ────────────────────────────────────────────────
socket.on("agent:permission-revoked", (data) => {
  if (!verifyGateway(data, "permission-revoked")) return;

  console.log(`🔓 Permission revoked: ${data.module}`);
});

// ─── Errors ────────────────────────────────────────────────────────────
socket.on("agent:error", (data) => {
  console.error(`❌ Error: ${data.message}`);
});

socket.on("connect_error", (err) => {
  console.error(`❌ Connection error: ${err.message}`);
});

socket.on("disconnect", (reason) => {
  console.log(`🔌 Disconnected: ${reason}`);
});

// ─── Graceful Shutdown ─────────────────────────────────────────────────
process.on("SIGINT", () => {
  console.log("\nShutting down mock agent...");
  if (socket._keylogInterval) clearInterval(socket._keylogInterval);
  socket.close();
  process.exit(0);
});

console.log(`🤖 Mock Agent starting... (ID: ${AGENT_ID})`);
