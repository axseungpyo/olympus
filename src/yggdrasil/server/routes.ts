import { Router, type Request, type Response } from "express";
import path from "path";
import fs from "fs/promises";
import { parseIndex, parseDocument } from "./parser";
import { getAgentStates } from "./agents";
import { createLogger } from "./logger";

export function createRouter(asgardRoot: string): Router {
  const router = Router();
  const artifactsDir = path.resolve(asgardRoot, "artifacts");
  const log = createLogger({ component: "Routes" });

  async function readIndexFile(): Promise<string> {
    try {
      return await fs.readFile(
        path.join(artifactsDir, "INDEX.md"),
        "utf-8"
      );
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        log.error({ err }, "Failed to read INDEX.md");
      }
      return "";
    }
  }

  // GET /api/health
  router.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", uptime: process.uptime(), timestamp: Date.now() });
  });

  // GET /api/status
  router.get("/api/status", async (_req: Request, res: Response) => {
    try {
      const content = await readIndexFile();
      const tasks = parseIndex(content);
      const agents = await getAgentStates(asgardRoot, tasks);
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

  // GET /api/chronicle
  router.get("/api/chronicle", async (_req: Request, res: Response) => {
    try {
      const content = await readIndexFile();
      const tasks = parseIndex(content);
      res.json({ tasks });
    } catch (err: unknown) {
      log.error({ err }, "/api/chronicle error");
      res.status(500).json({ error: "Failed to get chronicle" });
    }
  });

  // GET /api/document/:type/:id
  router.get(
    "/api/document/:type/:id",
    async (req: Request, res: Response) => {
      const { type, id } = req.params;

      if (type !== "tp" && type !== "rp") {
        res.status(400).json({ error: "Invalid type. Must be 'tp' or 'rp'" });
        return;
      }

      if (!/^\d{3}$/.test(id as string)) {
        res.status(400).json({ error: "Invalid id. Must be 3-digit number" });
        return;
      }

      const fileName = `${type.toUpperCase()}-${id}.md`;
      const filePath = path.resolve(artifactsDir, "handoff", fileName);

      if (!filePath.startsWith(artifactsDir)) {
        res.status(403).json({ error: "Access denied" });
        return;
      }

      try {
        const doc = await parseDocument(filePath);
        if (!doc.content) {
          res.status(404).json({ error: "Document not found" });
          return;
        }
        res.json({ type, id, title: doc.title, content: doc.content });
      } catch (err: unknown) {
        log.error({ err, fileName }, "Document not found");
        res.status(404).json({ error: "Document not found" });
      }
    }
  );

  return router;
}
