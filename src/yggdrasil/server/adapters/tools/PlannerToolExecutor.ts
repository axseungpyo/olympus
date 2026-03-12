import type { ExecutionPlan, PlanStep } from "../../core/entities/Plan";
import type { LLMToolCall } from "../../core/ports/ILLMGateway";
import type { IToolExecutor, ToolResult } from "../../core/ports/IToolExecutor";
import { PlannerUseCase } from "../../core/use-cases/plan/PlannerUseCase";

const HANDLED_TOOLS = new Set(["create_plan", "get_plan_status"]);

export class PlannerToolExecutor implements IToolExecutor {
  constructor(private readonly plannerUseCase: PlannerUseCase) {}

  canHandle(toolName: string): boolean {
    return HANDLED_TOOLS.has(toolName);
  }

  async execute(toolCall: LLMToolCall, _projectRoot: string): Promise<ToolResult> {
    try {
      if (toolCall.name === "create_plan") {
        const plan = await this.plannerUseCase.createPlan(
          this.readString(toolCall.input, "goal"),
          this.readSteps(toolCall.input),
        );
        const executed = await this.plannerUseCase.executePlan(plan.id);
        return this.formatPlanResult(executed);
      }

      if (toolCall.name === "get_plan_status") {
        const active = await this.plannerUseCase.getActivePlan();
        if (!active) {
          return { success: true, output: "활성 실행 계획이 없습니다." };
        }
        return this.formatPlanResult(active);
      }

      return { success: false, output: "", error: `지원하지 않는 도구: ${toolCall.name}` };
    } catch (error) {
      return {
        success: false,
        output: "",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private formatPlanResult(plan: ExecutionPlan): ToolResult {
    const lines = [
      `Plan: ${plan.goal} [${plan.status}]`,
      `Progress: ${plan.steps.filter((step) => step.status === "completed").length}/${plan.steps.length}`,
      ...plan.steps.map((step) => `  ${step.order}. [${step.status}] ${step.description}${step.error ? ` — ${step.error}` : ""}`),
    ];
    return { success: true, output: lines.join("\n") };
  }

  private readString(input: Record<string, unknown>, key: string): string {
    const value = input[key];
    if (typeof value !== "string" || !value.trim()) {
      throw new Error(`${key} must be a non-empty string`);
    }
    return value.trim();
  }

  private readSteps(input: Record<string, unknown>): PlanStep[] {
    const value = input.steps;
    if (!Array.isArray(value)) {
      throw new Error("steps must be an array");
    }

    return value.map((step, index) => {
      if (!step || typeof step !== "object" || Array.isArray(step)) {
        throw new Error(`steps[${index}] must be an object`);
      }

      const record = step as Record<string, unknown>;
      return {
        order: index + 1,
        action: this.readStepString(record, "action", index),
        description: this.readStepString(record, "description", index),
        input: this.readInput(record, index),
        dependsOn: this.readDependsOn(record.dependsOn, index),
        requiresApproval: typeof record.requiresApproval === "boolean" ? record.requiresApproval : false,
        status: "pending",
      };
    });
  }

  private readStepString(step: Record<string, unknown>, key: string, index: number): string {
    const value = step[key];
    if (typeof value !== "string" || !value.trim()) {
      throw new Error(`steps[${index}].${key} must be a non-empty string`);
    }
    return value.trim();
  }

  private readInput(step: Record<string, unknown>, index: number): Record<string, unknown> {
    const value = step.input;
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`steps[${index}].input must be an object`);
    }
    return value as Record<string, unknown>;
  }

  private readDependsOn(value: unknown, index: number): number[] | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (!Array.isArray(value) || value.some((item) => typeof item !== "number")) {
      throw new Error(`steps[${index}].dependsOn must be an array of numbers`);
    }
    return value as number[];
  }
}
