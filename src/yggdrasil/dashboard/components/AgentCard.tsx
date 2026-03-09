"use client";

import { useEffect, useState } from "react";
import type { AgentState, AgentStatus } from "../lib/types";

interface AgentCardProps {
  agent: AgentState;
}

const AGENT_META: Record<string, { model: string; role: string }> = {
  odin: { model: "Claude Opus 4.6", role: "Brain" },
  brokkr: { model: "GPT-5.4 (Codex CLI)", role: "Hands-Code" },
  heimdall: { model: "Gemini 3.1 Pro (Gemini CLI)", role: "Hands-Vision" },
};

const agentColors: Record<string, string> = {
  odin: "#d97757",
  brokkr: "#10a37f",
  heimdall: "#4285f4",
};

const statusConfig: Record<AgentStatus, { label: string; color: string }> = {
  idle: { label: "Idle", color: "#71717a" },
  running: { label: "Running", color: "#a78bfa" },
  blocked: { label: "Blocked", color: "#ff6b6b" },
  done: { label: "Done", color: "#a3e635" },
};

function formatElapsed(startedAt: number): string {
  const seconds = Math.floor((Date.now() - startedAt) / 1000);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function AgentCard({ agent }: AgentCardProps) {
  const [elapsed, setElapsed] = useState("");
  const meta = AGENT_META[agent.name] ?? { model: "Unknown", role: "Agent" };
  const color = agentColors[agent.name] ?? "#a1a1aa";
  const status = statusConfig[agent.status];

  useEffect(() => {
    if (agent.status !== "running" || !agent.startedAt) {
      setElapsed("");
      return;
    }
    setElapsed(formatElapsed(agent.startedAt));
    const interval = setInterval(() => {
      setElapsed(formatElapsed(agent.startedAt!));
    }, 1000);
    return () => clearInterval(interval);
  }, [agent.status, agent.startedAt]);

  return (
    <div className="bg-bg-secondary border border-zinc-500/60 rounded-lg p-4 hover:border-zinc-700/80/80 transition-colors">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <span
            className="w-1 h-5 rounded-full"
            style={{ backgroundColor: color }}
          />
          <span className="font-medium text-[14px] text-zinc-100">{agent.displayName}</span>
        </div>
        <span className="flex items-center gap-1.5 text-[12px] font-mono" style={{ color: status.color }}>
          {agent.status === "running" && (
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse-dot" />
          )}
          {status.label}
        </span>
      </div>

      <div className="text-[12px] text-zinc-600 mb-3 font-mono">
        {meta.role} · {meta.model}
      </div>

      <div className="space-y-1.5">
        {agent.currentTP ? (
          <div className="flex items-center justify-between">
            <span className="text-zinc-600 text-[12px] font-mono">task</span>
            <span className="font-mono text-[12px] text-zinc-400">{agent.currentTP}</span>
          </div>
        ) : (
          <div className="text-[12px] text-zinc-700 font-mono">No active task</div>
        )}

        {agent.status === "running" && elapsed && (
          <div className="flex items-center justify-between">
            <span className="text-zinc-600 text-[12px] font-mono">elapsed</span>
            <span className="font-mono text-[12px] text-zinc-400 tabular-nums">{elapsed}</span>
          </div>
        )}

        {agent.mode && (
          <div className="flex items-center justify-between">
            <span className="text-zinc-600 text-[12px] font-mono">mode</span>
            <span className="font-mono text-[12px] text-zinc-400">{agent.mode}</span>
          </div>
        )}
      </div>
    </div>
  );
}
