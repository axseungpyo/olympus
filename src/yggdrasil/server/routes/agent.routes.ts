import { Router, type Request, type Response } from "express";
import { createLogger } from "../infra/logger";
import type { Container } from "../di/container";
import {
  startAgent,
  stopAgent,
  getAgentHealth,
} from "../domain/agents/agent-control";
import { AGENT_MODES } from "../../shared/types";
import type { AgentName } from "../../shared/types";
import { AGENT_NAMES } from "../../shared/constants";

export function createAgentRouter(container: Container): Router {
  const router = Router();
  const log = createLogger({ component: "AgentRoutes" });

  function isValidAgentName(name: string): name is AgentName {
    return (AGENT_NAMES as readonly string[]).includes(name);
  }

  router.get("/api/agent/:name/health", async (req: Request, res: Response) => {
    const { name } = req.params;
    if (!isValidAgentName(name as string)) {
      res.status(400).json({ error: "Invalid agent name" });
      return;
    }
    try {
      const health = await getAgentHealth(container.agentRepository, name as AgentName);
      res.json(health);
    } catch (err: unknown) {
      log.error({ err, agent: name }, "Agent health check failed");
      res.status(500).json({ error: "Health check failed" });
    }
  });

  router.post("/api/agent/:name/start", async (req: Request, res: Response) => {
    const { name } = req.params;
    if (!isValidAgentName(name as string)) {
      res.status(400).json({ error: "Invalid agent name" });
      return;
    }

    const { tp, mode } = (req.body ?? {}) as { tp?: string; mode?: string };
    if (!tp || typeof tp !== "string") {
      res.status(400).json({ error: "Body must include { tp: string }" });
      return;
    }

    try {
      log.info({ agent: name, tp, mode }, "Agent start request");
      const result = await startAgent(
        container.taskRepository,
        container.agentRepository,
        container.processGateway,
        name as AgentName,
        { tp, mode },
      );
      res.status(result.success ? 200 : 400).json(result);
    } catch (err: unknown) {
      log.error({ err, agent: name }, "Agent start failed");
      res.status(500).json({ error: "Failed to start agent" });
    }
  });

  router.post("/api/agent/:name/stop", async (req: Request, res: Response) => {
    const { name } = req.params;
    if (!isValidAgentName(name as string)) {
      res.status(400).json({ error: "Invalid agent name" });
      return;
    }

    try {
      log.info({ agent: name }, "Agent stop request");
      const result = await stopAgent(
        container.agentRepository,
        container.processGateway,
        name as AgentName,
      );
      res.status(result.success ? 200 : 400).json(result);
    } catch (err: unknown) {
      log.error({ err, agent: name }, "Agent stop failed");
      res.status(500).json({ error: "Failed to stop agent" });
    }
  });

  router.get("/api/agent/modes", (_req: Request, res: Response) => {
    res.json(AGENT_MODES);
  });

  return router;
}
