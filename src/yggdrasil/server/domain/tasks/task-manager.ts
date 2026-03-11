import fs from "fs/promises";
import path from "path";
import { parseIndex } from "./task-parser";
import { createLogger } from "../../infra/logger";
import type { Task, TaskStatus } from "../../../shared/types";

const log = createLogger({ component: "TaskManager" });

// ── Types ──

export interface CreateTaskInput {
  title: string;
  objective: string;
  agent: "codex" | "gemini";
  complexity: "simple" | "moderate" | "complex" | "extreme";
  scopeIn: string[];
  scopeOut: string[];
  acceptanceCriteria: string[];
  dependsOn?: string[];
  notes?: string;
}

export interface UpdateTaskInput {
  title?: string;
  objective?: string;
  agent?: "codex" | "gemini";
  complexity?: "simple" | "moderate" | "complex" | "extreme";
  status?: TaskStatus;
}

export interface TaskDetail extends Task {
  content: string;
  rpContent?: string;
}

// ── Helpers ──

function today(): string {
  return new Date().toISOString().split("T")[0];
}

async function readIndexContent(asgardRoot: string): Promise<string> {
  const indexPath = path.join(asgardRoot, "artifacts", "INDEX.md");
  try {
    return await fs.readFile(indexPath, "utf-8");
  } catch {
    return "";
  }
}

function getNextTPNumber(indexContent: string): number {
  const match = indexContent.match(/Next TP Number:\s*TP-(\d+)/i);
  if (match) return parseInt(match[1], 10);

  // Fallback: scan existing TPs
  const tpMatches = indexContent.matchAll(/TP-(\d{3})/g);
  let max = 0;
  for (const m of tpMatches) {
    const n = parseInt(m[1], 10);
    if (n > max) max = n;
  }
  return max + 1;
}

function formatTPId(num: number): string {
  return `TP-${num.toString().padStart(3, "0")}`;
}

// ── INDEX.md Write ──

async function writeIndex(asgardRoot: string, activeTasks: Task[], completedTasks: { id: string; title: string; agent: string; completed: string }[], nextTPNum: number): Promise<void> {
  const indexPath = path.join(asgardRoot, "artifacts", "INDEX.md");

  let content = `# Asgard Chronicle — Work Status Index\n\nLast updated: ${today()}\n\n`;
  content += `## Active Tasks\n\n`;
  content += `| ID | Title | Agent | Status | Created | Updated |\n`;
  content += `|----|-------|-------|--------|---------|--------|\n`;

  for (const t of activeTasks) {
    content += `| ${t.id} | ${t.title} | ${t.agent} | ${t.status} | ${t.created} | ${t.updated} |\n`;
  }

  content += `\n## Completed Tasks\n\n`;
  content += `| ID | Title | Agent | Completed |\n`;
  content += `|----|-------|-------|-----------|\n`;

  for (const t of completedTasks) {
    content += `| ${t.id} | ${t.title} | ${t.agent} | ${t.completed} |\n`;
  }

  content += `\n## Next TP Number: ${formatTPId(nextTPNum)}\n`;

  await fs.writeFile(indexPath, content, "utf-8");
}

// ── Parse completed tasks from INDEX.md ──

function parseCompletedTasks(indexContent: string): { id: string; title: string; agent: string; completed: string }[] {
  const completed: { id: string; title: string; agent: string; completed: string }[] = [];
  const completedSection = indexContent.match(/##\s+Completed Tasks([\s\S]*)(?=##|$)/i)?.[1] ?? "";

  for (const line of completedSection.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) continue;
    const cells = trimmed.split("|").map(c => c.trim()).filter(Boolean);
    if (cells.length >= 4 && /^TP-\d{3}$/.test(cells[0])) {
      completed.push({ id: cells[0], title: cells[1], agent: cells[2], completed: cells[3] });
    }
  }

  return completed;
}

// ── TP File Template ──

