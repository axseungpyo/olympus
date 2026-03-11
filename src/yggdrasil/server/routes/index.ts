import { Router, type Response } from "express";
import { authMiddleware } from "../infra/auth";
import { createHealthRouter } from "./health.routes";
import { createAgentRouter } from "./agent.routes";
import { createTaskRouter } from "./task.routes";
import { createOdinRouter } from "./odin.routes";
import { createMcpRouter } from "./mcp.routes";
import { createDocumentRouter } from "./document.routes";

export function createRouter(asgardRoot: string): Router {
  const router = Router();

  router.get("/api/health", (_req, res: Response) => {
    res.json({ status: "ok", uptime: process.uptime(), timestamp: Date.now() });
  });

  router.use("/api", authMiddleware);
  router.use(createHealthRouter(asgardRoot));
  router.use(createAgentRouter(asgardRoot));
  router.use(createTaskRouter(asgardRoot));
  router.use(createOdinRouter(asgardRoot));
  router.use(createMcpRouter(asgardRoot));
  router.use(createDocumentRouter(asgardRoot));

  return router;
}
