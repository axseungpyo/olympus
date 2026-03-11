import type { CreateTaskInput, TaskDetail, TaskEntity, TaskStatus } from "../../core/entities/Task";
import type { ITaskRepository } from "../../core/ports/ITaskRepository";
import { CreateTaskUseCase } from "../../core/use-cases/task/CreateTaskUseCase";
import { DeleteTaskUseCase } from "../../core/use-cases/task/DeleteTaskUseCase";
import { GetTaskUseCase } from "../../core/use-cases/task/GetTaskUseCase";
import { ListTasksUseCase } from "../../core/use-cases/task/ListTasksUseCase";
import { UpdateTaskStatusUseCase } from "../../core/use-cases/task/UpdateTaskStatusUseCase";

export type { CreateTaskInput, TaskDetail } from "../../core/entities/Task";

export async function listTasks(taskRepository: ITaskRepository): Promise<{
  active: TaskEntity[];
  completed: { id: string; title: string; agent: string; completed: string }[];
}> {
  return new ListTasksUseCase(taskRepository).execute();
}

export async function getTask(taskRepository: ITaskRepository, id: string): Promise<TaskDetail | null> {
  return new GetTaskUseCase(taskRepository).execute(id);
}

export async function createTask(taskRepository: ITaskRepository, input: CreateTaskInput) {
  return new CreateTaskUseCase(taskRepository).execute(input);
}

export async function updateTaskStatus(taskRepository: ITaskRepository, id: string, status: TaskStatus) {
  return new UpdateTaskStatusUseCase(taskRepository).execute({ id, status });
}

export async function deleteTask(taskRepository: ITaskRepository, id: string) {
  return new DeleteTaskUseCase(taskRepository).execute({ id });
}
