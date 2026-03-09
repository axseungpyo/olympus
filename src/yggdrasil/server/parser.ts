import fs from "fs/promises";
import type { Task, TaskStatus } from "../dashboard/lib/types";

export function parseIndex(content: string): Task[] {
  const tasks: Task[] = [];
  const lines = content.split("\n");

  let inTable = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Detect table header row
    if (trimmed.startsWith("| ID") || trimmed.startsWith("| id")) {
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
        const status = cells[3] as TaskStatus;
        const validStatuses: TaskStatus[] = [
          "draft",
          "in-progress",
          "review-needed",
          "done",
          "blocked",
        ];
        tasks.push({
          id: cells[0],
          title: cells[1],
          agent: cells[2],
          status: validStatuses.includes(status) ? status : "draft",
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
  } catch {
    return { title: "Untitled", content: "" };
  }
}
