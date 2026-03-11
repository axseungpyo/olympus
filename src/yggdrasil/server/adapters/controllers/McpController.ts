import type { Request, Response } from "express";
import { addMcpServer, listMcpServers, removeMcpServer, syncToClaudeSettings, updateMcpServer } from "../../domain/mcp/mcp-manager";
import { createLogger } from "../../infra/logger";
import { sendBadRequest, sendServerError } from "./controller-utils";

export class McpController {
  private readonly log = createLogger({ component: "McpController" });

  constructor(private readonly asgardRoot: string) {}

  async listServers(_req: Request, res: Response): Promise<void> {
    try { res.json({ servers: await listMcpServers(this.asgardRoot) }); } catch (err) { this.fail(res, err, "Failed to list MCP servers"); }
  }

  async addServer(req: Request, res: Response): Promise<void> {
    const { name, command, args, env, agentAccess } = req.body ?? {};
    if (!name || !command) return sendBadRequest(res, "Required: name, command");
    try { res.status(201).json(await addMcpServer(this.asgardRoot, { name, command, args, env, agentAccess })); } catch (err) { res.status(400).json({ error: err instanceof Error ? err.message : "Failed to add MCP server" }); }
  }

  async updateServer(req: Request, res: Response): Promise<void> {
    try { const server = await updateMcpServer(this.asgardRoot, req.params.name as string, req.body ?? {}); server ? res.json(server) : res.status(404).json({ error: "MCP server not found" }); } catch (err) { this.fail(res, err, "Failed to update MCP server"); }
  }

  async deleteServer(req: Request, res: Response): Promise<void> {
    try { const removed = await removeMcpServer(this.asgardRoot, req.params.name as string); removed ? res.json({ success: true }) : res.status(404).json({ error: "MCP server not found" }); } catch (err) { this.fail(res, err, "Failed to remove MCP server"); }
  }

  async sync(_req: Request, res: Response): Promise<void> {
    try { res.json(await syncToClaudeSettings(this.asgardRoot)); } catch (err) { this.fail(res, err, "Failed to sync MCP settings"); }
  }

  private fail(res: Response, err: unknown, message: string): void {
    this.log.error({ err }, message);
    sendServerError(res, message);
  }
}
