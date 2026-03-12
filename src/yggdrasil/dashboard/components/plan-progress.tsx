"use client";

import type { PlanProgressMessage } from "../lib/types";

interface PlanProgressProps {
  message: PlanProgressMessage["data"] | null;
}

const STATUS_STYLES: Record<PlanProgressMessage["data"]["stepStatus"], string> = {
  pending: "bg-slate-500/15 text-slate-300",
  running: "bg-blue-500/15 text-blue-300",
  completed: "bg-emerald-500/15 text-emerald-300",
  failed: "bg-red-500/15 text-red-300",
  skipped: "bg-amber-500/15 text-amber-300",
};

export function PlanProgress({ message }: PlanProgressProps) {
  if (!message) {
    return null;
  }

  const progress = message.totalSteps > 0
    ? Math.min(100, Math.round((message.currentStep / message.totalSteps) * 100))
    : 0;

  return (
    <section className="bg-bg-secondary border border-border/60 rounded-lg p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[12px] font-mono font-medium text-slate-400 uppercase tracking-[0.15em]">
            Execution Plan
          </h2>
          <p className="mt-2 text-sm text-slate-300">{message.goal}</p>
        </div>
        <div className="rounded-md border border-border/60 bg-bg-primary px-2.5 py-1 text-[11px] font-mono text-slate-300">
          {message.currentStep}/{message.totalSteps}
        </div>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-slate-200 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-200">
          Step {message.currentStep}: {message.stepDescription}
        </p>
        <span className={`inline-flex w-fit rounded-full px-2.5 py-1 text-[11px] font-mono uppercase ${STATUS_STYLES[message.stepStatus]}`}>
          {message.stepStatus}
        </span>
      </div>
    </section>
  );
}
