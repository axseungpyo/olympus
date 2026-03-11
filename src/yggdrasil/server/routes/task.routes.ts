import { Router, type Request, type Response } from "express";
import { createLogger } from "../infra/logger";
import type { Container } from "../di/container";
import {
  listTasks,
  getTask,
  createTask,
  updateTaskStatus,
  deleteTask,
  type CreateTaskInput,
} from "../domain/tasks/task-manager";
import type { TaskStatus } from "../../shared/types";

export function createTaskRouter(container: Container): Router {
  const router = Router();
  const log = createLogger({ component: "TaskRoutes" });

  router.get("/api/tasks", async (_req: Request, res: Response) => {
    try {
      const data = await listTasks(container.taskRepository);
      res.json(data);
    } catch (err: unknown) {
      log.error({ err }, "/api/tasks error");
      res.status(500).json({ error: "Failed to list tasks" });
    }
  });

  router.post("/api/tasks", async (req: Request, res: Response) => {
    const body = req.body as Partial<CreateTaskInput>;
    if (!body.title || !body.objective || !body.agent || !body.acceptanceCriteria?.length) {
      res.status(400).json({
        error: "Required fields: title, objective, agent (codex|gemini), acceptanceCriteria (string[])",
      });
      return;
    }
    try {
      const result = await createTask(container.taskRepository, {
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

  router.get("/api/tasks/:id", async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!/^TP-\d{3}$/i.test(id as string)) {
      res.status(400).json({ error: "Invalid task ID format. Expected TP-NNN" });
      return;
    }
    try {
      const task = await getTask(container.taskRepository, (id as string).toUpperCase());
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

  router.put("/api/tasks/:id/status", async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status } = (req.body ?? {}) as { status?: string };

    const validStatuses: TaskStatus[] = ["draft", "in-progress", "review-needed", "done", "blocked"];
    if (!status || !validStatuses.includes(status as TaskStatus)) {
      res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` });
      return;
    }

    try {
      const task = await updateTaskStatus(
        container.taskRepository,
        (id as string).toUpperCase(),
        status as TaskStatus,
      );
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

  router.delete("/api/tasks/:id", async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
      const result = await deleteTask(container.taskRepository, (id as string).toUpperCase());
      res.status(result.success ? 200 : 400).json(result);
    } catch (err: unknown) {
      log.error({ err, id }, "Task delete error");
      res.status(500).json({ error: "Failed to delete task" });
    }
  });

  return router;
}
