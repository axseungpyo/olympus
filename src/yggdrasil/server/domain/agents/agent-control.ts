import type { AgentHealth, AgentName } from "../../core/entities/Agent";
import type { IAgentProcessRegistry } from "../../core/ports/IAgentProcessRegistry";
import type { IAgentRepository } from "../../core/ports/IAgentRepository";
import type { IProcessGateway } from "../../core/ports/IProcessGateway";
import type { ITaskRepository } from "../../core/ports/ITaskRepository";
import { GetAgentStatusUseCase } from "../../core/use-cases/agent/GetAgentStatusUseCase";
import { StartAgentUseCase } from "../../core/use-cases/agent/StartAgentUseCase";
import { StopAgentUseCase } from "../../core/use-cases/agent/StopAgentUseCase";

export interface StartAgentOptions {
  tp: string;
  mode?: string;
}

export interface StartAgentResult {
  success: boolean;
  message: string;
  pid?: number;
  mode?: string;
  requiresApproval?: boolean;
}

export interface StopAgentResult {
  success: boolean;
  message: string;
}

const defaultRegistry: IAgentProcessRegistry = {
  set() {},
  get() { return undefined; },
  delete() {},
  snapshot() { return new Map(); },
};

export async function startAgent(
  taskRepository: ITaskRepository,
  agentRepository: IAgentRepository,
  processGateway: IProcessGateway,
  agent: AgentName,
  options: StartAgentOptions,
): Promise<StartAgentResult> {
  return new StartAgentUseCase(taskRepository, agentRepository, processGateway, defaultRegistry).execute({
    agentName: agent,
    tp: options.tp,
    mode: options.mode,
  });
}

export async function stopAgent(
  agentRepository: IAgentRepository,
  processGateway: IProcessGateway,
  agent: AgentName,
): Promise<StopAgentResult> {
  return new StopAgentUseCase(agentRepository, processGateway, defaultRegistry).execute({ agentName: agent });
}

export async function getAgentHealth(
  agentRepository: IAgentRepository,
  agent: AgentName,
): Promise<AgentHealth> {
  return agentRepository.getHealth(agent);
}

export function getRunningAgents(): Map<AgentName, { tp: string; mode: string; startedAt: number; pid: number | null }> {
  return defaultRegistry.snapshot();
}
