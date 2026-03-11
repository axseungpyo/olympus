import type { IAgentRepository } from "../core/ports/IAgentRepository";
import type { IMessageRepository } from "../core/ports/IMessageRepository";
import type { IProcessGateway } from "../core/ports/IProcessGateway";
import type { ISkillRegistry } from "../core/ports/ISkillRegistry";
import type { ITaskRepository } from "../core/ports/ITaskRepository";
import { ChildProcessGateway } from "../adapters/gateways/ChildProcessGateway";
import { FileAgentRepository } from "../adapters/repositories/FileAgentRepository";
import { FileMessageRepository } from "../adapters/repositories/FileMessageRepository";
import { FileTaskRepository } from "../adapters/repositories/FileTaskRepository";
import { FileSkillRegistry } from "../adapters/skills/FileSkillRegistry";
import { getRunningAgents } from "../domain/agents/agent-control";

export interface Container {
  taskRepository: ITaskRepository;
  agentRepository: IAgentRepository;
  messageRepository: IMessageRepository;
  processGateway: IProcessGateway;
  skillRegistry: ISkillRegistry;
  asgardRoot: string;
}

export function createContainer(asgardRoot: string): Container {
  const taskRepository = new FileTaskRepository(asgardRoot);
  const processGateway = new ChildProcessGateway(asgardRoot);
  const agentRepository = new FileAgentRepository(asgardRoot, getRunningAgents);
  const messageRepository = new FileMessageRepository(asgardRoot);
  const skillRegistry = new FileSkillRegistry(
    asgardRoot,
    taskRepository,
    agentRepository,
    processGateway,
  );

  return {
    taskRepository,
    agentRepository,
    messageRepository,
    processGateway,
    skillRegistry,
    asgardRoot,
  };
}
