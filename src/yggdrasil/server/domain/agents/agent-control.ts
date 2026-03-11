import { spawn, type ChildProcess } from "child_process";
import fs from "fs/promises";
import path from "path";
import type { AgentName } from "../../../shared/types";
import { createLogger } from "../../infra/logger";

const log = createLogger({ component: "AgentControl" });

// ── Agent Mode Definitions ──

export const AGENT_MODES: Record<string, { modes: string[]; defaultMode: string }> = {
  brokkr: {
    modes: ["spark", "anvil", "mjolnir", "ragnarok"],
    defaultMode: "anvil",
  },
  heimdall: {
    modes: ["glint", "bifrost", "gjallarhorn"],
    defaultMode: "bifrost",
  },
  loki: {
    modes: ["sketch", "canvas"],
    defaultMode: "sketch",
  },
};

// Modes that require approval before starting
const DANGEROUS_MODES = new Set(["ragnarok"]);

// ── Process Registry ──

interface ManagedProcess {
  process: ChildProcess;
  agent: AgentName;
  tp: string;
  mode: string;
  startedAt: number;
}

const runningProcesses = new Map<AgentName, ManagedProcess>();

// ── Delegate Script Mapping ──

function getDelegateScript(agent: AgentName): string | null {
  const scripts: Partial<Record<AgentName, string>> = {
    brokkr: "scripts/delegate-codex.sh",
    heimdall: "scripts/delegate-gemini.sh",
    loki: "scripts/delegate-loki.sh",
  };
  return scripts[agent] ?? null;
}

// ── PID File Helpers ──

function getPidPath(asgardRoot: string, agent: AgentName): string {
  return path.join(asgardRoot, "artifacts", "logs", `.${agent}.pid`);
}

async function readPid(asgardRoot: string, agent: AgentName): Promise<number | null> {
  try {
    const content = await fs.readFile(getPidPath(asgardRoot, agent), "utf-8");
    const pid = parseInt(content.trim(), 10);
    return isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err: unknown) {
    return (err as NodeJS.ErrnoException).code === "EPERM";
  }
}

// ── Lock Check ──

async function isAgentLocked(asgardRoot: string, agent: AgentName): Promise<boolean> {
  const pid = await readPid(asgardRoot, agent);
  if (pid && isProcessAlive(pid)) return true;

  // Check if we have a managed process
  const managed = runningProcesses.get(agent);
  if (managed && !managed.process.killed) return true;

  return false;
}

// ── Start Agent ──

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

