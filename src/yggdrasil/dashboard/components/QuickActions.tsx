"use client";

import { useState } from "react";
import { authFetch } from "../lib/auth";

interface ActionResult {
  error?: string;
  [key: string]: unknown;
}

type ActionName = "status" | "validate";

const ACTIONS: {
  id: ActionName;
  label: string;
  description: string;
  args: string;
}[] = [
  {
    id: "status",
    label: "Check Status",
    description: "INDEX.md 기반 현재 프로젝트 상태를 조회합니다.",
    args: "",
  },
  {
    id: "validate",
    label: "Validate All TPs",
    description: "handoff 디렉토리의 모든 TP 포맷을 검사합니다.",
    args: "",
  },
];

export default function QuickActions() {
  const [running, setRunning] = useState<ActionName | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [error, setError] = useState<string>("");

  async function runAction(action: ActionName, args: string) {
    setRunning(action);
    setError("");

    try {
      const response = await authFetch("/api/skill/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skill: action, args }),
      });

      const data = await response.json() as ActionResult;
      if (!response.ok) {
        throw new Error(data.error || "Action failed");
      }

      setResult(data);
    } catch (err: unknown) {
      setResult(null);
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setRunning(null);
    }
  }

  return (
    <section>
      <h2 className="text-[13px] font-mono font-medium text-slate-400 uppercase tracking-[0.15em] mb-4">
        Quick Actions
      </h2>

      <div className="rounded-xl border border-border/60 bg-bg-secondary p-4 sm:p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {ACTIONS.map((action) => {
            const isRunning = running === action.id;

            return (
              <button
                key={action.id}
                onClick={() => runAction(action.id, action.args)}
                disabled={isRunning}
                className="rounded-lg border border-border bg-bg-primary/70 px-4 py-4 text-left transition-colors hover:border-slate-700 hover:bg-bg-secondary/70 disabled:opacity-60 disabled:cursor-wait"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[14px] font-mono text-slate-100">{action.label}</span>
                  <span className="text-[11px] font-mono text-emerald-300">
                    {isRunning ? "Running..." : "POST"}
                  </span>
                </div>
                <p className="mt-2 text-[12px] text-slate-400 leading-relaxed">
                  {action.description}
                </p>
              </button>
            );
          })}
        </div>

        {error && (
          <div className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] font-mono text-red-300 flex items-start justify-between gap-2">
            <span>{error}</span>
            <button
              onClick={() => setError("")}
              className="shrink-0 text-red-400 hover:text-red-200 transition-colors text-[14px] leading-none"
              title="Dismiss"
            >
              &times;
            </button>
          </div>
        )}

        {result && (
          <div className="rounded-lg border border-border bg-bg-primary/80 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
                Result
              </span>
              <button
                onClick={() => setResult(null)}
                className="text-slate-500 hover:text-slate-300 transition-colors text-[14px] leading-none px-1"
                title="Close result"
              >
                &times;
              </button>
            </div>
            <pre className="overflow-x-auto whitespace-pre-wrap break-words text-[11px] leading-5 text-cyan-200 font-mono">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </section>
  );
}
