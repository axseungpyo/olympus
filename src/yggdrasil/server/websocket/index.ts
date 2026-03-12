import http from "http";
import { PLAN_PROGRESS_EVENT } from "../core/events/PlanProgress";
import type { IEventBus } from "../core/ports/IEventBus";
import type { Container } from "../di/container";
import type { AsgardWatcher } from "../infra/watcher";
import type { OdinChannel } from "../domain/odin/odin-channel";
import { handleLogsConnection } from "./logs-handler";
import { handleOdinConnection } from "./odin-handler";
import { handleStatusConnection } from "./status-handler";
import {
  authorizeWebSocket,
  broadcast,
  createWebSocketServers,
  setupHeartbeat,
} from "./ws-manager";

export function setupWebSockets(
  server: http.Server,
  watcher: AsgardWatcher,
  eventBus: IEventBus,
  container: Container,
  odinChannel: OdinChannel,
): void {
  const { wssLogs, wssStatus, wssOdin } = createWebSocketServers(server);

  setupHeartbeat(wssLogs);
  setupHeartbeat(wssStatus);
  setupHeartbeat(wssOdin);

  wssLogs.on("connection", (ws, request) => {
    void handleLogsConnection(ws, request, watcher, eventBus, authorizeWebSocket, broadcast);
  });

  wssStatus.on("connection", (ws, request) => {
    void handleStatusConnection(ws, request, watcher, container, eventBus, authorizeWebSocket, broadcast);
  });

  wssOdin.on("connection", (ws, request) => {
    void handleOdinConnection(
      ws,
      request,
      watcher,
      odinChannel,
      eventBus,
      authorizeWebSocket,
      broadcast,
      wssOdin
    );
  });

  eventBus.subscribe(PLAN_PROGRESS_EVENT, (event) => {
    broadcast(wssStatus, {
      type: "plan_progress",
      data: event.payload,
    });
  });
}
