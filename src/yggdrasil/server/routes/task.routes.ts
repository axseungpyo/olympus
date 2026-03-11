import { Router } from "express";
import { TaskController } from "../adapters/controllers/TaskController";

export function createTaskRouter(controller: TaskController): Router {
  const router = Router();
  router.get("/api/tasks", (req, res) => controller.list(req, res));
  router.post("/api/tasks", (req, res) => controller.create(req, res));
  router.get("/api/tasks/:id", (req, res) => controller.get(req, res));
  router.put("/api/tasks/:id/status", (req, res) => controller.updateStatus(req, res));
  router.delete("/api/tasks/:id", (req, res) => controller.delete(req, res));
  return router;
}
