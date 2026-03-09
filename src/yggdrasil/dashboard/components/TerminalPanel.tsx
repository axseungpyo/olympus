"use client";

import { useRef, useEffect, useState } from "react";
import type { LogEntry, AgentName } from "../lib/types";

interface TerminalPanelProps {
  agent: AgentName;
  displayName: string;
  model: string;
  logs: LogEntry[];
  isRunning: boolean;
  accentColor: string;
}

function formatTime(ts: number): string {
  return new Date(ts).toTimeString().slice(0, 8);
}

export default function TerminalPanel({
  agent,
  displayName,
  model,
  logs,
  isRunning,
  accentColor,
}: TerminalPanelProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [userScrolled, setUserScrolled] = useState(false);

  useEffect(() => {
    if (!userScrolled && endRef.current) {
      endRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs.length, userScrolled]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    setUserScrolled(scrollHeight - scrollTop - clientHeight > 40);
  };

  const agentLogs = logs.filter((l) => l.agent === agent);

  return (
    <div className={`bg-bg-secondary border border-zinc-500/60 rounded-lg overflow-hidden flex flex-col transition-all ${isExpanded ? "col-span-3" : ""}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800/60">
        <div className="flex items-center gap-3">
          {isRunning && (
            <span className="w-1.5 h-1.5 rounded-full animate-pulse-dot" style={{ backgroundColor: accentColor }} />
          )}
          <span className="text-[12px] font-mono font-medium" style={{ color: accentColor }}>
            {displayName}
          </span>
          <span className="text-[12px] text-zinc-700 font-mono">{model}</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[12px] text-zinc-700 font-mono">{agentLogs.length}</span>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              {isExpanded ? (
                <><polyline points="4,1 1,1 1,4" /><polyline points="8,11 11,11 11,8" /></>
              ) : (
                <><polyline points="8,1 11,1 11,4" /><polyline points="4,11 1,11 1,8" /></>
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className={`overflow-y-auto p-3 bg-bg-primary ${isExpanded ? "max-h-[700px]" : "max-h-[500px]"}`}
      >
        {agentLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10">
            <span className="text-zinc-700 font-mono text-[12px]">
              $ waiting for {agent}...
            </span>
          </div>
        ) : (
          <div className="font-mono text-[12px] leading-[1.8]">
            {agentLogs.map((log, i) => {
              const isError = log.level === "error";
              const isWarn = log.level === "warn";

              return (
                <div
                  key={i}
                  className={`px-1.5 py-px rounded-sm ${
                    isError ? "bg-[#ff6b6b]/5 text-[#ff6b6b]" :
                    isWarn ? "bg-[#fbbf24]/5 text-[#fbbf24]" :
                    "text-zinc-500"
                  }`}
                >
                  <span className="text-zinc-700 select-none mr-2">{formatTime(log.timestamp)}</span>
                  {log.message}
                </div>
              );
            })}

            {isRunning && (
              <div className="flex items-center gap-1 px-1.5 mt-1">
                <span className="text-zinc-700">$</span>
                <span className="inline-block w-[6px] h-[13px] bg-zinc-600 animate-pulse" />
              </div>
            )}

            <div ref={endRef} />
          </div>
        )}
      </div>
    </div>
  );
}
