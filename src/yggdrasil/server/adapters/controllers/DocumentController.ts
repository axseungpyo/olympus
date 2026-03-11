import fs from "fs/promises";
import path from "path";
import type { Request, Response } from "express";
import type { IAgentRepository } from "../../core/ports/IAgentRepository";
import { parseIndex } from "../../domain/tasks/task-parser";
import { buildDependencyGraph, detectCycle, getExecutionOrder, parseDependencies, type TPMeta } from "../../infra/dependency";
import { createLogger } from "../../infra/logger";
import { sendBadRequest, sendServerError } from "./controller-utils";

const ALLOWED_SKILLS = ["status", "validate"] as const;
type AllowedSkill = (typeof ALLOWED_SKILLS)[number];

interface ValidationCheck { name: string; pass: boolean; }
interface ValidationResult { id: string; file: string; valid: boolean; checks: ValidationCheck[]; }

export class DocumentController {
  private readonly log = createLogger({ component: "DocumentController" });
  private readonly artifactsDir: string;
  private readonly skillsDir: string;

  constructor(
    asgardRoot: string,
    private readonly agentRepository: IAgentRepository,
  ) {
    this.artifactsDir = path.resolve(asgardRoot, "artifacts");
    this.skillsDir = path.resolve(asgardRoot, ".claude", "skills");
  }

  async chronicle(_req: Request, res: Response): Promise<void> {
    try { res.json({ tasks: parseIndex(await this.readIndexFile()) }); } catch (err) { this.fail(res, err, "Failed to get chronicle"); }
  }

  async getDoc(req: Request, res: Response): Promise<void> {
    await this.handleDocumentRequest(req.params.id as string, res);
  }

  async executeSkillByName(req: Request, res: Response): Promise<void> {
    const args = typeof req.body?.args === "string" ? req.body.args : null;
    if (typeof req.params.name !== "string" || args === null) return sendBadRequest(res, "Body must be { args: string }");
    await this.handleExecuteSkill(req.params.name, args, res);
  }

  async dependencyGraph(_req: Request, res: Response): Promise<void> {
    try { res.json((await this.readTpDependencyState()).response); } catch (err) { this.fail(res, err, "Failed to get dependency graph"); }
  }

  async listAgents(_req: Request, res: Response): Promise<void> {
    try { const tasks = parseIndex(await this.readIndexFile()); res.json({ agents: await this.agentRepository.getStates(tasks) }); } catch (err) { this.fail(res, err, "Failed to get agents"); }
  }

  async getTypedDocument(req: Request, res: Response): Promise<void> {
    const { type, id } = req.params;
    if (type !== "tp" && type !== "rp") return sendBadRequest(res, "Invalid type. Must be 'tp' or 'rp'");
    if (!/^\d{3}$/.test(id as string)) return sendBadRequest(res, "Invalid id. Must be 3-digit number");
    await this.handleDocumentRequest(`${type}-${id}`, res);
  }

  async getSkillDoc(req: Request, res: Response): Promise<void> {
    const name = req.params.name as string;
    if (!/^[a-z][a-z0-9-]*$/.test(name)) return sendBadRequest(res, "Invalid skill name");
    const skillPath = path.resolve(this.skillsDir, name, "SKILL.md");
    if (!skillPath.startsWith(this.skillsDir)) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    try { res.json({ name, content: await fs.readFile(skillPath, "utf-8") }); } catch { res.status(404).json({ error: "Skill document not found" }); }
  }

  async executeSkill(req: Request, res: Response): Promise<void> {
    const skill = typeof req.body?.skill === "string" ? req.body.skill : null;
    const args = typeof req.body?.args === "string" ? req.body.args : null;
    if (!skill || args === null) return sendBadRequest(res, "Body must be { skill: string, args: string }");
    await this.handleExecuteSkill(skill, args, res);
  }

  private async handleDocumentRequest(documentId: string, res: Response): Promise<void> {
    const normalizedId = documentId.toUpperCase();
    if (!/^(TP|RP)-\d{3}$/.test(normalizedId)) return sendBadRequest(res, "Invalid id. Must be TP-NNN or RP-NNN");
    const filePath = path.resolve(this.artifactsDir, "handoff", `${normalizedId}.md`);
    if (!filePath.startsWith(this.artifactsDir)) return void res.status(403).json({ error: "Access denied" });
    try { const doc = await this.readDocument(filePath); doc.content ? res.json({ type: normalizedId.slice(0, 2).toLowerCase(), id: normalizedId.slice(3), title: doc.title, content: doc.content }) : res.status(404).json({ error: "Document not found" }); } catch (err) { this.log.error({ err, fileName: `${normalizedId}.md` }, "Document not found"); res.status(404).json({ error: "Document not found" }); }
  }

  private async handleExecuteSkill(skill: string, args: string, res: Response): Promise<void> {
    if (!ALLOWED_SKILLS.includes(skill as AllowedSkill)) return void res.status(403).json({ error: "Skill not allowed" });
    try { if (skill === "status") return void res.json(await this.executeStatusSkill()); const result = await this.executeValidateSkill(args); res.status(result.status).json(result.body); } catch (err) { this.fail(res, err, "Failed to execute skill", { skill, args }); }
  }

  private async executeStatusSkill() {
    const tasks = parseIndex(await this.readIndexFile());
    return {
      skill: "status" as const,
      summary: {
        totalTasks: tasks.length,
        activeTasks: tasks.filter((t) => t.status === "in-progress" || t.status === "draft").length,
        completedTasks: tasks.filter((t) => t.status === "done").length,
        blockedTasks: tasks.filter((t) => t.status === "blocked").length,
      },
      agents: await this.agentRepository.getStates(tasks),
      tasks,
    };
  }

