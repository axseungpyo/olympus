import fs from "fs/promises";
import path from "path";
import type { AgentName, AgentState, AgentStatus, Task } from "../../../shared/types";
import { AGENT_CONFIG, AGENT_NAMES } from "../../../shared/constants";
import { createLogger } from "../../infra/logger";
import { getRunningAgents } from "./agent-control";

const log = createLogger({ component: "Agents" });

async function readPidFile(
  filePath: string
): Promise<{ pid: number; startedAt: number } | null> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const pid = parseInt(content.trim(), 10);
    if (isNaN(pid)) return null;

    const stat = await fs.stat(filePath);
    return { pid, startedAt: stat.mtimeMs };
  } catch (err: unknown) {
    // ENOENT is expected (no PID file = agent not running)
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      log.error({ err, filePath }, "Failed to read PID file");
    }
    return null;
  }
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "EPERM") {
      // Process exists but we lack permission — treat as alive
      return true;
    }
    // ESRCH = no such process — expected
    return false;
  }
}

export async function getAgentStates(
  asgardRoot: string,
  tasks: Task[]
): Promise<AgentState[]> {
  const logsDir = path.join(asgardRoot, "artifacts", "logs");

  const pidFiles: Record<string, string> = {
    brokkr: path.join(logsDir, ".brokkr.pid"),
    heimdall: path.join(logsDir, ".heimdall.pid"),
    loki: path.join(logsDir, ".loki.pid"),
  };

  const states: AgentState[] = [];

  for (const name of AGENT_NAMES) {
    const config = AGENT_CONFIG[name];
    let status: AgentStatus = "idle";
    let currentTP: string | null = null;
    let startedAt: number | null = null;
    let pid: number | null = null;

    // Find tasks assigned to this agent
    const agentTasks = tasks.filter(
      (t) => t.agent.toLowerCase() === name.toLowerCase()
    );
    const inProgressTask = agentTasks.find((t) => t.status === "in-progress");
    const blockedTask = agentTasks.find((t) => t.status === "blocked");
    const reviewTask = agentTasks.find(
      (t) => t.status === "review-needed" || t.status === "done"
    );

    if (inProgressTask) {
      currentTP = inProgressTask.id;
    }

    // Check PID file for runnable agents
    if (name !== "odin" && pidFiles[name]) {
      const pidInfo = await readPidFile(pidFiles[name]);
      if (pidInfo && isProcessAlive(pidInfo.pid)) {
        status = "running";
        pid = pidInfo.pid;
        startedAt = pidInfo.startedAt;
      }
    }

    // Override with task-based status if not running
    if (status !== "running") {
      if (blockedTask) {
        status = "blocked";
        currentTP = currentTP ?? blockedTask.id;
      } else if (reviewTask) {
        status = "done";
        currentTP = currentTP ?? reviewTask.id;
      } else if (inProgressTask) {
        // Has in-progress task but no live PID
        status = "idle";
      }
    }

    // Resolve mode from control registry
    const runningInfo = getRunningAgents().get(name);
    const mode = runningInfo?.mode ?? null;

    states.push({
      name,
      displayName: config.displayName as string,
      status,
      currentTP,
      mode,
      startedAt,
      pid,
      color: config.color,
    });
  }

  return states;
}
