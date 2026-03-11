import type { CreateTaskInput, TaskEntity } from "../../entities/Task";
import type { ITaskRepository } from "../../ports/ITaskRepository";

export interface CreateTaskResult {
  id: string;
  task: TaskEntity;
}

export class CreateTaskUseCase {
  constructor(private readonly taskRepository: ITaskRepository) {}

  execute(input: CreateTaskInput): Promise<CreateTaskResult> {
    return this.taskRepository.create(input);
  }
}