function generateTPContent(id: string, input: CreateTaskInput): string {
  const modeMap: Record<string, string> = {
    simple: "Spark", moderate: "Anvil", complex: "Mjolnir", extreme: "Ragnarok",
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
  for (const s of input.scopeIn) content += `- ${s}\n`;
  content += `\n## Scope Out\n`;
  for (const s of input.scopeOut) content += `- ${s}\n`;
  content += `\n## Acceptance Criteria\n`;
  for (const ac of input.acceptanceCriteria) content += `- [ ] ${ac}\n`;
  if (input.notes) {
    content += `\n## Implementation Notes\n${input.notes}\n`;
  }

  return content;
}

// ── CRUD Operations ──

export async function listTasks(asgardRoot: string): Promise<{ active: Task[]; completed: { id: string; title: string; agent: string; completed: string }[] }> {
  const indexContent = await readIndexContent(asgardRoot);
  const active = parseIndex(indexContent);
  const completed = parseCompletedTasks(indexContent);
  return { active, completed };
}

export async function getTask(asgardRoot: string, id: string): Promise<TaskDetail | null> {
  const indexContent = await readIndexContent(asgardRoot);
  const tasks = parseIndex(indexContent);
  const completedTasks = parseCompletedTasks(indexContent);

  const task = tasks.find(t => t.id === id);
  const completedTask = completedTasks.find(t => t.id === id);

  const handoffDir = path.join(asgardRoot, "artifacts", "handoff");
  const tpPath = path.join(handoffDir, `${id}.md`);

  let content = "";
  try {
    content = await fs.readFile(tpPath, "utf-8");
  } catch {
    if (!task && !completedTask) return null;
  }

  // Try to read associated RP
  const rpId = id.replace("TP", "RP");
  const rpPath = path.join(handoffDir, `${rpId}.md`);
  let rpContent: string | undefined;
  try {
    rpContent = await fs.readFile(rpPath, "utf-8");
  } catch { /* no RP yet */ }

  if (task) {
    return { ...task, content, rpContent };
  }

  if (completedTask) {
    return {
      id: completedTask.id,
      title: completedTask.title,
      agent: completedTask.agent,
      status: "done" as TaskStatus,
      created: completedTask.completed,
      updated: completedTask.completed,
      content,
      rpContent,
    };
  }

  // TP file exists but not in INDEX
  return {
    id,
    title: content.match(/^#\s+TP-\d{3}:\s*(.+)$/m)?.[1] ?? "Untitled",
    agent: content.match(/Agent Target:\s*(\S+)/)?.[1] ?? "unknown",
    status: "draft",
    created: today(),
    updated: today(),
    content,
    rpContent,
  };
}

export async function createTask(asgardRoot: string, input: CreateTaskInput): Promise<{ id: string; task: Task }> {
  const indexContent = await readIndexContent(asgardRoot);
  const nextNum = getNextTPNumber(indexContent);
  const id = formatTPId(nextNum);

  // Write TP file
  const handoffDir = path.join(asgardRoot, "artifacts", "handoff");
  await fs.mkdir(handoffDir, { recursive: true });
  await fs.writeFile(path.join(handoffDir, `${id}.md`), generateTPContent(id, input), "utf-8");

  // Update INDEX.md
  const activeTasks = parseIndex(indexContent);
  const completedTasks = parseCompletedTasks(indexContent);
  const newTask: Task = {
    id,
    title: input.title,
    agent: input.agent,
    status: "draft",
    created: today(),
    updated: today(),
  };
  activeTasks.push(newTask);

  await writeIndex(asgardRoot, activeTasks, completedTasks, nextNum + 1);

  log.info({ id, title: input.title }, "Task created");
  return { id, task: newTask };
}

export async function updateTaskStatus(asgardRoot: string, id: string, status: TaskStatus): Promise<Task | null> {
  const indexContent = await readIndexContent(asgardRoot);
  const activeTasks = parseIndex(indexContent);
  const completedTasks = parseCompletedTasks(indexContent);
  const nextNum = getNextTPNumber(indexContent);

  const taskIdx = activeTasks.findIndex(t => t.id === id);

  if (status === "done" && taskIdx >= 0) {
    // Move to completed
    const task = activeTasks[taskIdx];
    activeTasks.splice(taskIdx, 1);
    completedTasks.unshift({ id: task.id, title: task.title, agent: task.agent, completed: today() });
    await writeIndex(asgardRoot, activeTasks, completedTasks, nextNum);
    log.info({ id, status }, "Task moved to completed");
    return { ...task, status: "done", updated: today() };
  }

  if (taskIdx >= 0) {
    activeTasks[taskIdx].status = status;
    activeTasks[taskIdx].updated = today();
    await writeIndex(asgardRoot, activeTasks, completedTasks, nextNum);
    log.info({ id, status }, "Task status updated");
    return activeTasks[taskIdx];
  }

  return null;
}

export async function deleteTask(asgardRoot: string, id: string): Promise<{ success: boolean; message: string }> {
  const indexContent = await readIndexContent(asgardRoot);
  const activeTasks = parseIndex(indexContent);
  const taskIdx = activeTasks.findIndex(t => t.id === id);

  if (taskIdx < 0) {
    return { success: false, message: `Task ${id} not found in active tasks.` };
  }

  if (activeTasks[taskIdx].status !== "draft") {
    return { success: false, message: `Can only delete draft tasks. ${id} is ${activeTasks[taskIdx].status}.` };
  }

  // Remove from INDEX
  activeTasks.splice(taskIdx, 1);
  const completedTasks = parseCompletedTasks(indexContent);
  const nextNum = getNextTPNumber(indexContent);
  await writeIndex(asgardRoot, activeTasks, completedTasks, nextNum);

  // Delete TP file
  const tpPath = path.join(asgardRoot, "artifacts", "handoff", `${id}.md`);
  try {
    await fs.unlink(tpPath);
  } catch { /* file may not exist */ }

  log.info({ id }, "Task deleted");
  return { success: true, message: `${id} deleted.` };
}
