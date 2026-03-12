import type { ExecutionPlan } from "../../core/entities/Plan";
import type { IPlanRepository } from "../../core/ports/IPlanRepository";

const ACTIVE_STATUSES = new Set(["draft", "approved", "running", "paused"]);

export class InMemoryPlanRepository implements IPlanRepository {
  private readonly plans = new Map<string, ExecutionPlan>();

  async save(plan: ExecutionPlan): Promise<void> {
    this.plans.set(plan.id, this.clone(plan));
  }

  async getById(id: string): Promise<ExecutionPlan | null> {
    const plan = this.plans.get(id);
    return plan ? this.clone(plan) : null;
  }

  async getActive(): Promise<ExecutionPlan | null> {
    const activePlans = [...this.plans.values()]
      .filter((plan) => ACTIVE_STATUSES.has(plan.status))
      .sort((left, right) => right.updatedAt - left.updatedAt);
    return activePlans[0] ? this.clone(activePlans[0]) : null;
  }

  async update(plan: ExecutionPlan): Promise<void> {
    this.plans.set(plan.id, this.clone(plan));
  }

  private clone(plan: ExecutionPlan): ExecutionPlan {
    return structuredClone(plan);
  }
}
