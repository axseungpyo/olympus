"use client";

import { useMemo } from "react";
import type { Task } from "../lib/types";
import { AGENT_CONFIG, TASK_STATUS_CONFIG } from "../lib/constants";

interface FlowViewProps {
  tasks: Task[];
}

const agentDisplayMap: Record<string, { label: string; color: string }> = {
  odin: { label: AGENT_CONFIG.odin.displayName, color: AGENT_CONFIG.odin.color },
  brokkr: { label: AGENT_CONFIG.brokkr.displayName, color: AGENT_CONFIG.brokkr.color },
  heimdall: { label: AGENT_CONFIG.heimdall.displayName, color: AGENT_CONFIG.heimdall.color },
  codex: { label: AGENT_CONFIG.brokkr.displayName, color: AGENT_CONFIG.brokkr.color },
  gemini: { label: AGENT_CONFIG.heimdall.displayName, color: AGENT_CONFIG.heimdall.color },
};

export default function FlowView({ tasks }: FlowViewProps) {
  const flowTasks = useMemo(
    () =>
      [...tasks].sort(
        (a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime()
      ),
    [tasks]
  );

  if (flowTasks.length === 0) {
    return (
      <div className="bg-bg-secondary border border-zinc-500/60 rounded-lg p-8 text-center">
        <p className="text-zinc-700 text-[13px] font-mono">No task flow available</p>
      </div>
    );
  }

  return (
    <div className="bg-bg-secondary border border-zinc-500/60 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800/60">
        <h2 className="text-[12px] font-mono font-medium text-zinc-400 uppercase tracking-wider">
          Task Flow
        </h2>
        <span className="text-[12px] text-zinc-600 font-mono">{flowTasks.length} tasks</span>
      </div>

      <div className="p-3 sm:p-4 space-y-3">
        {flowTasks.map((task) => {
          const status = TASK_STATUS_CONFIG[task.status];
          const agent =
            agentDisplayMap[task.agent.toLowerCase()] ?? {
              label: task.agent,
              color: "#a1a1aa",
            };
          const isActive = task.status === "in-progress";

          return (
            <div
              key={task.id}
              className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 px-3 py-3 sm:px-4"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3">
                <div>
                  <div className="text-[12px] font-mono text-zinc-500">{task.id}</div>
                  <div className="text-[14px] text-zinc-200">{task.title}</div>
                </div>
                <div
                  className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-mono self-start ${
                    isActive ? "animate-pulse-dot" : ""
                  }`}
                  style={{
                    color: status.color,
                    borderColor: `${status.color}55`,
                    backgroundColor: `${status.color}12`,
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  {status.label}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_72px_minmax(0,1fr)_72px_minmax(0,1fr)] gap-2 items-center">
                <FlowNode
                  label="TP"
                  title={task.id}
                  subtitle="Rune"
                  accent={status.color}
                  isAnimated={isActive}
                />
                <FlowConnector color={status.color} isAnimated={isActive} />
                <FlowNode
                  label="Agent"
                  title={agent.label}
                  subtitle={task.agent}
                  accent={agent.color}
                  isAnimated={isActive}
                />
                <FlowConnector color={status.color} isAnimated={isActive} />
                <FlowNode
                  label="RP"
                  title={task.id.replace(/^TP/i, "RP")}
                  subtitle="Saga"
                  accent={status.color}
                  isAnimated={isActive}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface FlowNodeProps {
  label: string;
  title: string;
  subtitle: string;
  accent: string;
  isAnimated?: boolean;
}

function FlowNode({ label, title, subtitle, accent, isAnimated = false }: FlowNodeProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-lg border bg-zinc-900/70 px-3 py-3 min-h-[92px] ${
        isAnimated ? "animate-pulse-dot" : ""
      }`}
      style={{ borderColor: `${accent}44` }}
    >
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
      />
      <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-500 mb-2">
        {label}
      </div>
      <div className="text-[14px] text-zinc-100 break-all">{title}</div>
      <div className="text-[12px] font-mono mt-1" style={{ color: accent }}>
        {subtitle}
      </div>
    </div>
  );
}

interface FlowConnectorProps {
  color: string;
  isAnimated?: boolean;
}

function FlowConnector({ color, isAnimated = false }: FlowConnectorProps) {
  return (
    <div className="hidden lg:flex items-center justify-center">
      <svg
        viewBox="0 0 72 24"
        className={`w-[72px] h-6 ${isAnimated ? "animate-pulse-dot" : ""}`}
        aria-hidden="true"
      >
        <line
          x1="4"
          y1="12"
          x2="60"
          y2="12"
          stroke={color}
          strokeWidth="1.5"
          strokeDasharray={isAnimated ? "5 4" : undefined}
        />
        <path d="M60 6 L68 12 L60 18" fill="none" stroke={color} strokeWidth="1.5" />
      </svg>
    </div>
  );
}
