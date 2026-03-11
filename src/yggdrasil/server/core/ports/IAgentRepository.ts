import type { AgentEntity, AgentHealth, AgentName } from "../entities/Agent";
import type { TaskEntity } from "../entities/Task";

export interface IAgentRepository {
  getHealth(agent: AgentName): Promise<AgentHealth>;
  getStates(tasks: TaskEntity[]): Promise<AgentEntity[]>;
  readPid(agent: AgentName): Promise<number | null>;
  writePid(agent: AgentName, pid: number): Promise<void>;
  deletePid(agent: AgentName): Promise<void>;
}
