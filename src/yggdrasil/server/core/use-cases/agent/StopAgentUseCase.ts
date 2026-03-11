import type { AgentName } from "../../entities/Agent";
import type { IAgentRepository } from "../../ports/IAgentRepository";
import type { IAgentProcessRegistry } from "../../ports/IAgentProcessRegistry";
import type { IProcessGateway } from "../../ports/IProcessGateway";

export interface StopAgentInput {
  agentName: AgentName;
}

export interface StopAgentResult {
  success: boolean;
  message: string;
}

export class StopAgentUseCase {
  constructor(
    private readonly agentRepository: IAgentRepository,
    private readonly processGateway: IProcessGateway,
    private readonly processRegistry: IAgentProcessRegistry,
  ) {}

  async execute(input: StopAgentInput): Promise<StopAgentResult> {
    if (input.agentName === "odin") {
      return { success: false, message: "Cannot stop Odin." };
    }

    const managed = this.processRegistry.get(input.agentName);
    if (managed) {
      try {
        managed.process.pid ? this.processGateway.kill(-managed.process.pid, "SIGTERM") : managed.process.kill("SIGTERM");
        this.processRegistry.delete(input.agentName);
        await this.agentRepository.deletePid(input.agentName);
        return { success: true, message: `${input.agentName} stopped.` };
      } catch (err) {
        void err;
      }
    }

    const pid = await this.agentRepository.readPid(input.agentName);
    if (!pid) {
      return { success: false, message: `${input.agentName} is not running.` };
    }
    if (!this.processGateway.isAlive(pid)) {
      await this.agentRepository.deletePid(input.agentName);
      return { success: false, message: `${input.agentName} is not running (stale PID cleaned up).` };
    }

    try {
      this.processGateway.kill(pid, "SIGTERM");
      await new Promise((resolve) => setTimeout(resolve, 2000));
      if (this.processGateway.isAlive(pid)) {
        this.processGateway.kill(pid, "SIGKILL");
      }
      await this.agentRepository.deletePid(input.agentName);
      this.processRegistry.delete(input.agentName);
      return { success: true, message: `${input.agentName} stopped (PID ${pid}).` };
    } catch (err) {
      return { success: false, message: `Failed to stop ${input.agentName}: ${err instanceof Error ? err.message : "Unknown error"}` };
    }
  }
}
