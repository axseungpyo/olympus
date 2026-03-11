import { Router } from "express";
import { authMiddleware } from "../infra/auth";
import type { Container } from "../di/container";
import { createHealthRouter } from "./health.routes";
import { createAgentRouter } from "./agent.routes";
import { createTaskRouter } from "./task.routes";
import { createOdinRouter } from "./odin.routes";
import { createMcpRouter } from "./mcp.routes";
import { createDocumentRouter } from "./document.routes";

export function createRouter(container: Container): Router {
  const router = Router();

  router.get("/api/health", (req, res) => container.healthController.health(req, res));

  router.use("/api", authMiddleware);
  router.use(createHealthRouter(container.healthController));
  router.use(createAgentRouter(container.agentController));
  router.use(createTaskRouter(container.taskController));
  router.use(createOdinRouter(container.odinController));
  router.use(createMcpRouter(container.mcpController));
  router.use(createDocumentRouter(container.documentController));

  return router;
}
