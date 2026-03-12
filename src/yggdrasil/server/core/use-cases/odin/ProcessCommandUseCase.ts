import type { CommandResult } from "../../entities/Message";
import type { IAgentRepository } from "../../ports/IAgentRepository";
import type { IApprovalStore } from "../../ports/IApprovalStore";
import { COMMAND_PROCESSED_EVENT } from "../../events/CommandProcessed";
import type { ILLMGateway, LLMMessage, LLMToolCall, LLMToolDefinition } from "../../ports/ILLMGateway";
import type { IEventBus } from "../../ports/IEventBus";
import type { IMessageRepository } from "../../ports/IMessageRepository";
import type { ISkillRegistry } from "../../ports/ISkillRegistry";
import type { ITaskRepository } from "../../ports/ITaskRepository";
import type { IToolExecutor } from "../../ports/IToolExecutor";
import { ContextBuilder } from "./ContextBuilder";

const ODIN_TOOLS: LLMToolDefinition[] = [
  { name: "get_status", description: "프로젝트 현황 조회", input_schema: { type: "object", properties: {}, additionalProperties: false } },
  {
    name: "create_task",
    description: "새 태스크(TP) 생성",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        objective: { type: "string" },
        agent: { type: "string" },
      },
      required: ["title", "objective", "agent"],
    },
  },
  {
    name: "delegate_task",
    description: "에이전트에게 태스크 위임",
    input_schema: {
      type: "object",
      properties: {
        tp_id: { type: "string" },
        agent: { type: "string" },
      },
      required: ["tp_id", "agent"],
    },
  },
  {
    name: "stop_agent",
    description: "에이전트 중지",
    input_schema: {
      type: "object",
      properties: {
        agent: { type: "string" },
      },
      required: ["agent"],
    },
  },
  {
    name: "validate_task",
    description: "TP 포맷 검증",
    input_schema: {
      type: "object",
      properties: {
        tp_id: { type: "string" },
      },
    },
  },
  {
    name: "ask_user",
    description: "사용자에게 승인 요청",
    input_schema: {
      type: "object",
      properties: {
        question: { type: "string" },
        actions: {
          type: "array",
          items: { type: "string" },
        },
      },
      required: ["question"],
    },
  },
  {
    name: "create_plan",
    description: "멀티스텝 실행 계획을 생성하고 실행한다",
    input_schema: {
      type: "object",
      properties: {
        goal: { type: "string", description: "최종 목표" },
        steps: {
          type: "array",
          items: {
            type: "object",
            properties: {
              action: { type: "string", description: "tool 이름" },
              description: { type: "string" },
              input: { type: "object" },
              dependsOn: { type: "array", items: { type: "number" } },
              requiresApproval: { type: "boolean" },
            },
            required: ["action", "description", "input"],
          },
        },
      },
      required: ["goal", "steps"],
    },
  },
  {
    name: "get_plan_status",
    description: "현재 실행 중인 계획의 상태를 조회한다",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "read_file",
    description: "프로젝트 파일을 읽는다 (최대 10,000자)",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "프로젝트 루트 기준 상대 경로" },
      },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description: "파일을 생성하거나 수정한다",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "프로젝트 루트 기준 상대 경로" },
        content: { type: "string", description: "파일 내용" },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "list_directory",
    description: "디렉토리 내용을 나열한다",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "프로젝트 루트 기준 상대 경로 (기본: .)" },
      },
    },
  },
  {
    name: "search_codebase",
    description: "코드베이스에서 텍스트 패턴을 검색한다",
    input_schema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "검색할 텍스트 또는 정규표현식" },
        path: { type: "string", description: "검색 시작 디렉토리 (기본: .)" },
        glob: { type: "string", description: "파일 필터 (예: *.ts)" },
      },
      required: ["pattern"],
    },
  },
  {
    name: "review_saga",
    description: "Saga(RP)를 읽고 Acceptance Criteria를 확인한다",
    input_schema: {
      type: "object",
      properties: {
        rp_id: { type: "string", description: "RP ID (예: RP-024)" },
      },
      required: ["rp_id"],
    },
  },
];

export class ProcessCommandUseCase {
  private readonly contextBuilder: ContextBuilder;

  constructor(
    private readonly messageRepository: IMessageRepository,
    private readonly skillRegistry: ISkillRegistry,
    private readonly approvalStore: IApprovalStore,
    private readonly llmGateway: ILLMGateway,
    private readonly regexFallbackGateway: ILLMGateway,
    private readonly toolExecutors: IToolExecutor[],
    taskRepository: ITaskRepository,
    agentRepository: IAgentRepository,
    private readonly projectRoot: string,
    private readonly eventBus?: IEventBus,
  ) {
    this.contextBuilder = new ContextBuilder(
      projectRoot,
      taskRepository,
      agentRepository,
      messageRepository,
      skillRegistry,
    );
  }

