import { Router, type Request, type Response } from "express";
import { createLogger } from "../infra/logger";
import {
  listMcpServers,
  addMcpServer,
  removeMcpServer,
  updateMcpServer,
  syncToClaudeSettings,
} from "../domain/mcp/mcp-manager";

export function createMcpRouter(asgardRoot: string): Router {
  const router = Router();
  const log = createLogger({ component: "McpRoutes" });

  router.get("/api/mcp/servers", async (_req: Request, res: Response) => {
    try {
      const servers = await listMcpServers(asgardRoot);
      res.json({ servers });
    } catch (err: unknown) {
      log.error({ err }, "/api/mcp/servers error");
      res.status(500).json({ error: "Failed to list MCP servers" });
    }
  });

  router.post("/api/mcp/servers", async (req: Request, res: Response) => {
    const { name, command, args, env, agentAccess } = req.body ?? {};
    if (!name || !command) {
      res.status(400).json({ error: "Required: name, command" });
      return;
    }
    try {
      const server = await addMcpServer(asgardRoot, { name, command, args, env, agentAccess });
      res.status(201).json(server);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to add MCP server";
      res.status(400).json({ error: message });
    }
  });

  router.put("/api/mcp/servers/:name", async (req: Request, res: Response) => {
    const { name } = req.params;
    const { enabled, agentAccess, env } = req.body ?? {};
    try {
      const server = await updateMcpServer(asgardRoot, name as string, { enabled, agentAccess, env });
      if (!server) {
        res.status(404).json({ error: "MCP server not found" });
        return;
      }
      res.json(server);
    } catch (err: unknown) {
      log.error({ err }, "MCP server update error");
      res.status(500).json({ error: "Failed to update MCP server" });
    }
  });

  router.delete("/api/mcp/servers/:name", async (req: Request, res: Response) => {
    const { name } = req.params;
    try {
      const removed = await removeMcpServer(asgardRoot, name as string);
      if (!removed) {
        res.status(404).json({ error: "MCP server not found" });
        return;
      }
      res.json({ success: true });
    } catch (err: unknown) {
      log.error({ err }, "MCP server delete error");
      res.status(500).json({ error: "Failed to remove MCP server" });
    }
  });

  router.post("/api/mcp/sync", async (_req: Request, res: Response) => {
    try {
      const result = await syncToClaudeSettings(asgardRoot);
      res.json(result);
    } catch (err: unknown) {
      log.error({ err }, "MCP sync error");
      res.status(500).json({ error: "Failed to sync MCP settings" });
    }
  });

  return router;
}
