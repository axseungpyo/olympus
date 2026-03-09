import fs from "fs/promises";
import path from "path";
import type { AgentName, AgentState, AgentStatus, Task } from "../dashboard/lib/types";

interface AgentConfig {
  displayName: string;
  color: string;
}

const AGENT_CONFIGS: Record<AgentName, AgentConfig> = {
  odin: { displayName: "Odin", color: "#d97757" },
  brokkr: { displayName: "Brokkr", color: "#10a37f" },
  heimdall: { displayName: "Heimdall", color: "#4285f4" },
};

async function readPidFile(
  filePath: string
): Promise<{ pid: number; startedAt: number } | null> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const pid = parseInt(content.trim(), 10);
    if (isNaN(pid)) return null;

    const stat = await fs.stat(filePath);
    return { pid, startedAt: stat.mtimeMs };
  } catch {
    return null;
  }
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
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
  };

  const states: AgentState[] = [];

  for (const name of Object.keys(AGENT_CONFIGS) as AgentName[]) {
    const config = AGENT_CONFIGS[name];
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

    // Check PID file for brokkr and heimdall
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

    states.push({
      name,
      displayName: config.displayName,
      status,
      currentTP,
      mode: null,
      startedAt,
      pid,
      color: config.color,
    });
  }

  return states;
}
