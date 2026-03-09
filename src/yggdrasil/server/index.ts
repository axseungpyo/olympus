import http from "http";
import path from "path";
import express from "express";
import { WebSocketServer, WebSocket } from "ws";
import next from "next";
import { createRouter } from "./routes";
import { AsgardWatcher } from "./watcher";
import { parseIndex } from "./parser";
import { getAgentStates } from "./agents";
import fs from "fs/promises";
import { createLogger } from "./logger";

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

  wssLogs.on("connection", async (ws) => {
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

  wssStatus.on("connection", async (ws) => {
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

  await watcher.start();

  server.listen(PORT, () => {
    log.info({ port: PORT, url: `http://localhost:${PORT}` }, "Server running");
    log.info({ asgardRoot: ASGARD_ROOT }, "Resolved ASGARD_ROOT");
    log.info({ mode: dev ? "development" : "production" }, "Server mode");
    log.info({ endpoints: ["/ws/logs", "/ws/status"] }, "WebSocket endpoints ready");
  });

  const shutdown = async () => {
    log.info("Shutting down");
    await watcher.stop();
    wssLogs.close();
    wssStatus.close();
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
