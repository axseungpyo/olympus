import http from "http";
import path from "path";
import express from "express";
import next from "next";
import { getToken } from "./infra/auth";
import { createRouter } from "./routes/index";
import { createContainer } from "./di/container";
import { AsgardWatcher } from "./infra/watcher";
import { createLogger } from "./infra/logger";
import { createOdinChannel } from "./domain/odin/odin-channel";
import { setupWebSockets } from "./websocket";

const PORT = parseInt(process.env.PORT || "7777", 10);
const dev = process.env.NODE_ENV !== "production";
const ASGARD_ROOT = path.resolve(process.cwd(), "../..");
const log = createLogger({ component: "YggdrasilServer" });

async function main() {
  const nextApp = next({ dev, dir: "./dashboard" });
  const handle = nextApp.getRequestHandler();
  await nextApp.prepare();
  const container = createContainer(ASGARD_ROOT);
  const odinChannel = createOdinChannel({
    messageRepository: container.messageRepository,
    skillRegistry: container.skillRegistry,
    approvalStore: container.approvalStore,
  });

  const app = express();
  app.use(express.json());
  app.use(createRouter(container));

  app.all("/{*path}", (req, res) => {
    return handle(req, res);
  });

  const server = http.createServer(app);

  const watcher = new AsgardWatcher(container);
  setupWebSockets(server, watcher, container, odinChannel);

  await odinChannel.loadHistory();

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
