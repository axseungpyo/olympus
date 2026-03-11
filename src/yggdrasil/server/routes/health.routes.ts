import { Router, type Request, type Response } from "express";
import { parseIndex } from "../domain/tasks/task-parser";
import { getAgentStates } from "../domain/agents/agent-state";
import { createLogger } from "../infra/logger";
import { collectMetrics } from "../infra/metrics";
import type { Container } from "../di/container";
import fs from "fs/promises";
import path from "path";

export function createHealthRouter(container: Container): Router {
  const router = Router();
  const artifactsDir = path.resolve(container.asgardRoot, "artifacts");
  const log = createLogger({ component: "HealthRoutes" });

  async function readIndexFile(): Promise<string> {
    try {
      return await fs.readFile(path.join(artifactsDir, "INDEX.md"), "utf-8");
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        log.error({ err }, "Failed to read INDEX.md");
      }
      return "";
    }
  }

  router.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", uptime: process.uptime(), timestamp: Date.now() });
  });

  router.get("/api/status", async (_req: Request, res: Response) => {
    try {
      const content = await readIndexFile();
      const tasks = parseIndex(content);
      const agents = await getAgentStates(container.agentRepository, tasks);
      res.json({
        agents,
        activeTasks: tasks.filter(
          (t) => t.status === "in-progress" || t.status === "draft"
        ).length,
        completedTasks: tasks.filter((t) => t.status === "done").length,
      });
    } catch (err: unknown) {
      log.error({ err }, "/api/status error");
      res.status(500).json({ error: "Failed to get status" });
    }
  });

  router.get("/api/metrics", async (_req: Request, res: Response) => {
    try {
      const metrics = await collectMetrics(container.asgardRoot);
      res.json(metrics);
    } catch (err: unknown) {
      log.error({ err }, "/api/metrics error");
      res.status(500).json({ error: "Failed to get metrics" });
    }
  });

  return router;
}
