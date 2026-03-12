"use client";

import { useEffect, useRef, useState } from "react";
import type {
  AgentProgressPayload,
  AgentState,
  ContextSharedPayload,
  OdinMessage,
  PlanProgressPayload,
  WSMessage,
} from "../lib/types";
import { AGENT_CONFIG, getWsBase } from "../lib/constants";
import { useWebSocket } from "../lib/websocket";

const WS_BASE = getWsBase();
const COWORK_AGENT_NAMES = ["odin", "brokkr", "heimdall"] as const;

function createDefaultAgents(): AgentState[] {
  return COWORK_AGENT_NAMES.map((name) => ({
    name,
    displayName: AGENT_CONFIG[name].displayName,
    status: "idle",
    currentTP: null,
    mode: null,
    startedAt: null,
    pid: null,
    color: AGENT_CONFIG[name].color,
  }));
}

export interface WorkItem extends AgentProgressPayload {
  id: string;
  title: string;
}

function createContextSharedMessage(payload: ContextSharedPayload): OdinMessage {
  return {
    id: `context-${payload.planId}-${payload.timestamp}`,
    timestamp: payload.timestamp,
    role: "odin",
    type: "progress",
    content: `Context shared ${payload.fromAgent} -> ${payload.toAgent}: ${payload.contextSummary}`,
    metadata: {
      agent: payload.toAgent,
      severity: "info",
    },
  };
}

export function useCoworkState(token: string, enabled: boolean) {
  const [agents, setAgents] = useState<AgentState[]>(createDefaultAgents);
  const [activeWork, setActiveWork] = useState<WorkItem[]>([]);
  const [odinMessages, setOdinMessages] = useState<OdinMessage[]>([]);
  const [plan, setPlan] = useState<PlanProgressPayload | null>(null);
  const cleanupTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const statusWsUrl = enabled
    ? `${WS_BASE}/ws/status?token=${encodeURIComponent(token)}`
    : null;
  const odinWsUrl = enabled
    ? `${WS_BASE}/ws/odin?token=${encodeURIComponent(token)}`
    : null;

  const { lastMessage: statusMessage } = useWebSocket(statusWsUrl);
  const { lastMessage: odinMessage } = useWebSocket(odinWsUrl);

  useEffect(() => {
    if (!enabled) {
      setAgents(createDefaultAgents());
      setActiveWork([]);
      setOdinMessages([]);
      setPlan(null);
      cleanupTimersRef.current.forEach((timer) => clearTimeout(timer));
      cleanupTimersRef.current.clear();
    }
  }, [enabled]);

  useEffect(() => {
    return () => {
      cleanupTimersRef.current.forEach((timer) => clearTimeout(timer));
      cleanupTimersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!statusMessage) {
      return;
    }

    const message = statusMessage as WSMessage;

    if (message.type === "status" || message.type === "agent_status") {
      const nextAgents = message.data.filter((agent) =>
        COWORK_AGENT_NAMES.includes(agent.name as (typeof COWORK_AGENT_NAMES)[number])
      );
      setAgents(nextAgents);
      setActiveWork((prev) => {
        const byId = new Map(prev.map((item) => [item.id, item]));
        for (const agent of nextAgents) {
          if (agent.status === "running" && agent.currentTP) {
            const key = `${agent.name}-${agent.currentTP}`;
            if (!byId.has(key)) {
              byId.set(key, {
                id: key,
                agent: agent.name,
                tp: agent.currentTP,
                title: agent.currentTP,
                percent: 5,
                status: "running",
                timestamp: Date.now(),
              });
            }
          }
        }
        return Array.from(byId.values()).sort((a, b) => b.timestamp - a.timestamp);
      });
      return;
    }

    if (message.type === "agent_progress") {
      const payload = message.data;
      const key = `${payload.agent}-${payload.tp}`;
      setActiveWork((prev) => {
        const next = new Map(prev.map((item) => [item.id, item]));
        next.set(key, {
          id: key,
          title: payload.tp,
          ...payload,
        });
        return Array.from(next.values()).sort((a, b) => b.timestamp - a.timestamp);
      });

      const existingTimer = cleanupTimersRef.current.get(key);
      if (existingTimer) {
        clearTimeout(existingTimer);
        cleanupTimersRef.current.delete(key);
      }

      if (payload.status !== "running") {
        const timer = setTimeout(() => {
          setActiveWork((current) =>
            current.filter((item) => item.id !== key || item.timestamp !== payload.timestamp)
          );
          cleanupTimersRef.current.delete(key);
        }, 5000);
        cleanupTimersRef.current.set(key, timer);
      }
      return;
    }

    if (message.type === "plan_progress") {
      setPlan(message.data);
      return;
    }

    if (message.type === "context_shared") {
      setOdinMessages((prev) => [
        ...prev,
        createContextSharedMessage(message.data),
      ].slice(-50));
    }
  }, [statusMessage]);

  useEffect(() => {
    if (!odinMessage) {
      return;
    }

    const message = odinMessage as WSMessage;
    if (message.type !== "message") {
      return;
    }

    setOdinMessages((prev) => {
      const next = [...prev, message.data];
      const deduped = next.filter(
        (item, index) => next.findIndex((candidate) => candidate.id === item.id) === index
      );
      return deduped.slice(-50);
    });
  }, [odinMessage]);

  return { agents, activeWork, odinMessages, plan };
}
