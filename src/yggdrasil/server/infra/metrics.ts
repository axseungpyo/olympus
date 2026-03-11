import fs from "fs/promises";
import path from "path";
import { createLogger } from "./logger";

const log = createLogger({ component: "Metrics" });

export interface AgentMetric {
  name: string;
  totalTasks: number;
  completed: number;
  blocked: number;
  successRate: number;
  avgDuration: number;
}

export interface DailyMetric {
  date: string;
  count: number;
}

export interface RecentExecution {
  agent: string;
  tp: string;
  duration: number;
  result: string;
  timestamp: string;
}

export interface AgentMetrics {
  agents: AgentMetric[];
  daily: DailyMetric[];
  recentExecutions: RecentExecution[];
}

interface IndexAgentSummary {
  completed: number;
  blocked: number;
}

interface ParsedExecutionEvent {
  timestamp: string;
  agent: string;
  tp: string;
  result: string;
  duration: number;
}

interface StartedExecution {
  timestamp: Date;
  agent: string;
}

const EMPTY_METRICS: AgentMetrics = {
  agents: [],
  daily: [],
  recentExecutions: [],
};

function normalizeAgentName(rawAgent: string): string {
  const agent = rawAgent.trim().toLowerCase();
  if (agent === "codex") return "brokkr";
  if (agent === "gemini") return "heimdall";
  return agent;
}

function parseTimestamp(rawTimestamp: string): Date | null {
  const normalized = rawTimestamp.replace(" ", "T");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function readTableCells(line: string): string[] {
  return line
    .split("|")
    .map((cell) => cell.trim())
    .filter(Boolean);
}

export function parseIndexMetrics(content: string): {
  agents: Map<string, IndexAgentSummary>;
  daily: DailyMetric[];
} {
  const agentSummary = new Map<string, IndexAgentSummary>();
  const completedByDate = new Map<string, number>();
  const lines = content.split("\n");

  let section: "active" | "completed" | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (/^##\s+Active Tasks/i.test(trimmed)) {
      section = "active";
      continue;
    }

    if (/^##\s+Completed Tasks/i.test(trimmed)) {
      section = "completed";
      continue;
    }

    if (!trimmed.startsWith("|") || /^\|[\s:-]+\|$/.test(trimmed)) {
      continue;
    }

    const cells = readTableCells(trimmed);
    if (section === "active" && cells.length >= 6 && /^TP-\d{3}$/.test(cells[0])) {
      const agent = normalizeAgentName(cells[2]);
      const status = cells[3].toLowerCase();
      const summary = agentSummary.get(agent) ?? { completed: 0, blocked: 0 };
      if (status === "blocked") {
        summary.blocked += 1;
      }
      agentSummary.set(agent, summary);
      continue;
    }

    if (section === "completed" && cells.length >= 4 && /^TP-\d{3}$/.test(cells[0])) {
      const agent = normalizeAgentName(cells[2]);
      const date = cells[3];
      const summary = agentSummary.get(agent) ?? { completed: 0, blocked: 0 };
      summary.completed += 1;
      agentSummary.set(agent, summary);
      completedByDate.set(date, (completedByDate.get(date) ?? 0) + 1);
    }
  }

  const daily = [...completedByDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, count]) => ({ date, count }));

  return { agents: agentSummary, daily };
}

