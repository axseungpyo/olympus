"use client";

import { useState, useRef, useEffect } from "react";
import type { LogEntry, AgentName } from "../lib/types";

interface LiveLogProps {
  logs: LogEntry[];
}

type TabFilter = "all" | AgentName;

const tabs: { key: TabFilter; label: string; color: string }[] = [
  { key: "all", label: "All", color: "#a1a1aa" },
  { key: "odin", label: "Odin", color: "#d97757" },
  { key: "brokkr", label: "Brokkr", color: "#10a37f" },
  { key: "heimdall", label: "Heimdall", color: "#4285f4" },
];

const agentTagColors: Record<string, string> = {
  odin: "#d97757",
  brokkr: "#10a37f",
  heimdall: "#4285f4",
  system: "#52525b",
};

function formatTime(ts: number): string {
  return new Date(ts).toTimeString().slice(0, 8);
}

export default function LiveLog({ logs }: LiveLogProps) {
  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [autoScroll, setAutoScroll] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);

  const filtered = activeTab === "all" ? logs : logs.filter((l) => l.agent === activeTab);

  useEffect(() => {
    if (autoScroll && endRef.current) {
      endRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [filtered.length, autoScroll]);

  return (
    <div className="bg-bg-secondary border border-zinc-500/60 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800/60">
        <div className="flex items-center gap-3">
          <h2 className="text-[12px] font-mono font-medium text-zinc-400 uppercase tracking-wider">Logs</h2>
          {filtered.length > 0 && (
            <span className="text-[12px] text-zinc-600 font-mono">{filtered.length}</span>
          )}
        </div>
        <button
          onClick={() => setAutoScroll(!autoScroll)}
          className="text-[12px] text-zinc-600 hover:text-zinc-400 transition-colors font-mono"
        >
          auto {autoScroll ? "on" : "off"}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-px px-3 py-1.5 border-b border-zinc-800/40">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="px-2.5 py-1 rounded text-[12px] font-mono transition-colors"
            style={{
              color: activeTab === tab.key ? tab.color : "#52525b",
              backgroundColor: activeTab === tab.key ? `${tab.color}10` : "transparent",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Log Area */}
      <div className="bg-bg-primary max-h-[400px] overflow-y-auto p-3">
        {filtered.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-zinc-700 text-[12px] font-mono">waiting for logs...</p>
          </div>
        ) : (
          <div className="font-mono text-[12px] leading-[1.8] space-y-px">
            {filtered.map((log, i) => {
              const isError = log.level === "error";
              const isWarn = log.level === "warn";
              const tagColor = agentTagColors[log.agent] ?? "#52525b";

              return (
                <div
                  key={i}
                  className={`flex gap-2 px-1.5 py-0.5 rounded-sm ${
                    isError ? "bg-[#ff6b6b]/5" : isWarn ? "bg-[#fbbf24]/5" : ""
                  }`}
                >
                  <span className="text-zinc-700 shrink-0 select-none">{formatTime(log.timestamp)}</span>
                  <span className="shrink-0 w-[72px] text-right" style={{ color: tagColor }}>
                    {log.agent.toUpperCase()}
                  </span>
                  <span className={
                    isError ? "text-[#ff6b6b]" : isWarn ? "text-[#fbbf24]" : "text-zinc-500"
                  }>
                    {log.message}
                  </span>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>
        )}
      </div>
    </div>
  );
}
