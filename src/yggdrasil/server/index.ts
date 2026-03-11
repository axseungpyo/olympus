import http from "http";
import path from "path";
import express from "express";
import { WebSocketServer, WebSocket } from "ws";
import next from "next";
import { getToken, validateToken } from "./auth";
import { createRouter } from "./routes/index";
import { AsgardWatcher } from "./watcher";
import { parseIndex } from "./parser";
import { getAgentStates } from "./agents";
import fs from "fs/promises";
import { createLogger } from "./logger";
import { loadHistory, getMessages, processCommand, processApproval, saveHistory } from "./odin-channel";

const PORT = parseInt(process.env.PORT || "7777", 10);
const dev = process.env.NODE_ENV !== "production";
const ASGARD_ROOT = path.resolve(process.cwd(), "../..");
const WS_HEARTBEAT_INTERVAL = 30_000;
const log = createLogger({ component: "YggdrasilServer" });

async function main() {
  const nextApp = next({ dev, dir: "./dashboard" });
  const handle = nextApp.getRequestHandler();
  await nextApp.prepare();

  const app = express();
  app.use(express.json());
  app.use(createRouter(ASGARD_ROOT));

  app.all("/{*path}", (req, res) => {
    return handle(req, res);
  });

  const server = http.createServer(app);

  const wssLogs = new WebSocketServer({ noServer: true });
  const wssStatus = new WebSocketServer({ noServer: true });
  const wssOdin = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    const { pathname } = new URL(request.url || "/", `http://localhost:${PORT}`);

    if (pathname === "/ws/logs") {
      wssLogs.handleUpgrade(request, socket, head, (ws) => {
        wssLogs.emit("connection", ws, request);
      });
    } else if (pathname === "/ws/status") {
      wssStatus.handleUpgrade(request, socket, head, (ws) => {
        wssStatus.emit("connection", ws, request);
      });
    } else if (pathname === "/ws/odin") {
      wssOdin.handleUpgrade(request, socket, head, (ws) => {
        wssOdin.emit("connection", ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  // WebSocket heartbeat — detect zombie connections
  function setupHeartbeat(wss: WebSocketServer) {
    const aliveMap = new WeakMap<WebSocket, boolean>();

    wss.on("connection", (ws) => {
      aliveMap.set(ws, true);
      ws.on("pong", () => aliveMap.set(ws, true));
    });

    const interval = setInterval(() => {
      wss.clients.forEach((ws) => {
        if (aliveMap.get(ws) === false) {
          ws.terminate();
          return;
        }
        aliveMap.set(ws, false);
        ws.ping();
      });
    }, WS_HEARTBEAT_INTERVAL);

    wss.on("close", () => clearInterval(interval));
  }

  setupHeartbeat(wssLogs);
  setupHeartbeat(wssStatus);
  setupHeartbeat(wssOdin);

  const watcher = new AsgardWatcher(ASGARD_ROOT);

  function broadcast(wss: WebSocketServer, data: unknown) {
    const message = JSON.stringify(data);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  watcher.on("log-change", ({ lines }) => {
    for (const entry of lines) {
      broadcast(wssLogs, { type: "log", data: entry });
    }
  });

  watcher.on("index-change", ({ tasks }) => {
    broadcast(wssStatus, { type: "chronicle", data: tasks });
  });

  watcher.on("agent-change", ({ agents }) => {
    broadcast(wssStatus, { type: "status", data: agents });
  });

  function authorizeWebSocket(ws: WebSocket, request: http.IncomingMessage, channel: string): boolean {
    const url = new URL(request.url || "/", `http://localhost:${PORT}`);
    const token = url.searchParams.get("token") ?? "";

    if (!validateToken(token)) {
      log.warn({ channel, pathname: url.pathname }, "Rejected unauthorized WebSocket connection");
      ws.close(4001, "Unauthorized");
      return false;
    }

    return true;
  }

  wssLogs.on("connection", async (ws, request) => {
    if (!authorizeWebSocket(ws, request, "logs")) {
      return;
    }

    ws.send(JSON.stringify({ type: "connected", data: { message: "Logs stream connected" } }));
    try {
      const recentLogs = await watcher.getRecentLogs(100);
      for (const entry of recentLogs) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "log", data: entry }));
        }
      }
    } catch (err) {
      log.error({ err }, "Failed to send initial logs");
    }
  });

  wssStatus.on("connection", async (ws, request) => {
    if (!authorizeWebSocket(ws, request, "status")) {
      return;
    }

    ws.send(JSON.stringify({ type: "connected", data: { message: "Status stream connected" } }));
    try {
      const indexPath = path.join(ASGARD_ROOT, "artifacts", "INDEX.md");
      let content = "";
      try {
        content = await fs.readFile(indexPath, "utf-8");
      } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
          log.error({ err }, "Failed to read INDEX.md");
        }
      }
      const tasks = parseIndex(content);
      const agents = await getAgentStates(ASGARD_ROOT, tasks);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "status", data: agents }));
        ws.send(JSON.stringify({ type: "chronicle", data: tasks }));
      }
    } catch (err) {
      log.error({ err }, "Failed to send initial status");
    }
  });

  // Odin Command Channel WebSocket
  wssOdin.on("connection", async (ws, request) => {
    if (!authorizeWebSocket(ws, request, "odin")) return;

    ws.send(JSON.stringify({ type: "connected", data: { message: "Odin channel connected" } }));

    // Send existing messages
    const history = getMessages(50);
    for (const msg of history) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "message", data: msg }));
      }
    }

    // Handle incoming commands
    ws.on("message", async (raw) => {
      try {
        const parsed = JSON.parse(raw.toString());

        if (parsed.type === "command" && typeof parsed.content === "string") {
          const result = await processCommand(parsed.content, ASGARD_ROOT);
          await saveHistory(ASGARD_ROOT);
          for (const msg of result.messages) {
            broadcast(wssOdin, { type: "message", data: msg });
          }
        } else if (parsed.type === "approve" && typeof parsed.approvalId === "string") {
          const result = await processApproval(parsed.approvalId, parsed.approved !== false, ASGARD_ROOT);
          await saveHistory(ASGARD_ROOT);
          for (const msg of result.messages) {
            broadcast(wssOdin, { type: "message", data: msg });
          }
        }
      } catch (err) {
        log.error({ err }, "Failed to process Odin WS message");
      }
    });
  });

  // Load Odin chat history
  await loadHistory(ASGARD_ROOT);

  await watcher.start();

  server.listen(PORT, () => {
    const token = getToken();
    log.info({ port: PORT, url: `http://localhost:${PORT}` }, "Server running");
    log.info({ asgardRoot: ASGARD_ROOT }, "Resolved ASGARD_ROOT");
    log.info({ mode: dev ? "development" : "production" }, "Server mode");
    log.info(
      {
        authEnabled: process.env.YGGDRASIL_AUTH !== "false",
        token,
      },
      "Yggdrasil auth token"
    );
    log.info({ endpoints: ["/ws/logs", "/ws/status", "/ws/odin"] }, "WebSocket endpoints ready");
  });

  const shutdown = async () => {
    log.info("Shutting down");
    await watcher.stop();
    wssLogs.close();
    wssStatus.close();
    wssOdin.close();
    server.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  log.fatal({ err }, "Fatal error");
  process.exit(1);
});
