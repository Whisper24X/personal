import { TaskMode } from '../tasks/dto/task-mode.enum';
import { TaskStatus } from '../tasks/dto/task-status.enum';
import { ContainerOrchestrationService } from './container-orchestration.service';

describe('ContainerOrchestrationService', () => {
  const createTask = (status: TaskStatus) => ({
    id: 'task-1',
    projectId: 'project-1',
    businessLineId: 'business-line-1',
    mode: TaskMode.workflow,
    title: 'Workflow task',
    prompt: 'task prompt',
    status,
    gitBranch: 'feature/task-1',
    gitBaseBranch: 'main',
    gitWorktree: 'wk-task-1',
    configJson: null,
    startedAt: new Date('2026-03-19T10:00:00.000Z'),
    finishedAt: null,
    createdAt: new Date('2026-03-19T10:00:00.000Z'),
    updatedAt: new Date('2026-03-19T10:00:00.000Z'),
    deletedAt: null,
  });

  const createProject = (configJson?: Record<string, unknown>) => ({
    id: 'project-1',
    businessLineId: 'business-line-1',
    name: 'AINative Web',
    description: null,
    gitUrl: 'git@example.com:ainative/web.git',
    defaultBranch: 'main',
    configJson: configJson ?? null,
    createdAt: new Date('2026-03-19T10:00:00.000Z'),
    updatedAt: new Date('2026-03-19T10:00:00.000Z'),
    deletedAt: null,
  });

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('should resume heartbeat for valid paused task slots on startup', async () => {
    const config = {
      isDockerMode: jest.fn().mockReturnValue(true),
      getSlotHeartbeatMs: jest.fn().mockReturnValue(1000),
      getSlotTtlMs: jest.fn().mockReturnValue(5000),
      resolveContainerName: jest.fn().mockReturnValue('ainative-task-task-1'),
    };
    const isolatedRunner = {
      remove: jest.fn().mockResolvedValue(undefined),
      listAinativeContainers: jest.fn().mockResolvedValue([]),
    };
    const projectRunnerImageService = {
      resolveRunnerImage: jest.fn().mockResolvedValue('ainative/runner:latest'),
    };
    const slotRepository = {
      findAll: jest.fn().mockResolvedValue([
        {
          id: 'slot-1',
          projectId: 'project-1',
          taskId: 'task-1',
          containerId: 'container-1',
          claimedAt: new Date('2026-03-19T10:00:00.000Z'),
          expiresAt: new Date(Date.now() + 60_000),
          heartbeatAt: null,
        },
      ]),
      renewSlot: jest.fn().mockResolvedValue(undefined),
      releaseSlot: jest.fn().mockResolvedValue(undefined),
    };
    const taskRepository = {
      findById: jest.fn().mockResolvedValue(createTask(TaskStatus.inReview)),
    };

    const service = new ContainerOrchestrationService(
      config as never,
      projectRunnerImageService as never,
      isolatedRunner as never,
      slotRepository as never,
      taskRepository as never,
    );

    await service.resumeActiveSlotsOnStartup();
    await jest.advanceTimersByTimeAsync(1000);

    expect(slotRepository.renewSlot).toHaveBeenCalledWith('project-1', 5000);
    expect(slotRepository.releaseSlot).not.toHaveBeenCalled();
    expect(isolatedRunner.remove).not.toHaveBeenCalled();

    service.onModuleDestroy();
  });

  it('should release stale done-task slots on startup instead of resuming them', async () => {
    const config = {
      isDockerMode: jest.fn().mockReturnValue(true),
      getSlotHeartbeatMs: jest.fn().mockReturnValue(1000),
      getSlotTtlMs: jest.fn().mockReturnValue(5000),
      resolveContainerName: jest.fn().mockReturnValue('ainative-task-task-1'),
    };
    const isolatedRunner = {
      remove: jest.fn().mockResolvedValue(undefined),
      listAinativeContainers: jest.fn().mockResolvedValue([]),
    };
    const projectRunnerImageService = {
      resolveRunnerImage: jest.fn().mockResolvedValue('ainative/runner:latest'),
    };
    const slotRepository = {
      findAll: jest.fn().mockResolvedValue([
        {
          id: 'slot-1',
          projectId: 'project-1',
          taskId: 'task-1',
          containerId: 'container-1',
          claimedAt: new Date('2026-03-19T10:00:00.000Z'),
          expiresAt: new Date(Date.now() + 60_000),
          heartbeatAt: null,
        },
      ]),
      renewSlot: jest.fn().mockResolvedValue(undefined),
      releaseSlot: jest.fn().mockResolvedValue(undefined),
    };
    const taskRepository = {
      findById: jest.fn().mockResolvedValue(createTask(TaskStatus.done)),
    };

    const service = new ContainerOrchestrationService(
      config as never,
      projectRunnerImageService as never,
      isolatedRunner as never,
      slotRepository as never,
      taskRepository as never,
    );

    await service.resumeActiveSlotsOnStartup();
    await jest.advanceTimersByTimeAsync(1000);

    expect(isolatedRunner.remove).toHaveBeenCalledWith('ainative-task-task-1');
    expect(slotRepository.releaseSlot).toHaveBeenCalledWith('project-1');
    expect(slotRepository.renewSlot).not.toHaveBeenCalled();
  });

  it('should apply project-level container runtime overrides when starting containers', async () => {
    const config = {
      isDockerMode: jest.fn().mockReturnValue(true),
      isStrictMode: jest.fn().mockReturnValue(true),
      resolveContainerName: jest.fn().mockReturnValue('ainative-task-task-1'),
      getSandboxProfile: jest.fn().mockReturnValue('preview-web'),
      getRunnerNetworkMode: jest.fn().mockReturnValue('bridge'),
      shouldExposeSandboxPort: jest.fn().mockReturnValue(true),
      getRunnerExposeHostIp: jest.fn().mockReturnValue('192.168.50.8'),
      getRunnerExposeContainerPort: jest.fn().mockReturnValue(4173),
      usesSandboxEntrypoint: jest.fn().mockReturnValue(true),
      getRunnerWorkspace: jest.fn().mockReturnValue('/workspace'),
      getRunnerAnonymousVolumeMounts: jest
        .fn()
        .mockReturnValue(['/workspace/backend/node_modules']),
      getRunnerEnv: jest.fn().mockReturnValue({ PORT: '4173' }),
      resourceLimitsForProfile: jest
        .fn()
        .mockReturnValue({ memoryMb: 3072, pidsLimit: 300 }),
      getRunnerReadinessProbeUrl: jest
        .fn()
        .mockReturnValue('http://127.0.0.1:8080/health'),
      getRunnerStartTimeoutMs: jest.fn().mockReturnValue(90000),
      getSlotHeartbeatMs: jest.fn().mockReturnValue(1000),
      getSlotTtlMs: jest.fn().mockReturnValue(5000),
      getRunnerExposePortRange: jest
        .fn()
        .mockReturnValue({ start: 38080, end: 38080 }),
    };
    const isolatedRunner = {
      inspect: jest.fn().mockResolvedValue(null),
      run: jest.fn().mockResolvedValue({
        containerId: 'container-1',
        publishedPorts: [
          {
            hostIp: '0.0.0.0',
            hostPort: 38080,
            containerPort: 4173,
          },
        ],
      }),
    };
    const projectRunnerImageService = {
      resolveRunnerImage: jest
        .fn()
        .mockResolvedValue('ainative/runner:project-1'),
    };
    const slotRepository = {
      updateContainerRuntime: jest.fn().mockResolvedValue(undefined),
      updateContainerId: jest.fn().mockResolvedValue(undefined),
      renewSlot: jest.fn().mockResolvedValue(undefined),
      releaseSlot: jest.fn().mockResolvedValue(undefined),
    };
    const taskRepository = {
      findById: jest.fn(),
    };
    const service = new ContainerOrchestrationService(
      config as never,
      projectRunnerImageService as never,
      isolatedRunner as never,
      slotRepository as never,
      taskRepository as never,
    );
    jest
      .spyOn(service as never, 'allocatePublishedPort' as never)
      .mockResolvedValue(38080 as never);

    const result = await service.ensureContainer({
      task: createTask(TaskStatus.inProgress) as never,
      project: createProject({
        containerRuntime: {
          sandboxProfile: 'preview-web',
          networkMode: 'bridge',
          exposeLocal: true,
          exposeHostIp: '192.168.50.8',
          exposeContainerPort: 4173,
          startTimeoutMs: 90000,
          resourceLimits: {
            memoryMb: 3072,
            pidsLimit: 300,
          },
          env: {
            PORT: '4173',
          },
        },
      }) as never,
      worktreePath: '/tmp/worktrees/wk-task-1',
    });

    expect(result).toEqual({ containerId: 'container-1' });
    expect(isolatedRunner.run).toHaveBeenCalledWith(
      expect.objectContaining({
        containerName: 'ainative-task-task-1',
        image: 'ainative/runner:project-1',
        env: { PORT: '4173' },
        resourceLimits: { memoryMb: 3072, pidsLimit: 300 },
        networkMode: 'bridge',
        startTimeoutMs: 90000,
        publishedPorts: [
          {
            hostIp: '0.0.0.0',
            hostPort: 38080,
            containerPort: 4173,
          },
        ],
      }),
    );
    expect(slotRepository.updateContainerRuntime).toHaveBeenCalledWith(
      'project-1',
      expect.objectContaining({
        containerId: 'container-1',
        accessMetadata: expect.objectContaining({
          hostIp: '192.168.50.8',
          hostPort: 38080,
          containerPort: 4173,
          networkMode: 'bridge',
        }),
      }),
    );
    expect(projectRunnerImageService.resolveRunnerImage).toHaveBeenCalledTimes(
      1,
    );
  });

  it('should replace a running host-network container and persist derived preview metadata', async () => {
    const config = {
      isDockerMode: jest.fn().mockReturnValue(true),
      isStrictMode: jest.fn().mockReturnValue(true),
      resolveContainerName: jest.fn().mockReturnValue('ainative-task-task-1'),
      getSandboxProfile: jest.fn().mockReturnValue('default'),
      getRunnerNetworkMode: jest.fn().mockReturnValue('host'),
      shouldExposeSandboxPort: jest.fn().mockReturnValue(true),
      getRunnerExposeHostIp: jest.fn().mockReturnValue('127.0.0.1'),
      getRunnerExposeContainerPort: jest.fn().mockReturnValue(8080),
      usesSandboxEntrypoint: jest.fn().mockReturnValue(true),
      getRunnerWorkspace: jest.fn().mockReturnValue('/workspace'),
      getRunnerAnonymousVolumeMounts: jest.fn().mockReturnValue([]),
      getRunnerEnv: jest.fn().mockReturnValue({}),
      resourceLimitsForProfile: jest.fn().mockReturnValue({}),
      getRunnerReadinessProbeUrl: jest.fn().mockReturnValue(null),
      getRunnerStartTimeoutMs: jest.fn().mockReturnValue(30000),
      getSlotHeartbeatMs: jest.fn().mockReturnValue(1000),
      getSlotTtlMs: jest.fn().mockReturnValue(5000),
    };
    const isolatedRunner = {
      inspect: jest.fn().mockResolvedValue({
        id: 'container-old',
        status: 'running',
        running: true,
        image: 'ainative/runner:stale',
      }),
      remove: jest.fn().mockResolvedValue(undefined),
      run: jest.fn().mockResolvedValue({
        containerId: 'container-new',
        publishedPorts: [],
      }),
    };
    const projectRunnerImageService = {
      resolveRunnerImage: jest.fn().mockResolvedValue('ainative/runner:fresh'),
    };
    const slotRepository = {
      updateContainerRuntime: jest.fn().mockResolvedValue(undefined),
      updateContainerId: jest.fn().mockResolvedValue(undefined),
      renewSlot: jest.fn().mockResolvedValue(undefined),
      releaseSlot: jest.fn().mockResolvedValue(undefined),
    };
    const taskRepository = {
      findById: jest.fn(),
    };
    const service = new ContainerOrchestrationService(
      config as never,
      projectRunnerImageService as never,
      isolatedRunner as never,
      slotRepository as never,
      taskRepository as never,
    );

    const result = await service.ensureContainer({
      task: createTask(TaskStatus.inProgress) as never,
      project: createProject() as never,
      worktreePath: '/tmp/worktrees/wk-task-1',
    });

    expect(result).toEqual({ containerId: 'container-new' });
    expect(isolatedRunner.remove).toHaveBeenCalledWith('ainative-task-task-1');
    expect(isolatedRunner.run).toHaveBeenCalledWith(
      expect.objectContaining({
        image: 'ainative/runner:fresh',
      }),
    );
    expect(slotRepository.updateContainerRuntime).toHaveBeenCalledWith(
      'project-1',
      expect.objectContaining({
        containerId: 'container-new',
        accessMetadata: expect.objectContaining({
          hostIp: '127.0.0.1',
          hostPort: 8080,
          containerPort: 8080,
          previewAddress: '127.0.0.1:8080',
          networkMode: 'host',
        }),
      }),
    );
  });

  it('should refresh slot runtime metadata when reusing a running container', async () => {
    const config = {
      isDockerMode: jest.fn().mockReturnValue(true),
      isStrictMode: jest.fn().mockReturnValue(true),
      resolveContainerName: jest.fn().mockReturnValue('ainative-task-task-1'),
      getSandboxProfile: jest.fn().mockReturnValue('preview-web'),
      getRunnerNetworkMode: jest.fn().mockReturnValue('bridge'),
      shouldExposeSandboxPort: jest.fn().mockReturnValue(true),
      getRunnerExposeHostIp: jest.fn().mockReturnValue('192.168.50.8'),
      getRunnerExposeContainerPort: jest.fn().mockReturnValue(4173),
      usesSandboxEntrypoint: jest.fn().mockReturnValue(true),
      getRunnerWorkspace: jest.fn().mockReturnValue('/workspace'),
      getRunnerAnonymousVolumeMounts: jest.fn().mockReturnValue([]),
      getRunnerEnv: jest.fn().mockReturnValue({}),
      resourceLimitsForProfile: jest.fn().mockReturnValue({}),
      getRunnerReadinessProbeUrl: jest.fn().mockReturnValue(null),
      getRunnerStartTimeoutMs: jest.fn().mockReturnValue(30000),
      getSlotHeartbeatMs: jest.fn().mockReturnValue(1000),
      getSlotTtlMs: jest.fn().mockReturnValue(5000),
    };
    const isolatedRunner = {
      inspect: jest.fn().mockResolvedValue({
        id: 'container-1',
        status: 'running',
        running: true,
        image: 'ainative/runner:fresh',
        publishedPorts: [],
      }),
    };
    const projectRunnerImageService = {
      resolveRunnerImage: jest.fn().mockResolvedValue('ainative/runner:fresh'),
    };
    const accessMetadata = {
      hostIp: '192.168.50.8',
      hostPort: 38080,
      containerPort: 4173,
      previewAddress: '192.168.50.8:38080',
      baseUrl: 'http://192.168.50.8:38080',
      networkMode: 'bridge',
    };
    const slotRepository = {
      findByProjectId: jest.fn().mockResolvedValue({
        projectId: 'project-1',
        taskId: 'task-1',
        accessMetadata,
      }),
      updateContainerRuntime: jest.fn().mockResolvedValue(undefined),
      updateContainerId: jest.fn().mockResolvedValue(undefined),
      renewSlot: jest.fn().mockResolvedValue(undefined),
      releaseSlot: jest.fn().mockResolvedValue(undefined),
    };
    const taskRepository = {
      findById: jest.fn(),
    };
    const service = new ContainerOrchestrationService(
      config as never,
      projectRunnerImageService as never,
      isolatedRunner as never,
      slotRepository as never,
      taskRepository as never,
    );

    const result = await service.ensureContainer({
      task: createTask(TaskStatus.inProgress) as never,
      project: createProject() as never,
      worktreePath: '/tmp/worktrees/wk-task-1',
    });

    expect(result).toEqual({ containerId: 'container-1' });
    expect(slotRepository.findByProjectId).toHaveBeenCalledWith('project-1');
    expect(slotRepository.updateContainerRuntime).toHaveBeenCalledWith(
      'project-1',
      {
        containerId: 'container-1',
        accessMetadata,
      },
    );
    expect(slotRepository.updateContainerId).not.toHaveBeenCalled();
  });

  it('should recover bridge preview metadata from inspected published ports when reused metadata is missing', async () => {
    const config = {
      isDockerMode: jest.fn().mockReturnValue(true),
      isStrictMode: jest.fn().mockReturnValue(true),
      resolveContainerName: jest.fn().mockReturnValue('ainative-task-task-1'),
      getSandboxProfile: jest.fn().mockReturnValue('preview-web'),
      getRunnerNetworkMode: jest.fn().mockReturnValue('bridge'),
      shouldExposeSandboxPort: jest.fn().mockReturnValue(true),
      getRunnerExposeHostIp: jest.fn().mockReturnValue('192.168.50.8'),
      getRunnerExposeContainerPort: jest.fn().mockReturnValue(4173),
      usesSandboxEntrypoint: jest.fn().mockReturnValue(true),
      getRunnerWorkspace: jest.fn().mockReturnValue('/workspace'),
      getRunnerAnonymousVolumeMounts: jest.fn().mockReturnValue([]),
      getRunnerEnv: jest.fn().mockReturnValue({}),
      resourceLimitsForProfile: jest.fn().mockReturnValue({}),
      getRunnerReadinessProbeUrl: jest.fn().mockReturnValue(null),
      getRunnerStartTimeoutMs: jest.fn().mockReturnValue(30000),
      getSlotHeartbeatMs: jest.fn().mockReturnValue(1000),
      getSlotTtlMs: jest.fn().mockReturnValue(5000),
    };
    const isolatedRunner = {
      inspect: jest.fn().mockResolvedValue({
        id: 'container-1',
        status: 'running',
        running: true,
        image: 'ainative/runner:fresh',
        publishedPorts: [
          {
            hostIp: '0.0.0.0',
            hostPort: 38080,
            containerPort: 4173,
          },
        ],
      }),
    };
    const projectRunnerImageService = {
      resolveRunnerImage: jest.fn().mockResolvedValue('ainative/runner:fresh'),
    };
    const slotRepository = {
      findByProjectId: jest.fn().mockResolvedValue({
        projectId: 'project-1',
        taskId: 'task-1',
        accessMetadata: null,
      }),
      updateContainerRuntime: jest.fn().mockResolvedValue(undefined),
      updateContainerId: jest.fn().mockResolvedValue(undefined),
      renewSlot: jest.fn().mockResolvedValue(undefined),
      releaseSlot: jest.fn().mockResolvedValue(undefined),
    };
    const taskRepository = {
      findById: jest.fn(),
    };
    const service = new ContainerOrchestrationService(
      config as never,
      projectRunnerImageService as never,
      isolatedRunner as never,
      slotRepository as never,
      taskRepository as never,
    );
    const result = await service.ensureContainer({
      task: createTask(TaskStatus.inProgress) as never,
      project: createProject() as never,
      worktreePath: '/tmp/worktrees/wk-task-1',
    });

    expect(result).toEqual({ containerId: 'container-1' });
    expect(slotRepository.updateContainerRuntime).toHaveBeenCalledWith(
      'project-1',
      {
        containerId: 'container-1',
        accessMetadata: {
          hostIp: '192.168.50.8',
          hostPort: 38080,
          containerPort: 4173,
          previewAddress: '192.168.50.8:38080',
          baseUrl: 'http://192.168.50.8:38080',
          networkMode: 'bridge',
        },
      },
    );
    expect(slotRepository.updateContainerId).not.toHaveBeenCalled();
  });

  it('should derive host preview metadata when reusing a running host container', async () => {
    const config = {
      isDockerMode: jest.fn().mockReturnValue(true),
      isStrictMode: jest.fn().mockReturnValue(true),
      resolveContainerName: jest.fn().mockReturnValue('ainative-task-task-1'),
      getSandboxProfile: jest.fn().mockReturnValue('preview-web'),
      getRunnerNetworkMode: jest.fn().mockReturnValue('host'),
      shouldExposeSandboxPort: jest.fn().mockReturnValue(true),
      getRunnerExposeHostIp: jest.fn().mockReturnValue('127.0.0.1'),
      getRunnerExposeContainerPort: jest.fn().mockReturnValue(8080),
      usesSandboxEntrypoint: jest.fn().mockReturnValue(true),
      getRunnerWorkspace: jest.fn().mockReturnValue('/workspace'),
      getRunnerAnonymousVolumeMounts: jest.fn().mockReturnValue([]),
      getRunnerEnv: jest.fn().mockReturnValue({}),
      resourceLimitsForProfile: jest.fn().mockReturnValue({}),
      getRunnerReadinessProbeUrl: jest.fn().mockReturnValue(null),
      getRunnerStartTimeoutMs: jest.fn().mockReturnValue(30000),
      getSlotHeartbeatMs: jest.fn().mockReturnValue(1000),
      getSlotTtlMs: jest.fn().mockReturnValue(5000),
    };
    const isolatedRunner = {
      inspect: jest.fn().mockResolvedValue({
        id: 'container-1',
        status: 'running',
        running: true,
        image: 'ainative/runner:fresh',
        publishedPorts: [],
      }),
    };
    const projectRunnerImageService = {
      resolveRunnerImage: jest.fn().mockResolvedValue('ainative/runner:fresh'),
    };
    const slotRepository = {
      findByProjectId: jest.fn().mockResolvedValue({
        projectId: 'project-1',
        taskId: 'task-1',
        accessMetadata: null,
      }),
      updateContainerRuntime: jest.fn().mockResolvedValue(undefined),
      updateContainerId: jest.fn().mockResolvedValue(undefined),
      renewSlot: jest.fn().mockResolvedValue(undefined),
      releaseSlot: jest.fn().mockResolvedValue(undefined),
    };
    const taskRepository = {
      findById: jest.fn(),
    };
    const service = new ContainerOrchestrationService(
      config as never,
      projectRunnerImageService as never,
      isolatedRunner as never,
      slotRepository as never,
      taskRepository as never,
    );
    const loggerWarn = jest
      .spyOn((service as any).logger, 'warn')
      .mockImplementation(() => undefined);

    const result = await service.ensureContainer({
      task: createTask(TaskStatus.inProgress) as never,
      project: createProject() as never,
      worktreePath: '/tmp/worktrees/wk-task-1',
    });

    expect(result).toEqual({ containerId: 'container-1' });
    expect(slotRepository.updateContainerRuntime).toHaveBeenCalledWith(
      'project-1',
      {
        containerId: 'container-1',
        accessMetadata: {
          hostIp: '127.0.0.1',
          hostPort: 8080,
          containerPort: 8080,
          previewAddress: '127.0.0.1:8080',
          baseUrl: 'http://127.0.0.1:8080',
          networkMode: 'host',
        },
      },
    );
    expect(slotRepository.updateContainerId).not.toHaveBeenCalled();
    expect(loggerWarn).not.toHaveBeenCalledWith(
      expect.stringContaining('reuse_runner_container_metadata_missing '),
    );
  });

  it('should warn and only update container id when reused metadata is missing and inspect has no published ports', async () => {
    const config = {
      isDockerMode: jest.fn().mockReturnValue(true),
      isStrictMode: jest.fn().mockReturnValue(true),
      resolveContainerName: jest.fn().mockReturnValue('ainative-task-task-1'),
      getSandboxProfile: jest.fn().mockReturnValue('preview-web'),
      getRunnerNetworkMode: jest.fn().mockReturnValue('bridge'),
      shouldExposeSandboxPort: jest.fn().mockReturnValue(true),
      getRunnerExposeHostIp: jest.fn().mockReturnValue('192.168.50.8'),
      getRunnerExposeContainerPort: jest.fn().mockReturnValue(4173),
      usesSandboxEntrypoint: jest.fn().mockReturnValue(true),
      getRunnerWorkspace: jest.fn().mockReturnValue('/workspace'),
      getRunnerAnonymousVolumeMounts: jest.fn().mockReturnValue([]),
      getRunnerEnv: jest.fn().mockReturnValue({}),
      resourceLimitsForProfile: jest.fn().mockReturnValue({}),
      getRunnerReadinessProbeUrl: jest.fn().mockReturnValue(null),
      getRunnerStartTimeoutMs: jest.fn().mockReturnValue(30000),
      getSlotHeartbeatMs: jest.fn().mockReturnValue(1000),
      getSlotTtlMs: jest.fn().mockReturnValue(5000),
    };
    const isolatedRunner = {
      inspect: jest.fn().mockResolvedValue({
        id: 'container-1',
        status: 'running',
        running: true,
        image: 'ainative/runner:fresh',
        publishedPorts: [],
      }),
    };
    const projectRunnerImageService = {
      resolveRunnerImage: jest.fn().mockResolvedValue('ainative/runner:fresh'),
    };
    const slotRepository = {
      findByProjectId: jest.fn().mockResolvedValue({
        projectId: 'project-1',
        taskId: 'task-1',
        accessMetadata: null,
      }),
      updateContainerRuntime: jest.fn().mockResolvedValue(undefined),
      updateContainerId: jest.fn().mockResolvedValue(undefined),
      renewSlot: jest.fn().mockResolvedValue(undefined),
      releaseSlot: jest.fn().mockResolvedValue(undefined),
    };
    const taskRepository = {
      findById: jest.fn(),
    };
    const service = new ContainerOrchestrationService(
      config as never,
      projectRunnerImageService as never,
      isolatedRunner as never,
      slotRepository as never,
      taskRepository as never,
    );
    const loggerWarn = jest
      .spyOn((service as any).logger, 'warn')
      .mockImplementation(() => undefined);

    const result = await service.ensureContainer({
      task: createTask(TaskStatus.inProgress) as never,
      project: createProject() as never,
      worktreePath: '/tmp/worktrees/wk-task-1',
    });

    expect(result).toEqual({ containerId: 'container-1' });
    expect(slotRepository.updateContainerRuntime).not.toHaveBeenCalled();
    expect(slotRepository.updateContainerId).toHaveBeenCalledWith(
      'project-1',
      'container-1',
    );
    expect(loggerWarn).toHaveBeenCalledWith(
      expect.stringContaining('reuse_runner_container_metadata_missing '),
    );
  });

  it('should remove the resolved container and log the cleanup result', async () => {
    const config = {
      isDockerMode: jest.fn().mockReturnValue(true),
      resolveContainerName: jest.fn().mockReturnValue('ainative-task-task-1'),
    };
    const isolatedRunner = {
      remove: jest.fn().mockResolvedValue(undefined),
    };
    const projectRunnerImageService = {
      resolveRunnerImage: jest.fn(),
    };
    const slotRepository = {
      releaseSlot: jest.fn().mockResolvedValue(undefined),
    };
    const taskRepository = {
      findById: jest.fn().mockResolvedValue(createTask(TaskStatus.inProgress)),
    };

    const service = new ContainerOrchestrationService(
      config as never,
      projectRunnerImageService as never,
      isolatedRunner as never,
      slotRepository as never,
      taskRepository as never,
    );
    const loggerLog = jest
      .spyOn((service as any).logger, 'log')
      .mockImplementation(() => undefined);

    await service.removeContainerForTask('task-1', 'project-1');

    expect(isolatedRunner.remove).toHaveBeenCalledWith('ainative-task-task-1');
    expect(slotRepository.releaseSlot).toHaveBeenCalledWith('project-1');
    expect(loggerLog).toHaveBeenCalledWith(
      expect.stringContaining('remove_runner_container '),
    );
    expect(loggerLog).toHaveBeenCalledWith(
      expect.stringContaining('remove_runner_container_done '),
    );
  });

  it('should only release the slot and log when the task no longer exists', async () => {
    const config = {
      isDockerMode: jest.fn().mockReturnValue(true),
    };
    const isolatedRunner = {
      remove: jest.fn().mockResolvedValue(undefined),
    };
    const projectRunnerImageService = {
      resolveRunnerImage: jest.fn(),
    };
    const slotRepository = {
      releaseSlot: jest.fn().mockResolvedValue(undefined),
    };
    const taskRepository = {
      findById: jest.fn().mockResolvedValue(null),
    };

    const service = new ContainerOrchestrationService(
      config as never,
      projectRunnerImageService as never,
      isolatedRunner as never,
      slotRepository as never,
      taskRepository as never,
    );
    const loggerLog = jest
      .spyOn((service as any).logger, 'log')
      .mockImplementation(() => undefined);

    await service.removeContainerForTask('task-1', 'project-1');

    expect(isolatedRunner.remove).not.toHaveBeenCalled();
    expect(slotRepository.releaseSlot).toHaveBeenCalledWith('project-1');
    expect(loggerLog).toHaveBeenCalledWith(
      expect.stringContaining('remove_runner_container_task_missing '),
    );
  });
});
