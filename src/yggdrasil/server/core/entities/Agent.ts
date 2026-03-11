export type AgentName = "odin" | "brokkr" | "heimdall" | "loki";

export type AgentStatus = "idle" | "running" | "blocked" | "done";

export type AgentMode =
  | "spark"
  | "anvil"
  | "mjolnir"
  | "ragnarok"
  | "glint"
  | "bifrost"
  | "gjallarhorn"
  | "sketch"
  | "canvas";

export interface AgentEntity {
  name: AgentName;
  displayName: string;
  status: AgentStatus;
  currentTP: string | null;
  mode: string | null;
  startedAt: number | null;
  pid: number | null;
  color: string;
}

export interface AgentHealth {
  name: AgentName;
  running: boolean;
  pid: number | null;
  tp: string | null;
  mode: string | null;
  startedAt: number | null;
  uptime: number | null;
}

export const AGENT_MODES: Record<string, { modes: string[]; defaultMode: string }> = {
  brokkr: {
    modes: ["spark", "anvil", "mjolnir", "ragnarok"],
    defaultMode: "anvil",
  },
  heimdall: {
    modes: ["glint", "bifrost", "gjallarhorn"],
    defaultMode: "bifrost",
  },
  loki: {
    modes: ["sketch", "canvas"],
    defaultMode: "sketch",
  },
};
