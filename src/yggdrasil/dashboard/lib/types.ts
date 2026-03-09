export type AgentName = "odin" | "brokkr" | "heimdall";

export type AgentStatus = "idle" | "running" | "blocked" | "done";

export interface AgentState {
  name: AgentName;
  displayName: string;
  status: AgentStatus;
  currentTP: string | null;
  mode: string | null;
  startedAt: number | null;
  pid: number | null;
  color: string;
}

export type TaskStatus =
  | "draft"
  | "in-progress"
  | "review-needed"
  | "done"
  | "blocked";

export interface Task {
  id: string;
  title: string;
  agent: string;
  status: TaskStatus;
  created: string;
  updated: string;
}

export interface DependencyGraphNode {
  id: string;
  dependsOn: string[];
  status: TaskStatus;
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

export interface StatusResponse {
  agents: AgentState[];
  activeTasks: number;
  completedTasks: number;
}

export interface ChronicleResponse {
  tasks: Task[];
}

export interface DocumentResponse {
  type: "tp" | "rp";
  id: string;
  content: string;
  title: string;
}

// WebSocket message types
export type WSMessage =
  | { type: "log"; data: LogEntry }
  | { type: "status"; data: AgentState[] }
  | { type: "chronicle"; data: Task[] }
  | { type: "connected"; data: { message: string } };
