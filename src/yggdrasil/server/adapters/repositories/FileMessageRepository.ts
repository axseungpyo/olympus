import fs from "fs/promises";
import path from "path";
import type { IMessageRepository } from "../../core/ports/IMessageRepository";
import type { OdinMessage } from "../../core/entities/Message";
import { createLogger } from "../../infra/logger";

const log = createLogger({ component: "FileMessageRepository" });

export class FileMessageRepository implements IMessageRepository {
  private messageHistory: OdinMessage[] = [];

  constructor(private readonly asgardRoot: string) {}

  getMessages(limit = 50): OdinMessage[] {
    return this.messageHistory.slice(-limit);
  }

  addMessage(msg: Omit<OdinMessage, "id" | "timestamp">): OdinMessage {
    const message: OdinMessage = {
      ...msg,
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
    };

    this.messageHistory.push(message);
    if (this.messageHistory.length > 200) {
      this.messageHistory = this.messageHistory.slice(-200);
    }
    return message;
  }

  async loadHistory(): Promise<void> {
    try {
      const content = await fs.readFile(this.chatPath(), "utf-8");
      const lines = content.trim().split("\n").filter(Boolean);
      this.messageHistory = lines.map((line) => JSON.parse(line) as OdinMessage);
      log.info({ count: this.messageHistory.length }, "Loaded chat history");
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        log.error({ err }, "Failed to load chat history");
      }
    }
  }

  async saveHistory(): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.chatPath()), { recursive: true });
      const content = this.messageHistory.map((message) => JSON.stringify(message)).join("\n");
      await fs.writeFile(this.chatPath(), content ? `${content}\n` : "", "utf-8");
    } catch (err) {
      log.error({ err }, "Failed to save chat history");
    }
  }

  private chatPath(): string {
    return path.join(this.asgardRoot, "artifacts", "logs", "odin-chat.jsonl");
  }
}
