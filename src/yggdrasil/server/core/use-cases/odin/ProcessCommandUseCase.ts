import type { CommandResult } from "../../entities/Message";
import type { IApprovalStore } from "../../ports/IApprovalStore";
import type { IMessageRepository } from "../../ports/IMessageRepository";
import type { ISkillRegistry } from "../../ports/ISkillRegistry";

export class ProcessCommandUseCase {
  constructor(
    private readonly messageRepository: IMessageRepository,
    private readonly skillRegistry: ISkillRegistry,
    private readonly approvalStore: IApprovalStore,
  ) {}

  async execute(content: string): Promise<CommandResult> {
    const messages = [this.messageRepository.addMessage({ role: "user", type: "command", content })];
    const skillMatch = this.skillRegistry.match(content);

    if (!skillMatch) {
      messages.push(this.messageRepository.addMessage({
        role: "odin",
        type: "response",
        content: `명령을 이해했습니다. 다음 작업을 수행할 수 있습니다:\n\n• **상태 확인** — "상태" 또는 "status"\n• **TP 검증** — "TP-016 검증"\n• **위임** — "TP-016 Brokkr에게 위임"\n• **검토** — "RP-016 검토"\n• **기획** — "로그인 기능 기획"\n• **롤백** — "TP-016 롤백"\n• **재시도** — "TP-016 재시도"`,
      }));
      return { messages };
    }

    if (skillMatch.requiresApproval) {
      return this.requestApproval(skillMatch.skill, skillMatch.args, skillMatch.description, messages);
    }

    return this.executeSkill(skillMatch.skill, skillMatch.args, messages);
  }

  private requestApproval(skill: string, args: string, description: string, messages: CommandResult["messages"]): CommandResult {
    const approvalId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.approvalStore.set(approvalId, { skill, args });
    messages.push(this.messageRepository.addMessage({
      role: "odin",
      type: "approval_request",
      content: `**${description}**\n\nSkill: \`/${skill}${args ? ` ${args}` : ""}\`\n${args ? `Target: ${args}` : "인자 없음"}`,
      actions: [{ id: approvalId, label: "Approve", type: "approve" }, { id: `${approvalId}-reject`, label: "Cancel", type: "reject" }],
      metadata: { skill, tp: args || undefined },
    }));
    return { messages };
  }

  private async executeSkill(skill: string, args: string, messages: CommandResult["messages"]): Promise<CommandResult> {
    messages.push(this.messageRepository.addMessage({
      role: "odin",
      type: "progress",
      content: `\`/${skill}${args ? ` ${args}` : ""}\` 실행 중...`,
      metadata: { skill },
    }));

    try {
      const result = await this.skillRegistry.execute(skill, args);
      messages.push(this.messageRepository.addMessage({ role: "odin", type: "response", content: result, metadata: { skill } }));
    } catch (err) {
      messages.push(this.messageRepository.addMessage({
        role: "odin",
        type: "response",
        content: `실행 실패: ${err instanceof Error ? err.message : "Unknown error"}`,
        metadata: { skill, severity: "critical" },
      }));
    }

    return { messages };
  }
}
