"use client";

import type { AgentProgressPayload } from "../lib/types";

interface AgentProgressProps {
  agents: AgentProgressPayload[];
}

const STATUS_STYLES: Record<AgentProgressPayload["status"], string> = {
  running: "bg-blue-500/15 text-blue-300",
  completed: "bg-emerald-500/15 text-emerald-300",
  failed: "bg-red-500/15 text-red-300",
};

const BAR_STYLES: Record<AgentProgressPayload["status"], string> = {
  running: "bg-slate-200",
  completed: "bg-emerald-400",
  failed: "bg-red-400",
};

function formatAgentName(agent: string): string {
  return agent === "brokkr" ? "Brokkr" : agent === "heimdall" ? "Heimdall" : agent;
}

export function AgentProgress({ agents }: AgentProgressProps) {
  if (agents.length === 0) {
    return null;
  }

  return (
    <section className="bg-bg-secondary border border-border/60 rounded-lg p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[12px] font-mono font-medium text-slate-400 uppercase tracking-[0.15em]">
            Agent Progress
          </h2>
          <p className="mt-2 text-sm text-slate-300">
            Active and recently finished agent runs.
          </p>
        </div>
        <div className="rounded-md border border-border/60 bg-bg-primary px-2.5 py-1 text-[11px] font-mono text-slate-300">
          {agents.length} active
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {agents.map((agent) => (
          <div key={`${agent.agent}-${agent.tp}`} className="rounded-lg border border-border/60 bg-bg-primary/60 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-slate-200">
                {formatAgentName(agent.agent)} - {agent.tp}
              </p>
              <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-mono uppercase ${STATUS_STYLES[agent.status]}`}>
                {agent.status}
              </span>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3 text-[11px] font-mono text-slate-400">
              <span className="truncate">{agent.currentFile ?? "Monitoring output..."}</span>
              <span>{agent.percent}%</span>
            </div>

            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
              <div
                className={`h-full rounded-full transition-all duration-300 ${BAR_STYLES[agent.status]}`}
                style={{ width: `${agent.percent}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
