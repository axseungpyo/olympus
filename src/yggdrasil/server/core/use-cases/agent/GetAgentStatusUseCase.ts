import type { AgentEntity, AgentHealth, AgentName } from "../../entities/Agent";
import type { IAgentRepository } from "../../ports/IAgentRepository";
import type { ITaskRepository } from "../../ports/ITaskRepository";

export class GetAgentStatusUseCase {
  constructor(
    private readonly agentRepository: IAgentRepository,
    private readonly taskRepository: ITaskRepository,
  ) {}

  execute(agentName: AgentName): Promise<AgentHealth>;
  execute(): Promise<AgentEntity[]>;
  async execute(agentName?: AgentName): Promise<AgentHealth | AgentEntity[]> {
    if (agentName) {
      return this.agentRepository.getHealth(agentName);
    }
    const { active } = await this.taskRepository.list();
    return this.agentRepository.getStates(active);
  }
}