export function parseExecutionLog(content: string): ParsedExecutionEvent[] {
  const started = new Map<string, StartedExecution>();
  const events: ParsedExecutionEvent[] = [];
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const startedMatch = trimmed.match(
      /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}) \[([^\]]+)\] (?:START (TP-\d{3})|(TP-\d{3}) started)$/i
    );
    if (startedMatch) {
      const timestamp = parseTimestamp(startedMatch[1]);
      const agent = normalizeAgentName(startedMatch[2]);
      const tp = startedMatch[3] ?? startedMatch[4];
      if (timestamp && tp) {
        started.set(`${agent}:${tp}`, { timestamp, agent });
      }
      continue;
    }

    const finishedMatch = trimmed.match(
      /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}) \[([^\]]+)\] (?:(DONE|BLOCKED) (TP-\d{3})(?: -> RP-\d{3})? \((\d+)s\)|(TP-\d{3}) (done|blocked) \((\d+)s\))$/i
    );

    if (!finishedMatch) continue;

    const timestamp = finishedMatch[1];
    const agent = normalizeAgentName(finishedMatch[2]);
    const explicitResult = finishedMatch[3]?.toLowerCase();
    const explicitTp = finishedMatch[4];
    const explicitDuration = finishedMatch[5];
    const altTp = finishedMatch[6];
    const altResult = finishedMatch[7]?.toLowerCase();
    const altDuration = finishedMatch[8];
    const tp = explicitTp ?? altTp;
    const result = explicitResult ?? altResult;

    if (!tp || !result) continue;

    const durationFromLine = Number.parseInt(explicitDuration ?? altDuration ?? "", 10);
    const start = started.get(`${agent}:${tp}`);
    let duration = Number.isFinite(durationFromLine) ? durationFromLine : 0;

    if ((!Number.isFinite(durationFromLine) || duration <= 0) && start) {
      const end = parseTimestamp(timestamp);
      if (end) {
        duration = Math.max(0, Math.round((end.getTime() - start.timestamp.getTime()) / 1000));
      }
    }

    events.push({
      timestamp,
      agent,
      tp,
      result,
      duration,
    });
  }

  return events.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

export function buildAgentMetrics(
  indexMetrics: ReturnType<typeof parseIndexMetrics>,
  executionEvents: ParsedExecutionEvent[]
): AgentMetric[] {
  const durationsByAgent = new Map<string, number[]>();

  for (const event of executionEvents) {
    if (!durationsByAgent.has(event.agent)) {
      durationsByAgent.set(event.agent, []);
    }
    durationsByAgent.get(event.agent)?.push(event.duration);
  }

  const agentNames = new Set<string>([
    ...indexMetrics.agents.keys(),
    ...durationsByAgent.keys(),
  ]);

  return [...agentNames]
    .sort((a, b) => a.localeCompare(b))
    .map((name) => {
      const summary = indexMetrics.agents.get(name) ?? { completed: 0, blocked: 0 };
      const durations = durationsByAgent.get(name) ?? [];
      const totalTasks = summary.completed + summary.blocked;
      const successRate =
        totalTasks === 0 ? 0 : Math.round((summary.completed / totalTasks) * 100);
      const avgDuration =
        durations.length === 0
          ? 0
          : Math.round(durations.reduce((sum, duration) => sum + duration, 0) / durations.length);

      return {
        name,
        totalTasks,
        completed: summary.completed,
        blocked: summary.blocked,
        successRate,
        avgDuration,
      };
    });
}

export async function collectMetrics(asgardRoot: string): Promise<AgentMetrics> {
  const artifactsDir = path.resolve(asgardRoot, "artifacts");
  const indexPath = path.join(artifactsDir, "INDEX.md");
  const executionLogPath = path.join(artifactsDir, "logs", "execution.log");

  let indexContent = "";
  let executionLogContent = "";

  try {
    indexContent = await fs.readFile(indexPath, "utf-8");
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      log.error({ err, indexPath }, "Failed to read INDEX.md for metrics");
    }
  }

  try {
    executionLogContent = await fs.readFile(executionLogPath, "utf-8");
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      log.error({ err, executionLogPath }, "Failed to read execution.log for metrics");
    }
  }

  if (!indexContent && !executionLogContent) {
    return EMPTY_METRICS;
  }

  const indexMetrics = parseIndexMetrics(indexContent);
  const executionEvents = parseExecutionLog(executionLogContent);

  return {
    agents: buildAgentMetrics(indexMetrics, executionEvents),
    daily: indexMetrics.daily,
    recentExecutions: executionEvents
      .slice(-10)
      .reverse()
      .map((event) => ({
        agent: event.agent,
        tp: event.tp,
        duration: event.duration,
        result: event.result,
        timestamp: event.timestamp,
      })),
  };
}
