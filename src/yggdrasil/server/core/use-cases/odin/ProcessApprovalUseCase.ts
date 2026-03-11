import type { CommandResult } from "../../entities/Message";
import type { IApprovalStore } from "../../ports/IApprovalStore";
import type { IMessageRepository } from "../../ports/IMessageRepository";
import type { ISkillRegistry } from "../../ports/ISkillRegistry";

export interface ProcessApprovalInput {
  approvalId: string;
  approved: boolean;
}

export class ProcessApprovalUseCase {
  constructor(
    private readonly messageRepository: IMessageRepository,
    private readonly skillRegistry: ISkillRegistry,
    private readonly approvalStore: IApprovalStore,
  ) {}

  async execute(input: ProcessApprovalInput): Promise<CommandResult> {
    const messages: CommandResult["messages"] = [];
    const pending = this.approvalStore.get(input.approvalId);

    if (!pending) {
      messages.push(this.messageRepository.addMessage({
        role: "odin",
        type: "response",
        content: "승인 요청을 찾을 수 없습니다. 이미 처리되었거나 만료되었습니다.",
      }));
      return { messages };
    }

    this.approvalStore.delete(input.approvalId);
    if (!input.approved) {
      messages.push(this.messageRepository.addMessage({ role: "user", type: "command", content: "Cancel" }));
      messages.push(this.messageRepository.addMessage({ role: "odin", type: "response", content: `\`/${pending.skill}\` 실행이 취소되었습니다.` }));
      return { messages };
    }

    messages.push(this.messageRepository.addMessage({ role: "user", type: "command", content: "Approve" }));
    messages.push(this.messageRepository.addMessage({
      role: "odin",
      type: "progress",
      content: `\`/${pending.skill}${pending.args ? ` ${pending.args}` : ""}\` 실행 중...`,
      metadata: { skill: pending.skill },
    }));

    try {
      const result = await this.skillRegistry.execute(pending.skill, pending.args);
      messages.push(this.messageRepository.addMessage({ role: "odin", type: "response", content: result, metadata: { skill: pending.skill } }));
    } catch (err) {
      messages.push(this.messageRepository.addMessage({
        role: "odin",
        type: "response",
        content: `실행 실패: ${err instanceof Error ? err.message : "Unknown error"}`,
        metadata: { skill: pending.skill, severity: "critical" },
      }));
    }

    return { messages };
  }
}
