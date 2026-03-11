import type { CommandResult, OdinMessage } from "../../core/entities/Message";
import type { IMessageRepository } from "../../core/ports/IMessageRepository";
import type { ISkillRegistry } from "../../core/ports/ISkillRegistry";
import type { IApprovalStore } from "../../core/ports/IApprovalStore";
import { ProcessApprovalUseCase } from "../../core/use-cases/odin/ProcessApprovalUseCase";
import { ProcessCommandUseCase } from "../../core/use-cases/odin/ProcessCommandUseCase";

interface OdinChannelDeps {
  messageRepository: IMessageRepository;
  skillRegistry: ISkillRegistry;
  approvalStore: IApprovalStore;
}

export interface OdinChannel {
  getMessages(limit?: number): OdinMessage[];
  processCommand(content: string): Promise<CommandResult>;
  processApproval(approvalId: string, approved: boolean): Promise<CommandResult>;
  loadHistory(): Promise<void>;
  saveHistory(): Promise<void>;
}

export function createOdinChannel(deps: OdinChannelDeps): OdinChannel {
  const processCommandUseCase = new ProcessCommandUseCase(deps.messageRepository, deps.skillRegistry, deps.approvalStore);
  const processApprovalUseCase = new ProcessApprovalUseCase(deps.messageRepository, deps.skillRegistry, deps.approvalStore);

  return {
    getMessages(limit = 50): OdinMessage[] {
      return deps.messageRepository.getMessages(limit);
    },

    async processCommand(content: string): Promise<CommandResult> {
      return processCommandUseCase.execute(content);
    },

    async processApproval(approvalId: string, approved: boolean): Promise<CommandResult> {
      return processApprovalUseCase.execute({ approvalId, approved });
    },

    loadHistory(): Promise<void> {
      return deps.messageRepository.loadHistory();
    },

    saveHistory(): Promise<void> {
      return deps.messageRepository.saveHistory();
    },
  };
}
