import { AGENT_MODES, type AgentName } from "../../entities/Agent";
import type { IAgentRepository } from "../../ports/IAgentRepository";
import type { IAgentProcessRegistry } from "../../ports/IAgentProcessRegistry";
import type { IProcessGateway } from "../../ports/IProcessGateway";
import type { ITaskRepository } from "../../ports/ITaskRepository";

const DANGEROUS_MODES = new Set(["ragnarok"]);

export interface StartAgentInput {
  agentName: AgentName;
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

export class StartAgentUseCase {
  constructor(
    private readonly taskRepository: ITaskRepository,
    private readonly agentRepository: IAgentRepository,
    private readonly processGateway: IProcessGateway,
    private readonly processRegistry: IAgentProcessRegistry,
  ) {}

  async execute(input: StartAgentInput): Promise<StartAgentResult> {
    if (input.agentName === "odin") {
      return { success: false, message: "Odin is always active as the brain agent." };
    }

    const scriptPath = this.getDelegateScript(input.agentName);
    if (!scriptPath) {
      return { success: false, message: `No delegate script for ${input.agentName}.` };
    }

    if (!/^TP-\d{3}(-[a-z]+)?$/i.test(input.tp)) {
      return { success: false, message: `Invalid TP format: ${input.tp}. Expected: TP-NNN` };
    }

    const task = await this.taskRepository.getById(input.tp);
    if (!task) {
      return { success: false, message: `TP file not found: ${input.tp}` };
    }

    if (await this.isAgentLocked(input.agentName)) {
      return { success: false, message: `${input.agentName} is already running. Stop it first.` };
    }

    const modeResult = this.resolveMode(input.agentName, input.mode);
    if ("success" in modeResult) {
      return modeResult;
    }

    try {
      const child = this.processGateway.spawn(scriptPath, [task.id], { AGENT_MODE: modeResult.mode });
      child.unref();
      this.processRegistry.set({
        process: child,
        agent: input.agentName,
        tp: task.id,
        mode: modeResult.mode,
        startedAt: Date.now(),
      });
      child.onExit((code) => {
        void code;
        this.processRegistry.delete(input.agentName);
      });
      child.onError((err) => {
        void err;
        this.processRegistry.delete(input.agentName);
      });
      await new Promise((resolve) => setTimeout(resolve, 500));
      const pid = (await this.agentRepository.readPid(input.agentName)) ?? child.pid ?? undefined;
      return { success: true, message: `${input.agentName} started on ${task.id} [${modeResult.mode}]`, pid, mode: modeResult.mode };
    } catch (err) {
      return { success: false, message: `Failed to start ${input.agentName}: ${err instanceof Error ? err.message : "Unknown error"}` };
    }
  }

  private getDelegateScript(agent: AgentName): string | null {
    const scripts: Partial<Record<AgentName, string>> = {
      brokkr: "scripts/delegate-codex.sh",
      heimdall: "scripts/delegate-gemini.sh",
      loki: "scripts/delegate-loki.sh",
    };
    return scripts[agent] ?? null;
  }

  private resolveMode(agentName: AgentName, requestedMode?: string): { mode: string } | StartAgentResult {
    const agentModes = AGENT_MODES[agentName];
    const mode = requestedMode?.toLowerCase() ?? agentModes?.defaultMode ?? "default";
    if (agentModes && !agentModes.modes.includes(mode)) {
      return { success: false, message: `Invalid mode "${mode}" for ${agentName}. Available: ${agentModes.modes.join(", ")}` };
    }
    if (DANGEROUS_MODES.has(mode)) {
      return { success: false, requiresApproval: true, message: `${mode} mode requires approval. This is a high-autonomy mode.` };
    }
    return { mode };
  }

  private async isAgentLocked(agent: AgentName): Promise<boolean> {
    const pid = await this.agentRepository.readPid(agent);
    if (pid && this.processGateway.isAlive(pid)) {
      return true;
    }
    const managed = this.processRegistry.get(agent);
    return Boolean(managed?.process.pid && this.processGateway.isAlive(managed.process.pid));
  }
}
