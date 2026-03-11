export type {
  AgentEntity as AgentState,
  AgentHealth,
  AgentMode,
  AgentName,
  AgentStatus,
} from "../server/core/entities/Agent";
export { AGENT_MODES } from "../server/core/entities/Agent";
export type {
  CommandResult,
  OdinAction,
  OdinMessage,
} from "../server/core/entities/Message";
export type {
  CompletedTask,
  CreateTaskInput,
  TaskComplexity,
  TaskDetail,
  TaskEntity as Task,
  TaskStatus,
  UpdateTaskInput,
} from "../server/core/entities/Task";
import type { AgentName } from "../server/core/entities/Agent";
import type { TaskStatus as SharedTaskStatus } from "../server/core/entities/Task";

export interface DependencyGraphNode {
  id: string;
  dependsOn: string[];
  status: SharedTaskStatus;
}

export interface DependencyGraphResponse {
  nodes: DependencyGraphNode[];
  executionOrder: string[][];
  hasCycle: boolean;
  cycle: string[] | null;
}

export interface LogEntry {
  timestamp: number;
  agent: AgentName | "system";
  message: string;
  level: "info" | "warn" | "error";
}
