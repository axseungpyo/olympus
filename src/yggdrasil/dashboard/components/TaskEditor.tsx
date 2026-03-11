"use client";

import { useState, useCallback } from "react";
import { authFetch } from "../lib/auth";

interface TaskEditorProps {
  onClose: () => void;
  onCreated: () => void;
}

export default function TaskEditor({ onClose, onCreated }: TaskEditorProps) {
  const [title, setTitle] = useState("");
  const [objective, setObjective] = useState("");
  const [agent, setAgent] = useState<"codex" | "gemini">("codex");
  const [complexity, setComplexity] = useState<"simple" | "moderate" | "complex" | "extreme">("moderate");
  const [scopeIn, setScopeIn] = useState("");
  const [scopeOut, setScopeOut] = useState("");
  const [acceptanceCriteria, setAcceptanceCriteria] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    if (!title.trim() || !objective.trim() || !acceptanceCriteria.trim()) {
      setError("Title, Objective, and Acceptance Criteria are required.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await authFetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          objective: objective.trim(),
          agent,
          complexity,
          scopeIn: scopeIn.split("\n").map(s => s.trim()).filter(Boolean),
          scopeOut: scopeOut.split("\n").map(s => s.trim()).filter(Boolean),
          acceptanceCriteria: acceptanceCriteria.split("\n").map(s => s.trim()).filter(Boolean),
          notes: notes.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create task");
        return;
      }

      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task");
    } finally {
      setLoading(false);
    }
  }, [title, objective, agent, complexity, scopeIn, scopeOut, acceptanceCriteria, notes, onCreated]);

  const inputClass = "w-full px-3 py-2 text-[13px] font-mono rounded-lg border border-border bg-bg-secondary text-slate-200 outline-none focus:border-slate-500 transition placeholder:text-slate-600";
  const labelClass = "text-[11px] font-mono text-slate-500 uppercase tracking-wide block mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="fixed inset-0 bg-bg-primary/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-xl border border-border bg-bg-primary p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-mono text-slate-100">New Rune</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition text-lg">✕</button>
        </div>

        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className={labelClass}>Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Dashboard 제어 API 구현"
              className={inputClass}
            />
          </div>

          {/* Objective */}
          <div>
            <label className={labelClass}>Objective</label>
            <textarea
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="한 문장으로 목표를 서술하세요."
              rows={2}
              className={inputClass + " resize-none"}
            />
          </div>

          {/* Agent + Complexity */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Agent</label>
              <div className="flex gap-1">
                {(["codex", "gemini"] as const).map((a) => (
                  <button
                    key={a}
                    onClick={() => setAgent(a)}
                    className={`flex-1 px-2 py-1.5 text-[12px] font-mono rounded border transition ${
                      agent === a
                        ? "border-slate-500 bg-slate-700/50 text-slate-200"
                        : "border-border text-slate-500 hover:text-slate-400"
                    }`}
                  >
                    {a === "codex" ? "Brokkr" : "Heimdall"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={labelClass}>Complexity</label>
              <select
                value={complexity}
                onChange={(e) => setComplexity(e.target.value as typeof complexity)}
                className={inputClass + " cursor-pointer"}
              >
                <option value="simple">Simple (Spark)</option>
                <option value="moderate">Moderate (Anvil)</option>
                <option value="complex">Complex (Mjolnir)</option>
                <option value="extreme">Extreme (Ragnarok)</option>
              </select>
            </div>
          </div>

          {/* Scope In */}
          <div>
            <label className={labelClass}>Scope In <span className="text-slate-600">(one per line)</span></label>
            <textarea
              value={scopeIn}
              onChange={(e) => setScopeIn(e.target.value)}
              placeholder="구현할 항목들을 줄 단위로 입력"
              rows={3}
              className={inputClass + " resize-none"}
            />
          </div>

          {/* Scope Out */}
          <div>
            <label className={labelClass}>Scope Out <span className="text-slate-600">(one per line)</span></label>
            <textarea
              value={scopeOut}
              onChange={(e) => setScopeOut(e.target.value)}
              placeholder="구현하지 않을 항목"
              rows={2}
              className={inputClass + " resize-none"}
            />
          </div>

          {/* Acceptance Criteria */}
          <div>
            <label className={labelClass}>Acceptance Criteria <span className="text-slate-600">(one per line, required)</span></label>
            <textarea
              value={acceptanceCriteria}
              onChange={(e) => setAcceptanceCriteria(e.target.value)}
              placeholder="npm test 전체 PASS&#10;API 응답 200 확인&#10;빌드 에러 없음"
              rows={3}
              className={inputClass + " resize-none"}
            />
          </div>

          {/* Notes */}
          <div>
            <label className={labelClass}>Notes <span className="text-slate-600">(optional)</span></label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="구현 힌트, 파일 구조 등"
              rows={2}
              className={inputClass + " resize-none"}
            />
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-300 font-mono">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 px-4 py-2 text-[13px] font-mono rounded-lg border border-slate-700 bg-slate-100 text-slate-950 hover:bg-white transition disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create Rune"}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 text-[13px] font-mono rounded-lg border border-border text-slate-400 hover:text-slate-300 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
