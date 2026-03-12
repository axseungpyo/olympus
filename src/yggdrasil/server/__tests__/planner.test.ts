import { describe, expect, it } from "vitest";
import { InMemoryPlanRepository } from "../adapters/repositories/InMemoryPlanRepository";
import { InMemorySettingsRepository } from "../adapters/repositories/InMemorySettingsRepository";
import { InMemoryApprovalStore } from "../adapters/stores/InMemoryApprovalStore";
import { PlannerToolExecutor } from "../adapters/tools/PlannerToolExecutor";
import { PLAN_PROGRESS_EVENT } from "../core/events/PlanProgress";
import type { DomainEvent } from "../core/events/DomainEvent";
import type { IEventBus } from "../core/ports/IEventBus";
import type { IMessageRepository } from "../core/ports/IMessageRepository";
import type { IToolExecutor, ToolResult } from "../core/ports/IToolExecutor";
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

class StubToolExecutor implements IToolExecutor {
  readonly calls: string[] = [];

  constructor(
    private readonly toolName: string,
    private readonly responder: (callCount: number) => Promise<ToolResult>,
  ) {}

  canHandle(toolName: string): boolean {
    return toolName === this.toolName;
  }

  async execute(toolCall: Parameters<IToolExecutor["execute"]>[0], _projectRoot: string): Promise<ToolResult> {
    this.calls.push(toolCall.name);
    return this.responder(this.calls.length);
  }
}

function createPlanner(toolExecutors: IToolExecutor[]) {
  const eventBus = new StubEventBus();
  const settingsRepository = new InMemorySettingsRepository();
  settingsRepository.setAutonomyLevel(2);
  const plannerUseCase = new PlannerUseCase(
    new InMemoryPlanRepository(),
    toolExecutors,
    new InMemoryApprovalStore(),
    new MemoryMessageRepository(),
    eventBus,
    settingsRepository,
    "/tmp/asgard",
  );

  return { plannerUseCase, eventBus, settingsRepository };
}

async function createSamplePlan(plannerUseCase: PlannerUseCase) {
  return plannerUseCase.createPlan("ship feature", [
    {
      action: "analyze",
      description: "Analyze codebase",
      input: { path: "src" },
      requiresApproval: false,
    },
    {
      action: "implement",
      description: "Implement change",
      input: { file: "feature.ts" },
      requiresApproval: false,
    },
  ]);
}

