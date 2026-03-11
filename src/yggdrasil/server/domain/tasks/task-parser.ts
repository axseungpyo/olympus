import fs from "fs/promises";
import type { Task, TaskStatus } from "../../../shared/types";
import { createLogger } from "../../infra/logger";

const log = createLogger({ component: "Parser" });

export function parseIndex(content: string): Task[] {
  const tasks: Task[] = [];
  const lines = content.split("\n");

  let inTable = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Detect table header row (case-insensitive, flexible column order)
    if (/^\|\s*id\s*\|/i.test(trimmed)) {
      inTable = true;
      continue;
    }

    // Skip separator line
    if (inTable && /^\|[\s-|]+\|$/.test(trimmed)) {
      continue;
    }

    if (inTable && trimmed.startsWith("|")) {
      const cells = trimmed
        .split("|")
        .map((c) => c.trim())
        .filter(Boolean);

      if (cells.length >= 6) {
        const validStatuses: TaskStatus[] = [
          "draft",
          "in-progress",
          "review-needed",
          "done",
          "blocked",
        ];
        const rawStatus = cells[3].toLowerCase() as TaskStatus;
        tasks.push({
          id: cells[0],
          title: cells[1],
          agent: cells[2],
          status: validStatuses.includes(rawStatus) ? rawStatus : "draft",
          created: cells[4],
          updated: cells[5],
        });
      }
    } else if (inTable && !trimmed.startsWith("|")) {
      // Table ended
      inTable = false;
    }
  }

  return tasks;
}

export async function parseDocument(
  filePath: string
): Promise<{ title: string; content: string }> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const titleMatch = content.match(/^#\s+(.+)$/m);
    return {
      title: titleMatch ? titleMatch[1].trim() : "Untitled",
      content,
    };
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      log.error({ err, filePath }, "Failed to read document");
    }
    return { title: "Untitled", content: "" };
  }
}
