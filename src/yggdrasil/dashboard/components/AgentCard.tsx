"use client";

import { useEffect, useState, useCallback } from "react";
import type { AgentState, AgentName } from "../lib/types";
import { AGENT_CONFIG, STATUS_CONFIG, AGENT_MODE_CONFIG } from "../lib/constants";
import { authFetch } from "../lib/auth";

interface AgentCardProps {
  agent: AgentState;
  tasks?: { id: string; title: string }[];
  onAction?: (message: string) => void;
}

function formatElapsed(startedAt: number): string {
  const seconds = Math.floor((Date.now() - startedAt) / 1000);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function AgentCard({ agent, tasks = [], onAction }: AgentCardProps) {
  const [elapsed, setElapsed] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [selectedMode, setSelectedMode] = useState("");
  const [selectedTP, setSelectedTP] = useState("");
  const [loading, setLoading] = useState(false);

  const config = AGENT_CONFIG[agent.name];
  const color = config?.color ?? "#a1a1aa";
  const status = STATUS_CONFIG[agent.status];
  const modeConfig = AGENT_MODE_CONFIG[agent.name];
  const isControllable = agent.name !== "odin";

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

  // Set default mode when modeConfig loads
  useEffect(() => {
    if (modeConfig && !selectedMode) {
      setSelectedMode(modeConfig.defaultMode);
    }
  }, [modeConfig, selectedMode]);

  const handleStart = useCallback(async () => {
    if (!selectedTP) return;
    setLoading(true);
    try {
      const res = await authFetch(`/api/agent/${agent.name}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tp: selectedTP, mode: selectedMode || undefined }),
      });
      const data = await res.json();
      onAction?.(data.message || `${agent.displayName} started`);
    } catch (err) {
      onAction?.(`Failed to start ${agent.displayName}: ${err instanceof Error ? err.message : "Error"}`);
    } finally {
      setLoading(false);
    }
  }, [agent.name, agent.displayName, selectedTP, selectedMode, onAction]);

  const handleStop = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`/api/agent/${agent.name}/stop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      onAction?.(data.message || `${agent.displayName} stopped`);
    } catch (err) {
      onAction?.(`Failed to stop ${agent.displayName}: ${err instanceof Error ? err.message : "Error"}`);
    } finally {
      setLoading(false);
    }
  }, [agent.name, agent.displayName, onAction]);

  return (
    <div
      className="bg-bg-secondary border border-border/60 rounded-lg p-4 hover:border-slate-700/80 transition-colors"
      style={{ backgroundImage: `linear-gradient(135deg, ${color}0d, transparent)` }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <span
            className="w-1 h-5 rounded-full"
            style={{ backgroundColor: color }}
          />
          <span className="font-medium text-[14px] text-slate-100">{agent.displayName}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-[12px] font-mono" style={{ color: status.color }}>
            {agent.status === "running" && (
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse-dot" />
            )}
            {status.label}
          </span>
          {isControllable && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-slate-500 hover:text-slate-300 transition-colors text-[11px] font-mono"
              title={expanded ? "Collapse" : "Expand controls"}
            >
              {expanded ? "▲" : "▼"}
            </button>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="text-[12px] text-slate-500 mb-3 font-mono">
        {config?.role ?? "Agent"} · {config?.model ?? "Unknown"}
      </div>

      <div className="space-y-1.5">
        {agent.currentTP ? (
          <div className="flex items-center justify-between">
            <span className="text-slate-500 text-[12px] font-mono">task</span>
            <span className="font-mono text-[12px] text-slate-400">{agent.currentTP}</span>
          </div>
        ) : (
          <div className="text-[12px] text-slate-500 font-mono">No active task</div>
        )}

        {agent.status === "running" && elapsed && (
          <div className="flex items-center justify-between">
            <span className="text-slate-500 text-[12px] font-mono">elapsed</span>
            <span className="font-mono text-[12px] text-slate-400 tabular-nums">{elapsed}</span>
          </div>
        )}

        {agent.mode && (
          <div className="flex items-center justify-between">
            <span className="text-slate-500 text-[12px] font-mono">mode</span>
            <span className="font-mono text-[12px] text-slate-400">{agent.mode}</span>
          </div>
        )}
      </div>

      {/* Controls Panel (Expanded) */}
      {expanded && isControllable && (
        <div className="mt-4 pt-3 border-t border-border/40 space-y-3">
          {agent.status === "running" ? (
            /* Running: show Stop button */
            <button
              onClick={handleStop}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-[12px] font-mono rounded-md border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition disabled:opacity-50"
            >
              {loading ? "Stopping..." : "Stop"}
            </button>
          ) : (
            /* Idle: show Start controls */
            <>
              {/* TP selector */}
              <div>
                <label className="text-[11px] font-mono text-slate-500 block mb-1">Task (TP)</label>
                <input
                  type="text"
                  value={selectedTP}
                  onChange={(e) => setSelectedTP(e.target.value.toUpperCase())}
                  placeholder="TP-016"
                  className="w-full px-2.5 py-1.5 text-[12px] font-mono rounded-md border border-border bg-bg-primary text-slate-200 outline-none focus:border-slate-500 transition placeholder:text-slate-600"
                />
              </div>

              {/* Mode selector */}
              {modeConfig && (
                <div>
                  <label className="text-[11px] font-mono text-slate-500 block mb-1">Mode</label>
                  <div className="flex flex-wrap gap-1">
                    {modeConfig.modes.map((mode) => (
                      <button
                        key={mode.id}
                        onClick={() => setSelectedMode(mode.id)}
                        className={`px-2 py-1 text-[11px] font-mono rounded border transition ${
                          selectedMode === mode.id
                            ? "border-slate-500 bg-slate-700/50 text-slate-200"
                            : "border-border text-slate-500 hover:text-slate-400 hover:border-slate-600"
                        }`}
                        title={mode.description}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Start button */}
              <button
                onClick={handleStart}
                disabled={loading || !selectedTP}
                className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-[12px] font-mono rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Starting..." : "Start"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
