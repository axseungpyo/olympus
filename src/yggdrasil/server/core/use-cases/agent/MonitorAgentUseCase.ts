import { AGENT_PROGRESS_EVENT, type AgentProgressPayload } from "../../events/AgentProgress";
import type { IEventBus } from "../../ports/IEventBus";
import type { SpawnResult } from "../../ports/IProcessGateway";

const FILE_ACTIVITY_PATTERN = /(?:writing|modifying|creating)\s+(\S+)/i;

export class MonitorAgentUseCase {
  constructor(private readonly eventBus: IEventBus) {}

  startMonitoring(agent: string, tp: string, spawnResult: SpawnResult): void {
    let fileCount = 0;
    let lastFile: string | undefined;

    spawnResult.onStdout((line: string) => {
      const fileMatch = line.match(FILE_ACTIVITY_PATTERN);
      if (fileMatch) {
        fileCount += 1;
        lastFile = fileMatch[1];
      }

      this.publish({
        agent,
        tp,
        percent: Math.min(fileCount * 10, 95),
        currentFile: lastFile,
        status: "running",
        timestamp: Date.now(),
      });
    });

    spawnResult.onExit((code) => {
      this.publish({
        agent,
        tp,
        percent: 100,
        currentFile: lastFile,
        status: code === 0 ? "completed" : "failed",
        timestamp: Date.now(),
      });
    });
  }

  private publish(payload: AgentProgressPayload): void {
    this.eventBus.publish({
      type: AGENT_PROGRESS_EVENT,
      timestamp: payload.timestamp,
      payload,
    });
  }
}
