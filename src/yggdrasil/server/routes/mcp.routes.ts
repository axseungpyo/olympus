import { Router } from "express";
import { McpController } from "../adapters/controllers/McpController";

export function createMcpRouter(controller: McpController): Router {
  const router = Router();
  router.get("/api/mcp/servers", (req, res) => controller.listServers(req, res));
  router.post("/api/mcp/servers", (req, res) => controller.addServer(req, res));
  router.put("/api/mcp/servers/:name", (req, res) => controller.updateServer(req, res));
  router.delete("/api/mcp/servers/:name", (req, res) => controller.deleteServer(req, res));
  router.post("/api/mcp/sync", (req, res) => controller.sync(req, res));
  return router;
}
