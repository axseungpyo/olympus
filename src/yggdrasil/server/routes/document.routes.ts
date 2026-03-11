import { Router, type Request, type Response } from "express";
import path from "path";
import fs from "fs/promises";
import { parseIndex, parseDocument } from "../parser";
import { getAgentStates } from "../agents";
import { createLogger } from "../logger";
import {
  buildDependencyGraph,
  detectCycle,
  getExecutionOrder,
  parseDependencies,
  type TPMeta,
} from "../dependency";

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

interface DependencyNodeResponse {
  id: string;
  dependsOn: string[];
  status: string;
}

interface DependencyGraphResponse {
  nodes: DependencyNodeResponse[];
  executionOrder: string[][];
  hasCycle: boolean;
  cycle: string[] | null;
}

export function createDocumentRouter(asgardRoot: string): Router {
  const router = Router();
  const artifactsDir = path.resolve(asgardRoot, "artifacts");
  const log = createLogger({ component: "DocumentRoutes" });

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

  function readTaskStatusMap(indexContent: string): Map<string, TPMeta["status"]> {
    const statuses = new Map<string, TPMeta["status"]>();

    for (const task of parseIndex(indexContent)) {
      statuses.set(task.id, task.status);
    }

    const completedSection = indexContent.match(/##\s+Completed Tasks([\s\S]*)$/i)?.[1] ?? "";
    for (const line of completedSection.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("|")) continue;

      const cells = trimmed
        .split("|")
        .map((cell) => cell.trim())
        .filter(Boolean);

      if (cells.length >= 4 && /^TP-\d{3}$/.test(cells[0])) {
        statuses.set(cells[0], "done");
      }
    }

    return statuses;
  }

  async function readTpDependencyState(): Promise<{
    tpMeta: TPMeta[];
    response: DependencyGraphResponse;
  }> {
    const handoffDir = path.join(artifactsDir, "handoff");
    const [entries, indexContent] = await Promise.all([
      fs.readdir(handoffDir),
      readIndexFile(),
    ]);

    const tpFiles = entries
      .filter((entry) => /^TP-\d{3}\.md$/.test(entry))
      .sort((a, b) => a.localeCompare(b));

    const taskStatusMap = readTaskStatusMap(indexContent);

    const tpMeta = await Promise.all(
      tpFiles.map(async (file) => {
        const content = await fs.readFile(path.join(handoffDir, file), "utf-8");
        const id = file.replace(/\.md$/, "");
        return {
          id,
          dependsOn: parseDependencies(content),
          status: taskStatusMap.get(id) ?? "draft",
        } satisfies TPMeta;
      })
    );

    const graph = buildDependencyGraph(tpMeta);
    const cycle = detectCycle(graph);
    const executionOrder = cycle ? [] : getExecutionOrder(graph);

    return {
      tpMeta,
      response: {
        nodes: tpMeta.map((tp) => ({
          id: tp.id,
          dependsOn: tp.dependsOn,
          status: tp.status,
        })),
        executionOrder,
        hasCycle: cycle !== null,
        cycle,
      },
    };
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
    const normalizedArg = normalizeTpArg(args);

    if (normalizedArg === "") {
      return { status: 400, body: { error: "args must be empty or a TP id like TP-008" } };
    }

    const handoffDir = path.join(artifactsDir, "handoff");
    const { tpMeta, response: dependencyState } = await readTpDependencyState();
    const tpFiles = tpMeta.map((tp) => `${tp.id}.md`);

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
        const cycleCheck = dependencyState.hasCycle
          ? {
              name: "dependency-cycle",
              pass: !dependencyState.cycle?.includes(file.replace(/\.md$/, "")),
            }
          : { name: "dependency-cycle", pass: true };

        return {
          id: file.replace(/\.md$/, ""),
          file,
          valid: [...checks, cycleCheck].every((check) => check.pass),
          checks: [...checks, cycleCheck],
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
        hasCycle: dependencyState.hasCycle,
        cycle: dependencyState.cycle,
        results,
      },
    };
  }

  async function handleDocumentRequest(documentId: string, res: Response) {
    const normalizedId = documentId.toUpperCase();

    if (!/^(TP|RP)-\d{3}$/.test(normalizedId)) {
      res.status(400).json({ error: "Invalid id. Must be TP-NNN or RP-NNN" });
      return;
    }

    const fileName = `${normalizedId}.md`;
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
      res.json({
        type: normalizedId.slice(0, 2).toLowerCase(),
        id: normalizedId.slice(3),
        title: doc.title,
        content: doc.content,
      });
    } catch (err: unknown) {
      log.error({ err, fileName }, "Document not found");
      res.status(404).json({ error: "Document not found" });
    }
  }

  async function handleExecuteSkill(skill: string, args: string, res: Response) {
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
  }

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

  router.get("/api/docs/:id", async (req: Request, res: Response) => {
    await handleDocumentRequest(req.params.id as string, res);
  });

  router.post("/api/skills/:name/execute", async (req: Request, res: Response) => {
    const { name } = req.params;
    const { args = "" } = (req.body ?? {}) as { args?: unknown };

    if (typeof name !== "string" || typeof args !== "string") {
      res.status(400).json({ error: "Body must be { args: string }" });
      return;
    }

    await handleExecuteSkill(name, args, res);
  });

  router.get("/api/dependency-graph", async (_req: Request, res: Response) => {
    try {
      const { response } = await readTpDependencyState();
      res.json(response);
    } catch (err: unknown) {
      log.error({ err }, "/api/dependency-graph error");
      res.status(500).json({ error: "Failed to get dependency graph" });
    }
  });

  router.get("/api/agents", async (_req: Request, res: Response) => {
    try {
      const content = await readIndexFile();
      const tasks = parseIndex(content);
      const agents = await getAgentStates(asgardRoot, tasks);
      res.json({ agents });
    } catch (err: unknown) {
      log.error({ err }, "/api/agents error");
      res.status(500).json({ error: "Failed to get agents" });
    }
  });

  router.get("/api/document/:type/:id", async (req: Request, res: Response) => {
    const { type, id } = req.params;

    if (type !== "tp" && type !== "rp") {
      res.status(400).json({ error: "Invalid type. Must be 'tp' or 'rp'" });
      return;
    }

    if (!/^\d{3}$/.test(id as string)) {
      res.status(400).json({ error: "Invalid id. Must be 3-digit number" });
      return;
    }

    await handleDocumentRequest(`${type}-${id}`, res);
  });

  router.get("/api/skill/:name/doc", async (req: Request, res: Response) => {
    const { name } = req.params;

    if (!/^[a-z][a-z0-9-]*$/.test(name as string)) {
      res.status(400).json({ error: "Invalid skill name" });
      return;
    }

    const skillPath = path.resolve(asgardRoot, ".claude", "skills", name as string, "SKILL.md");

    if (!skillPath.startsWith(path.resolve(asgardRoot, ".claude", "skills"))) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    try {
      const content = await fs.readFile(skillPath, "utf-8");
      res.json({ name, content });
    } catch {
      res.status(404).json({ error: "Skill document not found" });
    }
  });

  router.post("/api/skill/execute", async (req: Request, res: Response) => {
    const { skill, args = "" } = (req.body ?? {}) as {
      skill?: unknown;
      args?: unknown;
    };

    if (typeof skill !== "string" || typeof args !== "string") {
      res.status(400).json({ error: "Body must be { skill: string, args: string }" });
      return;
    }

    await handleExecuteSkill(skill, args, res);
  });

  return router;
}
