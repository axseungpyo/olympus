"use client";

import { useEffect, useState } from "react";
import { authFetch } from "../lib/auth";

type AutonomyLevel = 1 | 2 | 3;

const DESCRIPTIONS: Record<AutonomyLevel, string> = {
  1: "Manual - every step requires approval",
  2: "Semi-Auto - keep planned approvals, pause on failure",
  3: "Full-Auto - only delegate, stop, write_file require approval",
};

export function AutonomySelector() {
  const [level, setLevel] = useState<AutonomyLevel>(1);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await authFetch("/api/settings/autonomy");
        const data = (await response.json()) as { level: AutonomyLevel };
        setLevel(data.level);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load autonomy");
      }
    };

    void load();
  }, []);

  const handleChange = async (nextLevel: AutonomyLevel) => {
    if (nextLevel === level || isSaving) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await authFetch("/api/settings/autonomy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level: nextLevel }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(typeof data?.error === "string" ? data.error : "Failed to update autonomy");
      }

      const data = (await response.json()) as { level: AutonomyLevel };
      setLevel(data.level);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update autonomy");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="bg-bg-secondary border border-border/60 rounded-lg p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-[12px] font-mono font-medium text-slate-400 uppercase tracking-[0.15em]">
            Autonomy
          </h2>
          <p className="mt-2 text-sm text-slate-300">{DESCRIPTIONS[level]}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {([1, 2, 3] as const).map((value) => {
            const active = level === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => void handleChange(value)}
                disabled={isSaving}
                className={`rounded-md border px-3 py-2 text-xs font-mono transition-colors ${
                  active
                    ? "border-slate-200 bg-slate-100 text-slate-950"
                    : "border-border/70 bg-bg-primary text-slate-400 hover:text-slate-200"
                } ${isSaving ? "cursor-wait opacity-70" : ""}`}
              >
                {`L${value}`}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}
    </section>
  );
}
