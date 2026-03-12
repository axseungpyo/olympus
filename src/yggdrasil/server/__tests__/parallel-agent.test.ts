import { describe, expect, it } from "vitest";
import { InMemoryPlanRepository } from "../adapters/repositories/InMemoryPlanRepository";
import { InMemorySettingsRepository } from "../adapters/repositories/InMemorySettingsRepository";
import { InMemoryApprovalStore } from "../adapters/stores/InMemoryApprovalStore";
import type { AgentEntity, AgentHealth, AgentName } from "../core/entities/Agent";
import { AGENT_PROGRESS_EVENT } from "../core/events/AgentProgress";
import type { DomainEvent } from "../core/events/DomainEvent";
import type { IAgentProcessRegistry } from "../core/ports/IAgentProcessRegistry";
import type { IAgentRepository } from "../core/ports/IAgentRepository";
import type { IEventBus } from "../core/ports/IEventBus";
import type { IMessageRepository } from "../core/ports/IMessageRepository";
import type { SpawnResult, IProcessGateway } from "../core/ports/IProcessGateway";
import type { ITaskRepository } from "../core/ports/ITaskRepository";
import type { IToolExecutor, ToolResult } from "../core/ports/IToolExecutor";
import { MonitorAgentUseCase } from "../core/use-cases/agent/MonitorAgentUseCase";
import { StartAgentUseCase } from "../core/use-cases/agent/StartAgentUseCase";
import { PlannerUseCase } from "../core/use-cases/plan/PlannerUseCase";

class MemoryMessageRepository implements IMessageRepository {
  getMessages() {
    return [];
  }

  addMessage(message: Parameters<IMessageRepository["addMessage"]>[0]) {
    return {
      ...message,
      id: "msg-1",
      timestamp: Date.now(),
    };
  }

  async loadHistory(): Promise<void> {}
  async saveHistory(): Promise<void> {}
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

class DeferredToolExecutor implements IToolExecutor {
  readonly started: string[] = [];
  readonly resolvers: Array<() => void> = [];
  active = 0;
  maxActive = 0;

  canHandle(): boolean {
    return true;
  }

  async execute(toolCall: Parameters<IToolExecutor["execute"]>[0]): Promise<ToolResult> {
    this.started.push(toolCall.name);
    this.active += 1;
    this.maxActive = Math.max(this.maxActive, this.active);

    await new Promise<void>((resolve) => {
      this.resolvers.push(() => {
        this.active -= 1;
        resolve();
      });
    });

    return {
      success: true,
      output: `${toolCall.name} done`,
    };
  }
}

class StubSpawnResult implements SpawnResult {
  private exitListeners: Array<(code: number | null) => void> = [];
  private errorListeners: Array<(error: Error) => void> = [];
  private stdoutListeners: Array<(data: string) => void> = [];

  constructor(public readonly pid: number | null = 1234) {}

  kill(): boolean {
    return true;
  }

  onExit(listener: (code: number | null) => void): void {
    this.exitListeners.push(listener);
  }

  onError(listener: (error: Error) => void): void {
    this.errorListeners.push(listener);
  }

  onStdout(listener: (data: string) => void): void {
    this.stdoutListeners.push(listener);
  }

  unref(): void {}

  emitStdout(data: string): void {
    for (const listener of this.stdoutListeners) {
      listener(data);
    }
  }

  emitExit(code: number | null): void {
    for (const listener of this.exitListeners) {
      listener(code);
    }
  }

