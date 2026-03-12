export const AGENT_PROGRESS_EVENT = "agent.progress" as const;

export interface AgentProgressPayload extends Record<string, unknown> {
  agent: string;
  tp: string;
  percent: number;
  currentFile?: string;
  status: "running" | "completed" | "failed";
  timestamp: number;
}
