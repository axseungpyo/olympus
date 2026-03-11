import { Router, type Response } from "express";
import { authMiddleware } from "../infra/auth";
import type { Container } from "../di/container";
import type { OdinChannel } from "../domain/odin/odin-channel";
import { createHealthRouter } from "./health.routes";
import { createAgentRouter } from "./agent.routes";
import { createTaskRouter } from "./task.routes";
import { createOdinRouter } from "./odin.routes";
import { createMcpRouter } from "./mcp.routes";
import { createDocumentRouter } from "./document.routes";

export function createRouter(container: Container, odinChannel: OdinChannel): Router {
  const router = Router();

  router.get("/api/health", (_req, res: Response) => {
    res.json({ status: "ok", uptime: process.uptime(), timestamp: Date.now() });
  });

  router.use("/api", authMiddleware);
  router.use(createHealthRouter(container));
  router.use(createAgentRouter(container));
  router.use(createTaskRouter(container));
  router.use(createOdinRouter(odinChannel));
  router.use(createMcpRouter(container.asgardRoot));
  router.use(createDocumentRouter(container));

  return router;
}
