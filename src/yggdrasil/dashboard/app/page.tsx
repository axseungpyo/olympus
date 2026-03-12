"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type {
  AgentState,
  Task,
  LogEntry,
  WSMessage,
  AgentName,
  MetricsResponse,
  PlanProgressPayload,
} from "../lib/types";
import {
  authFetch,
  getStoredAuthToken,
  setStoredAuthToken,
  UnauthorizedError,
} from "../lib/auth";
import { useWebSocket } from "../lib/websocket";
import { AGENT_CONFIG, AGENT_NAMES, getWsBase, MAX_LOGS } from "../lib/constants";
import Header from "../components/layout/Header";
import AgentCard from "../components/agents/AgentCard";
import Chronicle from "../components/tasks/Chronicle";
import LiveLog from "../components/LiveLog";
import DocViewer from "../components/settings/DocViewer";
import TerminalPanel from "../components/TerminalPanel";
import SkillsPanel from "../components/skills/SkillsPanel";
import FlowView from "../components/monitoring/FlowView";
import StatsPanel from "../components/monitoring/StatsPanel";
import QuickActions from "../components/odin/QuickActions";
import DependencyView from "../components/monitoring/DependencyView";
import ApiKeysModal from "../components/settings/ApiKeysModal";
import CommandBar from "../components/odin/CommandBar";
import TaskBoard from "../components/tasks/TaskBoard";
import ControlView from "../components/agents/ControlView";
import { AutonomySelector } from "../components/autonomy-selector";
import { PlanProgress } from "../components/plan-progress";
import type { DependencyGraphResponse } from "../lib/types";

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

type ViewMode = "overview" | "control" | "tasks" | "terminals" | "flow" | "stats" | "skills";

