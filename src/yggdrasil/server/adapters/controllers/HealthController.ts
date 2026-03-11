import fs from "fs/promises";
import path from "path";
import type { Request, Response } from "express";
import type { IAgentRepository } from "../../core/ports/IAgentRepository";
import { collectMetrics } from "../../infra/metrics";
import { createLogger } from "../../infra/logger";
import { parseIndex } from "../../domain/tasks/task-parser";
import { sendServerError } from "./controller-utils";

export class HealthController {
  private readonly log = createLogger({ component: "HealthController" });
  private readonly artifactsDir: string;

  constructor(
    asgardRoot: string,
    private readonly agentRepository: IAgentRepository,
  ) {
    this.artifactsDir = path.resolve(asgardRoot, "artifacts");
    this.asgardRoot = asgardRoot;
  }

  private readonly asgardRoot: string;

  health(_req: Request, res: Response): void {
    res.json({ status: "ok", uptime: process.uptime(), timestamp: Date.now() });
  }

  async status(_req: Request, res: Response): Promise<void> {
    try {
      const tasks = parseIndex(await this.readIndexFile());
      const agents = await this.agentRepository.getStates(tasks);
      res.json({ agents, activeTasks: tasks.filter((t) => t.status === "in-progress" || t.status === "draft").length, completedTasks: tasks.filter((t) => t.status === "done").length });
    } catch (err) { this.fail(res, err, "Failed to get status"); }
  }

  async metrics(_req: Request, res: Response): Promise<void> {
    try { res.json(await collectMetrics(this.asgardRoot)); } catch (err) { this.fail(res, err, "Failed to get metrics"); }
  }

  private async readIndexFile(): Promise<string> {
    try { return await fs.readFile(path.join(this.artifactsDir, "INDEX.md"), "utf-8"); } catch (err: unknown) { if ((err as NodeJS.ErrnoException).code !== "ENOENT") this.log.error({ err }, "Failed to read INDEX.md"); return ""; }
  }

  private fail(res: Response, err: unknown, message: string): void {
    this.log.error({ err }, message);
    sendServerError(res, message);
  }
}
