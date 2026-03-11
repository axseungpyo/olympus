import { describe, expect, it } from "vitest";
import {
  buildAgentMetrics,
  parseExecutionLog,
  parseIndexMetrics,
} from "../infra/metrics";

describe("metrics", () => {
  it("parses execution.log entries in current and legacy formats", () => {
    const content = `2026-03-09 21:26 [brokkr] START TP-007
2026-03-09 21:29 [brokkr] DONE TP-007 -> RP-007 (180s)
2026-03-09 21:30 [codex] TP-008 started
2026-03-09 21:37 [codex] TP-008 done (431s)`;

    const events = parseExecutionLog(content);

    expect(events).toEqual([
      {
        agent: "brokkr",
        tp: "TP-007",
        result: "done",
        duration: 180,
        timestamp: "2026-03-09 21:29",
      },
      {
        agent: "brokkr",
        tp: "TP-008",
        result: "done",
        duration: 431,
        timestamp: "2026-03-09 21:37",
      },
    ]);
  });

  it("returns empty executions for empty log content", () => {
    expect(parseExecutionLog("")).toEqual([]);
  });

  it("aggregates daily completed counts from INDEX.md", () => {
    const content = `# Asgard Chronicle

## Active Tasks

| ID | Title | Agent | Status | Created | Updated |
|----|-------|-------|--------|---------|---------|
| TP-011 | Metrics | codex | blocked | 2026-03-09 | 2026-03-09 |

## Completed Tasks

| ID | Title | Agent | Completed |
|----|-------|-------|-----------|
| TP-007 | Stats | codex | 2026-03-08 |
| TP-008 | Skill UI | codex | 2026-03-09 |
| TP-009 | DAG | gemini | 2026-03-09 |`;

    const metrics = parseIndexMetrics(content);

    expect(metrics.daily).toEqual([
      { date: "2026-03-08", count: 1 },
      { date: "2026-03-09", count: 2 },
    ]);
  });

  it("calculates success rate and average duration per agent", () => {
    const indexMetrics = parseIndexMetrics(`## Active Tasks
| ID | Title | Agent | Status | Created | Updated |
|----|-------|-------|--------|---------|---------|
| TP-011 | Metrics | codex | blocked | 2026-03-09 | 2026-03-09 |

## Completed Tasks
| ID | Title | Agent | Completed |
|----|-------|-------|-----------|
| TP-007 | Stats | codex | 2026-03-08 |
| TP-008 | Skill UI | codex | 2026-03-09 |`);

    const agents = buildAgentMetrics(indexMetrics, [
      {
        agent: "brokkr",
        tp: "TP-007",
        result: "done",
        duration: 180,
        timestamp: "2026-03-09 21:29",
      },
      {
        agent: "brokkr",
        tp: "TP-008",
        result: "done",
        duration: 420,
        timestamp: "2026-03-09 21:37",
      },
    ]);

    expect(agents).toEqual([
      {
        name: "brokkr",
        totalTasks: 3,
        completed: 2,
        blocked: 1,
        successRate: 67,
        avgDuration: 300,
      },
    ]);
  });
});