export default function DashboardPage() {
  const [agents, setAgents] = useState<AgentState[]>(defaultAgents);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [planProgress, setPlanProgress] = useState<PlanProgressPayload | null>(null);
  const [authToken, setAuthToken] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showApiKeys, setShowApiKeys] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("overview");
  const [dependencyGraph, setDependencyGraph] = useState<DependencyGraphResponse | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<{
    type: "tp" | "rp";
    id: string;
  } | null>(null);
  const isAuthenticated = authReady && authError === null;
  const logsWsUrl = isAuthenticated
    ? `${WS_BASE}/ws/logs?token=${encodeURIComponent(authToken)}`
    : null;
  const statusWsUrl = isAuthenticated
    ? `${WS_BASE}/ws/status?token=${encodeURIComponent(authToken)}`
    : null;

  const { lastMessage: logMsg, isConnected: logsConnected } = useWebSocket(
    logsWsUrl
  );
  const { lastMessage: statusMsg, isConnected: statusConnected } =
    useWebSocket(statusWsUrl);

  const isConnected = logsConnected || statusConnected;

  const loadDashboardData = useCallback(async (token: string) => {
    const [statusRes, chronicleRes, dependencyRes, metricsRes] = await Promise.all([
      authFetch("/api/status", {}, token),
      authFetch("/api/chronicle", {}, token),
      authFetch("/api/dependency-graph", {}, token),
      authFetch("/api/metrics", {}, token),
    ]);

    const [statusData, chronicleData, dependencyData, metricsData] = await Promise.all([
      statusRes.json(),
      chronicleRes.json(),
      dependencyRes.json(),
      metricsRes.json(),
    ]);

    if (statusData.agents) setAgents(statusData.agents);
    if (chronicleData.tasks) setTasks(chronicleData.tasks);
    if (dependencyData.nodes && dependencyData.executionOrder) setDependencyGraph(dependencyData);
    if (metricsData.agents && metricsData.daily && metricsData.recentExecutions) {
      setMetrics(metricsData);
    }
  }, []);

  const authenticate = useCallback(async (candidateToken: string) => {
    const normalizedToken = candidateToken.trim();
    setAuthError(null);

    try {
      await loadDashboardData(normalizedToken);
      setStoredAuthToken(normalizedToken);
      setAuthToken(normalizedToken);
      setTokenInput(normalizedToken);
      setAuthReady(true);
    } catch (err: unknown) {
      if (err instanceof UnauthorizedError) {
        setStoredAuthToken("");
        setAuthToken("");
        setAuthReady(false);
        setAuthError("Invalid token");
        return;
      }

      setAuthReady(true);
      setAuthError(err instanceof Error ? err.message : "Failed to load dashboard");
    }
  }, [loadDashboardData]);

  useEffect(() => {
    const storedToken = getStoredAuthToken();
    setTokenInput(storedToken);
    void authenticate(storedToken);
  }, [authenticate]);

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
    else if (msg.type === "plan_progress") setPlanProgress(msg.data);
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

  const handleConnect = useCallback(async () => {
    await authenticate(tokenInput);
  }, [authenticate, tokenInput]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header isConnected={isConnected} projectName="Asgard" onSettingsClick={() => setShowApiKeys(true)} />

      <main className="flex-1 px-4 sm:px-6 py-6 sm:py-10 max-w-6xl mx-auto w-full">
        {/* Hero Banner */}
        <div className="my-4 sm:my-5 lg:my-7">
          <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6 lg:gap-14 items-end">
            <div>
              <h1 className="sm:hidden text-2xl font-mono font-bold text-slate-200 tracking-[0.2em]">ASGARD</h1>
              <pre className="hidden sm:block text-slate-300 text-[12px] lg:text-[16px] tracking-[-1px] leading-[120%] select-none whitespace-pre font-mono" aria-label="ASGARD">{`
 █████╗ ███████╗ ██████╗  █████╗ ██████╗ ██████╗
██╔══██╗██╔════╝██╔════╝ ██╔══██╗██╔══██╗██╔══██╗
███████║███████╗██║  ███╗███████║██████╔╝██║  ██║
██╔══██║╚════██║██║   ██║██╔══██║██╔══██╗██║  ██║
██║  ██║███████║╚██████╔╝██║  ██║██║  ██║██████╔╝
╚═╝  ╚═╝╚══════╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝`.trimStart()}</pre>
              <p className="mt-4 text-[15px] lg:text-[19px] font-mono font-bold text-slate-100 uppercase tracking-[0.25em]">
                The Multi-Agent Orchestration System
              </p>
            </div>
            <p className="text-lg sm:text-xl lg:text-[22px] text-slate-400 max-w-md leading-relaxed lg:leading-[1.5] self-end mb-0.5">
              Runes are task contracts for AI agents. Route them with a single command to orchestrate your pantheon across planning, coding, and vision workflows.
            </p>
          </div>
        </div>

        {/* View Tabs */}
        <div className="flex items-center gap-1 border-b border-border/60 mb-8">
          {(["overview", "control", "tasks", "terminals", "flow", "stats", "skills"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-2 text-[13px] font-mono border-b-2 transition-colors ${
                viewMode === mode
                  ? "border-slate-300 text-slate-200"
                  : "border-transparent text-slate-500 hover:text-slate-400"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>

        {viewMode === "skills" ? (
          <SkillsPanel />
        ) : viewMode === "control" ? (
          <ControlView agents={agents} tasks={tasks} logs={logs} />
        ) : viewMode === "tasks" ? (
          <TaskBoard tasks={tasks} onDocClick={handleDocClick} />
        ) : viewMode === "flow" ? (
          <div className="space-y-6">
            <section>
              <h2 className="text-[13px] font-mono font-medium text-slate-400 uppercase tracking-[0.15em] mb-4">
                Flow
              </h2>
              <FlowView tasks={tasks} />
            </section>

            <section>
              <h2 className="text-[13px] font-mono font-medium text-slate-400 uppercase tracking-[0.15em] mb-4">
                Dependency Graph
              </h2>
              <DependencyView graph={dependencyGraph} />
            </section>
          </div>
        ) : viewMode === "stats" ? (
          <section>
            <h2 className="text-[13px] font-mono font-medium text-slate-400 uppercase tracking-[0.15em] mb-4">
              Stats
            </h2>
            <StatsPanel tasks={tasks} metrics={metrics} />
          </section>
        ) : viewMode === "overview" ? (
          <div className="space-y-10">
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
              <AutonomySelector />
              <PlanProgress message={planProgress} />
            </div>

            <QuickActions />

            <section>
              <h2 className="text-[13px] font-mono font-medium text-slate-400 uppercase tracking-[0.15em] mb-4">Agents</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                {agents.map((agent) => (
                  <AgentCard key={agent.name} agent={agent} tasks={tasks.map(t => ({ id: t.id, title: t.title }))} />
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
              <h2 className="text-[13px] font-mono font-medium text-slate-400 uppercase tracking-[0.15em] mb-4">Agents</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                {agents.map((agent) => (
                  <AgentCard key={agent.name} agent={agent} tasks={tasks.map(t => ({ id: t.id, title: t.title }))} />
                ))}
              </div>
            </section>

            <section>
              <h2 className="text-[13px] font-mono font-medium text-slate-400 uppercase tracking-[0.15em] mb-4">Terminals</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-4 gap-3">
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

      <footer className="border-t border-border/40 px-6 py-4 text-center mt-10 mb-14">
        <span className="text-[13px] text-slate-500 font-mono tracking-wide">yggdrasil v0.5.0</span>
      </footer>

      {selectedDoc && (
        <DocViewer
          type={selectedDoc.type}
          id={selectedDoc.id}
          onClose={() => setSelectedDoc(null)}
        />
      )}

      {showApiKeys && <ApiKeysModal onClose={() => setShowApiKeys(false)} />}

      {isAuthenticated && <CommandBar isConnected={isConnected} />}

      {!isAuthenticated && (
        <>
          <div className="fixed inset-0 z-40 bg-bg-primary/80 backdrop-blur-sm" />
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="w-full max-w-md rounded-2xl border border-border bg-bg-primary p-6 shadow-2xl">
              <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-slate-400">
                Yggdrasil Auth
              </div>
              <h2 className="mt-3 text-xl font-mono text-slate-100">Enter access token</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Paste the token printed by the Yggdrasil server and connect the dashboard.
              </p>
              <input
                value={tokenInput}
                onChange={(event) => setTokenInput(event.target.value)}
                placeholder="Bearer token"
                className="mt-5 w-full rounded-lg border border-border bg-bg-secondary px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-slate-500"
              />
              {authError && (
                <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  {authError}
                </div>
              )}
              <button
                onClick={() => void handleConnect()}
                className="mt-5 w-full rounded-lg border border-slate-700 bg-slate-100 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-white"
              >
                Connect
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
