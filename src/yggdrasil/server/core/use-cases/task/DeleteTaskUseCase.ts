import type { ITaskRepository } from "../../ports/ITaskRepository";

export interface DeleteTaskInput {
  id: string;
}

export interface DeleteTaskResult {
  success: boolean;
  message: string;
}

export class DeleteTaskUseCase {
  constructor(private readonly taskRepository: ITaskRepository) {}

  execute(input: DeleteTaskInput): Promise<DeleteTaskResult> {
    return this.taskRepository.delete(input.id);
  }
}
