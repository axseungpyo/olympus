import { Router, type Request, type Response } from "express";
import path from "path";
import fs from "fs/promises";
import { parseIndex, parseDocument } from "./parser";
import { getAgentStates } from "./agents";
import { createLogger } from "./logger";

const ALLOWED_SKILLS = ["status", "validate"] as const;
type AllowedSkill = (typeof ALLOWED_SKILLS)[number];

interface ValidationCheck {
  name: string;
  pass: boolean;
}

interface ValidationResult {
  id: string;
  file: string;
  valid: boolean;
  checks: ValidationCheck[];
}

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

  function normalizeTpArg(args: string): string | null {
    const trimmed = args.trim().toUpperCase();
    if (!trimmed) return null;
    return /^TP-\d{3}$/.test(trimmed) ? trimmed : "";
  }

  function buildValidationChecks(content: string): ValidationCheck[] {
    return [
      { name: "title", pass: /^#\s+TP-\d{3}:/m.test(content) },
      {
        name: "agent-target-or-metadata",
        pass: /^##\s+Agent Target\b/m.test(content) || /- Agent Target:\s*\S+/m.test(content),
      },
      {
        name: "complexity-or-metadata",
        pass: /^##\s+Complexity Hint\b/m.test(content) || /- Complexity:\s*\S+/m.test(content),
      },
      { name: "objective", pass: /^##\s+Objective\b/m.test(content) },
      {
        name: "scope",
        pass: /^##\s+Scope\b/m.test(content) || /^##\s+Scope In\b/m.test(content),
      },
      { name: "acceptance-criteria", pass: /^##\s+Acceptance Criteria\b/m.test(content) },
    ];
  }

  async function executeStatusSkill() {
    const content = await readIndexFile();
    const tasks = parseIndex(content);
    const agents = await getAgentStates(asgardRoot, tasks);

    return {
      skill: "status" as const,
      summary: {
        totalTasks: tasks.length,
        activeTasks: tasks.filter(
          (t) => t.status === "in-progress" || t.status === "draft"
        ).length,
        completedTasks: tasks.filter((t) => t.status === "done").length,
        blockedTasks: tasks.filter((t) => t.status === "blocked").length,
      },
      agents,
      tasks,
    };
  }

  async function executeValidateSkill(args: string) {
    const handoffDir = path.join(artifactsDir, "handoff");
    const normalizedArg = normalizeTpArg(args);

    if (normalizedArg === "") {
      return { status: 400, body: { error: "args must be empty or a TP id like TP-008" } };
    }

    const entries = await fs.readdir(handoffDir);
    const tpFiles = entries
      .filter((entry) => /^TP-\d{3}\.md$/.test(entry))
      .sort((a, b) => a.localeCompare(b));

    const selectedFiles = normalizedArg
      ? tpFiles.filter((file) => file === `${normalizedArg}.md`)
      : tpFiles;

    if (normalizedArg && selectedFiles.length === 0) {
      return { status: 404, body: { error: `TP not found: ${normalizedArg}` } };
    }

    const results: ValidationResult[] = await Promise.all(
      selectedFiles.map(async (file) => {
        const content = await fs.readFile(path.join(handoffDir, file), "utf-8");
        const checks = buildValidationChecks(content);
        return {
          id: file.replace(/\.md$/, ""),
          file,
          valid: checks.every((check) => check.pass),
          checks,
        };
      })
    );

    return {
      status: 200,
      body: {
        skill: "validate" as const,
        target: normalizedArg ?? "all",
        total: results.length,
        valid: results.filter((result) => result.valid).length,
        invalid: results.filter((result) => !result.valid).length,
        results,
      },
    };
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

  // POST /api/skill/execute
  router.post("/api/skill/execute", async (req: Request, res: Response) => {
    const { skill, args = "" } = (req.body ?? {}) as {
      skill?: unknown;
      args?: unknown;
    };

    if (typeof skill !== "string" || typeof args !== "string") {
      res.status(400).json({ error: "Body must be { skill: string, args: string }" });
      return;
    }

    if (!ALLOWED_SKILLS.includes(skill as AllowedSkill)) {
      log.warn({ skill }, "Rejected skill execution request");
      res.status(403).json({ error: "Skill not allowed" });
      return;
    }

    try {
      log.info({ skill, args }, "Executing skill request");

      if (skill === "status") {
        res.json(await executeStatusSkill());
        return;
      }

      const result = await executeValidateSkill(args);
      res.status(result.status).json(result.body);
    } catch (err: unknown) {
      log.error({ err, skill, args }, "Skill execution failed");
      res.status(500).json({ error: "Failed to execute skill" });
    }
  });

  return router;
}
