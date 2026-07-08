# Gateway Server

Server trung gian (relay) cho hệ thống điều khiển máy tính từ xa. Gateway đóng vai trò cầu nối giữa **Agent** (Windows C# app) và **Controller** (Web browser) thông qua Socket.IO.

## Kiến trúc

```
Controller (Web) ←──Socket.IO──→ Gateway (Node.js) ←──Socket.IO──→ Agent (Windows/C#)
```

- **Agent namespace**: `ws://<host>:<port>/agent`
- **Controller namespace**: `ws://<host>:<port>/controller`

## Cài đặt & Chạy

```bash
# Cài dependencies
npm install

# Copy và chỉnh sửa .env
cp .env.example .env

# Chạy (development, hot-reload)
npm run dev

# Chạy (production)
npm start
```

Server mặc định chạy trên **port 3000**.

## Biến môi trường (.env)

| Biến | Mô tả | Mặc định |
|---|---|---|
| `PORT` | Port lắng nghe | `3000` |
| `CORS_ORIGIN` | Allowed origins | `*` |
| `AGENT_AUTH_KEY` | Secret key Agent dùng để xác thực | (bắt buộc) |
| `CONTROLLER_AUTH_KEY` | Secret key Controller dùng để xác thực | (bắt buộc) |
| `LOG_LEVEL` | Mức log: debug, info, warn, error | `info` |

## REST API

| Method | Path | Mô tả |
|---|---|---|
| `GET` | `/` | Health check |
| `GET` | `/api/agents` | Danh sách Agent đang online |

---

## Socket.IO Protocol

### Kết nối

Cả Agent và Controller cần truyền `auth.key` khi kết nối:

```js
// JavaScript (Controller)
const socket = io("http://gateway:3000/controller", {
  auth: { key: "controller-secret-key" }
});
```

```csharp
// C# (Agent) — sử dụng SocketIOClient NuGet package
var socket = new SocketIOClient.SocketIO("http://gateway:3000/agent", new SocketIOOptions
{
    Auth = new { key = "agent-secret-key" }
});
await socket.ConnectAsync();
```

---

### Agent Events (namespace: `/agent`)

#### Agent gửi lên Gateway:

| Event | Data | Mô tả |
|---|---|---|
| `agent:register` | `{ agentId, hostname, ip, os }` | Đăng ký Agent khi kết nối |
| `agent:permission-response` | `{ controllerId, module, granted }` | Trả lời yêu cầu xin quyền (Accept/Deny) |
| `agent:module-data` | `{ controllerId, type, payload }` | Gửi kết quả module (app list, process list, screenshot, file list, power ack...) |
| `agent:keylog-data` | `{ controllerId, keys: [{key, timestamp}] }` | Gửi dữ liệu keylog (stream liên tục) |
| `agent:stream-frame` | `{ controllerId, type, frame }` | Gửi frame stream (live screen/webcam) — *tính năng tương lai* |
| `agent:module-error` | `{ controllerId, module, message }` | Báo lỗi khi thực thi module |

#### Agent nhận từ Gateway:

| Event | Data | Mô tả |
|---|---|---|
| `agent:registered` | `{ success, agentId }` | Xác nhận đăng ký thành công |
| `agent:permission-request` | `{ controllerId, module }` | Yêu cầu xin quyền từ Controller — **hiện popup cho user chọn Accept/Deny** |
| `agent:module-command` | `{ controllerId, module, command, params }` | Lệnh từ Controller (xem bảng module commands bên dưới) |
| `agent:stop-module` | `{ controllerId, module }` | Dừng module (stop keylog, stop stream...) |
| `agent:permission-revoked` | `{ controllerId, module }` | Controller thu hồi quyền |
| `agent:error` | `{ message }` | Thông báo lỗi từ Gateway |

---

### Controller Events (namespace: `/controller`)

#### Controller gửi lên Gateway:

| Event | Data | Mô tả |
|---|---|---|
| `controller:get-agents` | *(callback)* | Lấy danh sách Agent online. Trả về qua callback: `{ agents: [...] }` |
| `controller:request-permission` | `{ agentId, module }` | Yêu cầu xin quyền dùng module trên 1 Agent |
| `controller:module-command` | `{ agentId, module, command, params }` | Gửi lệnh cho module (phải có permission trước) |
| `controller:stop-module` | `{ agentId, module }` | Dừng module |
| `controller:revoke-permission` | `{ agentId, module }` | Thu hồi quyền đã cấp |

#### Controller nhận từ Gateway:

| Event | Data | Mô tả |
|---|---|---|
| `controller:agent-list` | `{ agents: [...] }` | Danh sách Agent (nếu không dùng callback) |
| `controller:agent-online` | `{ agentId, hostname, ip, os, connectedAt }` | Thông báo Agent mới online |
| `controller:agent-offline` | `{ agentId, hostname }` | Thông báo Agent offline |
| `controller:permission-result` | `{ agentId, module, granted }` | Kết quả xin quyền |
| `controller:module-data` | `{ agentId, type, payload }` | Dữ liệu module trả về |
| `controller:keylog-data` | `{ agentId, keys }` | Dữ liệu keylog |
| `controller:stream-frame` | `{ agentId, type, frame }` | Frame stream (tương lai) |
| `controller:module-error` | `{ agentId, module, message }` | Lỗi từ module trên Agent |
| `controller:error` | `{ message }` | Lỗi chung |

---

### Module Commands

| Module | Command | Params | Response type | Mô tả |
|---|---|---|---|---|
| `applications` | `list-apps` | — | `applications` | Danh sách ứng dụng đã cài |
| `processes` | `list-processes` | — | `processes` | Danh sách process đang chạy |
| `processes` | `kill-process` | `{ pid }` | `process-killed` | Kill process theo PID |
| `screenshot` | `take-screenshot` | — | `screenshot` | Chụp màn hình (base64) |
| `keylogger` | `start-keylog` | — | `keylog-data` (stream) | Bắt đầu ghi phím |
| `keylogger` | *(stop via `stop-module`)* | — | — | Dừng ghi phím |
| `file-download` | `list-files` | `{ path }` | `file-list` | Duyệt thư mục |
| `file-download` | `download-file` | `{ path }` | `file-content` | Tải file (base64) |
| `power-control` | `shutdown` | — | `power-ack` | Tắt máy |
| `power-control` | `restart` | — | `power-ack` | Khởi động lại |
| `power-control` | `logoff` | — | `power-ack` | Đăng xuất |

---

## Testing

```bash
# Terminal 1: Chạy Gateway
npm run dev

# Terminal 2: Chạy Mock Agent (giả lập Agent C#)
npm run test:mock-agent

# Terminal 3: Chạy Mock Controller (CLI tương tác)
npm run test:mock-controller
```

Mock Controller có menu CLI cho phép test từng module.

## Cấu trúc thư mục

```
src/
├── index.js              # Entry point (Express + Socket.IO)
├── config.js             # Biến môi trường
├── socket/
│   ├── index.js          # Namespace setup
│   ├── agentHandler.js   # Xử lý event từ Agent
│   └── controllerHandler.js  # Xử lý event từ Controller
├── store/
│   └── agentStore.js     # In-memory Agent registry
├── middleware/
│   └── auth.js           # Xác thực kết nối
└── utils/
    └── logger.js         # Winston logger
```