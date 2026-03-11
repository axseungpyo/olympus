import type { OdinMessage } from "../entities/Message";

export interface IMessageRepository {
  getMessages(limit?: number): OdinMessage[];
  addMessage(msg: Omit<OdinMessage, "id" | "timestamp">): OdinMessage;
  loadHistory(): Promise<void>;
  saveHistory(): Promise<void>;
}
