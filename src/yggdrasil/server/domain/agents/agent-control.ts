import { AGENT_MODES, type AgentHealth, type AgentName } from "../../core/entities/Agent";
import type { IAgentRepository } from "../../core/ports/IAgentRepository";
import type { IProcessGateway, SpawnResult } from "../../core/ports/IProcessGateway";
import type { ITaskRepository } from "../../core/ports/ITaskRepository";
import { createLogger } from "../../infra/logger";

const log = createLogger({ component: "AgentControl" });
const DANGEROUS_MODES = new Set(["ragnarok"]);

interface ManagedProcess {
  process: SpawnResult;
  agent: AgentName;
  tp: string;
  mode: string;
  startedAt: number;
}

const runningProcesses = new Map<AgentName, ManagedProcess>();

function getDelegateScript(agent: AgentName): string | null {
  const scripts: Partial<Record<AgentName, string>> = {
    brokkr: "scripts/delegate-codex.sh",
    heimdall: "scripts/delegate-gemini.sh",
    loki: "scripts/delegate-loki.sh",
  };
  return scripts[agent] ?? null;
}

export interface StartAgentOptions {
  tp: string;
  mode?: string;
}

export interface StartAgentResult {
  success: boolean;
  message: string;
  pid?: number;
  mode?: string;
  requiresApproval?: boolean;
}

export interface StopAgentResult {
  success: boolean;
  message: string;
}

export async function startAgent(
  taskRepository: ITaskRepository,
  agentRepository: IAgentRepository,
  processGateway: IProcessGateway,
  agent: AgentName,
  options: StartAgentOptions,
): Promise<StartAgentResult> {
  if (agent === "odin") {
    return { success: false, message: "Odin is always active as the brain agent." };
  }

  const scriptPath = getDelegateScript(agent);
  if (!scriptPath) {
    return { success: false, message: `No delegate script for ${agent}.` };
  }

  if (!/^TP-\d{3}(-[a-z]+)?$/i.test(options.tp)) {
    return { success: false, message: `Invalid TP format: ${options.tp}. Expected: TP-NNN` };
  }

  const task = await taskRepository.getById(options.tp);
  if (!task) {
    return { success: false, message: `TP file not found: ${options.tp}` };
  }

  if (await isAgentLocked(agentRepository, processGateway, agent)) {
    return { success: false, message: `${agent} is already running. Stop it first.` };
  }

  const agentModes = AGENT_MODES[agent];
  const mode = options.mode?.toLowerCase() ?? agentModes?.defaultMode ?? "default";

  if (agentModes && !agentModes.modes.includes(mode)) {
    return {
      success: false,
      message: `Invalid mode "${mode}" for ${agent}. Available: ${agentModes.modes.join(", ")}`,
    };
  }

  if (DANGEROUS_MODES.has(mode)) {
    return {
      success: false,
      requiresApproval: true,
      message: `${mode} mode requires approval. This is a high-autonomy mode.`,
    };
  }

  try {
    const child = processGateway.spawn(scriptPath, [task.id], { AGENT_MODE: mode });
    child.unref();

    const managed: ManagedProcess = {
      process: child,
      agent,
      tp: task.id,
      mode,
      startedAt: Date.now(),
    };
    runningProcesses.set(agent, managed);

    child.onExit((code) => {
      log.info({ agent, tp: task.id, code }, "Agent process exited");
      runningProcesses.delete(agent);
    });
    child.onError((err) => {
      log.error({ agent, err }, "Agent process error");
      runningProcesses.delete(agent);
    });

    await new Promise((resolve) => setTimeout(resolve, 500));
    const pid = (await agentRepository.readPid(agent)) ?? child.pid ?? undefined;

    return {
      success: true,
      message: `${agent} started on ${task.id} [${mode}]`,
      pid,
      mode,
    };
  } catch (err) {
    log.error({ agent, err }, "Failed to start agent");
    return {
      success: false,
      message: `Failed to start ${agent}: ${err instanceof Error ? err.message : "Unknown error"}`,
    };
  }
}

export async function stopAgent(
  agentRepository: IAgentRepository,
  processGateway: IProcessGateway,
  agent: AgentName,
): Promise<StopAgentResult> {
  if (agent === "odin") {
    return { success: false, message: "Cannot stop Odin." };
  }

  const managed = runningProcesses.get(agent);
  if (managed) {
    try {
      if (managed.process.pid) {
        processGateway.kill(-managed.process.pid, "SIGTERM");
      } else {
        managed.process.kill("SIGTERM");
      }
      runningProcesses.delete(agent);
      await agentRepository.deletePid(agent);
      return { success: true, message: `${agent} stopped.` };
    } catch (err) {
      log.error({ agent, err }, "Failed to stop managed process");
    }
  }

  const pid = await agentRepository.readPid(agent);
  if (!pid) {
    return { success: false, message: `${agent} is not running.` };
  }

  if (!processGateway.isAlive(pid)) {
    await agentRepository.deletePid(agent);
    return { success: false, message: `${agent} is not running (stale PID cleaned up).` };
  }

  try {
    processGateway.kill(pid, "SIGTERM");
    await new Promise((resolve) => setTimeout(resolve, 2000));
    if (processGateway.isAlive(pid)) {
      processGateway.kill(pid, "SIGKILL");
    }
    await agentRepository.deletePid(agent);
    runningProcesses.delete(agent);
    return { success: true, message: `${agent} stopped (PID ${pid}).` };
  } catch (err) {
    log.error({ agent, pid, err }, "Failed to stop agent");
    return {
      success: false,
      message: `Failed to stop ${agent}: ${err instanceof Error ? err.message : "Unknown error"}`,
    };
  }
}

export async function getAgentHealth(
  agentRepository: IAgentRepository,
  agent: AgentName,
): Promise<AgentHealth> {
  return agentRepository.getHealth(agent);
}

export function getRunningAgents(): Map<AgentName, { tp: string; mode: string; startedAt: number; pid: number | null }> {
  const result = new Map<AgentName, { tp: string; mode: string; startedAt: number; pid: number | null }>();
  for (const [agent, managed] of runningProcesses) {
    result.set(agent, {
      tp: managed.tp,
      mode: managed.mode,
      startedAt: managed.startedAt,
      pid: managed.process.pid,
    });
  }
  return result;
}

async function isAgentLocked(
  agentRepository: IAgentRepository,
  processGateway: IProcessGateway,
  agent: AgentName,
): Promise<boolean> {
  const pid = await agentRepository.readPid(agent);
  if (pid && processGateway.isAlive(pid)) {
    return true;
  }

  const managed = runningProcesses.get(agent);
  if (managed?.process.pid && processGateway.isAlive(managed.process.pid)) {
    return true;
  }

  return false;
}