  private async executeValidateSkill(args: string) {
    const normalizedArg = this.normalizeTpArg(args);
    if (normalizedArg === "") return { status: 400, body: { error: "args must be empty or a TP id like TP-008" } };
    const { tpMeta, response } = await this.readTpDependencyState();
    const selectedFiles = (normalizedArg ? tpMeta.filter((tp) => tp.id === normalizedArg) : tpMeta).map((tp) => `${tp.id}.md`);
    if (normalizedArg && selectedFiles.length === 0) return { status: 404, body: { error: `TP not found: ${normalizedArg}` } };
    const results = await Promise.all(selectedFiles.map(async (file) => this.buildValidationResult(file, response.hasCycle, response.cycle)));
    return { status: 200, body: { skill: "validate" as const, target: normalizedArg ?? "all", total: results.length, valid: results.filter((r) => r.valid).length, invalid: results.filter((r) => !r.valid).length, hasCycle: response.hasCycle, cycle: response.cycle, results } };
  }

  private async buildValidationResult(file: string, hasCycle: boolean, cycle: string[] | null): Promise<ValidationResult> {
    const content = await fs.readFile(path.join(this.artifactsDir, "handoff", file), "utf-8");
    const checks = this.buildValidationChecks(content);
    const cycleCheck = hasCycle ? { name: "dependency-cycle", pass: !cycle?.includes(file.replace(/\.md$/, "")) } : { name: "dependency-cycle", pass: true };
    return { id: file.replace(/\.md$/, ""), file, valid: [...checks, cycleCheck].every((check) => check.pass), checks: [...checks, cycleCheck] };
  }

  private buildValidationChecks(content: string): ValidationCheck[] {
    return [
      { name: "title", pass: /^#\s+TP-\d{3}:/m.test(content) },
      { name: "agent-target-or-metadata", pass: /^##\s+Agent Target\b/m.test(content) || /- Agent Target:\s*\S+/m.test(content) },
      { name: "complexity-or-metadata", pass: /^##\s+Complexity Hint\b/m.test(content) || /- Complexity:\s*\S+/m.test(content) },
      { name: "objective", pass: /^##\s+Objective\b/m.test(content) },
      { name: "scope", pass: /^##\s+Scope\b/m.test(content) || /^##\s+Scope In\b/m.test(content) },
      { name: "acceptance-criteria", pass: /^##\s+Acceptance Criteria\b/m.test(content) },
    ];
  }

  private normalizeTpArg(args: string): string | null {
    const trimmed = args.trim().toUpperCase();
    if (!trimmed) return null;
    return /^TP-\d{3}$/.test(trimmed) ? trimmed : "";
  }

  private async readTpDependencyState(): Promise<{ tpMeta: TPMeta[]; response: { nodes: Array<{ id: string; dependsOn: string[]; status: string }>; executionOrder: string[][]; hasCycle: boolean; cycle: string[] | null } }> {
    const [entries, indexContent] = await Promise.all([fs.readdir(path.join(this.artifactsDir, "handoff")), this.readIndexFile()]);
    const taskStatusMap = this.readTaskStatusMap(indexContent);
    const tpMeta = await Promise.all(entries.filter((entry) => /^TP-\d{3}\.md$/.test(entry)).sort((a, b) => a.localeCompare(b)).map(async (file) => {
      const content = await fs.readFile(path.join(this.artifactsDir, "handoff", file), "utf-8");
      const id = file.replace(/\.md$/, "");
      return { id, dependsOn: parseDependencies(content), status: taskStatusMap.get(id) ?? "draft" } satisfies TPMeta;
    }));
    const graph = buildDependencyGraph(tpMeta);
    const cycle = detectCycle(graph);
    return { tpMeta, response: { nodes: tpMeta.map((tp) => ({ id: tp.id, dependsOn: tp.dependsOn, status: tp.status })), executionOrder: cycle ? [] : getExecutionOrder(graph), hasCycle: cycle !== null, cycle } };
  }

  private readTaskStatusMap(indexContent: string): Map<string, TPMeta["status"]> {
    const statuses = new Map<string, TPMeta["status"]>();
    for (const task of parseIndex(indexContent)) statuses.set(task.id, task.status);
    const completedSection = indexContent.match(/##\s+Completed Tasks([\s\S]*)$/i)?.[1] ?? "";
    for (const line of completedSection.split("\n")) {
      const cells = line.trim().split("|").map((cell) => cell.trim()).filter(Boolean);
      if (cells.length >= 4 && /^TP-\d{3}$/.test(cells[0])) statuses.set(cells[0], "done");
    }
    return statuses;
  }

  private async readIndexFile(): Promise<string> {
    try { return await fs.readFile(path.join(this.artifactsDir, "INDEX.md"), "utf-8"); } catch (err: unknown) { if ((err as NodeJS.ErrnoException).code !== "ENOENT") this.log.error({ err }, "Failed to read INDEX.md"); return ""; }
  }

  private async readDocument(filePath: string): Promise<{ title: string; content: string }> {
    const content = await fs.readFile(filePath, "utf-8");
    return { title: content.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? "Untitled", content };
  }

  private fail(res: Response, err: unknown, message: string, context: Record<string, unknown> = {}): void {
    this.log.error({ err, ...context }, message);
    sendServerError(res, message);
  }
}
