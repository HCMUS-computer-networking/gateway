/**
 * Mock Controller — simulates a web Controller connecting to Gateway.
 *
 * Usage: node tests/mock-controller.js
 *
 * This script:
 * 1. Connects to Gateway /controller namespace
 * 2. Fetches Agent list
 * 3. Requests permission for "applications" on the first Agent
 * 4. Sends module commands and prints results
 *
 * Run mock-agent.js first, then run this.
 */

const { io } = require("socket.io-client");
const readline = require("readline");

const GATEWAY_URL = "http://localhost:3000/controller";
const AUTH_KEY = "controller-secret-key-change-me";

const socket = io(GATEWAY_URL, {
  auth: { key: AUTH_KEY },
  transports: ["websocket"],
});

let selectedAgentId = null;

// ─── Connection ────────────────────────────────────────────────────────
socket.on("connect", () => {
  console.log(`✅ Connected to Gateway as Controller: ${socket.id}`);
  console.log("   Fetching agent list...\n");

  // Fetch agents
  socket.emit("controller:get-agents", (response) => {
    console.log("📋 Online Agents:");
    if (response.agents.length === 0) {
      console.log("   (no agents online — run mock-agent.js first)");
      return;
    }

    response.agents.forEach((agent, i) => {
      console.log(`   ${i + 1}. ${agent.agentId} (${agent.hostname} / ${agent.ip} / ${agent.os})`);
    });

    // Auto-select first agent
    selectedAgentId = response.agents[0].agentId;
    console.log(`\n🎯 Auto-selected: ${selectedAgentId}`);
    showMenu();
  });
});

// ─── Event Listeners ───────────────────────────────────────────────────
socket.on("controller:agent-online", (data) => {
  console.log(`\n🟢 Agent online: ${data.agentId} (${data.hostname})`);
});

socket.on("controller:agent-offline", (data) => {
  console.log(`\n🔴 Agent offline: ${data.agentId} (${data.hostname})`);
});

socket.on("controller:permission-result", (data) => {
  console.log(`\n🔐 Permission result: ${data.module} = ${data.granted ? "GRANTED ✅" : "DENIED ❌"}`);
  if (data.granted) {
    console.log(`   You can now send commands for "${data.module}"`);
  }
});

socket.on("controller:module-data", (data) => {
  console.log(`\n📦 Module data [${data.type}] from ${data.agentId}:`);
  console.log(JSON.stringify(data.payload, null, 2));
});

socket.on("controller:keylog-data", (data) => {
  const text = data.keys.map((k) => k.key).join("");
  console.log(`\n⌨ Keylog from ${data.agentId}: "${text}"`);
});

socket.on("controller:module-error", (data) => {
  console.error(`\n❌ Module error [${data.module}] from ${data.agentId}: ${data.message}`);
});

socket.on("controller:error", (data) => {
  console.error(`\n❌ Error: ${data.message}`);
});

socket.on("connect_error", (err) => {
  console.error(`❌ Connection error: ${err.message}`);
});

// ─── Interactive Menu ──────────────────────────────────────────────────
function showMenu() {
  console.log("\n═══════════════════════════════════════════");
  console.log(" Commands (type number + Enter):");
  console.log("  1. Request permission: applications");
  console.log("  2. Request permission: processes");
  console.log("  3. Request permission: screenshot");
  console.log("  4. Request permission: keylogger");
  console.log("  5. Request permission: file-download");
  console.log("  6. Request permission: power-control");
  console.log("  ──────────────────────────────────");
  console.log("  10. List applications");
  console.log("  11. List processes");
  console.log("  12. Kill process (PID 1234)");
  console.log("  13. Take screenshot");
  console.log("  14. Start keylogger");
  console.log("  15. Stop keylogger");
  console.log("  16. List files (C:\\)");
  console.log("  17. Download file");
  console.log("  18. Shutdown");
  console.log("  19. Restart");
  console.log("  ──────────────────────────────────");
  console.log("  20. Refresh agent list");
  console.log("   0. Exit");
  console.log("═══════════════════════════════════════════");
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.on("line", (input) => {
  const cmd = input.trim();

  if (!selectedAgentId && cmd !== "20" && cmd !== "0") {
    console.log("❌ No agent selected. Run mock-agent.js first, then press 20 to refresh.");
    return;
  }

  switch (cmd) {
    // ─── Permission Requests ──────────────────────────────────────────
    case "1":
      socket.emit("controller:request-permission", { agentId: selectedAgentId, module: "applications" });
      break;
    case "2":
      socket.emit("controller:request-permission", { agentId: selectedAgentId, module: "processes" });
      break;
    case "3":
      socket.emit("controller:request-permission", { agentId: selectedAgentId, module: "screenshot" });
      break;
    case "4":
      socket.emit("controller:request-permission", { agentId: selectedAgentId, module: "keylogger" });
      break;
    case "5":
      socket.emit("controller:request-permission", { agentId: selectedAgentId, module: "file-download" });
      break;
    case "6":
      socket.emit("controller:request-permission", { agentId: selectedAgentId, module: "power-control" });
      break;

    // ─── Module Commands ──────────────────────────────────────────────
    case "10":
      socket.emit("controller:module-command", {
        agentId: selectedAgentId, module: "applications", command: "list-apps", params: {},
      });
      break;
    case "11":
      socket.emit("controller:module-command", {
        agentId: selectedAgentId, module: "processes", command: "list-processes", params: {},
      });
      break;
    case "12":
      socket.emit("controller:module-command", {
        agentId: selectedAgentId, module: "processes", command: "kill-process", params: { pid: 1234 },
      });
      break;
    case "13":
      socket.emit("controller:module-command", {
        agentId: selectedAgentId, module: "screenshot", command: "take-screenshot", params: {},
      });
      break;
    case "14":
      socket.emit("controller:module-command", {
        agentId: selectedAgentId, module: "keylogger", command: "start-keylog", params: {},
      });
      break;
    case "15":
      socket.emit("controller:stop-module", { agentId: selectedAgentId, module: "keylogger" });
      break;
    case "16":
      socket.emit("controller:module-command", {
        agentId: selectedAgentId, module: "file-download", command: "list-files", params: { path: "C:\\" },
      });
      break;
    case "17":
      socket.emit("controller:module-command", {
        agentId: selectedAgentId, module: "file-download", command: "download-file",
        params: { path: "C:\\Users\\test.txt" },
      });
      break;
    case "18":
      socket.emit("controller:module-command", {
        agentId: selectedAgentId, module: "power-control", command: "shutdown", params: {},
      });
      break;
    case "19":
      socket.emit("controller:module-command", {
        agentId: selectedAgentId, module: "power-control", command: "restart", params: {},
      });
      break;

    // ─── Utility ──────────────────────────────────────────────────────
    case "20":
      socket.emit("controller:get-agents", (response) => {
        console.log("\n📋 Online Agents:");
        response.agents.forEach((agent, i) => {
          console.log(`   ${i + 1}. ${agent.agentId} (${agent.hostname})`);
        });
        if (response.agents.length > 0) {
          selectedAgentId = response.agents[0].agentId;
          console.log(`🎯 Selected: ${selectedAgentId}`);
        }
      });
      break;

    case "0":
      console.log("Bye!");
      socket.close();
      rl.close();
      process.exit(0);
      break;

    default:
      console.log("Unknown command");
      showMenu();
  }
});

console.log("🖥 Mock Controller starting...");