export async function startAgent(
  asgardRoot: string,
  agent: AgentName,
  options: StartAgentOptions,
): Promise<StartAgentResult> {
  // Odin cannot be started as a process
  if (agent === "odin") {
    return { success: false, message: "Odin is always active as the brain agent." };
  }

  const scriptPath = getDelegateScript(agent);
  if (!scriptPath) {
    return { success: false, message: `No delegate script for ${agent}.` };
  }

  // Validate TP format
  if (!/^TP-\d{3}(-[a-z]+)?$/i.test(options.tp)) {
    return { success: false, message: `Invalid TP format: ${options.tp}. Expected: TP-NNN` };
  }

  // Check if TP file exists
  const tpPath = path.join(asgardRoot, "artifacts", "handoff", `${options.tp}.md`);
  try {
    await fs.access(tpPath);
  } catch {
    return { success: false, message: `TP file not found: ${options.tp}` };
  }

  // Check if agent is already running
  if (await isAgentLocked(asgardRoot, agent)) {
    return { success: false, message: `${agent} is already running. Stop it first.` };
  }

  // Resolve mode
  const agentModes = AGENT_MODES[agent];
  const mode = options.mode?.toLowerCase() ?? agentModes?.defaultMode ?? "default";

  if (agentModes && !agentModes.modes.includes(mode)) {
    return {
      success: false,
      message: `Invalid mode "${mode}" for ${agent}. Available: ${agentModes.modes.join(", ")}`,
    };
  }

  // Check if mode requires approval
  if (DANGEROUS_MODES.has(mode)) {
    return {
      success: false,
      requiresApproval: true,
      message: `${mode} mode requires approval. This is a high-autonomy mode.`,
    };
  }

  // Spawn delegate script
  const fullScriptPath = path.join(asgardRoot, scriptPath);
  log.info({ agent, tp: options.tp, mode, script: fullScriptPath }, "Starting agent");

  try {
    const child = spawn("bash", [fullScriptPath, options.tp], {
      cwd: asgardRoot,
      env: {
        ...process.env,
        AGENT_MODE: mode,
      },
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    child.unref();

    const managed: ManagedProcess = {
      process: child,
      agent,
      tp: options.tp,
      mode,
      startedAt: Date.now(),
    };

    runningProcesses.set(agent, managed);

    // Listen for exit
    child.on("exit", (code) => {
      log.info({ agent, tp: options.tp, code }, "Agent process exited");
      runningProcesses.delete(agent);
    });

    child.on("error", (err) => {
      log.error({ agent, err }, "Agent process error");
      runningProcesses.delete(agent);
    });

    // Wait briefly for PID file to be created
    await new Promise((resolve) => setTimeout(resolve, 500));

    const pid = child.pid ?? (await readPid(asgardRoot, agent));

    return {
      success: true,
      message: `${agent} started on ${options.tp} [${mode}]`,
      pid: pid ?? undefined,
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

// ── Stop Agent ──

export interface StopAgentResult {
  success: boolean;
  message: string;
}

export async function stopAgent(
  asgardRoot: string,
  agent: AgentName,
): Promise<StopAgentResult> {
  if (agent === "odin") {
    return { success: false, message: "Cannot stop Odin." };
  }

  // Try managed process first
  const managed = runningProcesses.get(agent);
  if (managed && !managed.process.killed) {
    try {
      // Kill the process group (negative PID kills the group)
      if (managed.process.pid) {
        process.kill(-managed.process.pid, "SIGTERM");
      } else {
        managed.process.kill("SIGTERM");
      }
      runningProcesses.delete(agent);

      // Clean up PID file
      try {
        await fs.unlink(getPidPath(asgardRoot, agent));
      } catch { /* ignore */ }

      log.info({ agent }, "Stopped managed agent process");
      return { success: true, message: `${agent} stopped.` };
    } catch (err) {
      log.error({ agent, err }, "Failed to stop managed process");
    }
  }

  // Fall back to PID file
  const pid = await readPid(asgardRoot, agent);
  if (!pid) {
    return { success: false, message: `${agent} is not running.` };
  }

  if (!isProcessAlive(pid)) {
    // Clean up stale PID file
    try {
      await fs.unlink(getPidPath(asgardRoot, agent));
    } catch { /* ignore */ }
    return { success: false, message: `${agent} is not running (stale PID cleaned up).` };
  }

  try {
    process.kill(pid, "SIGTERM");

    // Wait briefly, then force kill if needed
    await new Promise((resolve) => setTimeout(resolve, 2000));
    if (isProcessAlive(pid)) {
      process.kill(pid, "SIGKILL");
    }

    // Clean up PID file
    try {
      await fs.unlink(getPidPath(asgardRoot, agent));
    } catch { /* ignore */ }

    runningProcesses.delete(agent);
    log.info({ agent, pid }, "Stopped agent via PID");
    return { success: true, message: `${agent} stopped (PID ${pid}).` };
  } catch (err) {
    log.error({ agent, pid, err }, "Failed to stop agent");
    return {
      success: false,
      message: `Failed to stop ${agent}: ${err instanceof Error ? err.message : "Unknown error"}`,
    };
  }
}

// ── Agent Health ──

export interface AgentHealth {
  name: AgentName;
  running: boolean;
  pid: number | null;
  tp: string | null;
  mode: string | null;
  startedAt: number | null;
  uptime: number | null;
}

export async function getAgentHealth(
  asgardRoot: string,
  agent: AgentName,
): Promise<AgentHealth> {
  const managed = runningProcesses.get(agent);

  if (managed && !managed.process.killed) {
    return {
      name: agent,
      running: true,
      pid: managed.process.pid ?? null,
      tp: managed.tp,
      mode: managed.mode,
      startedAt: managed.startedAt,
      uptime: Date.now() - managed.startedAt,
    };
  }

  const pid = await readPid(asgardRoot, agent);
  if (pid && isProcessAlive(pid)) {
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

// ── Get All Running Info ──

export function getRunningAgents(): Map<AgentName, { tp: string; mode: string; startedAt: number }> {
  const result = new Map<AgentName, { tp: string; mode: string; startedAt: number }>();
  for (const [name, managed] of runningProcesses) {
    if (!managed.process.killed) {
      result.set(name, { tp: managed.tp, mode: managed.mode, startedAt: managed.startedAt });
    }
  }
  return result;
}
