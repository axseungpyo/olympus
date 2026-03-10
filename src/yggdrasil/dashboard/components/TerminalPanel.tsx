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
    <div className={`terminal-card bg-bg-secondary border border-border/60 rounded-lg overflow-hidden flex flex-col transition-all ${isExpanded ? "col-span-3" : ""}`}>
      {/* Header — 에이전트 컬러 왼쪽 바 + 구분선 */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/60 relative">
        <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-lg" style={{ backgroundColor: accentColor }} />
        <div className="flex items-center gap-3">
          {isRunning && (
            <span className="w-1.5 h-1.5 rounded-full animate-pulse-dot" style={{ backgroundColor: accentColor }} />
          )}
          <span className="text-[12px] font-mono font-medium" style={{ color: accentColor }}>
            {displayName}
          </span>
          <span className="text-[12px] text-slate-500 font-mono">{model}</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[12px] text-slate-500 font-mono">{agentLogs.length}</span>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-slate-500 hover:text-slate-300 transition-colors"
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

      {/* Content — 터미널 코드 영역 (별도 배경) */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className={`terminal-body overflow-y-auto p-3 ${isExpanded ? "max-h-[700px]" : "max-h-[500px]"}`}
      >
        {agentLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10">
            <span className="terminal-prompt text-slate-400 font-mono text-[12px]">
              $ waiting for {agent}...
            </span>
            <span className="inline-block w-[6px] h-[13px] bg-slate-400/50 animate-pulse mt-2" />
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
                    "text-slate-400"
                  }`}
                >
                  <span className="text-slate-500 select-none mr-2">{formatTime(log.timestamp)}</span>
                  {log.message}
                </div>
              );
            })}

            {isRunning && (
              <div className="flex items-center gap-1 px-1.5 mt-1">
                <span className="text-slate-500">$</span>
                <span className="inline-block w-[6px] h-[13px] bg-slate-500 animate-pulse" />
              </div>
            )}

            <div ref={endRef} />
          </div>
        )}
      </div>
    </div>
  );
}
