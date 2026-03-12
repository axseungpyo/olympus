export type PlanStatus = "draft" | "approved" | "running" | "paused" | "completed" | "failed";

export type StepStatus = "pending" | "running" | "completed" | "failed" | "skipped";

export interface PlanStep {
  order: number;
  action: string;
  description: string;
  input: Record<string, unknown>;
  dependsOn?: number[];
  parallel?: boolean;
  requiresApproval: boolean;
  status: StepStatus;
  result?: string;
  error?: string;
}

export interface ExecutionPlan {
  id: string;
  goal: string;
  steps: PlanStep[];
  status: PlanStatus;
  currentStep: number;
  maxRetries: number;
  retryCount: number;
  createdAt: number;
  updatedAt: number;
}
