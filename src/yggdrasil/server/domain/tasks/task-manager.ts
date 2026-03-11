import type { CreateTaskInput, TaskDetail, TaskEntity, TaskStatus } from "../../core/entities/Task";
import type { ITaskRepository } from "../../core/ports/ITaskRepository";

export type { CreateTaskInput, TaskDetail } from "../../core/entities/Task";

export async function listTasks(taskRepository: ITaskRepository): Promise<{
  active: TaskEntity[];
  completed: { id: string; title: string; agent: string; completed: string }[];
}> {
  return taskRepository.list();
}

export async function getTask(taskRepository: ITaskRepository, id: string): Promise<TaskDetail | null> {
  return taskRepository.getById(id);
}

export async function createTask(taskRepository: ITaskRepository, input: CreateTaskInput) {
  return taskRepository.create(input);
}

export async function updateTaskStatus(taskRepository: ITaskRepository, id: string, status: TaskStatus) {
  return taskRepository.updateStatus(id, status);
}

export async function deleteTask(taskRepository: ITaskRepository, id: string) {
  return taskRepository.delete(id);
}
