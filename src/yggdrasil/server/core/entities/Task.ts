export type TaskStatus =
  | "draft"
  | "in-progress"
  | "review-needed"
  | "done"
  | "blocked";

export type TaskAgentTarget = "codex" | "gemini";

export type TaskComplexity = "simple" | "moderate" | "complex" | "extreme";

export interface TaskEntity {
  id: string;
  title: string;
  agent: string;
  status: TaskStatus;
  created: string;
  updated: string;
}

export interface CompletedTask {
  id: string;
  title: string;
  agent: string;
  completed: string;
}

export interface CreateTaskInput {
  title: string;
  objective: string;
  agent: TaskAgentTarget;
  complexity: TaskComplexity;
  scopeIn: string[];
  scopeOut: string[];
  acceptanceCriteria: string[];
  dependsOn?: string[];
  notes?: string;
}

export interface UpdateTaskInput {
  title?: string;
  objective?: string;
  agent?: TaskAgentTarget;
  complexity?: TaskComplexity;
  status?: TaskStatus;
}

export interface TaskDetail extends TaskEntity {
  content: string;
  rpContent?: string;
}
