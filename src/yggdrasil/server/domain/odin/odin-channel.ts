import type { CommandResult, OdinMessage } from "../../core/entities/Message";
import type { IMessageRepository } from "../../core/ports/IMessageRepository";
import type { ISkillRegistry } from "../../core/ports/ISkillRegistry";

interface OdinChannelDeps {
  messageRepository: IMessageRepository;
  skillRegistry: ISkillRegistry;
}

export interface OdinChannel {
  getMessages(limit?: number): OdinMessage[];
  processCommand(content: string): Promise<CommandResult>;
  processApproval(approvalId: string, approved: boolean): Promise<CommandResult>;
  loadHistory(): Promise<void>;
  saveHistory(): Promise<void>;
}

export function createOdinChannel(deps: OdinChannelDeps): OdinChannel {
  const pendingApprovals = new Map<string, { skill: string; args: string }>();

  function generateId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  return {
    getMessages(limit = 50): OdinMessage[] {
      return deps.messageRepository.getMessages(limit);
    },

    async processCommand(content: string): Promise<CommandResult> {
      const messages: OdinMessage[] = [];
      messages.push(
        deps.messageRepository.addMessage({
          role: "user",
          type: "command",
          content,
        }),
      );

      const skillMatch = deps.skillRegistry.match(content);
      if (!skillMatch) {
        messages.push(
          deps.messageRepository.addMessage({
            role: "odin",
            type: "response",
            content:
              `명령을 이해했습니다. 다음 작업을 수행할 수 있습니다:\n\n`
              + `• **상태 확인** — "상태" 또는 "status"\n`
              + `• **TP 검증** — "TP-016 검증"\n`
              + `• **위임** — "TP-016 Brokkr에게 위임"\n`
              + `• **검토** — "RP-016 검토"\n`
              + `• **기획** — "로그인 기능 기획"\n`
              + `• **롤백** — "TP-016 롤백"\n`
              + `• **재시도** — "TP-016 재시도"`,
          }),
        );
        return { messages };
      }

      if (skillMatch.requiresApproval) {
        const approvalId = generateId();
        pendingApprovals.set(approvalId, { skill: skillMatch.skill, args: skillMatch.args });
        messages.push(
          deps.messageRepository.addMessage({
            role: "odin",
            type: "approval_request",
            content:
              `**${skillMatch.description}**\n\n`
              + `Skill: \`/${skillMatch.skill}${skillMatch.args ? ` ${skillMatch.args}` : ""}\`\n`
              + (skillMatch.args ? `Target: ${skillMatch.args}` : "인자 없음"),
            actions: [
              { id: approvalId, label: "Approve", type: "approve" },
              { id: `${approvalId}-reject`, label: "Cancel", type: "reject" },
            ],
            metadata: {
              skill: skillMatch.skill,
              tp: skillMatch.args || undefined,
            },
          }),
        );
        return { messages };
      }

      messages.push(
        deps.messageRepository.addMessage({
          role: "odin",
          type: "progress",
          content: `\`/${skillMatch.skill}${skillMatch.args ? ` ${skillMatch.args}` : ""}\` 실행 중...`,
          metadata: { skill: skillMatch.skill },
        }),
      );

      try {
        const result = await deps.skillRegistry.execute(skillMatch.skill, skillMatch.args);
        messages.push(
          deps.messageRepository.addMessage({
            role: "odin",
            type: "response",
            content: result,
            metadata: { skill: skillMatch.skill },
          }),
        );
      } catch (err) {
        messages.push(
          deps.messageRepository.addMessage({
            role: "odin",
            type: "response",
            content: `실행 실패: ${err instanceof Error ? err.message : "Unknown error"}`,
            metadata: { skill: skillMatch.skill, severity: "critical" },
          }),
        );
      }

      return { messages };
    },

    async processApproval(approvalId: string, approved: boolean): Promise<CommandResult> {
      const messages: OdinMessage[] = [];
      const pending = pendingApprovals.get(approvalId);
      if (!pending) {
        messages.push(
          deps.messageRepository.addMessage({
            role: "odin",
            type: "response",
            content: "승인 요청을 찾을 수 없습니다. 이미 처리되었거나 만료되었습니다.",
          }),
        );
        return { messages };
      }

      pendingApprovals.delete(approvalId);

      if (!approved) {
        messages.push(
          deps.messageRepository.addMessage({
            role: "user",
            type: "command",
            content: "Cancel",
          }),
        );
        messages.push(
          deps.messageRepository.addMessage({
            role: "odin",
            type: "response",
            content: `\`/${pending.skill}\` 실행이 취소되었습니다.`,
          }),
        );
        return { messages };
      }

      messages.push(
        deps.messageRepository.addMessage({
          role: "user",
          type: "command",
          content: "Approve",
        }),
      );
      messages.push(
        deps.messageRepository.addMessage({
          role: "odin",
          type: "progress",
          content: `\`/${pending.skill}${pending.args ? ` ${pending.args}` : ""}\` 실행 중...`,
          metadata: { skill: pending.skill },
        }),
      );

      try {
        const result = await deps.skillRegistry.execute(pending.skill, pending.args);
        messages.push(
          deps.messageRepository.addMessage({
            role: "odin",
            type: "response",
            content: result,
            metadata: { skill: pending.skill },
          }),
        );
      } catch (err) {
        messages.push(
          deps.messageRepository.addMessage({
            role: "odin",
            type: "response",
            content: `실행 실패: ${err instanceof Error ? err.message : "Unknown error"}`,
            metadata: { skill: pending.skill, severity: "critical" },
          }),
        );
      }

      return { messages };
    },

    loadHistory(): Promise<void> {
      return deps.messageRepository.loadHistory();
    },

    saveHistory(): Promise<void> {
      return deps.messageRepository.saveHistory();
    },
  };
}
