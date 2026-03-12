import type { StepStatus } from "../entities/Plan";

export const PLAN_PROGRESS_EVENT = "plan.progress" as const;

export interface PlanProgressPayload extends Record<string, unknown> {
  planId: string;
  goal: string;
  currentStep: number;
  totalSteps: number;
  stepDescription: string;
  stepStatus: StepStatus;
  timestamp: number;
}
