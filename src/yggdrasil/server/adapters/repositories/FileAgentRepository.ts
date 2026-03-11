import fs from "fs/promises";
import path from "path";
import type { AgentEntity, AgentHealth, AgentName } from "../../core/entities/Agent";
import type { TaskEntity } from "../../core/entities/Task";
import type { IAgentRepository } from "../../core/ports/IAgentRepository";
import { AGENT_CONFIG, AGENT_NAMES } from "../../../shared/constants";
import { createLogger } from "../../infra/logger";

const log = createLogger({ component: "FileAgentRepository" });

export type RunningAgentInfo = { tp: string; mode: string; startedAt: number; pid: number | null };

export class FileAgentRepository implements IAgentRepository {
  constructor(
    private readonly asgardRoot: string,
    private readonly getRunningAgents: () => Map<AgentName, RunningAgentInfo> = () => new Map(),
  ) {}

  async getHealth(agent: AgentName): Promise<AgentHealth> {
    const runningInfo = this.getRunningAgents().get(agent);
    if (runningInfo) {
      return {
        name: agent,
        running: true,
        pid: runningInfo.pid,
        tp: runningInfo.tp,
        mode: runningInfo.mode,
        startedAt: runningInfo.startedAt,
        uptime: Date.now() - runningInfo.startedAt,
      };
    }

    const pid = await this.readPid(agent);
    if (pid && this.isProcessAlive(pid)) {
      return {
        name: agent,
        running: true,
        pid,
        tp: null,
        mode: null,
        startedAt: null,
        uptime: null,
      };
    }

    return {
      name: agent,
      running: false,
      pid: null,
      tp: null,
      mode: null,
      startedAt: null,
      uptime: null,
    };
  }

  async getStates(tasks: TaskEntity[]): Promise<AgentEntity[]> {
    const runningAgents = this.getRunningAgents();
    const states: AgentEntity[] = [];

    for (const name of AGENT_NAMES) {
      const config = AGENT_CONFIG[name];
      const agentTasks = tasks.filter((task) => task.agent.toLowerCase() === name.toLowerCase());
      const inProgressTask = agentTasks.find((task) => task.status === "in-progress");
      const blockedTask = agentTasks.find((task) => task.status === "blocked");
      const reviewTask = agentTasks.find((task) => task.status === "review-needed" || task.status === "done");
      const runningInfo = runningAgents.get(name);

      let status: AgentEntity["status"] = "idle";
      let currentTP: string | null = inProgressTask?.id ?? null;
      let startedAt: number | null = null;
      let pid: number | null = null;
      let mode: string | null = runningInfo?.mode ?? null;

      if (runningInfo) {
        status = "running";
        currentTP = runningInfo.tp;
        startedAt = runningInfo.startedAt;
        pid = runningInfo.pid;
      } else if (name !== "odin") {
        const filePid = await this.readPid(name);
        if (filePid && this.isProcessAlive(filePid)) {
          status = "running";
          pid = filePid;
          startedAt = await this.readPidStartedAt(name);
        }
      }

      if (status !== "running") {
        if (blockedTask) {
          status = "blocked";
          currentTP = currentTP ?? blockedTask.id;
        } else if (reviewTask) {
          status = "done";
          currentTP = currentTP ?? reviewTask.id;
        }
      }

      states.push({
        name,
        displayName: config.displayName,
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

  async readPid(agent: AgentName): Promise<number | null> {
    try {
      const content = await fs.readFile(this.pidPath(agent), "utf-8");
      const pid = parseInt(content.trim(), 10);
      return Number.isNaN(pid) ? null : pid;
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        log.error({ err, agent }, "Failed to read PID file");
      }
      return null;
    }
  }

  async writePid(agent: AgentName, pid: number): Promise<void> {
    await fs.mkdir(path.join(this.asgardRoot, "artifacts", "logs"), { recursive: true });
    await fs.writeFile(this.pidPath(agent), String(pid), "utf-8");
  }

  async deletePid(agent: AgentName): Promise<void> {
    try {
      await fs.unlink(this.pidPath(agent));
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        throw err;
      }
    }
  }

  private async readPidStartedAt(agent: AgentName): Promise<number | null> {
    try {
      const stat = await fs.stat(this.pidPath(agent));
      return stat.mtimeMs;
    } catch {
      return null;
    }
  }

  private isProcessAlive(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch (err: unknown) {
      return (err as NodeJS.ErrnoException).code === "EPERM";
    }
  }

  private pidPath(agent: AgentName): string {
    return path.join(this.asgardRoot, "artifacts", "logs", `.${agent}.pid`);
  }
}
