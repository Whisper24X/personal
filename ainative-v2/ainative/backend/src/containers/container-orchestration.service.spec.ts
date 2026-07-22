import path from 'node:path';
import { TaskMode } from '../tasks/dto/task-mode.enum';
import { TaskStatus } from '../tasks/dto/task-status.enum';
import { ContainerOrchestrationService } from './container-orchestration.service';

process.env.AINATIVE_DATA_ROOT_DIR ??= path.resolve(process.cwd(), 'tmp');

describe('ContainerOrchestrationService', () => {
  const createTask = (
    status: TaskStatus,
    overrides: Record<string, unknown> = {},
  ) => ({
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
    ...overrides,
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

  const createPreviewConfig = (path = '/') => ({
    service: 'ainative-app',
    path,
  });

  const createRunnerOrchestration = (
    previewConfig = createPreviewConfig(),
  ) => ({
    resolvePreviewConfig: jest.fn().mockReturnValue(previewConfig),
    resolvePreviewConfigFromOrchestration: jest
      .fn()
      .mockImplementation((orchestration) => orchestration?.preview ?? null),
    buildEffectiveOrchestration: jest.fn().mockReturnValue({
      services: [
        {
          name: previewConfig.service,
          workdir: previewConfig.service,
          command: 'pnpm dev',
          port: previewConfig.service === 'ainative-app' ? 8080 : 5173,
        },
      ],
      routes: [
        {
          path: previewConfig.path ?? '/',
          action: 'proxy',
          match: 'prefix',
          service: previewConfig.service,
        },
      ],
      preview: previewConfig,
    }),
    readConfiguredOrchestration: jest.fn().mockReturnValue(null),
    normalizeConfigSnapshot: jest.fn().mockImplementation((snapshot) => snapshot),
    buildProjectRunnerConfigFile: jest.fn().mockReturnValue(null),
    buildProjectRunnerConfigFileFromOrchestration: jest
      .fn()
      .mockReturnValue(null),
    buildManagedVolumeTargets: jest.fn().mockReturnValue([]),
    buildManagedVolumeTargetsFromOrchestration: jest.fn().mockReturnValue([]),
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
      shouldAddHostDockerInternalGateway: jest.fn().mockReturnValue(true),
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
      renewSlotByTaskId: jest.fn().mockResolvedValue(undefined),
      releaseSlotByTaskId: jest.fn().mockResolvedValue(undefined),
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
      {} as never,
    );

    await service.resumeActiveSlotsOnStartup();
    await jest.advanceTimersByTimeAsync(1000);

    expect(slotRepository.renewSlotByTaskId).toHaveBeenCalledWith(
      'task-1',
      5000,
    );
    expect(slotRepository.releaseSlotByTaskId).not.toHaveBeenCalled();
    expect(isolatedRunner.remove).not.toHaveBeenCalled();

    service.onModuleDestroy();
  });

  it('should release stale done-task slots on startup instead of resuming them', async () => {
    const config = {
      isDockerMode: jest.fn().mockReturnValue(true),
      getSlotHeartbeatMs: jest.fn().mockReturnValue(1000),
      getSlotTtlMs: jest.fn().mockReturnValue(5000),
      shouldAddHostDockerInternalGateway: jest.fn().mockReturnValue(true),
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
      renewSlotByTaskId: jest.fn().mockResolvedValue(undefined),
      releaseSlotByTaskId: jest.fn().mockResolvedValue(undefined),
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
      {} as never,
    );

    await service.resumeActiveSlotsOnStartup();
    await jest.advanceTimersByTimeAsync(1000);

    expect(isolatedRunner.remove).toHaveBeenCalledWith('ainative-task-task-1');
    expect(slotRepository.releaseSlotByTaskId).toHaveBeenCalledWith('task-1');
    expect(slotRepository.renewSlotByTaskId).not.toHaveBeenCalled();
  });

  it('should release stale slot state when the container is not inspectable', async () => {
    const config = {
      resolveContainerName: jest.fn().mockReturnValue('ainative-task-task-1'),
    };
    const isolatedRunner = {
      inspect: jest.fn().mockResolvedValue(null),
    };
    const projectRunnerImageService = {
      resolveRunnerImage: jest.fn(),
    };
    const slotRepository = {
      findByTaskId: jest.fn().mockResolvedValue({
        taskId: 'task-1',
        containerId: 'container-1',
        accessMetadata: {
          hostIp: '127.0.0.1',
          hostPort: 8080,
          containerPort: 8080,
          previewUrl: 'http://127.0.0.1:8080',
          networkMode: 'host',
        },
      }),
      releaseSlotByTaskId: jest.fn().mockResolvedValue(undefined),
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
      {} as never,
    );

    const result = await service.inspectTaskContainer({
      task: createTask(TaskStatus.inProgress) as never,
      project: createProject() as never,
    });

    expect(slotRepository.findByTaskId).toHaveBeenCalledWith('task-1');
    expect(slotRepository.releaseSlotByTaskId).toHaveBeenCalledWith('task-1');
    expect(result).toEqual({
      kind: 'missing',
      slotState: 'released-stale',
    });
  });

  it('should treat a non-running inspected container as missing', async () => {
    const config = {
      resolveContainerName: jest.fn().mockReturnValue('ainative-task-task-1'),
    };
    const isolatedRunner = {
      inspect: jest.fn().mockResolvedValue({
        id: 'container-1',
        running: false,
        publishedPorts: [],
      }),
    };
    const projectRunnerImageService = {
      resolveRunnerImage: jest.fn(),
    };
    const slotRepository = {
      findByTaskId: jest.fn().mockResolvedValue({
        taskId: 'task-1',
        containerId: 'container-1',
      }),
      releaseSlotByTaskId: jest.fn().mockResolvedValue(undefined),
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
      {} as never,
    );

    const result = await service.inspectTaskContainer({
      task: createTask(TaskStatus.inProgress) as never,
      project: createProject() as never,
    });

    expect(slotRepository.releaseSlotByTaskId).toHaveBeenCalledWith('task-1');
    expect(result).toEqual({
      kind: 'missing',
      slotState: 'released-stale',
    });
  });

  it('should apply project-level container runtime overrides when starting containers', async () => {
    const config = {
      isDockerMode: jest.fn().mockReturnValue(true),
      isStrictMode: jest.fn().mockReturnValue(true),
      resolveContainerName: jest.fn().mockReturnValue('ainative-task-task-1'),
      getSandboxProfile: jest.fn().mockReturnValue('preview-web'),
      getRunnerPlatform: jest.fn().mockReturnValue('linux/amd64'),
      getRunnerNetworkMode: jest.fn().mockReturnValue('bridge'),
      shouldExposeSandboxPort: jest.fn().mockReturnValue(true),
      getRunnerExposeHostIp: jest.fn().mockReturnValue('192.168.50.8'),
      getRunnerExposeContainerPort: jest.fn().mockReturnValue(4173),
      usesSandboxEntrypoint: jest.fn().mockReturnValue(true),
      getRunnerWorkspace: jest.fn().mockReturnValue('/workspace'),
      getRunnerManagedVolumeTargets: jest
        .fn()
        .mockReturnValue(['/workspace/backend/node_modules']),
      getRunnerBootstrapEnv: jest.fn().mockReturnValue({
        GITLAB_TOKEN: 'token-value',
      }),
      getRunnerEnv: jest.fn().mockReturnValue({ PORT: '4173' }),
      getRunnerCpuLimit: jest.fn().mockReturnValue(2),
      resourceLimitsForProfile: jest
        .fn()
        .mockReturnValue({ memoryMb: 4096, pidsLimit: 512 }),
      getRunnerReadinessProbeUrl: jest
        .fn()
        .mockReturnValue('http://127.0.0.1:8080/health'),
      getRunnerStartTimeoutMs: jest.fn().mockReturnValue(90000),
      getPreviewBridgeScriptUrl: jest.fn().mockReturnValue(null),
      getSlotHeartbeatMs: jest.fn().mockReturnValue(1000),
      getSlotTtlMs: jest.fn().mockReturnValue(5000),
      shouldAddHostDockerInternalGateway: jest.fn().mockReturnValue(true),
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
    const runnerConfig = {
      version: 1,
      project: {
        id: 'project-1',
        name: 'AINative Web',
        gitUrl: 'git@example.com:ainative/web.git',
        defaultBranch: 'main',
      },
      runtime: {
        platform: 'linux/amd64',
        networkMode: 'bridge',
        listenPort: 4173,
        startTimeoutMs: 90000,
        cpuLimit: 2,
        resourceLimits: {
          memoryMb: 4096,
          pidsLimit: 512,
        },
        env: {
          PORT: '4173',
        },
        sharedVolumes: [
          {
            name: 'ainative-go-mod-cache',
            target: '/go/pkg/mod',
          },
          {
            name: 'ainative-go-build-cache',
            target: '/root/.cache/go-build',
          },
          {
            name: 'ainative-oauth-mcp-abb8c4342af6939a75c773ba',
            target: '/root',
          },
        ],
      },
      orchestration: {
        services: [
          {
            name: 'backend',
            workdir: 'backend',
            command: 'npm run start:dev',
            port: 9000,
          },
        ],
        preview: {
          service: 'backend',
          path: '/',
        },
      },
    };
    const runnerOrchestration = {
      resolvePreviewConfigFromOrchestration: jest
        .fn()
        .mockImplementation((orchestration) => orchestration?.preview ?? null),
      buildEffectiveOrchestration: jest
        .fn()
        .mockReturnValue(runnerConfig.orchestration),
      buildProjectRunnerConfigFileFromOrchestration: jest
        .fn()
        .mockReturnValue(runnerConfig),
      buildManagedVolumeTargetsFromOrchestration: jest
        .fn()
        .mockReturnValue([
          '/workspace/logs',
          '/workspace/backend/node_modules',
        ]),
    };
    const slotRepository = {
      updateContainerRuntimeByTaskId: jest.fn().mockResolvedValue(undefined),
      updateContainerIdByTaskId: jest.fn().mockResolvedValue(undefined),
      renewSlotByTaskId: jest.fn().mockResolvedValue(undefined),
      releaseSlotByTaskId: jest.fn().mockResolvedValue(undefined),
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
      {} as never,
      runnerOrchestration as never,
    );
    jest
      .spyOn(service as never, 'allocatePublishedPort' as never)
      .mockResolvedValue(38080 as never);

    const result = await service.ensureContainer({
      task: createTask(TaskStatus.inProgress) as never,
      project: createProject({
        containerRuntime: {
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
        readOnlyBindMounts: [],
        env: {
          GITLAB_TOKEN: 'token-value',
          PNPM_STORE_DIR: '/var/lib/ainative-runner-cache/pnpm-store',
          npm_config_cache: '/var/lib/ainative-runner-cache/npm-cache',
          YARN_CACHE_FOLDER: '/var/lib/ainative-runner-cache/yarn-cache',
          PORT: '4173',
          AINATIVE_RUNNER_LISTEN_PORT: '4173',
          AINATIVE_RUNNER_CONFIG_JSON: JSON.stringify(runnerConfig),
        },
        cpuLimit: 2,
        resourceLimits: { memoryMb: 4096, pidsLimit: 512 },
        networkMode: 'bridge',
        platform: 'linux/amd64',
        startTimeoutMs: 90000,
        sharedVolumeMounts: [
          {
            name: 'ainative-go-mod-cache',
            target: '/go/pkg/mod',
          },
          {
            name: 'ainative-go-build-cache',
            target: '/root/.cache/go-build',
          },
          {
            name: 'ainative-oauth-mcp-abb8c4342af6939a75c773ba',
            target: '/root',
          },
        ],
        managedVolumeMounts: [
          expect.objectContaining({
            name: 'ainative-task-task-1-workspace-logs',
            target: '/workspace/logs',
            labels: expect.objectContaining({
              'ainative.runner-managed': 'true',
              'ainative.container-name': 'ainative-task-task-1',
              'ainative.project-id': 'project-1',
              'ainative.task-id': 'task-1',
              'ainative.mount-target': '/workspace/logs',
            }),
          }),
          expect.objectContaining({
            name: 'ainative-task-task-1-workspace-backend-node_modules',
            target: '/workspace/backend/node_modules',
            labels: expect.objectContaining({
              'ainative.runner-managed': 'true',
              'ainative.container-name': 'ainative-task-task-1',
              'ainative.project-id': 'project-1',
              'ainative.task-id': 'task-1',
              'ainative.mount-target': '/workspace/backend/node_modules',
            }),
          }),
          expect.objectContaining({
            name: expect.stringMatching(/^ainative-runner-cache-/),
            target: '/var/lib/ainative-runner-cache',
            labels: expect.objectContaining({
              'ainative.cache-kind': 'runner-cache',
              'ainative.project-id': 'project-1',
            }),
          }),
        ],
        publishedPorts: [
          {
            hostIp: '0.0.0.0',
            hostPort: 38080,
            containerPort: 4173,
          },
        ],
        addHostDockerInternalGateway: true,
      }),
    );
    expect(slotRepository.updateContainerRuntimeByTaskId).toHaveBeenCalledWith(
      'task-1',
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
    expect(
      runnerOrchestration.buildProjectRunnerConfigFileFromOrchestration,
    ).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'project-1' }),
      runnerConfig.orchestration,
    );
  });

  it('should use task runner snapshot for workspace-native containers without default fallback', async () => {
    const config = {
      isDockerMode: jest.fn().mockReturnValue(true),
      isStrictMode: jest.fn().mockReturnValue(true),
      resolveContainerName: jest.fn().mockReturnValue('ainative-task-task-1'),
      getSandboxProfile: jest.fn().mockReturnValue('preview-web'),
      getRunnerPlatform: jest.fn().mockReturnValue(null),
      getRunnerNetworkMode: jest.fn().mockReturnValue('bridge'),
      shouldExposeSandboxPort: jest.fn().mockReturnValue(true),
      getRunnerExposeHostIp: jest.fn().mockReturnValue('127.0.0.1'),
      getRunnerExposeContainerPort: jest.fn().mockReturnValue(8080),
      usesSandboxEntrypoint: jest.fn().mockReturnValue(true),
      getRunnerWorkspace: jest.fn().mockReturnValue('/workspace'),
      getRunnerManagedVolumeTargets: jest.fn().mockReturnValue([]),
      getRunnerBootstrapEnv: jest.fn().mockReturnValue({}),
      getRunnerEnv: jest.fn().mockReturnValue({}),
      getRunnerCpuLimit: jest.fn().mockReturnValue(undefined),
      resourceLimitsForProfile: jest.fn().mockReturnValue({}),
      getRunnerReadinessProbeUrl: jest.fn().mockReturnValue(null),
      getRunnerStartTimeoutMs: jest.fn().mockReturnValue(30000),
      getPreviewBridgeScriptUrl: jest.fn().mockReturnValue(null),
      getSlotHeartbeatMs: jest.fn().mockReturnValue(1000),
      getSlotTtlMs: jest.fn().mockReturnValue(5000),
      shouldAddHostDockerInternalGateway: jest.fn().mockReturnValue(true),
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
            containerPort: 8080,
          },
        ],
      }),
    };
    const projectRunnerImageService = {
      resolveRunnerImage: jest.fn().mockResolvedValue('ainative/runner:latest'),
    };
    const slotRepository = {
      updateContainerRuntimeByTaskId: jest.fn().mockResolvedValue(undefined),
      updateContainerIdByTaskId: jest.fn().mockResolvedValue(undefined),
      renewSlotByTaskId: jest.fn().mockResolvedValue(undefined),
      releaseSlotByTaskId: jest.fn().mockResolvedValue(undefined),
    };
    const taskRepository = {
      findById: jest.fn(),
    };
    const snapshotOrchestration = {
      services: [
        {
          name: 'yanxue',
          workdir: 'yanxue',
          command: 'go run ./cmd/server',
          port: 8000,
        },
        {
          name: 'trip-shadow',
          workdir: 'trip-shadow',
          command: 'pnpm dev --host 0.0.0.0',
          port: 5176,
          installCommand: 'pnpm install',
        },
        {
          name: 'trip-miniprogram',
          workdir: 'trip-miniprogram',
          command: 'pnpm dev:h5 --host 0.0.0.0',
          port: 8200,
          installCommand: 'pnpm install',
        },
      ],
      routes: [
        {
          path: '/api/',
          service: 'yanxue',
          upstreamPath: '/',
        },
        {
          path: '/shadow/',
          service: 'trip-shadow',
          upstreamPath: '/',
        },
        {
          path: '/app/',
          service: 'trip-miniprogram',
          upstreamPath: '/',
        },
      ],
      preview: {
        service: 'trip-miniprogram',
        path: '/app/',
      },
      generatedMeta: {
        subRepoFingerprint: 'c06939e79a067578',
        coverageStatus: 'valid',
        verificationStatus: 'passed',
      },
    };
    const runnerConfig = {
      version: 1,
      project: {
        id: 'project-1',
        name: 'AINative Web',
        gitUrl: 'git@example.com:ainative/web.git',
        defaultBranch: 'main',
      },
      runtime: {
        networkMode: 'bridge',
        listenPort: 8080,
        startTimeoutMs: 30000,
      },
      orchestration: snapshotOrchestration,
    };
    const runnerOrchestration = {
      resolvePreviewConfigFromOrchestration: jest
        .fn()
        .mockImplementation((orchestration) => orchestration?.preview ?? null),
      buildEffectiveOrchestration: jest.fn().mockReturnValue({
        services: [
          {
            name: 'ainative-backend',
            workdir: 'ainative-backend',
            command: 'air',
            port: 8000,
          },
        ],
      }),
      normalizeConfigSnapshot: jest
        .fn()
        .mockImplementation((snapshot) => snapshot),
      buildProjectRunnerConfigFileFromOrchestration: jest
        .fn()
        .mockReturnValue(runnerConfig),
      buildManagedVolumeTargetsFromOrchestration: jest
        .fn()
        .mockReturnValue([
          '/workspace/logs',
          '/workspace/trip-shadow/node_modules',
          '/workspace/trip-miniprogram/node_modules',
        ]),
    };
    const service = new ContainerOrchestrationService(
      config as never,
      projectRunnerImageService as never,
      isolatedRunner as never,
      slotRepository as never,
      taskRepository as never,
      {} as never,
      runnerOrchestration as never,
    );
    jest
      .spyOn(service as never, 'allocatePublishedPort' as never)
      .mockResolvedValue(38080 as never);

    await service.ensureContainer({
      task: createTask(TaskStatus.inProgress, {
        configJson: {
          runner: {
            fingerprint: 'runner-fp',
            status: 'ready',
            source: 'projectConfig',
            configSnapshot: snapshotOrchestration,
          },
        },
      } as never) as never,
      project: createProject({
        subtreeMode: 'workspace-native',
        workspaceManaged: true,
        subRepos: [
          {
            prefix: 'yanxue',
            url: 'git@example.com:backend/yanxue.git',
            branch: 'main',
          },
          {
            prefix: 'trip-shadow',
            url: 'git@example.com:frontend/trip-shadow.git',
            branch: 'main',
          },
          {
            prefix: 'trip-miniprogram',
            url: 'git@example.com:frontend/trip-miniprogram.git',
            branch: 'main',
          },
        ],
      }) as never,
      worktreePath: '/tmp/worktrees/wk-task-1',
    });

    expect(runnerOrchestration.normalizeConfigSnapshot).toHaveBeenCalledWith(
      snapshotOrchestration,
    );
    expect(runnerOrchestration.buildEffectiveOrchestration).not.toHaveBeenCalled();
    expect(
      runnerOrchestration.buildProjectRunnerConfigFileFromOrchestration,
    ).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'project-1' }),
      snapshotOrchestration,
    );
    expect(isolatedRunner.run).toHaveBeenCalledWith(
      expect.objectContaining({
        env: expect.objectContaining({
          PNPM_STORE_DIR: '/var/lib/ainative-runner-cache/pnpm-store',
          npm_config_cache: '/var/lib/ainative-runner-cache/npm-cache',
          YARN_CACHE_FOLDER: '/var/lib/ainative-runner-cache/yarn-cache',
          AINATIVE_RUNNER_CONFIG_JSON: JSON.stringify(runnerConfig),
        }),
        managedVolumeMounts: expect.arrayContaining([
          expect.objectContaining({
            name: expect.stringMatching(/^ainative-deps-/),
            target: '/workspace/trip-shadow/node_modules',
            labels: expect.objectContaining({
              'ainative.cache-kind': 'node_modules',
              'ainative.project-id': 'project-1',
              'ainative.repo-prefix': 'trip-shadow',
              'ainative.runtime-platform': 'default',
            }),
          }),
          expect.objectContaining({
            name: expect.stringMatching(/^ainative-deps-/),
            target: '/workspace/trip-miniprogram/node_modules',
            labels: expect.objectContaining({
              'ainative.cache-kind': 'node_modules',
              'ainative.project-id': 'project-1',
              'ainative.repo-prefix': 'trip-miniprogram',
              'ainative.runtime-platform': 'default',
            }),
          }),
          expect.objectContaining({
            target: '/var/lib/ainative-runner-cache',
            name: expect.stringMatching(/^ainative-runner-cache-/),
          }),
        ]),
      }),
    );
  });

  it('should reuse the same shared node_modules cache volume for identical workspace-native lockfiles', async () => {
    const config = {
      isDockerMode: jest.fn().mockReturnValue(true),
      isStrictMode: jest.fn().mockReturnValue(true),
      resolveContainerName: jest.fn().mockReturnValue('ainative-task-task-1'),
      getSandboxProfile: jest.fn().mockReturnValue('preview-web'),
      getRunnerPlatform: jest.fn().mockReturnValue('linux/amd64'),
      getRunnerNetworkMode: jest.fn().mockReturnValue('bridge'),
      shouldExposeSandboxPort: jest.fn().mockReturnValue(true),
      getRunnerExposeHostIp: jest.fn().mockReturnValue('127.0.0.1'),
      getRunnerExposeContainerPort: jest.fn().mockReturnValue(8080),
      usesSandboxEntrypoint: jest.fn().mockReturnValue(true),
      getRunnerWorkspace: jest.fn().mockReturnValue('/workspace'),
      getRunnerManagedVolumeTargets: jest.fn().mockReturnValue([]),
      getRunnerBootstrapEnv: jest.fn().mockReturnValue({}),
      getRunnerEnv: jest.fn().mockReturnValue({}),
      getRunnerDependencyCacheEnv: jest.fn().mockReturnValue({
        PNPM_STORE_DIR: '/var/lib/ainative-runner-cache/pnpm-store',
        npm_config_cache: '/var/lib/ainative-runner-cache/npm-cache',
        YARN_CACHE_FOLDER: '/var/lib/ainative-runner-cache/yarn-cache',
      }),
      getRunnerCpuLimit: jest.fn().mockReturnValue(undefined),
      resourceLimitsForProfile: jest.fn().mockReturnValue({}),
      getRunnerReadinessProbeUrl: jest.fn().mockReturnValue(null),
      getRunnerStartTimeoutMs: jest.fn().mockReturnValue(30000),
      getPreviewBridgeScriptUrl: jest.fn().mockReturnValue(null),
      getSlotHeartbeatMs: jest.fn().mockReturnValue(1000),
      getSlotTtlMs: jest.fn().mockReturnValue(5000),
      shouldAddHostDockerInternalGateway: jest.fn().mockReturnValue(true),
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
            containerPort: 8080,
          },
        ],
      }),
    };
    const projectRunnerImageService = {
      resolveRunnerImage: jest.fn().mockResolvedValue('ainative/runner:latest'),
    };
    const slotRepository = {
      updateContainerRuntimeByTaskId: jest.fn().mockResolvedValue(undefined),
      updateContainerIdByTaskId: jest.fn().mockResolvedValue(undefined),
      renewSlotByTaskId: jest.fn().mockResolvedValue(undefined),
      releaseSlotByTaskId: jest.fn().mockResolvedValue(undefined),
    };
    const taskRepository = {
      findById: jest.fn(),
    };
    const snapshotOrchestration = {
      services: [
        {
          name: 'trip-shadow',
          workdir: 'trip-shadow',
          command: 'pnpm dev --host 0.0.0.0',
          port: 5176,
          installCommand: 'pnpm install',
        },
      ],
      routes: [
        {
          path: '/shadow/',
          service: 'trip-shadow',
          upstreamPath: '/',
        },
      ],
      preview: {
        service: 'trip-shadow',
        path: '/shadow/',
      },
    };
    const runnerOrchestration = {
      resolvePreviewConfigFromOrchestration: jest
        .fn()
        .mockImplementation((orchestration) => orchestration?.preview ?? null),
      buildEffectiveOrchestration: jest.fn(),
      normalizeConfigSnapshot: jest
        .fn()
        .mockImplementation((snapshot) => snapshot),
      buildProjectRunnerConfigFileFromOrchestration: jest.fn().mockReturnValue({
        version: 1,
        project: {
          id: 'project-1',
          name: 'AINative Web',
          gitUrl: 'git@example.com:ainative/web.git',
          defaultBranch: 'main',
        },
        runtime: {
          networkMode: 'bridge',
          listenPort: 8080,
          startTimeoutMs: 30000,
        },
        orchestration: snapshotOrchestration,
      }),
      buildManagedVolumeTargetsFromOrchestration: jest.fn().mockReturnValue([
        '/workspace/logs',
        '/workspace/trip-shadow/node_modules',
        '/var/lib/ainative-runner-cache',
      ]),
    };
    const service = new ContainerOrchestrationService(
      config as never,
      projectRunnerImageService as never,
      isolatedRunner as never,
      slotRepository as never,
      taskRepository as never,
      {} as never,
      runnerOrchestration as never,
    );
    jest
      .spyOn(service as never, 'allocatePublishedPort' as never)
      .mockResolvedValue(38080 as never);

    const readFileSpy = jest
      .spyOn(require('node:fs/promises'), 'readFile')
      .mockImplementation((filePath: any) => {
        const file = String(filePath);
        if (file.endsWith('trip-shadow/pnpm-lock.yaml')) {
          return Promise.resolve('lockfile-v1') as never;
        }
        return Promise.reject(new Error(`unexpected read ${file}`)) as never;
      });

    const taskOne = createTask(TaskStatus.inProgress, {
      id: 'task-1',
      configJson: {
        runner: {
          fingerprint: 'runner-fp',
          status: 'ready',
          source: 'projectConfig',
          configSnapshot: snapshotOrchestration,
        },
      },
    });
    const taskTwo = createTask(TaskStatus.inProgress, {
      id: 'task-2',
      gitWorktree: 'wk-task-2',
      configJson: {
        runner: {
          fingerprint: 'runner-fp',
          status: 'ready',
          source: 'projectConfig',
          configSnapshot: snapshotOrchestration,
        },
      },
    });
    const project = createProject({
      subtreeMode: 'workspace-native',
      workspaceManaged: true,
      subRepos: [
        {
          prefix: 'trip-shadow',
          url: 'git@example.com:frontend/trip-shadow.git',
          branch: 'main',
        },
      ],
    });

    await service.ensureContainer({
      task: taskOne as never,
      project: project as never,
      worktreePath: '/tmp/worktrees/wk-task-1',
    });
    await service.ensureContainer({
      task: taskTwo as never,
      project: project as never,
      worktreePath: '/tmp/worktrees/wk-task-2',
    });

    const firstMounts = isolatedRunner.run.mock.calls[0][0].managedVolumeMounts;
    const secondMounts = isolatedRunner.run.mock.calls[1][0].managedVolumeMounts;
    const firstNodeModules = firstMounts.find(
      (mount: { target: string }) =>
        mount.target === '/workspace/trip-shadow/node_modules',
    );
    const secondNodeModules = secondMounts.find(
      (mount: { target: string }) =>
        mount.target === '/workspace/trip-shadow/node_modules',
    );
    const firstRunnerCache = firstMounts.find(
      (mount: { target: string }) =>
        mount.target === '/var/lib/ainative-runner-cache',
    );
    const secondRunnerCache = secondMounts.find(
      (mount: { target: string }) =>
        mount.target === '/var/lib/ainative-runner-cache',
    );

    expect(firstNodeModules?.name).toBe(secondNodeModules?.name);
    expect(firstNodeModules?.labels).toEqual(
      expect.objectContaining({
        'ainative.cache-kind': 'node_modules',
        'ainative.lockfile-digest': expect.any(String),
        'ainative.runtime-platform': 'linux/amd64',
      }),
    );
    expect(firstRunnerCache?.name).toBe(secondRunnerCache?.name);
    expect(firstRunnerCache?.labels).toEqual(
      expect.objectContaining({
        'ainative.cache-kind': 'runner-cache',
        'ainative.runtime-platform': 'linux/amd64',
      }),
    );

    readFileSpy.mockRestore();
  });

  it('should fallback to project runner config when task snapshot is stale and project config is runnable', async () => {
    const config = {
      isDockerMode: jest.fn().mockReturnValue(true),
      isStrictMode: jest.fn().mockReturnValue(true),
      resolveContainerName: jest.fn().mockReturnValue('ainative-task-task-1'),
      getSandboxProfile: jest.fn().mockReturnValue('preview-web'),
      getRunnerPlatform: jest.fn().mockReturnValue(null),
      getRunnerNetworkMode: jest.fn().mockReturnValue('bridge'),
      shouldExposeSandboxPort: jest.fn().mockReturnValue(true),
      getRunnerExposeHostIp: jest.fn().mockReturnValue('127.0.0.1'),
      getRunnerExposeContainerPort: jest.fn().mockReturnValue(8080),
      usesSandboxEntrypoint: jest.fn().mockReturnValue(true),
      getRunnerWorkspace: jest.fn().mockReturnValue('/workspace'),
      getRunnerManagedVolumeTargets: jest.fn().mockReturnValue([]),
      getRunnerBootstrapEnv: jest.fn().mockReturnValue({}),
      getRunnerEnv: jest.fn().mockReturnValue({}),
      getRunnerCpuLimit: jest.fn().mockReturnValue(undefined),
      resourceLimitsForProfile: jest.fn().mockReturnValue({}),
      getRunnerReadinessProbeUrl: jest.fn().mockReturnValue(null),
      getRunnerStartTimeoutMs: jest.fn().mockReturnValue(30000),
      getPreviewBridgeScriptUrl: jest.fn().mockReturnValue(null),
      getSlotHeartbeatMs: jest.fn().mockReturnValue(1000),
      getSlotTtlMs: jest.fn().mockReturnValue(5000),
      shouldAddHostDockerInternalGateway: jest.fn().mockReturnValue(true),
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
            containerPort: 8080,
          },
        ],
      }),
    };
    const projectRunnerImageService = {
      resolveRunnerImage: jest.fn().mockResolvedValue('ainative/runner:latest'),
    };
    const slotRepository = {
      updateContainerRuntimeByTaskId: jest.fn().mockResolvedValue(undefined),
      updateContainerIdByTaskId: jest.fn().mockResolvedValue(undefined),
      renewSlotByTaskId: jest.fn().mockResolvedValue(undefined),
      releaseSlotByTaskId: jest.fn().mockResolvedValue(undefined),
    };
    const taskRepository = {
      findById: jest.fn(),
    };
    const businessLineRepository = {
      findById: jest.fn().mockResolvedValue({
        id: 'business-line-1',
        configJson: {
          runnerConfigStatus: 'ready',
          runnerFingerprint: 'runner-fp',
          runnerConfigCache: {
            services: [
              {
                name: 'yanxue',
                workdir: 'yanxue',
                command: 'go run ./cmd/server',
                port: 8000,
              },
            ],
            routes: [
              {
                path: '/api/',
                action: 'proxy',
                match: 'prefix',
                service: 'yanxue',
              },
            ],
            preview: {
              service: 'yanxue',
              path: '/api/',
            },
            generatedMeta: {
              subRepoFingerprint: '00c24e350423367e',
              coverageStatus: 'valid',
              verificationStatus: 'passed',
            },
          },
          runnerConfigCacheMeta: {
            source: 'ai-full-scan',
            generatedAt: '2026-06-01T00:00:00.000Z',
            subRepoFingerprint: '00c24e350423367e',
            coverageStatus: 'valid',
            verificationStatus: 'passed',
          },
        },
      }),
    };
    const runnerConfig = {
      version: 1,
      project: { id: 'project-1', name: 'AINative Web', defaultBranch: 'main' },
      runtime: { networkMode: 'bridge', listenPort: 8080, startTimeoutMs: 30000 },
      orchestration: {
        services: [
          {
            name: 'yanxue',
            workdir: 'yanxue',
            command: 'go run ./cmd/server',
            port: 8000,
          },
        ],
        routes: [
          {
            path: '/api/',
            action: 'proxy',
            match: 'prefix',
            service: 'yanxue',
          },
        ],
        preview: { service: 'yanxue', path: '/api/' },
      },
    };
    const runnerOrchestration = {
      resolvePreviewConfigFromOrchestration: jest
        .fn()
        .mockImplementation((orchestration) => orchestration?.preview ?? null),
      normalizeConfigSnapshot: jest.fn().mockImplementation((snapshot) => snapshot),
      buildProjectRunnerConfigFileFromOrchestration: jest
        .fn()
        .mockReturnValue(runnerConfig),
      buildManagedVolumeTargetsFromOrchestration: jest.fn().mockReturnValue([]),
    };
    const service = new ContainerOrchestrationService(
      config as never,
      projectRunnerImageService as never,
      isolatedRunner as never,
      slotRepository as never,
      taskRepository as never,
      {} as never,
      runnerOrchestration as never,
      businessLineRepository as never,
    );
    jest
      .spyOn(service as never, 'allocatePublishedPort' as never)
      .mockResolvedValue(38080 as never);

    await service.ensureContainer({
      task: createTask(TaskStatus.inProgress, {
        configJson: {
          runner: {
            fingerprint: 'runner-fp',
            status: 'ready',
            source: 'projectConfig',
            configSnapshot: {
              services: [
                {
                  name: 'yanxue',
                  workdir: 'yanxue',
                  command: 'go run ./cmd/server',
                  port: 8000,
                },
              ],
              generatedMeta: {
                coverageStatus: 'valid',
                verificationStatus: 'passed',
              },
            },
          },
        },
      } as never) as never,
      project: createProject({
        subtreeMode: 'workspace-native',
        workspaceManaged: true,
        subRepos: [
          {
            prefix: 'yanxue',
            url: 'git@example.com:backend/yanxue.git',
            branch: 'main',
          },
        ],
      }) as never,
      worktreePath: '/tmp/worktrees/wk-task-1',
    });

    expect(businessLineRepository.findById).not.toHaveBeenCalled();
    expect(
      runnerOrchestration.buildProjectRunnerConfigFileFromOrchestration,
    ).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'project-1' }),
      expect.objectContaining({
        services: expect.arrayContaining([
          expect.objectContaining({
            name: 'yanxue',
          }),
        ]),
      }),
    );
  });

  it('should fallback to verified project runner config when task snapshot is unavailable', async () => {
    const config = {
      isDockerMode: jest.fn().mockReturnValue(true),
      isStrictMode: jest.fn().mockReturnValue(true),
      resolveContainerName: jest.fn().mockReturnValue('ainative-task-task-1'),
      getSandboxProfile: jest.fn().mockReturnValue('preview-web'),
      getRunnerPlatform: jest.fn().mockReturnValue(null),
      getRunnerNetworkMode: jest.fn().mockReturnValue('bridge'),
      shouldExposeSandboxPort: jest.fn().mockReturnValue(true),
      getRunnerExposeHostIp: jest.fn().mockReturnValue('127.0.0.1'),
      getRunnerExposeContainerPort: jest.fn().mockReturnValue(8080),
      usesSandboxEntrypoint: jest.fn().mockReturnValue(true),
      getRunnerWorkspace: jest.fn().mockReturnValue('/workspace'),
      getRunnerManagedVolumeTargets: jest.fn().mockReturnValue([]),
      getRunnerBootstrapEnv: jest.fn().mockReturnValue({}),
      getRunnerEnv: jest.fn().mockReturnValue({}),
      getRunnerCpuLimit: jest.fn().mockReturnValue(undefined),
      resourceLimitsForProfile: jest.fn().mockReturnValue({}),
      getRunnerReadinessProbeUrl: jest.fn().mockReturnValue(null),
      getRunnerStartTimeoutMs: jest.fn().mockReturnValue(30000),
      getPreviewBridgeScriptUrl: jest.fn().mockReturnValue(null),
      getSlotHeartbeatMs: jest.fn().mockReturnValue(1000),
      getSlotTtlMs: jest.fn().mockReturnValue(5000),
      shouldAddHostDockerInternalGateway: jest.fn().mockReturnValue(true),
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
            containerPort: 8080,
          },
        ],
      }),
    };
    const projectRunnerImageService = {
      resolveRunnerImage: jest.fn().mockResolvedValue('ainative/runner:latest'),
    };
    const slotRepository = {
      updateContainerRuntimeByTaskId: jest.fn().mockResolvedValue(undefined),
      updateContainerIdByTaskId: jest.fn().mockResolvedValue(undefined),
      renewSlotByTaskId: jest.fn().mockResolvedValue(undefined),
      releaseSlotByTaskId: jest.fn().mockResolvedValue(undefined),
    };
    const taskRepository = {
      findById: jest.fn(),
    };
    const runnerConfig = {
      version: 1,
      project: { id: 'project-1', name: 'AINative Web', defaultBranch: 'main' },
      runtime: { networkMode: 'bridge', listenPort: 8080, startTimeoutMs: 30000 },
      orchestration: {
        services: [
          {
            name: 'yanxue',
            workdir: 'yanxue',
            command: 'go run ./cmd/server',
            port: 8000,
          },
        ],
        routes: [
          {
            path: '/api/',
            action: 'proxy',
            match: 'prefix',
            service: 'yanxue',
          },
        ],
        preview: { service: 'yanxue', path: '/api/' },
        generatedMeta: {
          subRepoFingerprint: '00c24e350423367e',
          coverageStatus: 'valid',
          verificationStatus: 'passed',
          runnerFingerprint: 'runner-fp',
        },
      },
    };
    const runnerOrchestration = {
      resolvePreviewConfigFromOrchestration: jest
        .fn()
        .mockImplementation((orchestration) => orchestration?.preview ?? null),
      normalizeConfigSnapshot: jest.fn().mockImplementation((snapshot) => snapshot),
      buildProjectRunnerConfigFileFromOrchestration: jest
        .fn()
        .mockReturnValue(runnerConfig),
      buildManagedVolumeTargetsFromOrchestration: jest.fn().mockReturnValue([]),
    };
    const service = new ContainerOrchestrationService(
      config as never,
      projectRunnerImageService as never,
      isolatedRunner as never,
      slotRepository as never,
      taskRepository as never,
      {} as never,
      runnerOrchestration as never,
      { findById: jest.fn().mockResolvedValue(null) } as never,
    );
    jest
      .spyOn(service as never, 'allocatePublishedPort' as never)
      .mockResolvedValue(38080 as never);

    await service.ensureContainer({
      task: createTask(TaskStatus.inProgress, {
        configJson: {
          runner: {
            fingerprint: 'runner-fp',
            status: 'unavailable',
            source: 'unavailableGenerationFailed',
          },
        },
      } as never) as never,
      project: createProject({
        subtreeMode: 'workspace-native',
        workspaceManaged: true,
        subRepos: [
          {
            prefix: 'yanxue',
            url: 'git@example.com:backend/yanxue.git',
            branch: 'main',
          },
        ],
        containerRuntime: {
          runnerOrchestration: runnerConfig.orchestration,
        },
      }) as never,
      worktreePath: '/tmp/worktrees/wk-task-1',
    });

    expect(
      runnerOrchestration.buildProjectRunnerConfigFileFromOrchestration,
    ).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'project-1' }),
      expect.objectContaining({
        generatedMeta: expect.objectContaining({
          verificationStatus: 'passed',
          runnerFingerprint: 'runner-fp',
        }),
      }),
    );
  });

  it('should prefer project preview orchestration when task snapshot is stale but project config remains runnable', async () => {
    const config = {
      isDockerMode: jest.fn().mockReturnValue(true),
      isStrictMode: jest.fn().mockReturnValue(true),
      resolveContainerName: jest.fn().mockReturnValue('ainative-task-task-1'),
      getSandboxProfile: jest.fn().mockReturnValue('preview-web'),
      getRunnerPlatform: jest.fn().mockReturnValue(null),
      getRunnerNetworkMode: jest.fn().mockReturnValue('bridge'),
      shouldExposeSandboxPort: jest.fn().mockReturnValue(true),
      getRunnerExposeHostIp: jest.fn().mockReturnValue('127.0.0.1'),
      getRunnerExposeContainerPort: jest.fn().mockReturnValue(8080),
      usesSandboxEntrypoint: jest.fn().mockReturnValue(true),
      getRunnerWorkspace: jest.fn().mockReturnValue('/workspace'),
      getRunnerManagedVolumeTargets: jest.fn().mockReturnValue([]),
      getRunnerBootstrapEnv: jest.fn().mockReturnValue({}),
      getRunnerEnv: jest.fn().mockReturnValue({}),
      getRunnerCpuLimit: jest.fn().mockReturnValue(undefined),
      resourceLimitsForProfile: jest.fn().mockReturnValue({}),
      getRunnerReadinessProbeUrl: jest.fn().mockReturnValue(null),
      getRunnerStartTimeoutMs: jest.fn().mockReturnValue(30000),
      getPreviewBridgeScriptUrl: jest.fn().mockReturnValue(null),
      getSlotHeartbeatMs: jest.fn().mockReturnValue(1000),
      getSlotTtlMs: jest.fn().mockReturnValue(5000),
      shouldAddHostDockerInternalGateway: jest.fn().mockReturnValue(true),
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
            containerPort: 8080,
          },
        ],
      }),
    };
    const projectRunnerImageService = {
      resolveRunnerImage: jest.fn().mockResolvedValue('ainative/runner:latest'),
    };
    const slotRepository = {
      updateContainerRuntimeByTaskId: jest.fn().mockResolvedValue(undefined),
      updateContainerIdByTaskId: jest.fn().mockResolvedValue(undefined),
      renewSlotByTaskId: jest.fn().mockResolvedValue(undefined),
      releaseSlotByTaskId: jest.fn().mockResolvedValue(undefined),
    };
    const taskRepository = {
      findById: jest.fn(),
    };
    const businessLineRepository = {
      findById: jest.fn().mockResolvedValue({
        id: 'business-line-1',
        configJson: {
          runnerConfigStatus: 'ready',
          runnerFingerprint: 'runner-fp-new',
          runnerConfigCache: {
            services: [
              {
                name: 'yanxue',
                workdir: 'yanxue',
                command: 'go run ./cmd/server',
                port: 8000,
              },
            ],
            routes: [
              {
                path: '/api/',
                action: 'proxy',
                match: 'prefix',
                service: 'yanxue',
              },
            ],
            preview: {
              service: 'yanxue',
              path: '/api/',
            },
            generatedMeta: {
              subRepoFingerprint: '00c24e350423367e',
              coverageStatus: 'valid',
              verificationStatus: 'passed',
            },
          },
          runnerConfigCacheMeta: {
            source: 'ai-full-scan',
            generatedAt: '2026-06-01T00:00:00.000Z',
            subRepoFingerprint: '00c24e350423367e',
            coverageStatus: 'valid',
            verificationStatus: 'passed',
          },
        },
      }),
    };
    const runnerOrchestration = {
      resolvePreviewConfigFromOrchestration: jest
        .fn()
        .mockImplementation((orchestration) => orchestration?.preview ?? null),
      normalizeConfigSnapshot: jest.fn().mockImplementation((snapshot) => snapshot),
      buildProjectRunnerConfigFileFromOrchestration: jest
        .fn()
        .mockImplementation((project, orchestration) => ({
          version: 1,
          project: { id: project.id, name: project.name, defaultBranch: project.defaultBranch },
          runtime: { networkMode: 'bridge', listenPort: 8080, startTimeoutMs: 30000 },
          orchestration,
        })),
      buildManagedVolumeTargetsFromOrchestration: jest.fn().mockReturnValue([]),
    };
    const service = new ContainerOrchestrationService(
      config as never,
      projectRunnerImageService as never,
      isolatedRunner as never,
      slotRepository as never,
      taskRepository as never,
      {} as never,
      runnerOrchestration as never,
      businessLineRepository as never,
    );

    jest
      .spyOn(service as never, 'allocatePublishedPort' as never)
      .mockResolvedValue(38080 as never);

    await service.ensureContainer({
      task: createTask(TaskStatus.inProgress, {
        configJson: {
          runner: {
            fingerprint: 'runner-fp-old',
            status: 'ready',
            source: 'projectConfig',
            configSnapshot: {
              services: [
                {
                  name: 'yanxue',
                  workdir: 'yanxue',
                  command: 'go run ./cmd/server',
                  port: 8000,
                },
              ],
              generatedMeta: {
                subRepoFingerprint: 'different-structure',
                coverageStatus: 'valid',
                verificationStatus: 'passed',
              },
            },
          },
        },
      } as never) as never,
      project: createProject({
        subtreeMode: 'workspace-native',
        workspaceManaged: true,
        subRepos: [
          {
            prefix: 'yanxue',
            url: 'git@example.com:backend/yanxue.git',
            branch: 'main',
          },
        ],
      }) as never,
      worktreePath: '/tmp/worktrees/wk-task-1',
    });

    expect(runnerOrchestration.buildProjectRunnerConfigFileFromOrchestration).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'project-1' }),
      expect.objectContaining({
        services: expect.arrayContaining([
          expect.objectContaining({
            name: 'yanxue',
          }),
        ]),
      }),
    );
    expect(isolatedRunner.run).toHaveBeenCalledWith(
      expect.objectContaining({
        command: ['/usr/local/bin/ainative-runner-entrypoint'],
        env: expect.objectContaining({
          AINATIVE_RUNNER_CONFIG_JSON: expect.stringContaining('"yanxue"'),
        }),
      }),
    );
  });

  it('should replace a running container when the desired platform changes', async () => {
    const config = {
      isDockerMode: jest.fn().mockReturnValue(true),
      isStrictMode: jest.fn().mockReturnValue(true),
      resolveContainerName: jest.fn().mockReturnValue('ainative-task-task-1'),
      getSandboxProfile: jest.fn().mockReturnValue('preview-web'),
      getRunnerPlatform: jest.fn().mockReturnValue('linux/amd64'),
      getRunnerNetworkMode: jest.fn().mockReturnValue('bridge'),
      shouldExposeSandboxPort: jest.fn().mockReturnValue(true),
      getRunnerExposeHostIp: jest.fn().mockReturnValue('192.168.50.8'),
      getRunnerExposeContainerPort: jest.fn().mockReturnValue(4173),
      usesSandboxEntrypoint: jest.fn().mockReturnValue(true),
      getRunnerWorkspace: jest.fn().mockReturnValue('/workspace'),
      getRunnerManagedVolumeTargets: jest.fn().mockReturnValue([]),
      getRunnerBootstrapEnv: jest.fn().mockReturnValue({}),
      getRunnerEnv: jest.fn().mockReturnValue({}),
      getRunnerCpuLimit: jest.fn().mockReturnValue(undefined),
      resourceLimitsForProfile: jest.fn().mockReturnValue({}),
      getRunnerReadinessProbeUrl: jest.fn().mockReturnValue(null),
      getRunnerStartTimeoutMs: jest.fn().mockReturnValue(30000),
      getPreviewBridgeScriptUrl: jest.fn().mockReturnValue(null),
      getSlotHeartbeatMs: jest.fn().mockReturnValue(1000),
      getSlotTtlMs: jest.fn().mockReturnValue(5000),
      shouldAddHostDockerInternalGateway: jest.fn().mockReturnValue(true),
      getRunnerExposePortRange: jest
        .fn()
        .mockReturnValue({ start: 38080, end: 38080 }),
    };
    const isolatedRunner = {
      inspect: jest.fn().mockResolvedValue({
        id: 'container-old',
        status: 'running',
        running: true,
        image: 'ainative/runner:fresh',
        platform: 'linux/arm64/v8',
        publishedPorts: [
          {
            hostIp: '0.0.0.0',
            hostPort: 38080,
            containerPort: 4173,
          },
        ],
      }),
      remove: jest.fn().mockResolvedValue(undefined),
      run: jest.fn().mockResolvedValue({
        containerId: 'container-new',
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
      updateContainerRuntimeByTaskId: jest.fn().mockResolvedValue(undefined),
      updateContainerIdByTaskId: jest.fn().mockResolvedValue(undefined),
      renewSlotByTaskId: jest.fn().mockResolvedValue(undefined),
      releaseSlotByTaskId: jest.fn().mockResolvedValue(undefined),
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
      {} as never,
      createRunnerOrchestration() as never,
    );
    jest
      .spyOn(service as never, 'allocatePublishedPort' as never)
      .mockResolvedValue(38080 as never);

    const result = await service.ensureContainer({
      task: createTask(TaskStatus.inProgress) as never,
      project: createProject() as never,
      worktreePath: '/tmp/worktrees/wk-task-1',
    });

    expect(result).toEqual({ containerId: 'container-new' });
    expect(isolatedRunner.remove).toHaveBeenCalledWith(
      'ainative-task-task-1',
      expect.objectContaining({
        preserveManagedVolumeTargets: expect.any(Function),
      }),
    );
    expect(isolatedRunner.run).toHaveBeenCalledWith(
      expect.objectContaining({
        image: 'ainative/runner:fresh',
        platform: 'linux/amd64',
      }),
    );
  });

  it('should unpause a paused runner container and reuse it when the image matches', async () => {
    const config = {
      isDockerMode: jest.fn().mockReturnValue(true),
      isStrictMode: jest.fn().mockReturnValue(true),
      resolveContainerName: jest.fn().mockReturnValue('ainative-task-task-1'),
      getSandboxProfile: jest.fn().mockReturnValue('preview-web'),
      getRunnerPlatform: jest.fn().mockReturnValue('linux/amd64'),
      getRunnerNetworkMode: jest.fn().mockReturnValue('bridge'),
      shouldExposeSandboxPort: jest.fn().mockReturnValue(true),
      getRunnerExposeHostIp: jest.fn().mockReturnValue('192.168.50.8'),
      getRunnerExposeContainerPort: jest.fn().mockReturnValue(4173),
      usesSandboxEntrypoint: jest.fn().mockReturnValue(true),
      getRunnerWorkspace: jest.fn().mockReturnValue('/workspace'),
      getRunnerManagedVolumeTargets: jest.fn().mockReturnValue([]),
      getRunnerBootstrapEnv: jest.fn().mockReturnValue({}),
      getRunnerEnv: jest.fn().mockReturnValue({}),
      getRunnerCpuLimit: jest.fn().mockReturnValue(undefined),
      resourceLimitsForProfile: jest.fn().mockReturnValue({}),
      getRunnerReadinessProbeUrl: jest.fn().mockReturnValue(null),
      getRunnerStartTimeoutMs: jest.fn().mockReturnValue(30000),
      getPreviewBridgeScriptUrl: jest.fn().mockReturnValue(null),
      getSlotHeartbeatMs: jest.fn().mockReturnValue(1000),
      getSlotTtlMs: jest.fn().mockReturnValue(5000),
      shouldAddHostDockerInternalGateway: jest.fn().mockReturnValue(true),
      getRunnerExposePortRange: jest
        .fn()
        .mockReturnValue({ start: 38080, end: 38080 }),
    };
    const pausedInspection = {
      id: 'container-paused',
      status: 'paused',
      running: false,
      paused: true,
      image: 'ainative/runner:fresh',
      platform: 'linux/amd64',
      publishedPorts: [
        {
          hostIp: '0.0.0.0',
          hostPort: 38080,
          containerPort: 4173,
        },
      ],
    };
    const runningInspection = {
      ...pausedInspection,
      status: 'running',
      running: true,
      paused: false,
    };
    const isolatedRunner = {
      inspect: jest
        .fn()
        .mockResolvedValueOnce(pausedInspection)
        .mockResolvedValueOnce(runningInspection),
      unpause: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn(),
      run: jest.fn(),
    };
    const projectRunnerImageService = {
      resolveRunnerImage: jest.fn().mockResolvedValue('ainative/runner:fresh'),
    };
    const slotRepository = {
      updateContainerRuntimeByTaskId: jest.fn().mockResolvedValue(undefined),
      updateContainerIdByTaskId: jest.fn().mockResolvedValue(undefined),
      renewSlotByTaskId: jest.fn().mockResolvedValue(undefined),
      releaseSlotByTaskId: jest.fn().mockResolvedValue(undefined),
      findByTaskId: jest.fn().mockResolvedValue(null),
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
      {} as never,
      createRunnerOrchestration() as never,
    );
    jest
      .spyOn(service as never, 'allocatePublishedPort' as never)
      .mockResolvedValue(38080 as never);

    const result = await service.ensureContainer({
      task: createTask(TaskStatus.inProgress) as never,
      project: createProject() as never,
      worktreePath: '/tmp/worktrees/wk-task-1',
    });

    expect(isolatedRunner.unpause).toHaveBeenCalledWith('ainative-task-task-1');
    expect(isolatedRunner.inspect).toHaveBeenCalledTimes(2);
    expect(isolatedRunner.run).not.toHaveBeenCalled();
    expect(result.containerId).toBe('container-paused');
  });

  it('should remove a non-running runner container before recreating it', async () => {
    const config = {
      isDockerMode: jest.fn().mockReturnValue(true),
      isStrictMode: jest.fn().mockReturnValue(true),
      resolveContainerName: jest.fn().mockReturnValue('ainative-task-task-1'),
      getSandboxProfile: jest.fn().mockReturnValue('preview-web'),
      getRunnerPlatform: jest.fn().mockReturnValue('linux/amd64'),
      getRunnerNetworkMode: jest.fn().mockReturnValue('bridge'),
      shouldExposeSandboxPort: jest.fn().mockReturnValue(true),
      getRunnerExposeHostIp: jest.fn().mockReturnValue('192.168.50.8'),
      getRunnerExposeContainerPort: jest.fn().mockReturnValue(4173),
      usesSandboxEntrypoint: jest.fn().mockReturnValue(true),
      getRunnerWorkspace: jest.fn().mockReturnValue('/workspace'),
      getRunnerManagedVolumeTargets: jest.fn().mockReturnValue([]),
      getRunnerBootstrapEnv: jest.fn().mockReturnValue({}),
      getRunnerEnv: jest.fn().mockReturnValue({}),
      getRunnerCpuLimit: jest.fn().mockReturnValue(undefined),
      resourceLimitsForProfile: jest.fn().mockReturnValue({}),
      getRunnerReadinessProbeUrl: jest.fn().mockReturnValue(null),
      getRunnerStartTimeoutMs: jest.fn().mockReturnValue(30000),
      getPreviewBridgeScriptUrl: jest.fn().mockReturnValue(null),
      getSlotHeartbeatMs: jest.fn().mockReturnValue(1000),
      getSlotTtlMs: jest.fn().mockReturnValue(5000),
      shouldAddHostDockerInternalGateway: jest.fn().mockReturnValue(true),
      getRunnerExposePortRange: jest
        .fn()
        .mockReturnValue({ start: 38080, end: 38080 }),
    };
    const isolatedRunner = {
      inspect: jest.fn().mockResolvedValue({
        id: 'container-exited',
        status: 'exited',
        running: false,
        paused: false,
        image: 'ainative/runner:fresh',
        platform: 'linux/amd64',
        publishedPorts: [],
      }),
      remove: jest.fn().mockResolvedValue(undefined),
      run: jest.fn().mockResolvedValue({
        containerId: 'container-new',
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
      updateContainerRuntimeByTaskId: jest.fn().mockResolvedValue(undefined),
      updateContainerIdByTaskId: jest.fn().mockResolvedValue(undefined),
      renewSlotByTaskId: jest.fn().mockResolvedValue(undefined),
      releaseSlotByTaskId: jest.fn().mockResolvedValue(undefined),
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
      {} as never,
      createRunnerOrchestration() as never,
    );
    jest
      .spyOn(service as never, 'allocatePublishedPort' as never)
      .mockResolvedValue(38080 as never);

    const result = await service.ensureContainer({
      task: createTask(TaskStatus.inProgress) as never,
      project: createProject() as never,
      worktreePath: '/tmp/worktrees/wk-task-1',
    });

    expect(isolatedRunner.remove).toHaveBeenCalledWith('ainative-task-task-1');
    expect(isolatedRunner.run).toHaveBeenCalledWith(
      expect.objectContaining({
        containerName: 'ainative-task-task-1',
        image: 'ainative/runner:fresh',
      }),
    );
    expect(result.containerId).toBe('container-new');
  });

  it('should replace a running host-network container and persist derived preview metadata', async () => {
    const config = {
      isDockerMode: jest.fn().mockReturnValue(true),
      isStrictMode: jest.fn().mockReturnValue(true),
      resolveContainerName: jest.fn().mockReturnValue('ainative-task-task-1'),
      getSandboxProfile: jest.fn().mockReturnValue('default'),
      getRunnerPlatform: jest.fn().mockReturnValue(null),
      getRunnerNetworkMode: jest.fn().mockReturnValue('host'),
      shouldExposeSandboxPort: jest.fn().mockReturnValue(true),
      getRunnerExposeHostIp: jest.fn().mockReturnValue('127.0.0.1'),
      getRunnerExposeContainerPort: jest.fn().mockReturnValue(8080),
      usesSandboxEntrypoint: jest.fn().mockReturnValue(true),
      getRunnerWorkspace: jest.fn().mockReturnValue('/workspace'),
      getRunnerManagedVolumeTargets: jest.fn().mockReturnValue([]),
      getRunnerBootstrapEnv: jest.fn().mockReturnValue({}),
      getRunnerEnv: jest.fn().mockReturnValue({}),
      getRunnerCpuLimit: jest.fn().mockReturnValue(undefined),
      resourceLimitsForProfile: jest.fn().mockReturnValue({}),
      getRunnerReadinessProbeUrl: jest.fn().mockReturnValue(null),
      getRunnerStartTimeoutMs: jest.fn().mockReturnValue(30000),
      getPreviewBridgeScriptUrl: jest.fn().mockReturnValue(null),
      getSlotHeartbeatMs: jest.fn().mockReturnValue(1000),
      getSlotTtlMs: jest.fn().mockReturnValue(5000),
      shouldAddHostDockerInternalGateway: jest.fn().mockReturnValue(true),
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
      updateContainerRuntimeByTaskId: jest.fn().mockResolvedValue(undefined),
      updateContainerIdByTaskId: jest.fn().mockResolvedValue(undefined),
      renewSlotByTaskId: jest.fn().mockResolvedValue(undefined),
      releaseSlotByTaskId: jest.fn().mockResolvedValue(undefined),
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
      {} as never,
      createRunnerOrchestration() as never,
    );

    const result = await service.ensureContainer({
      task: createTask(TaskStatus.inProgress) as never,
      project: createProject() as never,
      worktreePath: '/tmp/worktrees/wk-task-1',
    });

    expect(result).toEqual({ containerId: 'container-new' });
    expect(isolatedRunner.remove).toHaveBeenCalledWith(
      'ainative-task-task-1',
      expect.objectContaining({
        preserveManagedVolumeTargets: expect.any(Function),
      }),
    );
    expect(isolatedRunner.run).toHaveBeenCalledWith(
      expect.objectContaining({
        image: 'ainative/runner:fresh',
      }),
    );
    expect(slotRepository.updateContainerRuntimeByTaskId).toHaveBeenCalledWith(
      'task-1',
      expect.objectContaining({
        containerId: 'container-new',
        accessMetadata: expect.objectContaining({
          hostIp: '127.0.0.1',
          hostPort: 8080,
          containerPort: 8080,
          previewUrl: 'http://127.0.0.1:8080',
          networkMode: 'host',
        }),
      }),
    );
  });

  it('should persist published preview metadata using the configured preview base url', async () => {
    const config = {
      isDockerMode: jest.fn().mockReturnValue(true),
      isStrictMode: jest.fn().mockReturnValue(true),
      resolveContainerName: jest.fn().mockReturnValue('ainative-task-task-1'),
      getSandboxProfile: jest.fn().mockReturnValue('preview-web'),
      getRunnerPlatform: jest.fn().mockReturnValue(null),
      getRunnerNetworkMode: jest.fn().mockReturnValue('bridge'),
      shouldExposeSandboxPort: jest.fn().mockReturnValue(true),
      getRunnerExposeHostIp: jest.fn().mockReturnValue('192.168.50.8'),
      getRunnerExposeContainerPort: jest.fn().mockReturnValue(4173),
      getPreviewBaseUrl: jest
        .fn()
        .mockReturnValue('https://preview.example.com/root/'),
      usesSandboxEntrypoint: jest.fn().mockReturnValue(true),
      getRunnerWorkspace: jest.fn().mockReturnValue('/workspace'),
      getRunnerManagedVolumeTargets: jest.fn().mockReturnValue([]),
      getRunnerBootstrapEnv: jest.fn().mockReturnValue({}),
      getRunnerEnv: jest.fn().mockReturnValue({}),
      getRunnerCpuLimit: jest.fn().mockReturnValue(undefined),
      resourceLimitsForProfile: jest.fn().mockReturnValue({}),
      getRunnerReadinessProbeUrl: jest.fn().mockReturnValue(null),
      getRunnerStartTimeoutMs: jest.fn().mockReturnValue(30000),
      getPreviewBridgeScriptUrl: jest.fn().mockReturnValue(null),
      getSlotHeartbeatMs: jest.fn().mockReturnValue(1000),
      getSlotTtlMs: jest.fn().mockReturnValue(5000),
      shouldAddHostDockerInternalGateway: jest.fn().mockReturnValue(true),
    };
    const isolatedRunner = {
      inspect: jest.fn().mockResolvedValue(null),
      run: jest.fn().mockResolvedValue({
        containerId: 'container-new',
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
      updateContainerRuntimeByTaskId: jest.fn().mockResolvedValue(undefined),
      updateContainerIdByTaskId: jest.fn().mockResolvedValue(undefined),
      renewSlotByTaskId: jest.fn().mockResolvedValue(undefined),
      releaseSlotByTaskId: jest.fn().mockResolvedValue(undefined),
      findByTaskId: jest.fn().mockResolvedValue(null),
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
      {} as never,
      createRunnerOrchestration() as never,
    );
    jest
      .spyOn(service as never, 'allocatePublishedPort' as never)
      .mockResolvedValue(38080 as never);

    const result = await service.ensureContainer({
      task: createTask(TaskStatus.inProgress) as never,
      project: createProject() as never,
      worktreePath: '/tmp/worktrees/wk-task-1',
    });

    expect(result).toEqual({ containerId: 'container-new' });
    expect(slotRepository.updateContainerRuntimeByTaskId).toHaveBeenCalledWith(
      'task-1',
      expect.objectContaining({
        containerId: 'container-new',
        accessMetadata: expect.objectContaining({
          hostIp: '192.168.50.8',
          hostPort: 38080,
          containerPort: 4173,
          previewUrl: 'https://preview.example.com:38080',
          networkMode: 'bridge',
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
      getRunnerPlatform: jest.fn().mockReturnValue(null),
      getRunnerNetworkMode: jest.fn().mockReturnValue('bridge'),
      shouldExposeSandboxPort: jest.fn().mockReturnValue(true),
      getRunnerExposeHostIp: jest.fn().mockReturnValue('192.168.50.8'),
      getRunnerExposeContainerPort: jest.fn().mockReturnValue(4173),
      usesSandboxEntrypoint: jest.fn().mockReturnValue(true),
      getRunnerWorkspace: jest.fn().mockReturnValue('/workspace'),
      getRunnerManagedVolumeTargets: jest.fn().mockReturnValue([]),
      getRunnerBootstrapEnv: jest.fn().mockReturnValue({}),
      getRunnerEnv: jest.fn().mockReturnValue({}),
      getRunnerCpuLimit: jest.fn().mockReturnValue(undefined),
      resourceLimitsForProfile: jest.fn().mockReturnValue({}),
      getRunnerReadinessProbeUrl: jest.fn().mockReturnValue(null),
      getRunnerStartTimeoutMs: jest.fn().mockReturnValue(30000),
      getPreviewBridgeScriptUrl: jest.fn().mockReturnValue(null),
      getSlotHeartbeatMs: jest.fn().mockReturnValue(1000),
      getSlotTtlMs: jest.fn().mockReturnValue(5000),
      shouldAddHostDockerInternalGateway: jest.fn().mockReturnValue(true),
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
      previewUrl: 'http://192.168.50.8:38080',
      networkMode: 'bridge',
    };
    const slotRepository = {
      findByTaskId: jest.fn().mockResolvedValue({
        projectId: 'project-1',
        taskId: 'task-1',
        accessMetadata,
      }),
      updateContainerRuntimeByTaskId: jest.fn().mockResolvedValue(undefined),
      updateContainerIdByTaskId: jest.fn().mockResolvedValue(undefined),
      renewSlotByTaskId: jest.fn().mockResolvedValue(undefined),
      releaseSlotByTaskId: jest.fn().mockResolvedValue(undefined),
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
      {} as never,
      createRunnerOrchestration() as never,
    );

    const result = await service.ensureContainer({
      task: createTask(TaskStatus.inProgress) as never,
      project: createProject() as never,
      worktreePath: '/tmp/worktrees/wk-task-1',
    });

    expect(result).toEqual({ containerId: 'container-1' });
    expect(slotRepository.findByTaskId).toHaveBeenCalledWith('task-1');
    expect(slotRepository.updateContainerRuntimeByTaskId).toHaveBeenCalledWith(
      'task-1',
      {
        containerId: 'container-1',
        accessMetadata,
      },
    );
    expect(slotRepository.updateContainerIdByTaskId).not.toHaveBeenCalled();
  });

  it('should recover bridge preview metadata from inspected published ports when reused metadata is missing', async () => {
    const config = {
      isDockerMode: jest.fn().mockReturnValue(true),
      isStrictMode: jest.fn().mockReturnValue(true),
      resolveContainerName: jest.fn().mockReturnValue('ainative-task-task-1'),
      getSandboxProfile: jest.fn().mockReturnValue('preview-web'),
      getRunnerPlatform: jest.fn().mockReturnValue(null),
      getRunnerNetworkMode: jest.fn().mockReturnValue('bridge'),
      shouldExposeSandboxPort: jest.fn().mockReturnValue(true),
      getRunnerExposeHostIp: jest.fn().mockReturnValue('192.168.50.8'),
      getRunnerExposeContainerPort: jest.fn().mockReturnValue(4173),
      usesSandboxEntrypoint: jest.fn().mockReturnValue(true),
      getRunnerWorkspace: jest.fn().mockReturnValue('/workspace'),
      getRunnerManagedVolumeTargets: jest.fn().mockReturnValue([]),
      getRunnerBootstrapEnv: jest.fn().mockReturnValue({}),
      getRunnerEnv: jest.fn().mockReturnValue({}),
      getRunnerCpuLimit: jest.fn().mockReturnValue(undefined),
      resourceLimitsForProfile: jest.fn().mockReturnValue({}),
      getRunnerReadinessProbeUrl: jest.fn().mockReturnValue(null),
      getRunnerStartTimeoutMs: jest.fn().mockReturnValue(30000),
      getPreviewBridgeScriptUrl: jest.fn().mockReturnValue(null),
      getSlotHeartbeatMs: jest.fn().mockReturnValue(1000),
      getSlotTtlMs: jest.fn().mockReturnValue(5000),
      shouldAddHostDockerInternalGateway: jest.fn().mockReturnValue(true),
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
      findByTaskId: jest.fn().mockResolvedValue({
        projectId: 'project-1',
        taskId: 'task-1',
        accessMetadata: null,
      }),
      updateContainerRuntimeByTaskId: jest.fn().mockResolvedValue(undefined),
      updateContainerIdByTaskId: jest.fn().mockResolvedValue(undefined),
      renewSlotByTaskId: jest.fn().mockResolvedValue(undefined),
      releaseSlotByTaskId: jest.fn().mockResolvedValue(undefined),
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
      {} as never,
      createRunnerOrchestration() as never,
    );
    const result = await service.ensureContainer({
      task: createTask(TaskStatus.inProgress) as never,
      project: createProject() as never,
      worktreePath: '/tmp/worktrees/wk-task-1',
    });

    expect(result).toEqual({ containerId: 'container-1' });
    expect(slotRepository.updateContainerRuntimeByTaskId).toHaveBeenCalledWith(
      'task-1',
      {
        containerId: 'container-1',
        accessMetadata: {
          hostIp: '192.168.50.8',
          hostPort: 38080,
          containerPort: 4173,
          previewUrl: 'http://192.168.50.8:38080',
          networkMode: 'bridge',
        },
      },
    );
    expect(slotRepository.updateContainerIdByTaskId).not.toHaveBeenCalled();
  });

  it('should derive host preview metadata when reusing a running host container', async () => {
    const config = {
      isDockerMode: jest.fn().mockReturnValue(true),
      isStrictMode: jest.fn().mockReturnValue(true),
      resolveContainerName: jest.fn().mockReturnValue('ainative-task-task-1'),
      getSandboxProfile: jest.fn().mockReturnValue('preview-web'),
      getRunnerPlatform: jest.fn().mockReturnValue(null),
      getRunnerNetworkMode: jest.fn().mockReturnValue('host'),
      shouldExposeSandboxPort: jest.fn().mockReturnValue(true),
      getRunnerExposeHostIp: jest.fn().mockReturnValue('127.0.0.1'),
      getRunnerExposeContainerPort: jest.fn().mockReturnValue(8080),
      usesSandboxEntrypoint: jest.fn().mockReturnValue(true),
      getRunnerWorkspace: jest.fn().mockReturnValue('/workspace'),
      getRunnerManagedVolumeTargets: jest.fn().mockReturnValue([]),
      getRunnerBootstrapEnv: jest.fn().mockReturnValue({}),
      getRunnerEnv: jest.fn().mockReturnValue({}),
      getRunnerCpuLimit: jest.fn().mockReturnValue(undefined),
      resourceLimitsForProfile: jest.fn().mockReturnValue({}),
      getRunnerReadinessProbeUrl: jest.fn().mockReturnValue(null),
      getRunnerStartTimeoutMs: jest.fn().mockReturnValue(30000),
      getPreviewBridgeScriptUrl: jest.fn().mockReturnValue(null),
      getSlotHeartbeatMs: jest.fn().mockReturnValue(1000),
      getSlotTtlMs: jest.fn().mockReturnValue(5000),
      shouldAddHostDockerInternalGateway: jest.fn().mockReturnValue(true),
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
      findByTaskId: jest.fn().mockResolvedValue({
        projectId: 'project-1',
        taskId: 'task-1',
        accessMetadata: null,
      }),
      updateContainerRuntimeByTaskId: jest.fn().mockResolvedValue(undefined),
      updateContainerIdByTaskId: jest.fn().mockResolvedValue(undefined),
      renewSlotByTaskId: jest.fn().mockResolvedValue(undefined),
      releaseSlotByTaskId: jest.fn().mockResolvedValue(undefined),
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
      {} as never,
      createRunnerOrchestration() as never,
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
    expect(slotRepository.updateContainerRuntimeByTaskId).toHaveBeenCalledWith(
      'task-1',
      {
        containerId: 'container-1',
        accessMetadata: {
          hostIp: '127.0.0.1',
          hostPort: 8080,
          containerPort: 8080,
          previewUrl: 'http://127.0.0.1:8080',
          networkMode: 'host',
        },
      },
    );
    expect(slotRepository.updateContainerIdByTaskId).not.toHaveBeenCalled();
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
      getRunnerPlatform: jest.fn().mockReturnValue(null),
      getRunnerNetworkMode: jest.fn().mockReturnValue('bridge'),
      shouldExposeSandboxPort: jest.fn().mockReturnValue(true),
      getRunnerExposeHostIp: jest.fn().mockReturnValue('192.168.50.8'),
      getRunnerExposeContainerPort: jest.fn().mockReturnValue(4173),
      usesSandboxEntrypoint: jest.fn().mockReturnValue(true),
      getRunnerWorkspace: jest.fn().mockReturnValue('/workspace'),
      getRunnerManagedVolumeTargets: jest.fn().mockReturnValue([]),
      getRunnerBootstrapEnv: jest.fn().mockReturnValue({}),
      getRunnerEnv: jest.fn().mockReturnValue({}),
      getRunnerCpuLimit: jest.fn().mockReturnValue(undefined),
      resourceLimitsForProfile: jest.fn().mockReturnValue({}),
      getRunnerReadinessProbeUrl: jest.fn().mockReturnValue(null),
      getRunnerStartTimeoutMs: jest.fn().mockReturnValue(30000),
      getPreviewBridgeScriptUrl: jest.fn().mockReturnValue(null),
      getSlotHeartbeatMs: jest.fn().mockReturnValue(1000),
      getSlotTtlMs: jest.fn().mockReturnValue(5000),
      shouldAddHostDockerInternalGateway: jest.fn().mockReturnValue(true),
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
      findByTaskId: jest.fn().mockResolvedValue({
        projectId: 'project-1',
        taskId: 'task-1',
        accessMetadata: null,
      }),
      updateContainerRuntimeByTaskId: jest.fn().mockResolvedValue(undefined),
      updateContainerIdByTaskId: jest.fn().mockResolvedValue(undefined),
      renewSlotByTaskId: jest.fn().mockResolvedValue(undefined),
      releaseSlotByTaskId: jest.fn().mockResolvedValue(undefined),
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
      {} as never,
      createRunnerOrchestration() as never,
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
    expect(
      slotRepository.updateContainerRuntimeByTaskId,
    ).not.toHaveBeenCalled();
    expect(slotRepository.updateContainerIdByTaskId).toHaveBeenCalledWith(
      'task-1',
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
      releaseSlotByTaskId: jest.fn().mockResolvedValue(undefined),
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
      {} as never,
      createRunnerOrchestration() as never,
    );
    const loggerLog = jest
      .spyOn((service as any).logger, 'log')
      .mockImplementation(() => undefined);

    await service.removeContainerForTask('task-1', 'project-1');

    expect(isolatedRunner.remove).toHaveBeenCalledWith('ainative-task-task-1');
    expect(slotRepository.releaseSlotByTaskId).toHaveBeenCalledWith('task-1');
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
      releaseSlotByTaskId: jest.fn().mockResolvedValue(undefined),
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
      {} as never,
    );
    const loggerLog = jest
      .spyOn((service as any).logger, 'log')
      .mockImplementation(() => undefined);

    await service.removeContainerForTask('task-1', 'project-1');

    expect(isolatedRunner.remove).not.toHaveBeenCalled();
    expect(slotRepository.releaseSlotByTaskId).toHaveBeenCalledWith('task-1');
    expect(loggerLog).toHaveBeenCalledWith(
      expect.stringContaining('remove_runner_container_task_missing '),
    );
  });
});
