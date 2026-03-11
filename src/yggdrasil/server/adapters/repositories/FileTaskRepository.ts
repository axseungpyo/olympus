import fs from "fs/promises";
import path from "path";
import type { ITaskRepository } from "../../core/ports/ITaskRepository";
import type {
  CompletedTask,
  CreateTaskInput,
  TaskDetail,
  TaskEntity,
  TaskStatus,
} from "../../core/entities/Task";
import { createLogger } from "../../infra/logger";

const log = createLogger({ component: "FileTaskRepository" });

function today(): string {
  return new Date().toISOString().split("T")[0];
}

function formatTPId(num: number): string {
  return `TP-${num.toString().padStart(3, "0")}`;
}

function parseIndex(content: string): TaskEntity[] {
  const tasks: TaskEntity[] = [];
  let inTable = false;

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (/^\|\s*id\s*\|/i.test(trimmed)) {
      inTable = true;
      continue;
    }

    if (inTable && /^\|[\s-|]+\|$/.test(trimmed)) {
      continue;
    }

    if (inTable && trimmed.startsWith("|")) {
      const cells = trimmed.split("|").map((cell) => cell.trim()).filter(Boolean);
      if (cells.length >= 6) {
        const rawStatus = cells[3].toLowerCase() as TaskStatus;
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
          status: validStatuses.includes(rawStatus) ? rawStatus : "draft",
          created: cells[4],
          updated: cells[5],
        });
      }
    } else if (inTable) {
      inTable = false;
    }
  }

  return tasks;
}

function parseCompletedTasks(indexContent: string): CompletedTask[] {
  const completed: CompletedTask[] = [];
  const completedSection = indexContent.match(/##\s+Completed Tasks([\s\S]*)(?=##|$)/i)?.[1] ?? "";

  for (const line of completedSection.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) continue;
    const cells = trimmed.split("|").map((c) => c.trim()).filter(Boolean);
    if (cells.length >= 4 && /^TP-\d{3}$/.test(cells[0])) {
      completed.push({ id: cells[0], title: cells[1], agent: cells[2], completed: cells[3] });
    }
  }

  return completed;
}

function getNextTPNumber(indexContent: string): number {
  const match = indexContent.match(/Next TP Number:\s*TP-(\d+)/i);
  if (match) return parseInt(match[1], 10);

  const tpMatches = indexContent.matchAll(/TP-(\d{3})/g);
  let max = 0;
  for (const found of tpMatches) {
    const parsed = parseInt(found[1], 10);
    if (parsed > max) {
      max = parsed;
    }
  }

  return max + 1;
}

function generateTPContent(id: string, input: CreateTaskInput): string {
  const modeMap: Record<string, string> = {
    simple: "Spark",
    moderate: "Anvil",
    complex: "Mjolnir",
    extreme: "Ragnarok",
  };

  let content = `# ${id}: ${input.title}\n\n`;
  content += `## Meta\n`;
  content += `- **ID**: ${id}\n`;
  content += `- **Created**: ${today()}\n`;
  content += `- **Agent Target**: ${input.agent}\n`;
  content += `- **Mode**: ${modeMap[input.complexity] ?? "Anvil"}\n`;
  content += `- **Priority**: P1\n`;
  content += `- **Depends-on**: ${input.dependsOn?.length ? input.dependsOn.join(", ") : "none"}\n`;
  content += `- **Status**: draft\n\n`;
  content += `## Objective\n${input.objective}\n\n`;
  content += `## Scope In\n`;
  for (const entry of input.scopeIn) content += `- ${entry}\n`;
  content += `\n## Scope Out\n`;
  for (const entry of input.scopeOut) content += `- ${entry}\n`;
  content += `\n## Acceptance Criteria\n`;
  for (const criterion of input.acceptanceCriteria) content += `- [ ] ${criterion}\n`;
  if (input.notes) {
    content += `\n## Implementation Notes\n${input.notes}\n`;
  }

  return content;
}

export class FileTaskRepository implements ITaskRepository {
  constructor(private readonly asgardRoot: string) {}

  async list(): Promise<{ active: TaskEntity[]; completed: CompletedTask[] }> {
    const indexContent = await this.readIndexContent();
    return {
      active: parseIndex(indexContent),
      completed: parseCompletedTasks(indexContent),
    };
  }