  emitError(error: Error): void {
    for (const listener of this.errorListeners) {
      listener(error);
    }
  }
}

function createPlanner(toolExecutors: IToolExecutor[]) {
  const eventBus = new StubEventBus();
  const settingsRepository = new InMemorySettingsRepository();
  settingsRepository.setAutonomyLevel(2);

  return new PlannerUseCase(
    new InMemoryPlanRepository(),
    toolExecutors,
    new InMemoryApprovalStore(),
    new MemoryMessageRepository(),
    eventBus,
    settingsRepository,
    "/tmp/asgard",
  );
}

async function waitFor(condition: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

describe("parallel agent execution", () => {
  it("executes adjacent parallel steps concurrently", async () => {
    const executor = new DeferredToolExecutor();
    const plannerUseCase = createPlanner([executor]);
    const plan = await plannerUseCase.createPlan("parallel ship", [
      {
        action: "analyze",
        description: "Analyze backend",
        input: { path: "src/server" },
        requiresApproval: false,
      },
      {
        action: "implement",
        description: "Implement dashboard",
        input: { path: "src/dashboard" },
        parallel: true,
        requiresApproval: false,
      },
      {
        action: "verify",
        description: "Verify result",
        input: { command: "test" },
        requiresApproval: false,
      },
    ]);

    const execution = plannerUseCase.executePlan(plan.id);
    await waitFor(() => executor.started.length === 2);

    expect(executor.started).toEqual(["analyze", "implement"]);
    expect(executor.maxActive).toBe(2);

    executor.resolvers.shift()?.();
    executor.resolvers.shift()?.();
    await waitFor(() => executor.started.length === 3);

    expect(executor.started).toEqual(["analyze", "implement", "verify"]);

    executor.resolvers.shift()?.();
    const result = await execution;

    expect(result.status).toBe("completed");
    expect(result.steps.map((step) => step.status)).toEqual(["completed", "completed", "completed"]);
  });

  it("publishes agent progress from stdout activity and exit", () => {
    const eventBus = new StubEventBus();
    const monitorUseCase = new MonitorAgentUseCase(eventBus);
    const spawnResult = new StubSpawnResult();

    monitorUseCase.startMonitoring("brokkr", "TP-028", spawnResult);
    spawnResult.emitStdout("writing src/yggdrasil/server/core/use-cases/agent/MonitorAgentUseCase.ts");
    spawnResult.emitExit(0);

    const progressEvents = eventBus.published.filter((event) => event.type === AGENT_PROGRESS_EVENT);

    expect(progressEvents).toHaveLength(2);
    expect(progressEvents[0]?.payload).toMatchObject({
      agent: "brokkr",
      tp: "TP-028",
      percent: 10,
      currentFile: "src/yggdrasil/server/core/use-cases/agent/MonitorAgentUseCase.ts",
      status: "running",
    });
    expect(progressEvents[1]?.payload).toMatchObject({
      agent: "brokkr",
      tp: "TP-028",
      percent: 100,
      status: "completed",
    });
  });

  it("starts stdout monitoring when an agent process is spawned", async () => {
    const spawnResult = new StubSpawnResult(4321);
    const monitorCalls: Array<{ agent: string; tp: string; spawnResult: SpawnResult }> = [];

    const taskRepository: ITaskRepository = {
      async list() {
        return { active: [], completed: [] };
      },
      async getById(id) {
        return {
          id,
          title: "Parallel task",
          agent: "codex",
          status: "draft",
          created: "2026-03-12",
          updated: "2026-03-12",
          content: "# TP-028",
        };
      },
      async create() {
        throw new Error("not implemented");
      },
      async updateStatus() {
        return null;
      },
      async delete() {
        return { success: true, message: "ok" };
      },
      async getNextTPNumber() {
        return 29;
      },
    };

    const agentRepository: IAgentRepository = {
      async getHealth(agent: AgentName): Promise<AgentHealth> {
        return {
          name: agent,
          running: false,
          pid: null,
          tp: null,
          mode: null,
          startedAt: null,
          uptime: null,
        };
      },
      async getStates(): Promise<AgentEntity[]> {
        return [];
      },
      async readPid() {
        return null;
      },
      async writePid() {},
      async deletePid() {},
    };

    const processGateway: IProcessGateway = {
      spawn() {
        return spawnResult;
      },
      isAlive() {
        return false;
      },
      kill() {
        return true;
      },
    };

    const processRegistry: IAgentProcessRegistry = {
      set() {},
      get() {
        return undefined;
      },
      delete() {},
      snapshot() {
        return new Map();
      },
    };

    const monitorUseCase = {
      startMonitoring(agent: string, tp: string, result: SpawnResult) {
        monitorCalls.push({ agent, tp, spawnResult: result });
      },
    } as MonitorAgentUseCase;

    const useCase = new StartAgentUseCase(
      taskRepository,
      agentRepository,
      processGateway,
      processRegistry,
      new StubEventBus(),
      monitorUseCase,
    );

    const result = await useCase.execute({ agentName: "brokkr", tp: "TP-028" });

    expect(result.success).toBe(true);
    expect(monitorCalls).toEqual([
      { agent: "brokkr", tp: "TP-028", spawnResult },
    ]);
  });
});
