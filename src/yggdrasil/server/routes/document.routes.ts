import { Router } from "express";
import { DocumentController } from "../adapters/controllers/DocumentController";

export function createDocumentRouter(controller: DocumentController): Router {
  const router = Router();
  router.get("/api/chronicle", (req, res) => controller.chronicle(req, res));
  router.get("/api/docs/:id", (req, res) => controller.getDoc(req, res));
  router.post("/api/skills/:name/execute", (req, res) => controller.executeSkillByName(req, res));
  router.get("/api/dependency-graph", (req, res) => controller.dependencyGraph(req, res));
  router.get("/api/agents", (req, res) => controller.listAgents(req, res));
  router.get("/api/document/:type/:id", (req, res) => controller.getTypedDocument(req, res));
  router.get("/api/skill/:name/doc", (req, res) => controller.getSkillDoc(req, res));
  router.post("/api/skill/execute", (req, res) => controller.executeSkill(req, res));
  return router;
}
