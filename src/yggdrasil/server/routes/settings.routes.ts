import { Router } from "express";
import { SettingsController } from "../adapters/controllers/SettingsController";

export function createSettingsRouter(controller: SettingsController): Router {
  const router = Router();
  router.get("/api/settings/autonomy", (req, res) => controller.getAutonomy(req, res));
  router.put("/api/settings/autonomy", (req, res) => controller.setAutonomy(req, res));
  return router;
}
