import { Router } from "express";
import { OdinController } from "../adapters/controllers/OdinController";

export function createOdinRouter(controller: OdinController): Router {
  const router = Router();
  router.get("/api/odin/messages", (req, res) => controller.getMessages(req, res));
  router.post("/api/odin/command", (req, res) => controller.command(req, res));
  router.post("/api/odin/approve", (req, res) => controller.approve(req, res));
  return router;
}
