import type { IAgentRepository } from "../core/ports/IAgentRepository";
import type { IAgentProcessRegistry } from "../core/ports/IAgentProcessRegistry";
import type { IMessageRepository } from "../core/ports/IMessageRepository";
import type { IApprovalStore } from "../core/ports/IApprovalStore";
import type { ILLMGateway } from "../core/ports/ILLMGateway";
import type { IProcessGateway } from "../core/ports/IProcessGateway";
import type { ISkillRegistry } from "../core/ports/ISkillRegistry";
import type { ITaskRepository } from "../core/ports/ITaskRepository";
import type { IToolExecutor } from "../core/ports/IToolExecutor";
import { AgentController } from "../adapters/controllers/AgentController";
import { DocumentController } from "../adapters/controllers/DocumentController";
import { NodeFileSystem } from "../adapters/filesystem/NodeFileSystem";
import { HealthController } from "../adapters/controllers/HealthController";
import { McpController } from "../adapters/controllers/McpController";
import { OdinController } from "../adapters/controllers/OdinController";
import { SettingsController } from "../adapters/controllers/SettingsController";
import { TaskController } from "../adapters/controllers/TaskController";
import { ChildProcessGateway } from "../adapters/gateways/ChildProcessGateway";
import { ClaudeLLMGateway } from "../adapters/gateways/ClaudeLLMGateway";
import { RegexFallbackGateway } from "../adapters/gateways/RegexFallbackGateway";
import { FileAgentRepository } from "../adapters/repositories/FileAgentRepository";
import { InProcessEventBus } from "../adapters/events/InProcessEventBus";
import { FileMessageRepository } from "../adapters/repositories/FileMessageRepository";
import { InMemoryPlanRepository } from "../adapters/repositories/InMemoryPlanRepository";
import { InMemorySettingsRepository } from "../adapters/repositories/InMemorySettingsRepository";
import { FileTaskRepository } from "../adapters/repositories/FileTaskRepository";
import { FileSkillRegistry } from "../adapters/skills/FileSkillRegistry";
import { FileSystemToolExecutor } from "../adapters/tools/FileSystemToolExecutor";
import { PlannerToolExecutor } from "../adapters/tools/PlannerToolExecutor";
import { SkillToolExecutor } from "../adapters/tools/SkillToolExecutor";
import { AgentProcessRegistry } from "../adapters/stores/AgentProcessRegistry";
import { InMemoryApprovalStore } from "../adapters/stores/InMemoryApprovalStore";
import { GetAgentStatusUseCase } from "../core/use-cases/agent/GetAgentStatusUseCase";
import { MonitorAgentUseCase } from "../core/use-cases/agent/MonitorAgentUseCase";
import { StartAgentUseCase } from "../core/use-cases/agent/StartAgentUseCase";
import { StopAgentUseCase } from "../core/use-cases/agent/StopAgentUseCase";
import { ProcessApprovalUseCase } from "../core/use-cases/odin/ProcessApprovalUseCase";
import { ProcessCommandUseCase } from "../core/use-cases/odin/ProcessCommandUseCase";
import type { IEventBus } from "../core/ports/IEventBus";
import type { ISettingsRepository } from "../core/ports/ISettingsRepository";
import { PlannerUseCase } from "../core/use-cases/plan/PlannerUseCase";
import { CreateTaskUseCase } from "../core/use-cases/task/CreateTaskUseCase";
import { DeleteTaskUseCase } from "../core/use-cases/task/DeleteTaskUseCase";
import { GetTaskUseCase } from "../core/use-cases/task/GetTaskUseCase";
import { ListTasksUseCase } from "../core/use-cases/task/ListTasksUseCase";
import { UpdateTaskStatusUseCase } from "../core/use-cases/task/UpdateTaskStatusUseCase";

export interface Container {
  taskRepository: ITaskRepository;
  agentRepository: IAgentRepository;
  messageRepository: IMessageRepository;
  approvalStore: IApprovalStore;
  processGateway: IProcessGateway;
  skillRegistry: ISkillRegistry;
  toolExecutors: IToolExecutor[];
  llmGateway: ILLMGateway;
  regexFallbackGateway: ILLMGateway;
  processRegistry: IAgentProcessRegistry;
  eventBus: IEventBus;
  settingsRepository: ISettingsRepository;
  monitorAgentUseCase: MonitorAgentUseCase;
  startAgentUseCase: StartAgentUseCase;
  stopAgentUseCase: StopAgentUseCase;
  getAgentStatusUseCase: GetAgentStatusUseCase;
  createTaskUseCase: CreateTaskUseCase;
  listTasksUseCase: ListTasksUseCase;
  getTaskUseCase: GetTaskUseCase;
  updateTaskStatusUseCase: UpdateTaskStatusUseCase;
  deleteTaskUseCase: DeleteTaskUseCase;
  plannerUseCase: PlannerUseCase;
  processCommandUseCase: ProcessCommandUseCase;
  processApprovalUseCase: ProcessApprovalUseCase;
  agentController: AgentController;
  taskController: TaskController;
  odinController: OdinController;
  healthController: HealthController;
  mcpController: McpController;
  documentController: DocumentController;
  settingsController: SettingsController;
  asgardRoot: string;
}