  async execute(content: string): Promise<CommandResult> {
    const messages = [this.messageRepository.addMessage({ role: "user", type: "command", content })];
    const conversation = this.toLLMMessages();

    if (this.llmGateway.isAvailable()) {
      try {
        const response = await this.llmGateway.chat(conversation, {
          system: await this.contextBuilder.build(),
          tools: ODIN_TOOLS,
        });
        return this.finalizeCommand(content, await this.handleLLMResponse(response, messages));
      } catch {
        return this.finalizeCommand(content, await this.executeRegexFallback(conversation, messages));
      }
    }

    return this.finalizeCommand(content, await this.executeRegexFallback(conversation, messages));
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

  private async executeRegexFallback(conversation: LLMMessage[], messages: CommandResult["messages"]): Promise<CommandResult> {
    const response = await this.regexFallbackGateway.chat(conversation);
    return this.handleLLMResponse(response, messages);
  }

  private async handleLLMResponse(
    response: Awaited<ReturnType<ILLMGateway["chat"]>>,
    messages: CommandResult["messages"],
  ): Promise<CommandResult> {
    const toolCalls = response.toolCalls?.slice(0, 3) ?? [];

    if (toolCalls.length > 0) {
      for (const toolCall of toolCalls) {
        await this.handleToolCall(toolCall, messages);
      }
      return { messages };
    }

    messages.push(this.messageRepository.addMessage({
      role: "odin",
      type: "response",
      content: response.content || "처리할 수 있는 명령을 찾지 못했습니다.",
    }));
    return { messages };
  }

  private async handleToolCall(toolCall: LLMToolCall, messages: CommandResult["messages"]): Promise<void> {
    if (toolCall.name === "execute_skill") {
      const skill = this.readString(toolCall.input, "skill");
      const args = this.readString(toolCall.input, "args");
      const description = this.readString(toolCall.input, "description") || "승인 요청";
      const requiresApproval = Boolean(toolCall.input.requiresApproval);
      if (!skill) {
        messages.push(this.messageRepository.addMessage({ role: "odin", type: "response", content: "실행할 스킬 정보가 없습니다." }));
        return;
      }
      if (requiresApproval) {
        this.requestApproval(skill, args, description, messages);
        return;
      }
      await this.executeSkill(skill, args, messages);
      return;
    }

    if (this.isApprovalRequired(toolCall.name)) {
      this.handleApprovalToolCall(toolCall, messages);
      return;
    }

    const executor = this.toolExecutors.find((entry) => entry.canHandle(toolCall.name));
    if (executor) {
      const result = await executor.execute(toolCall, this.projectRoot);
      if (result.requiresApproval) {
        const approvalId = `tool-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        this.approvalStore.set(approvalId, {
          skill: `tool:${toolCall.name}`,
          args: JSON.stringify(toolCall.input),
        });
        messages.push(this.messageRepository.addMessage({
          role: "odin",
          type: "approval_request",
          content: result.approvalDescription || "Tool 실행 승인이 필요합니다.",
          actions: [
            { id: approvalId, label: "Approve", type: "approve" },
            { id: `${approvalId}-reject`, label: "Cancel", type: "reject" },
          ],
          metadata: { tool: toolCall.name },
        }));
        return;
      }
      messages.push(this.messageRepository.addMessage({
        role: "odin",
        type: "response",
        content: result.success ? result.output : `실행 실패: ${result.error ?? "Unknown error"}`,
        metadata: {
          tool: toolCall.name,
          skill: result.metadata?.skill,
        },
      }));
      return;
    }

    messages.push(this.messageRepository.addMessage({
      role: "odin",
      type: "response",
      content: `지원하지 않는 도구 호출입니다: ${toolCall.name}`,
    }));
  }

  private isApprovalRequired(toolName: string): boolean {
    return toolName === "delegate_task" || toolName === "stop_agent" || toolName === "ask_user";
  }

  private handleApprovalToolCall(toolCall: LLMToolCall, messages: CommandResult["messages"]): void {
    if (toolCall.name === "delegate_task") {
      const tpId = this.readString(toolCall.input, "tp_id") || this.readString(toolCall.input, "tpId");
      const requestedAgent = (this.readString(toolCall.input, "agent") || "brokkr").toLowerCase();
      const skill = requestedAgent === "heimdall" || requestedAgent === "gemini" ? "delegate-gemini" : "delegate";
      const description = skill === "delegate-gemini"
        ? "Heimdall에게 비전 태스크를 위임합니다."
        : "Brokkr에게 태스크를 위임합니다.";
      this.requestApproval(skill, tpId, description, messages);
      return;
    }

    if (toolCall.name === "stop_agent") {
      const agent = this.readString(toolCall.input, "agent").toLowerCase();
      this.requestApproval("stop-agent", agent, "에이전트를 중지합니다.", messages);
      return;
    }

    if (toolCall.name === "ask_user") {
      const question = this.readString(toolCall.input, "question") || "승인이 필요합니다.";
      const actions = Array.isArray(toolCall.input.actions)
        ? toolCall.input.actions.filter((value): value is string => typeof value === "string")
        : [];
      messages.push(this.messageRepository.addMessage({
        role: "odin",
        type: "approval_request",
        content: question,
        actions: actions.length
          ? actions.map((label, index) => ({ id: `ask-${Date.now()}-${index}`, label, type: "custom" as const }))
          : [{ id: `ask-${Date.now()}-0`, label: "확인", type: "custom" as const }],
      }));
      return;
    }
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

  private finalizeCommand(command: string, result: CommandResult): CommandResult {
    const lastSkill = [...result.messages]
      .reverse()
      .find((message) => message.metadata?.skill)
      ?.metadata?.skill ?? "";

    this.eventBus?.publish({
      type: COMMAND_PROCESSED_EVENT,
      timestamp: Date.now(),
      payload: {
        command,
        skill: lastSkill,
        result,
      },
    });

    return result;
  }

  private toLLMMessages(): LLMMessage[] {
    return this.messageRepository.getMessages(12).map((message) => ({
      role: message.role === "odin" ? "assistant" : "user",
      content: message.content,
    }));
  }

  private readString(input: Record<string, unknown>, key: string): string {
    const value = input[key];
    return typeof value === "string" ? value.trim() : "";
  }
}
