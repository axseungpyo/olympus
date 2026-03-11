import { Router } from "express";
import { HealthController } from "../adapters/controllers/HealthController";

export function createHealthRouter(controller: HealthController): Router {
  const router = Router();
  router.get("/api/health", (req, res) => controller.health(req, res));
  router.get("/api/status", (req, res) => controller.status(req, res));
  router.get("/api/metrics", (req, res) => controller.metrics(req, res));
  return router;
}
