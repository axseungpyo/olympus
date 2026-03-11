import type { Request, Response } from "express";
import type { CreateTaskInput, TaskStatus } from "../../core/entities/Task";
import { CreateTaskUseCase } from "../../core/use-cases/task/CreateTaskUseCase";
import { DeleteTaskUseCase } from "../../core/use-cases/task/DeleteTaskUseCase";
import { GetTaskUseCase } from "../../core/use-cases/task/GetTaskUseCase";
import { ListTasksUseCase } from "../../core/use-cases/task/ListTasksUseCase";
import { UpdateTaskStatusUseCase } from "../../core/use-cases/task/UpdateTaskStatusUseCase";
import { createLogger } from "../../infra/logger";
import { sendBadRequest, sendServerError } from "./controller-utils";

const VALID_STATUSES: TaskStatus[] = ["draft", "in-progress", "review-needed", "done", "blocked"];

export class TaskController {
  private readonly log = createLogger({ component: "TaskController" });

  constructor(
    private readonly listTasksUseCase: ListTasksUseCase,
    private readonly getTaskUseCase: GetTaskUseCase,
    private readonly createTaskUseCase: CreateTaskUseCase,
    private readonly updateTaskStatusUseCase: UpdateTaskStatusUseCase,
    private readonly deleteTaskUseCase: DeleteTaskUseCase,
  ) {}

  async list(_req: Request, res: Response): Promise<void> {
    try { res.json(await this.listTasksUseCase.execute()); } catch (err) { this.fail(res, err, "Failed to list tasks"); }
  }

  async create(req: Request, res: Response): Promise<void> {
    const input = this.parseCreateTaskInput(req.body);
    if (!input) return sendBadRequest(res, "Required fields: title, objective, agent (codex|gemini), acceptanceCriteria (string[])");
    try { res.status(201).json(await this.createTaskUseCase.execute(input)); } catch (err) { this.fail(res, err, "Failed to create task"); }
  }

  async get(req: Request, res: Response): Promise<void> {
    const rawId = this.readParam(req.params.id);
    const id = this.normalizeTaskId(rawId);
    if (!id) return sendBadRequest(res, "Invalid task ID format. Expected TP-NNN");
    try { const task = await this.getTaskUseCase.execute(id); task ? res.json(task) : res.status(404).json({ error: "Task not found" }); } catch (err) { this.fail(res, err, "Failed to get task", { id: rawId }); }
  }

  async updateStatus(req: Request, res: Response): Promise<void> {
    const rawId = this.readParam(req.params.id);
    const id = this.normalizeTaskId(rawId);
    const status = this.parseStatus(req.body?.status);
    if (!status) return sendBadRequest(res, `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`);
    try { const task = await this.updateTaskStatusUseCase.execute({ id: (id ?? rawId ?? "").toUpperCase(), status }); task ? res.json(task) : res.status(404).json({ error: "Task not found in active tasks" }); } catch (err) { this.fail(res, err, "Failed to update task status", { id: rawId, status: req.body?.status }); }
  }

  async delete(req: Request, res: Response): Promise<void> {
    const rawId = this.readParam(req.params.id);
    try { const result = await this.deleteTaskUseCase.execute({ id: (rawId ?? "").toUpperCase() }); res.status(result.success ? 200 : 400).json(result); } catch (err) { this.fail(res, err, "Failed to delete task", { id: rawId }); }
  }

  private parseCreateTaskInput(body: Partial<CreateTaskInput> | undefined): CreateTaskInput | null {
    if (!body?.title || !body.objective || !body.agent || !body.acceptanceCriteria?.length) return null;
    return {
      title: body.title,
      objective: body.objective,
      agent: body.agent as "codex" | "gemini",
      complexity: body.complexity ?? "moderate",
      scopeIn: body.scopeIn ?? [],
      scopeOut: body.scopeOut ?? [],
      acceptanceCriteria: body.acceptanceCriteria,
      dependsOn: body.dependsOn,
      notes: body.notes,
    };
  }

  private normalizeTaskId(id?: string): string | null {
    return /^TP-\d{3}$/i.test(id ?? "") ? (id as string).toUpperCase() : null;
  }

  private parseStatus(status: unknown): TaskStatus | null {
    return VALID_STATUSES.includes(status as TaskStatus) ? (status as TaskStatus) : null;
  }

  private readParam(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value[0] : value;
  }

  private fail(res: Response, err: unknown, message: string, context: Record<string, unknown> = {}): void {
    this.log.error({ err, ...context }, message);
    sendServerError(res, message);
  }
}
