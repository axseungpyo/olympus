import type { TaskEntity, TaskStatus } from "../../core/entities/Task";

export function parseIndex(content: string): TaskEntity[] {
  const tasks: TaskEntity[] = [];
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
