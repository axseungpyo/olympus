import type { TaskDetail } from "../../entities/Task";
import type { ITaskRepository } from "../../ports/ITaskRepository";

export class GetTaskUseCase {
  constructor(private readonly taskRepository: ITaskRepository) {}

  execute(id: string): Promise<TaskDetail | null> {
    return this.taskRepository.getById(id);
  }
}
