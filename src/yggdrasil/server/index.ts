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

const PORT = parseInt(process.env.PORT || "7777", 10);
const dev = process.env.NODE_ENV !== "production";
const ASGARD_ROOT = path.resolve(process.cwd(), "../..");

async function main() {
  // Next.js app
  const nextApp = next({ dev, dir: "./dashboard" });
  const handle = nextApp.getRequestHandler();
  await nextApp.prepare();

  // Express
  const app = express();
  app.use(express.json());
  app.use(createRouter(ASGARD_ROOT));

  // Next.js fallback handler
  app.all("/{*path}", (req, res) => {
    return handle(req, res);
  });

  // HTTP server
  const server = http.createServer(app);

  // WebSocket servers
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

  // File watcher
  const watcher = new AsgardWatcher(ASGARD_ROOT);

  // Helper to broadcast to all clients of a WebSocketServer
  function broadcast(wss: WebSocketServer, data: unknown) {
    const message = JSON.stringify(data);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  // Watcher events → WebSocket broadcasts
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

  // Send initial data on WebSocket connection
  wssLogs.on("connection", async (ws) => {
    ws.send(JSON.stringify({ type: "connected", data: { message: "Logs stream connected" } }));
    const recentLogs = await watcher.getRecentLogs(100);
    for (const entry of recentLogs) {
      ws.send(JSON.stringify({ type: "log", data: entry }));
    }
  });

  wssStatus.on("connection", async (ws) => {
    ws.send(JSON.stringify({ type: "connected", data: { message: "Status stream connected" } }));
    try {
      const indexPath = path.join(ASGARD_ROOT, "artifacts", "INDEX.md");
      let content = "";
      try {
        content = await fs.readFile(indexPath, "utf-8");
      } catch {
        // INDEX.md may not exist yet
      }
      const tasks = parseIndex(content);
      const agents = await getAgentStates(ASGARD_ROOT, tasks);
      ws.send(JSON.stringify({ type: "status", data: agents }));
      ws.send(JSON.stringify({ type: "chronicle", data: tasks }));
    } catch {
      // graceful
    }
  });

  // Start
  await watcher.start();

  server.listen(PORT, () => {
    console.log(`[Yggdrasil] Server running at http://localhost:${PORT}`);
    console.log(`[Yggdrasil] ASGARD_ROOT: ${ASGARD_ROOT}`);
    console.log(`[Yggdrasil] Mode: ${dev ? "development" : "production"}`);
    console.log(`[Yggdrasil] WebSocket endpoints: /ws/logs, /ws/status`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log("\n[Yggdrasil] Shutting down...");
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
  console.error("[Yggdrasil] Fatal error:", err);
  process.exit(1);
});
