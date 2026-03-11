import type { AgentEntity } from "../../core/entities/Agent";
import type { TaskEntity } from "../../core/entities/Task";
import type { IAgentRepository } from "../../core/ports/IAgentRepository";

export async function getAgentStates(
  agentRepository: IAgentRepository,
  tasks: TaskEntity[],
): Promise<AgentEntity[]> {
  return agentRepository.getStates(tasks);
}
