import { EventEmitter } from "events";
import fs from "fs/promises";
import path from "path";
import chokidar from "chokidar";
import { parseIndex } from "./parser";
import { getAgentStates } from "./agents";
import type { AgentName, LogEntry } from "../dashboard/lib/types";

const TAIL_INITIAL_LINES = 500;

export class AsgardWatcher extends EventEmitter {
  private asgardRoot: string;
  private fileOffsets: Map<string, number> = new Map();
  private watcher: ReturnType<typeof chokidar.watch> | null = null;

  constructor(asgardRoot: string) {
    super();
    this.asgardRoot = asgardRoot;
  }

  async start(): Promise<void> {
    const artifactsDir = path.join(this.asgardRoot, "artifacts");

    const watchPaths = [
      path.join(artifactsDir, "logs", "*.log"),
      path.join(artifactsDir, "INDEX.md"),
      path.join(artifactsDir, "handoff", "*.md"),
      path.join(artifactsDir, "logs", ".brokkr.pid"),
      path.join(artifactsDir, "logs", ".heimdall.pid"),
    ];

    // Initial load of existing log files
    await this.initialLoadLogs(path.join(artifactsDir, "logs"));

    this.watcher = chokidar.watch(watchPaths, {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
    });

    this.watcher.on("change", (filePath: string) => {
      this.handleFileChange(filePath);
    });

    this.watcher.on("add", (filePath: string) => {
      this.handleFileChange(filePath);
    });
  }

  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
  }

  private async initialLoadLogs(logsDir: string): Promise<void> {
    try {
      const files = await fs.readdir(logsDir);
      for (const file of files) {
        if (!file.endsWith(".log")) continue;
        const filePath = path.join(logsDir, file);
        await this.tailFile(filePath, TAIL_INITIAL_LINES);
      }
    } catch {
      // logs directory may not exist yet
    }
  }

  private async tailFile(
    filePath: string,
    maxLines: number
  ): Promise<string[]> {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      const stat = await fs.stat(filePath);
      this.fileOffsets.set(filePath, stat.size);

      const lines = content.split("\n").filter(Boolean);
      return lines.slice(-maxLines);
    } catch {
      return [];
    }
  }

  private async handleFileChange(filePath: string): Promise<void> {
    const basename = path.basename(filePath);

    if (filePath.endsWith(".log")) {
      await this.handleLogChange(filePath);
    } else if (basename === "INDEX.md") {
      await this.handleIndexChange(filePath);
    } else if (basename.endsWith(".pid")) {
      await this.handleAgentChange();
    }
    // handoff/*.md changes don't need special handling
  }

  private async handleLogChange(filePath: string): Promise<void> {
    try {
      const stat = await fs.stat(filePath);
      const lastOffset = this.fileOffsets.get(filePath) ?? 0;

      if (stat.size <= lastOffset) {
        // File was truncated, reset offset
        this.fileOffsets.set(filePath, 0);
        return;
      }

      const fd = await fs.open(filePath, "r");
      const buffer = Buffer.alloc(stat.size - lastOffset);
      await fd.read(buffer, 0, buffer.length, lastOffset);
      await fd.close();

      this.fileOffsets.set(filePath, stat.size);

      const newContent = buffer.toString("utf-8");
      const lines = newContent.split("\n").filter(Boolean);

      if (lines.length > 0) {
        const agent = this.agentFromFilePath(filePath);
        const logEntries: LogEntry[] = lines.map((line) => ({
          timestamp: Date.now(),
          agent,
          message: line,
          level: this.detectLevel(line),
        }));
        this.emit("log-change", { agent, lines: logEntries });
      }
    } catch {
      // File may have been deleted
    }
  }

  private async handleIndexChange(filePath: string): Promise<void> {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      const tasks = parseIndex(content);
      this.emit("index-change", { tasks });

      // Also emit agent state change
      const agents = await getAgentStates(this.asgardRoot, tasks);
      this.emit("agent-change", { agents });
    } catch {
      // File may be temporarily unavailable
    }
  }

  private async handleAgentChange(): Promise<void> {
    try {
      const indexPath = path.join(
        this.asgardRoot,
        "artifacts",
        "INDEX.md"
      );
      let content = "";
      try {
        content = await fs.readFile(indexPath, "utf-8");
      } catch {
        // INDEX.md may not exist
      }
      const tasks = parseIndex(content);
      const agents = await getAgentStates(this.asgardRoot, tasks);
      this.emit("agent-change", { agents });
    } catch {
      // graceful
    }
  }

  private agentFromFilePath(filePath: string): AgentName | "system" {
    const basename = path.basename(filePath, ".log").toLowerCase();
    if (basename === "odin" || basename === "brokkr" || basename === "heimdall") {
      return basename;
    }
    return "system";
  }

  private detectLevel(line: string): "info" | "warn" | "error" {
    const lower = line.toLowerCase();
    if (lower.includes("error") || lower.includes("fail")) return "error";
    if (lower.includes("warn")) return "warn";
    return "info";
  }

  /** Get initial log entries for new WebSocket connections */
  async getRecentLogs(maxLines: number = 100): Promise<LogEntry[]> {
    const logsDir = path.join(this.asgardRoot, "artifacts", "logs");
    const entries: LogEntry[] = [];

    try {
      const files = await fs.readdir(logsDir);
      for (const file of files) {
        if (!file.endsWith(".log")) continue;
        const filePath = path.join(logsDir, file);
        const lines = await this.tailFile(filePath, maxLines);
        const agent = this.agentFromFilePath(filePath);
        for (const line of lines) {
          entries.push({
            timestamp: Date.now(),
            agent,
            message: line,
            level: this.detectLevel(line),
          });
        }
      }
    } catch {
      // logs directory may not exist
    }

    return entries;
  }
}