describe("PlannerUseCase", () => {
  it("creates and stores a plan", async () => {
    const { plannerUseCase } = createPlanner([]);

    const plan = await plannerUseCase.createPlan("ship feature", [
      {
        action: "analyze",
        description: "Analyze codebase",
        input: { path: "src" },
        requiresApproval: false,
      },
    ]);

    expect(plan.status).toBe("draft");
    expect(plan.currentStep).toBe(0);
    expect(plan.steps).toMatchObject([
      {
        order: 1,
        action: "analyze",
        status: "pending",
        requiresApproval: false,
      },
    ]);
    await expect(plannerUseCase.getActivePlan()).resolves.toMatchObject({ id: plan.id });
  });

  it("executes plan steps sequentially", async () => {
    const analyzeExecutor = new StubToolExecutor("analyze", async () => ({ success: true, output: "analysis done" }));
    const implementExecutor = new StubToolExecutor("implement", async () => ({ success: true, output: "implemented" }));
    const { plannerUseCase } = createPlanner([analyzeExecutor, implementExecutor]);
    const plan = await createSamplePlan(plannerUseCase);

    const result = await plannerUseCase.executePlan(plan.id);

    expect(analyzeExecutor.calls).toEqual(["analyze"]);
    expect(implementExecutor.calls).toEqual(["implement"]);
    expect(result.status).toBe("completed");
    expect(result.steps.map((step) => step.status)).toEqual(["completed", "completed"]);
    expect(result.steps[0]?.result).toBe("analysis done");
    expect(result.steps[1]?.result).toBe("implemented");
  });

  it("skips a step when dependencies are not completed", async () => {
    const analyzeExecutor = new StubToolExecutor("analyze", async () => ({ success: true, output: "analysis done" }));
    const implementExecutor = new StubToolExecutor("implement", async () => ({ success: true, output: "implemented" }));
    const { plannerUseCase } = createPlanner([analyzeExecutor, implementExecutor]);
    const plan = await plannerUseCase.createPlan("ship feature", [
      {
        action: "analyze",
        description: "Analyze codebase",
        input: { path: "src" },
        requiresApproval: false,
      },
      {
        action: "implement",
        description: "Implement change",
        input: { file: "feature.ts" },
        dependsOn: [99],
        requiresApproval: false,
      },
    ]);

    const result = await plannerUseCase.executePlan(plan.id);

    expect(result.status).toBe("completed");
    expect(result.steps[0]?.status).toBe("completed");
    expect(result.steps[1]).toMatchObject({
      status: "skipped",
      error: expect.stringContaining("99"),
    });
    expect(implementExecutor.calls).toEqual([]);
  });

  it("retries a failed step and completes within max retries", async () => {
    const analyzeExecutor = new StubToolExecutor("analyze", async (callCount) => (
      callCount < 3
        ? { success: false, output: "", error: `failed-${callCount}` }
        : { success: true, output: "analysis done" }
    ));
    const { plannerUseCase, eventBus } = createPlanner([analyzeExecutor]);
    const plan = await plannerUseCase.createPlan("ship feature", [
      {
        action: "analyze",
        description: "Analyze codebase",
        input: { path: "src" },
        requiresApproval: false,
      },
    ]);

    const result = await plannerUseCase.executePlan(plan.id);

    expect(analyzeExecutor.calls).toEqual(["analyze", "analyze", "analyze"]);
    expect(result.status).toBe("completed");
    expect(result.retryCount).toBe(2);
    expect(result.steps[0]?.status).toBe("completed");
    expect(eventBus.published.filter((event) => event.type === PLAN_PROGRESS_EVENT)).not.toHaveLength(0);
  });

  it("fails the plan after exceeding max retries", async () => {
    const analyzeExecutor = new StubToolExecutor("analyze", async (callCount) => ({
      success: false,
      output: "",
      error: `failed-${callCount}`,
    }));
    const { plannerUseCase } = createPlanner([analyzeExecutor]);
    const plan = await plannerUseCase.createPlan("ship feature", [
      {
        action: "analyze",
        description: "Analyze codebase",
        input: { path: "src" },
        requiresApproval: false,
      },
    ]);

    const result = await plannerUseCase.executePlan(plan.id);

    expect(analyzeExecutor.calls).toEqual(["analyze", "analyze", "analyze"]);
    expect(result.status).toBe("failed");
    expect(result.retryCount).toBe(3);
    expect(result.steps[0]?.status).toBe("failed");
    expect(result.steps[0]?.error).toBe("failed-3");
  });

  it("pauses the plan when a step requires approval", async () => {
    const analyzeExecutor = new StubToolExecutor("analyze", async () => ({ success: true, output: "analysis done" }));
    const implementExecutor = new StubToolExecutor("implement", async () => ({ success: true, output: "implemented" }));
    const { plannerUseCase } = createPlanner([analyzeExecutor, implementExecutor]);
    const plan = await plannerUseCase.createPlan("ship feature", [
      {
        action: "analyze",
        description: "Analyze codebase",
        input: { path: "src" },
        requiresApproval: false,
      },
      {
        action: "implement",
        description: "Implement change",
        input: { file: "feature.ts" },
        requiresApproval: true,
      },
    ]);

    const result = await plannerUseCase.executePlan(plan.id);

    expect(result.status).toBe("paused");
    expect(result.currentStep).toBe(2);
    expect(result.steps[0]?.status).toBe("completed");
    expect(result.steps[1]?.status).toBe("pending");
    expect(implementExecutor.calls).toEqual([]);
  });

  it("forces approval for every step at autonomy level 1", async () => {
    const analyzeExecutor = new StubToolExecutor("analyze", async () => ({ success: true, output: "analysis done" }));
    const { plannerUseCase, settingsRepository } = createPlanner([analyzeExecutor]);
    settingsRepository.setAutonomyLevel(1);

    const plan = await plannerUseCase.createPlan("ship feature", [
      {
        action: "analyze",
        description: "Analyze codebase",
        input: { path: "src" },
        requiresApproval: false,
      },
    ]);

    expect(plan.steps[0]?.requiresApproval).toBe(true);

    const result = await plannerUseCase.executePlan(plan.id);

    expect(result.status).toBe("paused");
    expect(result.currentStep).toBe(1);
    expect(analyzeExecutor.calls).toEqual([]);
  });

  it("only requires approval for risky actions at autonomy level 3", async () => {
    const analyzeExecutor = new StubToolExecutor("analyze", async () => ({ success: true, output: "analysis done" }));
    const { plannerUseCase, settingsRepository } = createPlanner([analyzeExecutor]);
    settingsRepository.setAutonomyLevel(3);

    const plan = await plannerUseCase.createPlan("ship feature", [
      {
        action: "analyze",
        description: "Analyze codebase",
        input: { path: "src" },
        requiresApproval: true,
      },
      {
        action: "write_file",
        description: "Write output",
        input: { path: "feature.ts" },
        requiresApproval: false,
      },
    ]);

    expect(plan.steps.map((step) => step.requiresApproval)).toEqual([false, true]);
  });
});

describe("PlannerToolExecutor", () => {
  it("returns the active plan status", async () => {
    const analyzeExecutor = new StubToolExecutor("analyze", async () => ({ success: true, output: "analysis done" }));
    const { plannerUseCase } = createPlanner([analyzeExecutor]);
    const executor = new PlannerToolExecutor(plannerUseCase);

    await executor.execute({
      name: "create_plan",
      input: {
        goal: "ship feature",
        steps: [
          {
            action: "analyze",
            description: "Analyze codebase",
            input: { path: "src" },
          },
          {
            action: "approval_step",
            description: "Wait for approval",
            input: {},
            requiresApproval: true,
          },
        ],
      },
    }, "/tmp/asgard");

    const status = await executor.execute({ name: "get_plan_status", input: {} }, "/tmp/asgard");

    expect(status.success).toBe(true);
    expect(status.output).toContain("Plan: ship feature");
    expect(status.output).toContain("[paused]");
  });
});
