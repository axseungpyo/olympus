import type { ExecutionPlan, PlanStep } from "../../entities/Plan";
import { PLAN_PROGRESS_EVENT, type PlanProgressPayload } from "../../events/PlanProgress";
import type { IApprovalStore } from "../../ports/IApprovalStore";
import type { IEventBus } from "../../ports/IEventBus";
import type { IMessageRepository } from "../../ports/IMessageRepository";
import type { IPlanRepository } from "../../ports/IPlanRepository";
import type { IToolExecutor } from "../../ports/IToolExecutor";

export class PlannerUseCase {
  private toolExecutors: IToolExecutor[];

  constructor(
    private readonly planRepository: IPlanRepository,
    toolExecutors: IToolExecutor[],
    private readonly approvalStore: IApprovalStore,
    private readonly messageRepository: IMessageRepository,
    private readonly eventBus: IEventBus,
    private readonly projectRoot: string,
  ) {
    this.toolExecutors = toolExecutors;
  }

  setToolExecutors(toolExecutors: IToolExecutor[]): void {
    this.toolExecutors = toolExecutors;
  }

  async createPlan(goal: string, steps: Array<Omit<PlanStep, "order" | "status"> & Partial<Pick<PlanStep, "order" | "status">>>): Promise<ExecutionPlan> {
    const timestamp = Date.now();
    const plan: ExecutionPlan = {
      id: `plan-${timestamp}`,
      goal,
      steps: steps.map((step, index) => ({
        order: index + 1,
        action: step.action,
        description: step.description,
        input: step.input,
        dependsOn: step.dependsOn,
        requiresApproval: step.requiresApproval ?? false,
        status: "pending",
      })),
      status: "draft",
      currentStep: 0,
      maxRetries: 3,
      retryCount: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await this.planRepository.save(plan);
    return plan;
  }

  async executePlan(planId: string): Promise<ExecutionPlan> {
    const plan = await this.planRepository.getById(planId);
    if (!plan) {
      throw new Error(`Plan not found: ${planId}`);
    }

    plan.status = "running";
    this.touch(plan);
    await this.planRepository.update(plan);

    for (const step of plan.steps) {
      if (step.status === "completed" || step.status === "skipped") {
        continue;
      }

      if (this.hasUnmetDependencies(plan, step)) {
        const unmet = step.dependsOn?.filter((dependencyOrder) => {
          const dependency = plan.steps.find((candidate) => candidate.order === dependencyOrder);
          return !dependency || dependency.status !== "completed";
        }) ?? [];
        step.status = "skipped";
        step.error = `의존 단계 미완료: ${unmet.join(", ")}`;
        plan.currentStep = step.order;
        this.touch(plan);
        this.publishProgress(plan, step);
        await this.planRepository.update(plan);
        continue;
      }

      if (step.requiresApproval) {
        plan.currentStep = step.order;
        plan.status = "paused";
        this.touch(plan);
        this.publishProgress(plan, step);
        await this.planRepository.update(plan);
        return plan;
      }

      const completed = await this.executeStepWithRetry(plan, step);
      await this.planRepository.update(plan);
      if (!completed) {
        return plan;
      }
    }

    plan.status = plan.steps.every((step) => step.status === "completed" || step.status === "skipped")
      ? "completed"
      : "failed";
    this.touch(plan);
    await this.planRepository.update(plan);
    return plan;
  }

  async getActivePlan(): Promise<ExecutionPlan | null> {
    return this.planRepository.getActive();
  }

  async resumePlan(planId: string): Promise<ExecutionPlan> {
    return this.executePlan(planId);
  }

  private async executeStepWithRetry(plan: ExecutionPlan, step: PlanStep): Promise<boolean> {
    while (plan.retryCount < plan.maxRetries) {
      step.status = "running";
      step.error = undefined;
      plan.currentStep = step.order;
      this.touch(plan);
      this.publishProgress(plan, step);

      const executor = this.toolExecutors.find((entry) => entry.canHandle(step.action));
      if (!executor) {
        step.status = "failed";
        step.error = `실행기 없음: ${step.action}`;
        plan.status = "failed";
        this.touch(plan);
        this.publishProgress(plan, step);
        return false;
      }

      const result = await executor.execute({ name: step.action, input: step.input }, this.projectRoot);
      if (result.success) {
        step.status = "completed";
        step.result = result.output;
        this.touch(plan);
        this.publishProgress(plan, step);
        return true;
      }

      plan.retryCount += 1;
      step.status = "failed";
      step.error = result.error ?? "Unknown error";
      this.touch(plan);
      this.publishProgress(plan, step);

      if (plan.retryCount >= plan.maxRetries) {
        plan.status = "failed";
        this.touch(plan);
        return false;
      }

      step.status = "pending";
      this.touch(plan);
      this.publishProgress(plan, step);
    }

    plan.status = "failed";
    this.touch(plan);
    return false;
  }

  private hasUnmetDependencies(plan: ExecutionPlan, step: PlanStep): boolean {
    if (!step.dependsOn?.length) {
      return false;
    }

    return step.dependsOn.some((dependencyOrder) => {
      const dependency = plan.steps.find((candidate) => candidate.order === dependencyOrder);
      return !dependency || dependency.status !== "completed";
    });
  }

  private publishProgress(plan: ExecutionPlan, step: PlanStep): void {
    const timestamp = Date.now();
    const payload: PlanProgressPayload = {
      planId: plan.id,
      goal: plan.goal,
      currentStep: step.order,
      totalSteps: plan.steps.length,
      stepDescription: step.description,
      stepStatus: step.status,
      timestamp,
    };

    void this.approvalStore;
    void this.messageRepository;

    this.eventBus.publish({
      type: PLAN_PROGRESS_EVENT,
      timestamp,
      payload,
    });
  }

  private touch(plan: ExecutionPlan): void {
    plan.updatedAt = Date.now();
  }
}
