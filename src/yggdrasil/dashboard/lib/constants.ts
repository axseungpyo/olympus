import type { AgentName, AgentStatus, TaskStatus } from "./types";

// ─── Agent Configuration (Single Source of Truth) ───

export interface AgentConfig {
  displayName: string;
  color: string;
  model: string;
  role: string;
}

export const AGENT_CONFIG: Record<AgentName, AgentConfig> = {
  odin: { displayName: "Odin", color: "#d97757", model: "Claude Opus 4.6", role: "Brain" },
  brokkr: { displayName: "Brokkr", color: "#10a37f", model: "GPT-5.4 (Codex CLI)", role: "Hands-Code" },
  heimdall: { displayName: "Heimdall", color: "#4285f4", model: "Gemini 3.1 Pro (Gemini CLI)", role: "Hands-Vision" },
  loki: { displayName: "Loki", color: "#a855f7", model: "Image Gen", role: "Hands-Image" },
};

export const AGENT_NAMES: AgentName[] = ["odin", "brokkr", "heimdall", "loki"];

// ─── Status Configuration ───

export const STATUS_CONFIG: Record<AgentStatus, { label: string; color: string }> = {
  idle: { label: "Idle", color: "#9ca3af" },
  running: { label: "Running", color: "#b197fc" },
  blocked: { label: "Blocked", color: "#ff6b6b" },
  done: { label: "Done", color: "#86efac" },
};

export const TASK_STATUS_CONFIG: Record<TaskStatus, { label: string; color: string }> = {
  draft: { label: "Draft", color: "#94a3b8" },
  "in-progress": { label: "In Progress", color: "#b197fc" },
  "review-needed": { label: "Review", color: "#f0abfc" },
  done: { label: "Done", color: "#86efac" },
  blocked: { label: "Blocked", color: "#ff6b6b" },
};

// ─── WebSocket ───

export function getWsBase(): string {
  if (typeof window === "undefined") return "ws://localhost:7777";
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.hostname}:7777`;
}

export const MAX_LOGS = 500;

// ─── Agent Mode Configuration ───

export interface AgentModeConfig {
  id: string;
  label: string;
  description: string;
}

export const AGENT_MODE_CONFIG: Partial<Record<AgentName, { modes: AgentModeConfig[]; defaultMode: string }>> = {
  brokkr: {
    defaultMode: "anvil",
    modes: [
      { id: "spark", label: "Spark", description: "Simple edits, boilerplate" },
      { id: "anvil", label: "Anvil", description: "Standard implementation" },
      { id: "mjolnir", label: "Mjolnir", description: "Complex multi-file work" },
      { id: "ragnarok", label: "Ragnarok", description: "Extended autonomous work" },
    ],
  },
  heimdall: {
    defaultMode: "bifrost",
    modes: [
      { id: "glint", label: "Glint", description: "Quick OCR/classify" },
      { id: "bifrost", label: "Bifrost", description: "Detailed analysis" },
      { id: "gjallarhorn", label: "Gjallarhorn", description: "Image generation" },
    ],
  },
  loki: {
    defaultMode: "sketch",
    modes: [
      { id: "sketch", label: "Sketch", description: "Fast mock/placeholder" },
      { id: "canvas", label: "Canvas", description: "Precision image gen" },
    ],
  },
};
