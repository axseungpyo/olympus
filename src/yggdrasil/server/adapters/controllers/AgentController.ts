import type { Request, Response } from "express";
import { AGENT_MODES, type AgentName } from "../../core/entities/Agent";
import { GetAgentStatusUseCase } from "../../core/use-cases/agent/GetAgentStatusUseCase";
import { StartAgentUseCase } from "../../core/use-cases/agent/StartAgentUseCase";
import { StopAgentUseCase } from "../../core/use-cases/agent/StopAgentUseCase";
import { AGENT_NAMES } from "../../../shared/constants";
import { createLogger } from "../../infra/logger";
import { sendBadRequest, sendServerError } from "./controller-utils";

export class AgentController {
  private readonly log = createLogger({ component: "AgentController" });

  constructor(
    private readonly getAgentStatusUseCase: GetAgentStatusUseCase,
    private readonly startAgentUseCase: StartAgentUseCase,
    private readonly stopAgentUseCase: StopAgentUseCase,
  ) {}

  async getHealth(req: Request, res: Response): Promise<void> {
    const agent = this.parseAgentName(this.readParam(req.params.name));
    if (!agent) return sendBadRequest(res, "Invalid agent name");
    try { res.json(await this.getAgentStatusUseCase.execute(agent)); } catch (err) { this.fail(res, err, "Agent health check failed", { agent }); }
  }

  async start(req: Request, res: Response): Promise<void> {
    const agent = this.parseAgentName(this.readParam(req.params.name));
    const tp = typeof req.body?.tp === "string" ? req.body.tp : null;
    if (!agent) return sendBadRequest(res, "Invalid agent name");
    if (!tp) return sendBadRequest(res, "Body must include { tp: string }");
    try { const result = await this.startAgentUseCase.execute({ agentName: agent, tp, mode: req.body?.mode }); res.status(result.success ? 200 : 400).json(result); } catch (err) { this.fail(res, err, "Failed to start agent", { agent }); }
  }

  async stop(req: Request, res: Response): Promise<void> {
    const agent = this.parseAgentName(this.readParam(req.params.name));
    if (!agent) return sendBadRequest(res, "Invalid agent name");
    try { const result = await this.stopAgentUseCase.execute({ agentName: agent }); res.status(result.success ? 200 : 400).json(result); } catch (err) { this.fail(res, err, "Failed to stop agent", { agent }); }
  }

  getModes(_req: Request, res: Response): void {
    res.json(AGENT_MODES);
  }

  private parseAgentName(name?: string): AgentName | null {
    return (AGENT_NAMES as readonly string[]).includes(name ?? "") ? (name as AgentName) : null;
  }

  private readParam(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value[0] : value;
  }

  private fail(res: Response, err: unknown, message: string, context: Record<string, unknown>): void {
    this.log.error({ err, ...context }, message);
    sendServerError(res, message);
  }
}
