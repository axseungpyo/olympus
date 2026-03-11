import fs from "fs/promises";
import http from "http";
import path from "path";
import { WebSocket } from "ws";
import { getAgentStates } from "../domain/agents/agent-state";
import { parseIndex } from "../domain/tasks/task-parser";
import type { Container } from "../di/container";
import { createLogger } from "../infra/logger";
import type { AsgardWatcher } from "../infra/watcher";
import type { AuthorizeWebSocket, Broadcast } from "./ws-manager";

const log = createLogger({ component: "YggdrasilServer" });

export async function handleStatusConnection(
  ws: WebSocket,
  request: http.IncomingMessage,
  watcher: AsgardWatcher,
  container: Container,
  authorizeWs: AuthorizeWebSocket,
  _broadcast: Broadcast
) {
  if (!authorizeWs(ws, request, "status")) {
    return;
  }

  ws.send(JSON.stringify({ type: "connected", data: { message: "Status stream connected" } }));
  try {
    const indexPath = path.join(container.asgardRoot, "artifacts", "INDEX.md");
    let content = "";
    try {
      content = await fs.readFile(indexPath, "utf-8");
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        log.error({ err }, "Failed to read INDEX.md");
      }
    }
    const tasks = parseIndex(content);
    const agents = await getAgentStates(container.agentRepository, tasks);
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "status", data: agents }));
      ws.send(JSON.stringify({ type: "chronicle", data: tasks }));
    }
  } catch (err) {
    log.error({ err }, "Failed to send initial status");
  }
}
