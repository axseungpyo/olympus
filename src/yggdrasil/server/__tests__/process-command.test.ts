import { describe, expect, it, vi } from "vitest";
import { COMMAND_PROCESSED_EVENT } from "../core/events/CommandProcessed";
import type { DomainEvent } from "../core/events/DomainEvent";
import { InMemoryApprovalStore } from "../adapters/stores/InMemoryApprovalStore";
import { RegexFallbackGateway } from "../adapters/gateways/RegexFallbackGateway";
import { SkillToolExecutor } from "../adapters/tools/SkillToolExecutor";
import { ProcessCommandUseCase } from "../core/use-cases/odin/ProcessCommandUseCase";
import type { AgentEntity, AgentHealth, AgentName } from "../core/entities/Agent";
import type { SkillDefinition, SkillMatch } from "../core/entities/Skill";
import type { CreateTaskInput, TaskEntity, TaskStatus } from "../core/entities/Task";
import type { IAgentRepository } from "../core/ports/IAgentRepository";
import type { IEventBus } from "../core/ports/IEventBus";
import type { ILLMGateway, LLMMessage, LLMResponse } from "../core/ports/ILLMGateway";
import type { IMessageRepository } from "../core/ports/IMessageRepository";
import type { ISkillRegistry } from "../core/ports/ISkillRegistry";
import type { ITaskRepository } from "../core/ports/ITaskRepository";

class MemoryMessageRepository implements IMessageRepository {
  private messages: Array<ReturnType<IMessageRepository["addMessage"]>> = [];

  getMessages(limit = 50) {
    return this.messages.slice(-limit);
  }

  addMessage(message: Parameters<IMessageRepository["addMessage"]>[0]) {
    const stored = {
      ...message,
      id: `msg-${this.messages.length + 1}`,
      timestamp: Date.now(),
    };
    this.messages.push(stored);
    return stored;
  }

  async loadHistory(): Promise<void> {}
  async saveHistory(): Promise<void> {}
}

class StubTaskRepository implements ITaskRepository {
  async list() { return { active: [], completed: [] }; }
  async getById(_id: string) { return null; }
  async create(_input: CreateTaskInput): Promise<{ id: string; task: TaskEntity }> {
    throw new Error("not implemented");
  }
  async updateStatus(_id: string, _status: TaskStatus) { return null; }
  async delete(_id: string) { return { success: false, message: "not implemented" }; }
  async getNextTPNumber() { return 1; }
}

class StubAgentRepository implements IAgentRepository {
  async getHealth(_agent: AgentName): Promise<AgentHealth> {
    return { name: "odin", running: false, pid: null, tp: null, mode: null, startedAt: null, uptime: null };
  }

  async getStates(_tasks: TaskEntity[]): Promise<AgentEntity[]> {
    return [];
  }

  async readPid(_agent: AgentName): Promise<number | null> { return null; }
  async writePid(_agent: AgentName, _pid: number): Promise<void> {}
  async deletePid(_agent: AgentName): Promise<void> {}
}

class StubGateway implements ILLMGateway {
  constructor(
    private readonly available: boolean,
    private readonly responder: (messages: LLMMessage[]) => Promise<LLMResponse>,
  ) {}

  isAvailable(): boolean {
    return this.available;
  }

  chat(messages: LLMMessage[]): Promise<LLMResponse> {
    return this.responder(messages);
  }
}

class StubEventBus implements IEventBus {
  published: DomainEvent[] = [];

  publish(event: DomainEvent): void {
    this.published.push(event);
  }

  subscribe(): () => void {
    return () => {};
  }

  subscribeAll(): () => void {
    return () => {};
  }
}

function createSkillRegistry(): ISkillRegistry {
  const skills: SkillDefinition[] = [
    {
      skill: "status",
      description: "프로젝트 현황을 확인합니다.",
      patterns: [/상태/],
      requiresApproval: false,
    },
    {
      skill: "delegate",
      description: "Brokkr에게 태스크를 위임합니다.",
      patterns: [/위임/],
      extractArgs: () => "TP-022",
      requiresApproval: true,
    },
  ];

  return {
    match(message: string): SkillMatch | null {
      const matched = skills.find((skill) => skill.patterns.some((pattern) => pattern.test(message)));
      if (!matched) {
        return null;
      }

      return {
        skill: matched.skill,
        args: matched.extractArgs ? matched.extractArgs(message) : "",
        description: matched.description,
        requiresApproval: matched.requiresApproval,
      };
    },
    execute: vi.fn(async (skill: string) => skill === "status" ? "**프로젝트 현황**" : "done"),
    listSkills() {
      return skills;
    },
  };
}

describe("ProcessCommandUseCase", () => {
  it("falls back to regex matching when the Claude gateway is unavailable", async () => {
    const messageRepository = new MemoryMessageRepository();
    const skillRegistry = createSkillRegistry();
    const eventBus = new StubEventBus();
    const useCase = new ProcessCommandUseCase(
      messageRepository,
      skillRegistry,
      new InMemoryApprovalStore(),
      new StubGateway(false, async () => ({ content: "unused", stopReason: "end_turn" })),
      new RegexFallbackGateway(skillRegistry),
      [new SkillToolExecutor(skillRegistry)],
      new StubTaskRepository(),
      new StubAgentRepository(),
      "/tmp/asgard",
      eventBus,
    );

    const result = await useCase.execute("상태 알려줘");

    expect(skillRegistry.execute).toHaveBeenCalledWith("status", "");
    expect(result.messages.at(-1)?.content).toContain("프로젝트 현황");
    expect(eventBus.published.at(-1)).toMatchObject({
      type: COMMAND_PROCESSED_EVENT,
      payload: {
        command: "상태 알려줘",
        skill: "status",
      },
    });
  });

  it("executes tool calls from the Claude gateway", async () => {
    const messageRepository = new MemoryMessageRepository();
    const skillRegistry = createSkillRegistry();
    const regexGateway = new StubGateway(true, async () => ({ content: "regex", stopReason: "end_turn" }));
    const eventBus = new StubEventBus();
    const useCase = new ProcessCommandUseCase(
      messageRepository,
      skillRegistry,
      new InMemoryApprovalStore(),
      new StubGateway(true, async () => ({
        content: "",
        toolCalls: [{ name: "get_status", input: {} }],
        stopReason: "tool_use",
      })),
      regexGateway,
      [new SkillToolExecutor(skillRegistry)],
      new StubTaskRepository(),
      new StubAgentRepository(),
      "/tmp/asgard",
      eventBus,
    );

    const result = await useCase.execute("상태 알려줘");

    expect(skillRegistry.execute).toHaveBeenCalledWith("status", "");
    expect(result.messages.at(-1)?.content).toContain("프로젝트 현황");
    expect(eventBus.published.at(-1)?.type).toBe(COMMAND_PROCESSED_EVENT);
  });
});
