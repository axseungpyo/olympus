import fs from "fs/promises";
import path from "path";
import { createLogger } from "../../infra/logger";

const log = createLogger({ component: "MCPManager" });

// ── Types ──

export interface McpServerConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  enabled: boolean;
  agentAccess: Record<string, boolean>;
}

export interface McpManagerState {
  servers: McpServerConfig[];
}

// ── State File ──

function getConfigPath(asgardRoot: string): string {
  return path.join(asgardRoot, "artifacts", "config", "mcp-servers.json");
}

async function ensureConfigDir(asgardRoot: string): Promise<void> {
  const dir = path.join(asgardRoot, "artifacts", "config");
  await fs.mkdir(dir, { recursive: true });
}

async function loadConfig(asgardRoot: string): Promise<McpManagerState> {
  try {
    const content = await fs.readFile(getConfigPath(asgardRoot), "utf-8");
    return JSON.parse(content) as McpManagerState;
  } catch {
    return { servers: [] };
  }
}

async function saveConfig(asgardRoot: string, state: McpManagerState): Promise<void> {
  await ensureConfigDir(asgardRoot);
  await fs.writeFile(getConfigPath(asgardRoot), JSON.stringify(state, null, 2), "utf-8");
}

// ── CRUD Operations ──

export async function listMcpServers(asgardRoot: string): Promise<McpServerConfig[]> {
  const state = await loadConfig(asgardRoot);
  return state.servers;
}

export async function addMcpServer(
  asgardRoot: string,
  server: Omit<McpServerConfig, "enabled" | "agentAccess"> & { agentAccess?: Record<string, boolean> },
): Promise<McpServerConfig> {
  const state = await loadConfig(asgardRoot);

  // Check duplicate
  if (state.servers.find(s => s.name === server.name)) {
    throw new Error(`MCP server "${server.name}" already exists.`);
  }

  const newServer: McpServerConfig = {
    name: server.name,
    command: server.command,
    args: server.args,
    env: server.env,
    enabled: true,
    agentAccess: server.agentAccess ?? {
      odin: true,
      brokkr: true,
      heimdall: true,
      loki: true,
    },
  };

  state.servers.push(newServer);
  await saveConfig(asgardRoot, state);
  log.info({ name: server.name }, "MCP server added");
  return newServer;
}

export async function removeMcpServer(asgardRoot: string, name: string): Promise<boolean> {
  const state = await loadConfig(asgardRoot);
  const idx = state.servers.findIndex(s => s.name === name);
  if (idx < 0) return false;

  state.servers.splice(idx, 1);
  await saveConfig(asgardRoot, state);
  log.info({ name }, "MCP server removed");
  return true;
}

export async function updateMcpServer(
  asgardRoot: string,
  name: string,
  updates: Partial<Pick<McpServerConfig, "enabled" | "agentAccess" | "env">>,
): Promise<McpServerConfig | null> {
  const state = await loadConfig(asgardRoot);
  const server = state.servers.find(s => s.name === name);
  if (!server) return null;

  if (updates.enabled !== undefined) server.enabled = updates.enabled;
  if (updates.agentAccess) server.agentAccess = { ...server.agentAccess, ...updates.agentAccess };
  if (updates.env) server.env = { ...server.env, ...updates.env };

  await saveConfig(asgardRoot, state);
  log.info({ name, updates }, "MCP server updated");
  return server;
}

// ── Claude settings.json Integration ──

export async function syncToClaudeSettings(asgardRoot: string): Promise<{ synced: number }> {
  const state = await loadConfig(asgardRoot);
  const settingsPath = path.join(asgardRoot, ".claude", "settings.json");

  let settings: Record<string, unknown> = {};
  try {
    const content = await fs.readFile(settingsPath, "utf-8");
    settings = JSON.parse(content);
  } catch { /* start fresh */ }

  // Build mcpServers config from our state
  const mcpServers: Record<string, { command: string; args?: string[]; env?: Record<string, string> }> = {};
  let synced = 0;

  for (const server of state.servers) {
    if (!server.enabled) continue;
    mcpServers[server.name] = {
      command: server.command,
      ...(server.args?.length ? { args: server.args } : {}),
      ...(server.env && Object.keys(server.env).length ? { env: server.env } : {}),
    };
    synced++;
  }

  settings.mcpServers = mcpServers;
  await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), "utf-8");
  log.info({ synced }, "Synced MCP servers to Claude settings");
  return { synced };
}
