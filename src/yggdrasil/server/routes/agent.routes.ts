import { Router } from "express";
import { AgentController } from "../adapters/controllers/AgentController";

export function createAgentRouter(controller: AgentController): Router {
  const router = Router();
  router.get("/api/agent/:name/health", (req, res) => controller.getHealth(req, res));
  router.post("/api/agent/:name/start", (req, res) => controller.start(req, res));
  router.post("/api/agent/:name/stop", (req, res) => controller.stop(req, res));
  router.get("/api/agent/modes", (req, res) => controller.getModes(req, res));
  return router;
}
