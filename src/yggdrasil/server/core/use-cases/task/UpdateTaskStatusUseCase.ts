import type { TaskEntity, TaskStatus } from "../../entities/Task";
import type { ITaskRepository } from "../../ports/ITaskRepository";

export interface UpdateTaskStatusInput {
  id: string;
  status: TaskStatus;
}

export class UpdateTaskStatusUseCase {
  constructor(private readonly taskRepository: ITaskRepository) {}

  execute(input: UpdateTaskStatusInput): Promise<TaskEntity | null> {
    return this.taskRepository.updateStatus(input.id, input.status);
  }
}
