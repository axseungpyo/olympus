import type { CompletedTask, CreateTaskInput, TaskDetail, TaskEntity, TaskStatus } from "../entities/Task";

export interface ITaskRepository {
  list(): Promise<{ active: TaskEntity[]; completed: CompletedTask[] }>;
  getById(id: string): Promise<TaskDetail | null>;
  create(input: CreateTaskInput): Promise<{ id: string; task: TaskEntity }>;
  updateStatus(id: string, status: TaskStatus): Promise<TaskEntity | null>;
  delete(id: string): Promise<{ success: boolean; message: string }>;
  getNextTPNumber(): Promise<number>;
}
