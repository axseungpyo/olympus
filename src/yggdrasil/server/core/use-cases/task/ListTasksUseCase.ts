import type { CompletedTask, TaskEntity } from "../../entities/Task";
import type { ITaskRepository } from "../../ports/ITaskRepository";

export interface ListTasksResult {
  active: TaskEntity[];
  completed: CompletedTask[];
}

export class ListTasksUseCase {
  constructor(private readonly taskRepository: ITaskRepository) {}

  execute(): Promise<ListTasksResult> {
    return this.taskRepository.list();
  }
}
