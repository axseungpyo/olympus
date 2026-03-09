"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { AgentState, Task, LogEntry, WSMessage, AgentName } from "../lib/types";
import { useWebSocket } from "../lib/websocket";
import { AGENT_CONFIG, AGENT_NAMES, getWsBase, MAX_LOGS } from "../lib/constants";
import Header from "../components/Header";
import AgentCard from "../components/AgentCard";
import Chronicle from "../components/Chronicle";
import LiveLog from "../components/LiveLog";
import DocViewer from "../components/DocViewer";
import TerminalPanel from "../components/TerminalPanel";
import SkillsPanel from "../components/SkillsPanel";
import FlowView from "../components/FlowView";
import StatsPanel from "../components/StatsPanel";
import QuickActions from "../components/QuickActions";

const WS_BASE = getWsBase();

const defaultAgents: AgentState[] = AGENT_NAMES.map((name) => ({
  name,
  displayName: AGENT_CONFIG[name].displayName,
  status: "idle" as const,
  currentTP: null,
  mode: null,
  startedAt: null,
  pid: null,
  color: AGENT_CONFIG[name].color,
}));

type ViewMode = "overview" | "terminals" | "flow" | "stats" | "skills";

export default function DashboardPage() {
  const [agents, setAgents] = useState<AgentState[]>(defaultAgents);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("overview");
  const [selectedDoc, setSelectedDoc] = useState<{
    type: "tp" | "rp";
    id: string;
  } | null>(null);

  const { lastMessage: logMsg, isConnected: logsConnected } = useWebSocket(
    `${WS_BASE}/ws/logs`
  );
  const { lastMessage: statusMsg, isConnected: statusConnected } =
    useWebSocket(`${WS_BASE}/ws/status`);

  const isConnected = logsConnected || statusConnected;

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((data) => { if (data.agents) setAgents(data.agents); })
      .catch((err) => console.warn("[Dashboard] Failed to fetch status:", err.message));

    fetch("/api/chronicle")
      .then((r) => r.json())
      .then((data) => { if (data.tasks) setTasks(data.tasks); })
      .catch((err) => console.warn("[Dashboard] Failed to fetch chronicle:", err.message));
  }, []);

  useEffect(() => {
    if (!logMsg) return;
    const msg = logMsg as WSMessage;
    if (msg.type === "log") {
      setLogs((prev) => {
        const next = [...prev, msg.data];
        return next.length > MAX_LOGS ? next.slice(-MAX_LOGS) : next;
      });
    }
  }, [logMsg]);

  useEffect(() => {
    if (!statusMsg) return;
    const msg = statusMsg as WSMessage;
    if (msg.type === "status") setAgents(msg.data);
    else if (msg.type === "chronicle") setTasks(msg.data);
  }, [statusMsg]);

  // Browser notifications for agent state changes
  const prevAgentsRef = useRef<AgentState[]>(defaultAgents);
  useEffect(() => {
    const prev = prevAgentsRef.current;
    for (const agent of agents) {
      const prevAgent = prev.find((a) => a.name === agent.name);
      if (!prevAgent || prevAgent.status === agent.status) continue;

      // Notify on completion or failure
      if (agent.status === "done" || agent.status === "blocked") {
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          new Notification(`${agent.displayName} — ${agent.status === "done" ? "Task Complete" : "Blocked"}`, {
            body: agent.currentTP ? `${agent.currentTP}` : undefined,
            tag: `asgard-${agent.name}`,
          });
        }
      }
    }
    prevAgentsRef.current = agents;
  }, [agents]);

  // Request notification permission once
  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const handleDocClick = useCallback(
    (type: "tp" | "rp", id: string) => setSelectedDoc({ type, id }),
    []
  );

  const getAgentStatus = (name: AgentName): boolean =>
    agents.find((a) => a.name === name)?.status === "running";

  return (
    <div className="min-h-screen flex flex-col">
      <Header isConnected={isConnected} projectName="Asgard" />

      <main className="flex-1 px-4 sm:px-6 py-6 sm:py-10 max-w-6xl mx-auto w-full">
        {/* Hero Banner */}
        <div className="my-4 sm:my-5 lg:my-7">
          <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6 lg:gap-14 items-end">
            <div>
              <h1 className="sm:hidden text-2xl font-mono font-bold text-zinc-200 tracking-[0.2em]">ASGARD</h1>
              <pre className="hidden sm:block text-zinc-300 text-[12px] lg:text-[16px] tracking-[-1px] leading-[120%] select-none whitespace-pre font-mono" aria-label="ASGARD">{`
 █████╗ ███████╗ ██████╗  █████╗ ██████╗ ██████╗
██╔══██╗██╔════╝██╔════╝ ██╔══██╗██╔══██╗██╔══██╗
███████║███████╗██║  ███╗███████║██████╔╝██║  ██║
██╔══██║╚════██║██║   ██║██╔══██║██╔══██╗██║  ██║
██║  ██║███████║╚██████╔╝██║  ██║██║  ██║██████╔╝
╚═╝  ╚═╝╚══════╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝`.trimStart()}</pre>
              <p className="mt-4 text-[15px] lg:text-[19px] font-mono font-bold text-zinc-100 uppercase tracking-[0.25em]">
                The Multi-Agent Orchestration System
              </p>
            </div>
            <p className="text-lg sm:text-xl lg:text-[22px] text-zinc-500 max-w-md leading-relaxed lg:leading-[1.5] self-end mb-0.5">
              Runes are task contracts for AI agents. Route them with a single command to orchestrate your pantheon across planning, coding, and vision workflows.
            </p>
          </div>
        </div>

        {/* View Tabs */}
        <div className="flex items-center gap-1 border-b border-zinc-800/60 mb-8">
          {(["overview", "terminals", "flow", "stats", "skills"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-2 text-[13px] font-mono border-b-2 transition-colors ${
                viewMode === mode
                  ? "border-zinc-300 text-zinc-200"
                  : "border-transparent text-zinc-600 hover:text-zinc-400"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>

        {viewMode === "skills" ? (
          <SkillsPanel />
        ) : viewMode === "flow" ? (
          <section>
            <h2 className="text-[13px] font-mono font-medium text-zinc-500 uppercase tracking-[0.15em] mb-4">
              Flow
            </h2>
            <FlowView tasks={tasks} />
          </section>
        ) : viewMode === "stats" ? (
          <section>
            <h2 className="text-[13px] font-mono font-medium text-zinc-500 uppercase tracking-[0.15em] mb-4">
              Stats
            </h2>
            <StatsPanel tasks={tasks} />
          </section>
        ) : viewMode === "overview" ? (
          <div className="space-y-10">
            <QuickActions />

            <section>
              <h2 className="text-[13px] font-mono font-medium text-zinc-500 uppercase tracking-[0.15em] mb-4">Agents</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {agents.map((agent) => (
                  <AgentCard key={agent.name} agent={agent} />
                ))}
              </div>
            </section>

            <section>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <Chronicle tasks={tasks} onDocClick={handleDocClick} />
                <LiveLog logs={logs} />
              </div>
            </section>
          </div>
        ) : (
          <div className="space-y-10">
            <section>
              <h2 className="text-[13px] font-mono font-medium text-zinc-500 uppercase tracking-[0.15em] mb-4">Agents</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {agents.map((agent) => (
                  <AgentCard key={agent.name} agent={agent} />
                ))}
              </div>
            </section>

            <section>
              <h2 className="text-[13px] font-mono font-medium text-zinc-500 uppercase tracking-[0.15em] mb-4">Terminals</h2>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                {AGENT_NAMES.map((name) => {
                  const cfg = AGENT_CONFIG[name];
                  return (
                    <TerminalPanel
                      key={name}
                      agent={name}
                      displayName={cfg.displayName}
                      model={cfg.model}
                      logs={logs}
                      isRunning={getAgentStatus(name)}
                      accentColor={cfg.color}
                    />
                  );
                })}
              </div>
            </section>
          </div>
        )}
      </main>

      <footer className="border-t border-zinc-800/40 px-6 py-4 text-center mt-10">
        <span className="text-[13px] text-zinc-700 font-mono tracking-wide">yggdrasil v0.2.5</span>
      </footer>

      {selectedDoc && (
        <DocViewer
          type={selectedDoc.type}
          id={selectedDoc.id}
          onClose={() => setSelectedDoc(null)}
        />
      )}
    </div>
  );
}
