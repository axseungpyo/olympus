export type AgentName = "odin" | "brokkr" | "heimdall" | "loki";

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

export interface AgentMetric {
  name: string;
  totalTasks: number;
  completed: number;
  blocked: number;
  successRate: number;
  avgDuration: number;
}

export interface DailyMetric {
  date: string;
  count: number;
}

export interface RecentExecution {
  agent: string;
  tp: string;
  duration: number;
  result: string;
  timestamp: string;
}

export interface MetricsResponse {
  agents: AgentMetric[];
  daily: DailyMetric[];
  recentExecutions: RecentExecution[];
}

export interface DocumentResponse {
  type: "tp" | "rp";
  id: string;
  content: string;
  title: string;
}

// Odin Command Channel
export interface OdinAction {
  id: string;
  label: string;
  type: "approve" | "reject" | "custom";
  payload?: Record<string, unknown>;
}

export interface OdinMessage {
  id: string;
  timestamp: number;
  role: "user" | "odin";
  type: "command" | "response" | "approval_request" | "notification" | "progress";
  content: string;
  actions?: OdinAction[];
  metadata?: {
    tp?: string;
    agent?: string;
    skill?: string;
    severity?: "info" | "warning" | "critical";
  };
}

// WebSocket message types
export type WSMessage =
  | { type: "log"; data: LogEntry }
  | { type: "status"; data: AgentState[] }
  | { type: "chronicle"; data: Task[] }
  | { type: "message"; data: OdinMessage }
  | { type: "connected"; data: { message: string } };
