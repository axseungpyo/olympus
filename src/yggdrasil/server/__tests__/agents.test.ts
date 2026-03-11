import { describe, it, expect, vi, beforeEach } from "vitest";
import { getAgentStates } from "../domain/agents/agent-state";
import type { Task } from "../../shared/types";

vi.mock("fs/promises", () => ({
  default: {
    readFile: vi.fn().mockRejectedValue({ code: "ENOENT" }),
    stat: vi.fn().mockRejectedValue({ code: "ENOENT" }),
  },
}));

describe("getAgentStates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns all 4 agents", async () => {
    const states = await getAgentStates("/fake/root", []);
    expect(states).toHaveLength(4);
    expect(states.map((s) => s.name)).toEqual(["odin", "brokkr", "heimdall", "loki"]);
  });

  it("all agents idle when no tasks", async () => {
    const states = await getAgentStates("/fake/root", []);
    for (const state of states) {
      expect(state.status).toBe("idle");
      expect(state.currentTP).toBeNull();
    }
  });

  it("sets correct display names and colors", async () => {
    const states = await getAgentStates("/fake/root", []);
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
    const states = await getAgentStates("/fake/root", tasks);
    const brokkr = states.find((s) => s.name === "brokkr")!;
    expect(brokkr.status).toBe("blocked");
    expect(brokkr.currentTP).toBe("TP-001");
  });

  it("reflects done/review-needed task status", async () => {
    const tasks: Task[] = [
      { id: "TP-002", title: "Test", agent: "heimdall", status: "review-needed", created: "2026-01-01", updated: "2026-01-01" },
    ];
    const states = await getAgentStates("/fake/root", tasks);
    const heimdall = states.find((s) => s.name === "heimdall")!;
    expect(heimdall.status).toBe("done");
    expect(heimdall.currentTP).toBe("TP-002");
  });

  it("case-insensitive agent matching", async () => {
    const tasks: Task[] = [
      { id: "TP-001", title: "Test", agent: "Codex", status: "blocked", created: "2026-01-01", updated: "2026-01-01" },
    ];
    // "Codex" !== "brokkr" — no match, all idle
    const states = await getAgentStates("/fake/root", tasks);
    for (const state of states) {
      expect(state.status).toBe("idle");
    }
  });
});