export function createContainer(asgardRoot: string): Container {
  const processRegistry = new AgentProcessRegistry();
  const eventBus = new InProcessEventBus();
  const taskRepository = new FileTaskRepository(asgardRoot);
  const processGateway = new ChildProcessGateway(asgardRoot);
  const agentRepository = new FileAgentRepository(asgardRoot, () => processRegistry.snapshot());
  const messageRepository = new FileMessageRepository(asgardRoot);
  const approvalStore = new InMemoryApprovalStore();
  const settingsRepository = new InMemorySettingsRepository();
  const monitorAgentUseCase = new MonitorAgentUseCase(eventBus);
  const startAgentUseCase = new StartAgentUseCase(taskRepository, agentRepository, processGateway, processRegistry, eventBus, monitorAgentUseCase);
  const stopAgentUseCase = new StopAgentUseCase(agentRepository, processGateway, processRegistry, eventBus);
  const getAgentStatusUseCase = new GetAgentStatusUseCase(agentRepository, taskRepository);
  const createTaskUseCase = new CreateTaskUseCase(taskRepository, eventBus);
  const listTasksUseCase = new ListTasksUseCase(taskRepository);
  const getTaskUseCase = new GetTaskUseCase(taskRepository);
  const updateTaskStatusUseCase = new UpdateTaskStatusUseCase(taskRepository, eventBus);
  const deleteTaskUseCase = new DeleteTaskUseCase(taskRepository);
  const skillRegistry = new FileSkillRegistry(
    asgardRoot,
    startAgentUseCase,
    stopAgentUseCase,
    taskRepository,
    agentRepository,
  );
  const llmGateway = new ClaudeLLMGateway(asgardRoot);
  const regexFallbackGateway = new RegexFallbackGateway(skillRegistry);
  const nodeFileSystem = new NodeFileSystem();
  const fileSystemToolExecutor = new FileSystemToolExecutor(nodeFileSystem, asgardRoot, eventBus);
  const skillToolExecutor = new SkillToolExecutor(skillRegistry);
  const toolExecutors: IToolExecutor[] = [fileSystemToolExecutor, skillToolExecutor];
  const planRepository = new InMemoryPlanRepository();
  const plannerUseCase = new PlannerUseCase(
    planRepository,
    toolExecutors,
    approvalStore,
    messageRepository,
    eventBus,
    settingsRepository,
    asgardRoot,
  );
  const plannerToolExecutor = new PlannerToolExecutor(plannerUseCase);
  toolExecutors.push(plannerToolExecutor);
  plannerUseCase.setToolExecutors(toolExecutors);
  const processCommandUseCase = new ProcessCommandUseCase(
    messageRepository,
    skillRegistry,
    approvalStore,
    llmGateway,
    regexFallbackGateway,
    toolExecutors,
    taskRepository,
    agentRepository,
    asgardRoot,
    eventBus,
  );
  const processApprovalUseCase = new ProcessApprovalUseCase(
    messageRepository,
    skillRegistry,
    approvalStore,
    toolExecutors,
    asgardRoot,
  );
  const agentController = new AgentController(getAgentStatusUseCase, startAgentUseCase, stopAgentUseCase);
  const taskController = new TaskController(listTasksUseCase, getTaskUseCase, createTaskUseCase, updateTaskStatusUseCase, deleteTaskUseCase);
  const odinController = new OdinController(messageRepository, processCommandUseCase, processApprovalUseCase);
  const healthController = new HealthController(asgardRoot, agentRepository);
  const mcpController = new McpController(asgardRoot);
  const documentController = new DocumentController(asgardRoot, agentRepository);
  const settingsController = new SettingsController(settingsRepository);

  return {
    taskRepository,
    agentRepository,
    messageRepository,
    approvalStore,
    processGateway,
    skillRegistry,
    toolExecutors,
    llmGateway,
    regexFallbackGateway,
    processRegistry,
    eventBus,
    settingsRepository,
    monitorAgentUseCase,
    startAgentUseCase,
    stopAgentUseCase,
    getAgentStatusUseCase,
    createTaskUseCase,
    listTasksUseCase,
    getTaskUseCase,
    updateTaskStatusUseCase,
    deleteTaskUseCase,
    plannerUseCase,
    processCommandUseCase,
    processApprovalUseCase,
    agentController,
    taskController,
    odinController,
    healthController,
    mcpController,
    documentController,
    settingsController,
    asgardRoot,
  };
}