  async getById(id: string): Promise<TaskDetail | null> {
    const normalizedId = id.toUpperCase();
    const indexContent = await this.readIndexContent();
    const activeTasks = parseIndex(indexContent);
    const completedTasks = parseCompletedTasks(indexContent);

    const activeTask = activeTasks.find((task) => task.id === normalizedId);
    const completedTask = completedTasks.find((task) => task.id === normalizedId);
    const tpPath = path.join(this.handoffDir(), `${normalizedId}.md`);

    let content = "";
    try {
      content = await fs.readFile(tpPath, "utf-8");
    } catch {
      if (!activeTask && !completedTask) {
        return null;
      }
    }

    const rpPath = path.join(this.handoffDir(), `${normalizedId.replace("TP", "RP")}.md`);
    let rpContent: string | undefined;
    try {
      rpContent = await fs.readFile(rpPath, "utf-8");
    } catch {
      rpContent = undefined;
    }

    if (activeTask) {
      return { ...activeTask, content, rpContent };
    }

    if (completedTask) {
      return {
        id: completedTask.id,
        title: completedTask.title,
        agent: completedTask.agent,
        status: "done",
        created: completedTask.completed,
        updated: completedTask.completed,
        content,
        rpContent,
      };
    }

    return {
      id: normalizedId,
      title: content.match(/^#\s+TP-\d{3}:\s*(.+)$/m)?.[1] ?? "Untitled",
      agent: content.match(/Agent Target:\s*(\S+)/)?.[1] ?? "unknown",
      status: "draft",
      created: today(),
      updated: today(),
      content,
      rpContent,
    };
  }

  async create(input: CreateTaskInput): Promise<{ id: string; task: TaskEntity }> {
    const indexContent = await this.readIndexContent();
    const nextNum = getNextTPNumber(indexContent);
    const id = formatTPId(nextNum);

    await fs.mkdir(this.handoffDir(), { recursive: true });
    await fs.writeFile(path.join(this.handoffDir(), `${id}.md`), generateTPContent(id, input), "utf-8");

    const activeTasks = parseIndex(indexContent);
    const completedTasks = parseCompletedTasks(indexContent);
    const task: TaskEntity = {
      id,
      title: input.title,
      agent: input.agent,
      status: "draft",
      created: today(),
      updated: today(),
    };

    activeTasks.push(task);
    await this.writeIndex(activeTasks, completedTasks, nextNum + 1);

    log.info({ id, title: input.title }, "Task created");
    return { id, task };
  }

  async updateStatus(id: string, status: TaskStatus): Promise<TaskEntity | null> {
    const normalizedId = id.toUpperCase();
    const indexContent = await this.readIndexContent();
    const activeTasks = parseIndex(indexContent);
    const completedTasks = parseCompletedTasks(indexContent);
    const nextNum = getNextTPNumber(indexContent);

    const taskIndex = activeTasks.findIndex((task) => task.id === normalizedId);

    if (status === "done" && taskIndex >= 0) {
      const task = activeTasks[taskIndex];
      activeTasks.splice(taskIndex, 1);
      completedTasks.unshift({
        id: task.id,
        title: task.title,
        agent: task.agent,
        completed: today(),
      });
      await this.writeIndex(activeTasks, completedTasks, nextNum);
      return { ...task, status: "done", updated: today() };
    }

    if (taskIndex < 0) {
      return null;
    }

    activeTasks[taskIndex].status = status;
    activeTasks[taskIndex].updated = today();
    await this.writeIndex(activeTasks, completedTasks, nextNum);
    return activeTasks[taskIndex];
  }

  async delete(id: string): Promise<{ success: boolean; message: string }> {
    const normalizedId = id.toUpperCase();
    const indexContent = await this.readIndexContent();
    const activeTasks = parseIndex(indexContent);
    const taskIndex = activeTasks.findIndex((task) => task.id === normalizedId);

    if (taskIndex < 0) {
      return { success: false, message: `${normalizedId} not found in active tasks.` };
    }

    activeTasks.splice(taskIndex, 1);
    await this.writeIndex(activeTasks, parseCompletedTasks(indexContent), getNextTPNumber(indexContent));

    try {
      await fs.unlink(path.join(this.handoffDir(), `${normalizedId}.md`));
    } catch {
      // ignore missing files
    }

    return { success: true, message: `${normalizedId} deleted.` };
  }

  async getNextTPNumber(): Promise<number> {
    return getNextTPNumber(await this.readIndexContent());
  }

  private async readIndexContent(): Promise<string> {
    try {
      return await fs.readFile(this.indexPath(), "utf-8");
    } catch {
      return "";
    }
  }

  private async writeIndex(activeTasks: TaskEntity[], completedTasks: CompletedTask[], nextTPNum: number): Promise<void> {
    let content = `# Asgard Chronicle — Work Status Index\n\nLast updated: ${today()}\n\n`;
    content += `## Active Tasks\n\n`;
    content += `| ID | Title | Agent | Status | Created | Updated |\n`;
    content += `|----|-------|-------|--------|---------|--------|\n`;

    for (const task of activeTasks) {
      content += `| ${task.id} | ${task.title} | ${task.agent} | ${task.status} | ${task.created} | ${task.updated} |\n`;
    }

    content += `\n## Completed Tasks\n\n`;
    content += `| ID | Title | Agent | Completed |\n`;
    content += `|----|-------|-------|-----------|\n`;

    for (const task of completedTasks) {
      content += `| ${task.id} | ${task.title} | ${task.agent} | ${task.completed} |\n`;
    }

    content += `\n## Next TP Number: ${formatTPId(nextTPNum)}\n`;
    await fs.writeFile(this.indexPath(), content, "utf-8");
  }

  private indexPath(): string {
    return path.join(this.asgardRoot, "artifacts", "INDEX.md");
  }

  private handoffDir(): string {
    return path.join(this.asgardRoot, "artifacts", "handoff");
  }
}
