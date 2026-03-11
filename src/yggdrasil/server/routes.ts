import { Router, type Request, type Response } from "express";
import path from "path";
import fs from "fs/promises";
import { parseIndex, parseDocument } from "./parser";
import { getAgentStates } from "./agents";
import { authMiddleware } from "./auth";
import { createLogger } from "./logger";
import { collectMetrics } from "./metrics";
import {
  buildDependencyGraph,
  detectCycle,
  getExecutionOrder,
  parseDependencies,
  type TPMeta,
} from "./dependency";
import {
  getMessages,
  processCommand,
  processApproval,
  saveHistory,
} from "./odin-channel";
import {
  startAgent,
  stopAgent,
  getAgentHealth,
  AGENT_MODES,
} from "./control";
import {
  listTasks,
  getTask,
  createTask,
  updateTaskStatus,
  deleteTask,
  type CreateTaskInput,
} from "./task-manager";
import type { AgentName, TaskStatus } from "../dashboard/lib/types";
import { AGENT_NAMES } from "../dashboard/lib/constants";

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

  // GET /api/health
  router.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", uptime: process.uptime(), timestamp: Date.now() });
  });

  router.use("/api", authMiddleware);

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

  // GET /api/dependency-graph
  router.get("/api/dependency-graph", async (_req: Request, res: Response) => {
    try {
      const { response } = await readTpDependencyState();
      res.json(response);
    } catch (err: unknown) {
      log.error({ err }, "/api/dependency-graph error");
      res.status(500).json({ error: "Failed to get dependency graph" });
    }
  });

  // GET /api/metrics
  router.get("/api/metrics", async (_req: Request, res: Response) => {
    try {
      const metrics = await collectMetrics(asgardRoot);
      res.json(metrics);
    } catch (err: unknown) {
      log.error({ err }, "/api/metrics error");
      res.status(500).json({ error: "Failed to get metrics" });
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

  // GET /api/skill/:name/doc — Skill SKILL.md 문서 조회
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

  // ── Agent Control (Phase 2) ──

  function isValidAgentName(name: string): name is AgentName {
    return (AGENT_NAMES as readonly string[]).includes(name);
  }

  // GET /api/agent/:name/health
  router.get("/api/agent/:name/health", async (req: Request, res: Response) => {
    const { name } = req.params;
    if (!isValidAgentName(name as string)) {
      res.status(400).json({ error: "Invalid agent name" });
      return;
    }
    try {
      const health = await getAgentHealth(asgardRoot, name as AgentName);
      res.json(health);
    } catch (err: unknown) {
      log.error({ err, agent: name }, "Agent health check failed");
      res.status(500).json({ error: "Health check failed" });
    }
  });

  // POST /api/agent/:name/start
  router.post("/api/agent/:name/start", async (req: Request, res: Response) => {
    const { name } = req.params;
    if (!isValidAgentName(name as string)) {
      res.status(400).json({ error: "Invalid agent name" });
      return;
    }

    const { tp, mode } = (req.body ?? {}) as { tp?: string; mode?: string };
    if (!tp || typeof tp !== "string") {
      res.status(400).json({ error: "Body must include { tp: string }" });
      return;
    }

    try {
      log.info({ agent: name, tp, mode }, "Agent start request");
      const result = await startAgent(asgardRoot, name as AgentName, { tp, mode });
      res.status(result.success ? 200 : 400).json(result);
    } catch (err: unknown) {
      log.error({ err, agent: name }, "Agent start failed");
      res.status(500).json({ error: "Failed to start agent" });
    }
  });

  // POST /api/agent/:name/stop
  router.post("/api/agent/:name/stop", async (req: Request, res: Response) => {
    const { name } = req.params;
    if (!isValidAgentName(name as string)) {
      res.status(400).json({ error: "Invalid agent name" });
      return;
    }

    try {
      log.info({ agent: name }, "Agent stop request");
      const result = await stopAgent(asgardRoot, name as AgentName);
      res.status(result.success ? 200 : 400).json(result);
    } catch (err: unknown) {
      log.error({ err, agent: name }, "Agent stop failed");
      res.status(500).json({ error: "Failed to stop agent" });
    }
  });

  // GET /api/agent/modes
  router.get("/api/agent/modes", (_req: Request, res: Response) => {
    res.json(AGENT_MODES);
  });

  // ── Task Management (Phase 3) ──

  // GET /api/tasks
  router.get("/api/tasks", async (_req: Request, res: Response) => {
    try {
      const data = await listTasks(asgardRoot);
      res.json(data);
    } catch (err: unknown) {
      log.error({ err }, "/api/tasks error");
      res.status(500).json({ error: "Failed to list tasks" });
    }
  });

  // GET /api/tasks/:id
  router.get("/api/tasks/:id", async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!/^TP-\d{3}$/i.test(id as string)) {
      res.status(400).json({ error: "Invalid task ID format. Expected TP-NNN" });
      return;
    }
    try {
      const task = await getTask(asgardRoot, (id as string).toUpperCase());
      if (!task) {
        res.status(404).json({ error: "Task not found" });
        return;
      }
      res.json(task);
    } catch (err: unknown) {
      log.error({ err, id }, "/api/tasks/:id error");
      res.status(500).json({ error: "Failed to get task" });
    }
  });

  // POST /api/tasks
  router.post("/api/tasks", async (req: Request, res: Response) => {
    const body = req.body as Partial<CreateTaskInput>;
    if (!body.title || !body.objective || !body.agent || !body.acceptanceCriteria?.length) {
      res.status(400).json({
        error: "Required fields: title, objective, agent (codex|gemini), acceptanceCriteria (string[])",
      });
      return;
    }
    try {
      const result = await createTask(asgardRoot, {
        title: body.title,
        objective: body.objective,
        agent: body.agent as "codex" | "gemini",
        complexity: body.complexity ?? "moderate",
        scopeIn: body.scopeIn ?? [],
        scopeOut: body.scopeOut ?? [],
        acceptanceCriteria: body.acceptanceCriteria,
        dependsOn: body.dependsOn,
        notes: body.notes,
      });
      res.status(201).json(result);
    } catch (err: unknown) {
      log.error({ err }, "/api/tasks POST error");
      res.status(500).json({ error: "Failed to create task" });
    }
  });

  // PUT /api/tasks/:id/status
  router.put("/api/tasks/:id/status", async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status } = (req.body ?? {}) as { status?: string };

    const validStatuses: TaskStatus[] = ["draft", "in-progress", "review-needed", "done", "blocked"];
    if (!status || !validStatuses.includes(status as TaskStatus)) {
      res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` });
      return;
    }

    try {
      const task = await updateTaskStatus(asgardRoot, (id as string).toUpperCase(), status as TaskStatus);
      if (!task) {
        res.status(404).json({ error: "Task not found in active tasks" });
        return;
      }
      res.json(task);
    } catch (err: unknown) {
      log.error({ err, id, status }, "Task status update error");
      res.status(500).json({ error: "Failed to update task status" });
    }
  });

  // DELETE /api/tasks/:id
  router.delete("/api/tasks/:id", async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
      const result = await deleteTask(asgardRoot, (id as string).toUpperCase());
      res.status(result.success ? 200 : 400).json(result);
    } catch (err: unknown) {
      log.error({ err, id }, "Task delete error");
      res.status(500).json({ error: "Failed to delete task" });
    }
  });

  // ── Odin Command Channel ──

  // GET /api/odin/messages
  router.get("/api/odin/messages", (_req: Request, res: Response) => {
    const limit = parseInt((_req.query.limit as string) || "50", 10);
    res.json({ messages: getMessages(limit) });
  });

  // POST /api/odin/command
  router.post("/api/odin/command", async (req: Request, res: Response) => {
    const { content } = (req.body ?? {}) as { content?: string };
    if (!content || typeof content !== "string") {
      res.status(400).json({ error: "Body must be { content: string }" });
      return;
    }

    try {
      log.info({ content }, "Odin command received");
      const result = await processCommand(content, asgardRoot);
      await saveHistory(asgardRoot);
      res.json(result);
    } catch (err: unknown) {
      log.error({ err }, "Odin command failed");
      res.status(500).json({ error: "Command processing failed" });
    }
  });

  // POST /api/odin/approve
  router.post("/api/odin/approve", async (req: Request, res: Response) => {
    const { approvalId, approved } = (req.body ?? {}) as {
      approvalId?: string;
      approved?: boolean;
    };

    if (!approvalId || typeof approved !== "boolean") {
      res.status(400).json({ error: "Body must be { approvalId: string, approved: boolean }" });
      return;
    }

    try {
      log.info({ approvalId, approved }, "Odin approval response");
      const result = await processApproval(approvalId, approved, asgardRoot);
      await saveHistory(asgardRoot);
      res.json(result);
    } catch (err: unknown) {
      log.error({ err }, "Odin approval failed");
      res.status(500).json({ error: "Approval processing failed" });
    }
  });

  return router;
}
