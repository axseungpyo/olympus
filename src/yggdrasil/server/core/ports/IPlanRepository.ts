import type { ExecutionPlan } from "../entities/Plan";

export interface IPlanRepository {
  save(plan: ExecutionPlan): Promise<void>;
  getById(id: string): Promise<ExecutionPlan | null>;
  getActive(): Promise<ExecutionPlan | null>;
  update(plan: ExecutionPlan): Promise<void>;
}
