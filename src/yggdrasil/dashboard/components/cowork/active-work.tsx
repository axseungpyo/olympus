"use client";

import type { WorkItem } from "../../hooks/useCoworkState";

interface ActiveWorkProps {
  items: WorkItem[];
}

const STATUS_STYLES: Record<WorkItem["status"], string> = {
  running: "bg-blue-500/15 text-blue-300",
  completed: "bg-emerald-500/15 text-emerald-300",
  failed: "bg-red-500/15 text-red-300",
};

const BAR_STYLES: Record<WorkItem["status"], string> = {
  running: "bg-slate-200",
  completed: "bg-emerald-400",
  failed: "bg-red-400",
};

function formatAgent(agent: string): string {
  if (agent === "odin") return "Odin";
  if (agent === "brokkr") return "Brokkr";
  if (agent === "heimdall") return "Heimdall";
  return agent;
}

export function ActiveWork({ items }: ActiveWorkProps) {
  return (
    <section className="bg-bg-secondary border border-border/60 rounded-lg p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[12px] font-mono font-medium text-slate-400 uppercase tracking-[0.15em]">
            Active Work
          </h2>
          <p className="mt-2 text-sm text-slate-300">Current task execution across the team.</p>
        </div>
        <div className="rounded-md border border-border/60 bg-bg-primary px-2.5 py-1 text-[11px] font-mono text-slate-300">
          {items.length}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/60 bg-bg-primary/30 px-4 py-6 text-sm text-slate-400">
            No active TP execution.
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="rounded-lg border border-border/60 bg-bg-primary/60 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm text-slate-100">{item.title}</p>
                  <p className="mt-1 text-[11px] font-mono uppercase tracking-[0.12em] text-slate-400">
                    {formatAgent(item.agent)}
                  </p>
                </div>
                <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-mono uppercase ${STATUS_STYLES[item.status]}`}>
                  {item.status}
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3 text-[11px] font-mono text-slate-400">
                <span className="truncate">{item.currentFile ?? item.tp}</span>
                <span>{item.percent}%</span>
              </div>

              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${BAR_STYLES[item.status]}`}
                  style={{ width: `${Math.max(0, Math.min(100, item.percent))}%` }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
