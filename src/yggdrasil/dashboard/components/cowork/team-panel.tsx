"use client";

import type { AgentState, OdinMessage } from "../../lib/types";
import type { WorkItem } from "../../hooks/useCoworkState";

interface TeamPanelProps {
  agents: AgentState[];
  activeWork: WorkItem[];
  odinMessages: OdinMessage[];
}

const TEAM = [
  { name: "odin", role: "Brain" },
  { name: "brokkr", role: "Code" },
  { name: "heimdall", role: "Eye" },
] as const;

function getPresence(
  agent: AgentState | undefined,
  activeWork: WorkItem[],
  odinMessages: OdinMessage[]
): { label: string; dotClassName: string } {
  if (agent?.status === "running") {
    return { label: "Running", dotClassName: "bg-emerald-400" };
  }

  const now = Date.now();
  const recentWork = activeWork.some(
    (item) => item.agent === agent?.name && now - item.timestamp < 15000
  );
  const recentOdinThought = agent?.name === "odin" && odinMessages.some(
    (message) => message.role === "odin" && now - message.timestamp < 15000
  );

  if (recentWork || recentOdinThought) {
    return { label: "Thinking", dotClassName: "bg-amber-400" };
  }

  return { label: "Idle", dotClassName: "bg-slate-500" };
}

export function TeamPanel({ agents, activeWork, odinMessages }: TeamPanelProps) {
  return (
    <section className="bg-bg-secondary border border-border/60 rounded-lg p-4 h-full">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[12px] font-mono font-medium text-slate-400 uppercase tracking-[0.15em]">
            Team
          </h2>
          <p className="mt-2 text-sm text-slate-300">Live status for Odin and active hands.</p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {TEAM.map((member) => {
          const agent = agents.find((item) => item.name === member.name);
          const presence = getPresence(agent, activeWork, odinMessages);

          return (
            <div key={member.name} className="rounded-lg border border-border/60 bg-bg-primary/60 px-3 py-3">
              <div className="flex items-start gap-3">
                <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${presence.dotClassName}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-100">
                      {agent?.displayName ?? member.name}
                    </p>
                    <span className="text-[11px] font-mono uppercase text-slate-500">
                      {member.role}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] font-mono uppercase tracking-[0.12em] text-slate-400">
                    {presence.label}
                  </p>
                  <p className="mt-2 truncate text-xs text-slate-300">
                    {agent?.currentTP ? agent.currentTP : "No active TP"}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
