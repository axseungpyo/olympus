import { describe, it, expect } from "vitest";
import { getAgentStates } from "../domain/agents/agent-state";
import type { Task } from "../../shared/types";
import type { IAgentRepository } from "../core/ports/IAgentRepository";
import type { AgentEntity, AgentHealth, AgentName } from "../core/entities/Agent";

describe("getAgentStates", () => {
  const repo: IAgentRepository = {
    async getHealth(agent: AgentName): Promise<AgentHealth> {
      return {
        name: agent,
        running: false,
        pid: null,
        tp: null,
        mode: null,
        startedAt: null,
        uptime: null,
      };
    },
    async getStates(tasks: Task[]): Promise<AgentEntity[]> {
      return [
        makeAgent("odin", tasks),
        makeAgent("brokkr", tasks),
        makeAgent("heimdall", tasks),
        makeAgent("loki", tasks),
      ];
    },
    async readPid(): Promise<number | null> {
      return null;
    },
    async writePid(): Promise<void> {},
    async deletePid(): Promise<void> {},
  };

  it("returns all 4 agents", async () => {
    const states = await getAgentStates(repo, []);
    expect(states).toHaveLength(4);
    expect(states.map((s) => s.name)).toEqual(["odin", "brokkr", "heimdall", "loki"]);
  });

  it("all agents idle when no tasks", async () => {
    const states = await getAgentStates(repo, []);
    for (const state of states) {
      expect(state.status).toBe("idle");
      expect(state.currentTP).toBeNull();
    }
  });

  it("sets correct display names and colors", async () => {
    const states = await getAgentStates(repo, []);
    const odin = states.find((s) => s.name === "odin")!;
    expect(odin.displayName).toBe("Odin");
    expect(odin.color).toBe("#d97757");

    const brokkr = states.find((s) => s.name === "brokkr")!;
    expect(brokkr.displayName).toBe("Brokkr");
    expect(brokkr.color).toBe("#10a37f");

    const heimdall = states.find((s) => s.name === "heimdall")!;
    expect(heimdall.displayName).toBe("Heimdall");
    expect(heimdall.color).toBe("#4285f4");

    const loki = states.find((s) => s.name === "loki")!;
    expect(loki.displayName).toBe("Loki");
    expect(loki.color).toBe("#a855f7");
  });

  it("reflects blocked task status", async () => {
    const tasks: Task[] = [
      { id: "TP-001", title: "Test", agent: "brokkr", status: "blocked", created: "2026-01-01", updated: "2026-01-01" },
    ];
    const states = await getAgentStates(repo, tasks);
    const brokkr = states.find((s) => s.name === "brokkr")!;
    expect(brokkr.status).toBe("blocked");
    expect(brokkr.currentTP).toBe("TP-001");
  });

  it("reflects done/review-needed task status", async () => {
    const tasks: Task[] = [
      { id: "TP-002", title: "Test", agent: "heimdall", status: "review-needed", created: "2026-01-01", updated: "2026-01-01" },
    ];
    const states = await getAgentStates(repo, tasks);
    const heimdall = states.find((s) => s.name === "heimdall")!;
    expect(heimdall.status).toBe("done");
    expect(heimdall.currentTP).toBe("TP-002");
  });

  it("case-insensitive agent matching", async () => {
    const tasks: Task[] = [
      { id: "TP-001", title: "Test", agent: "Codex", status: "blocked", created: "2026-01-01", updated: "2026-01-01" },
    ];
    // "Codex" !== "brokkr" — no match, all idle
    const states = await getAgentStates(repo, tasks);
    for (const state of states) {
      expect(state.status).toBe("idle");
    }
  });
});

function makeAgent(name: AgentName, tasks: Task[]): AgentEntity {
  const match = tasks.find((task) => task.agent.toLowerCase() === name.toLowerCase());
  const reviewTask = tasks.find((task) => task.agent.toLowerCase() === name.toLowerCase() && (
    task.status === "review-needed" || task.status === "done"
  ));
  const blockedTask = tasks.find((task) => task.agent.toLowerCase() === name.toLowerCase() && task.status === "blocked");

  return {
    name,
    displayName: name === "odin" ? "Odin" : name === "brokkr" ? "Brokkr" : name === "heimdall" ? "Heimdall" : "Loki",
    color: name === "odin" ? "#d97757" : name === "brokkr" ? "#10a37f" : name === "heimdall" ? "#4285f4" : "#a855f7",
    status: blockedTask ? "blocked" : reviewTask ? "done" : "idle",
    currentTP: blockedTask?.id ?? reviewTask?.id ?? match?.id ?? null,
    mode: null,
    startedAt: null,
    pid: null,
  };
}
