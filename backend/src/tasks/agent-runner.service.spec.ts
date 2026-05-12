import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';
import { ConfigService } from '@nestjs/config';
import { AgentToolConfigRepository } from '../business-lines/infrastructure/persistence/agent-tool-config.repository';
import { AgentCliAdapterRegistry } from '../agent-execution/agent-cli/agent-cli-adapter.registry';
import { AgentExecutionConfigResolverService } from '../agent-execution/agent-execution-config-resolver.service';
import { AgentPromptTemplateService } from '../agent-execution/agent-prompt-template.service';
import { RunnerAgentExecutionService } from '../agent-execution/runner-agent-execution.service';
import { ContainerExecutionConfigService } from '../containers/container-execution-config.service';
import { DockerExecProcessLauncherService } from '../containers/docker-exec-process-launcher.service';
import { IsolatedRunnerContainerService } from '../containers/isolated-runner-container.service';
import { ProjectWorkspacePathsService } from '../project-workspace/project-workspace-paths.service';
import { Project } from '../projects/domain/project';
import { resolveAinativeDataRootDir } from '../utils/workspace-paths';
import { Task } from './domain/task';
import { TaskNode } from './domain/task-node';
import { TaskMode } from './dto/task-mode.enum';
import { TaskNodeStatus } from './dto/task-node-status.enum';
import { TaskStatus } from './dto/task-status.enum';

jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

process.env.AINATIVE_DATA_ROOT_DIR ??= path.resolve(process.cwd(), 'tmp');

const spawnMock = spawn as jest.MockedFunction<typeof spawn>;

const worktreeRoot = path.resolve(
  resolveAinativeDataRootDir(),
  'business-line-1',
  'projects',
  'project-1',
  'worktrees',
);

const createProject = (configJson?: Record<string, unknown>): Project => ({
  id: 'project-1',
  businessLineId: 'business-line-1',
  name: 'AINative',
  description: null,
  gitUrl: 'https://example.com/repo.git',
  defaultBranch: 'main',
  configJson: configJson ?? null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
});

const createTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'task-1',
  projectId: 'project-1',
  businessLineId: 'business-line-1',
  mode: TaskMode.workflow,
  title: 'task title',
  prompt: 'task description',
  status: TaskStatus.todo,
  gitBranch: 'feature/task-1',
  gitBaseBranch: 'main',
  gitWorktree: path.join(worktreeRoot, 'task-1'),
  configJson: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  ...overrides,
});

const createNode = (): TaskNode => ({
  id: 'node-1',
  taskId: 'task-1',
  nodeOrder: 1,
  name: 'agent node',
  input: {
    nodeInput: 'Run task',
    taskInput: 'task description',
  },
  agentCliId: 'codex',
  agentCliConfigId: 'cfg-default',
  agentClioutput: null,
  agentCliSessionId: null,
  loopJson: {
    enabled: false,
    loopCount: 0,
    maxLoops: 1,
  },
  runtimeJson: null,
  status: TaskNodeStatus.todo,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const createRepositoryMock = () => ({
  create: jest.fn(),
  findByBusinessLineId: jest.fn(),
  findById: jest.fn(),
  findDefaultByBusinessLineIdAndToolId: jest.fn(),
  clearDefaultByBusinessLineIdAndToolId: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
});

class AgentRunnerService extends RunnerAgentExecutionService {
  constructor(
    agentToolConfigRepository: AgentToolConfigRepository,
    configService: ConfigService = new ConfigService(),
    promptTemplateService: AgentPromptTemplateService = new AgentPromptTemplateService(),
    agentCliAdapterRegistry: AgentCliAdapterRegistry = new AgentCliAdapterRegistry(),
    projectWorkspacePathsService: ProjectWorkspacePathsService = new ProjectWorkspacePathsService(
      configService,
    ),
    containerExecutionConfig?: ContainerExecutionConfigService,
    dockerExecProcessLauncher?: DockerExecProcessLauncherService,
    isolatedRunnerContainer?: IsolatedRunnerContainerService,
  ) {
    super(
      new AgentExecutionConfigResolverService(
        agentToolConfigRepository,
        configService,
        promptTemplateService,
        agentCliAdapterRegistry,
        projectWorkspacePathsService,
      ),
      configService,
      agentCliAdapterRegistry,
      containerExecutionConfig,
      dockerExecProcessLauncher,
      isolatedRunnerContainer,
    );
  }
}

describe('AgentRunnerService', () => {
  afterEach(() => {
    spawnMock.mockReset();
    jest.clearAllMocks();
  });

  it('should apply business-line default agent tool config overrides', async () => {
    const repositoryMock = createRepositoryMock();
    repositoryMock.findDefaultByBusinessLineIdAndToolId.mockResolvedValue({
      id: 'cfg-retail-codex',
      businessLineId: 'business-line-1',
      toolId: 'codex',
      name: 'Retail Codex',
      description: null,
      configJson: JSON.stringify({
        model: 'gpt-5.4',
        execution_mode: 'full-auto',
        config_overrides: ['model_reasoning_summary="concise"'],
        env: {
          PROFILE_ENV: 'retail',
        },
        forbidden: 'not-allowed',
      }),
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const service = new AgentRunnerService(
      repositoryMock as unknown as AgentToolConfigRepository,
    );
    const serviceAny = service as any;

    const project = createProject({
      agentAdapter: 'codex',
      agentRunner: {
        command: 'codex-global',
        args: ['exec', '--skip-git-repo-check', '-'],
        env: {
          BASE_ENV: 'base',
        },
      },
    });

    const result = await serviceAny.resolveRunnerConfig(
      project,
      createTask(),
      createNode(),
    );

    expect(result.adapter).toBe('codex');
    expect(result.command).toBe('codex');
    expect(result.args).toEqual([
      'exec',
      '--json',
      '--skip-git-repo-check',
      '--model',
      'gpt-5.4',
      '--full-auto',
      '-c',
      'model_reasoning_summary="concise"',
      '-',
    ]);
    expect(result.env).toMatchObject({
      PROFILE_ENV: 'retail',
      AINATIVE_BUSINESS_LINE_ID: 'business-line-1',
      AINATIVE_AGENT_TOOL_CONFIG_ID: 'cfg-retail-codex',
      AINATIVE_AGENT_TOOL_CONFIG_NAME: 'Retail Codex',
    });
    expect(result.env.forbidden).toBeUndefined();
  });

  it('should prefer task specified agent tool config id', async () => {
    const repositoryMock = createRepositoryMock();
    repositoryMock.findById.mockResolvedValue({
      id: 'cfg-explicit',
      businessLineId: 'business-line-1',
      toolId: 'codex-cli',
      name: 'Explicit Codex',
      description: null,
      configJson: JSON.stringify({
        execution_mode: 'dangerously-bypass-approvals-and-sandbox',
        model: 'gpt-5.4',
      }),
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const service = new AgentRunnerService(
      repositoryMock as unknown as AgentToolConfigRepository,
    );
    const serviceAny = service as any;

    const project = createProject({
      agentAdapter: 'codex',
    });

    const result = await serviceAny.resolveRunnerConfig(project, createTask(), {
      ...createNode(),
      agentCliConfigId: 'cfg-explicit',
    });

    expect(result.command).toBe('codex');
    expect(result.args).toEqual([
      'exec',
      '--json',
      '--skip-git-repo-check',
      '--model',
      'gpt-5.4',
      '--dangerously-bypass-approvals-and-sandbox',
      '-',
    ]);
    expect(result.env.AINATIVE_AGENT_TOOL_CONFIG_ID).toBe('cfg-explicit');
    expect(repositoryMock.findById).toHaveBeenCalledWith('cfg-explicit');
    expect(
      repositoryMock.findDefaultByBusinessLineIdAndToolId,
    ).not.toHaveBeenCalled();
  });

  it('should fallback to alias tool id when querying business-line default config', async () => {
    const repositoryMock = createRepositoryMock();
    repositoryMock.findDefaultByBusinessLineIdAndToolId.mockImplementation(
      (_businessLineId: string, toolId: string) => {
        if (toolId === 'codex-cli') {
          return {
            id: 'cfg-alias',
            businessLineId: 'business-line-1',
            toolId: 'codex-cli',
            name: 'Alias Codex',
            description: null,
            configJson: JSON.stringify({
              profile: 'ops',
            }),
            isDefault: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
        }

        return null;
      },
    );

    const service = new AgentRunnerService(
      repositoryMock as unknown as AgentToolConfigRepository,
    );
    const serviceAny = service as any;

    const project = createProject({
      agentAdapter: 'codex',
    });

    const result = await serviceAny.resolveRunnerConfig(
      project,
      createTask(),
      createNode(),
    );

    expect(result.command).toBe('codex');
    expect(result.args).toEqual([
      'exec',
      '--json',
      '--skip-git-repo-check',
      '--profile',
      'ops',
      '--sandbox',
      'workspace-write',
      '-',
    ]);
    expect(
      repositoryMock.findDefaultByBusinessLineIdAndToolId,
    ).toHaveBeenNthCalledWith(1, 'business-line-1', 'codex');
    expect(
      repositoryMock.findDefaultByBusinessLineIdAndToolId,
    ).toHaveBeenNthCalledWith(2, 'business-line-1', 'codex-cli');
  });

  it('should fallback to legacy project agent tool config list when db config is missing', async () => {
    const repositoryMock = createRepositoryMock();
    repositoryMock.findDefaultByBusinessLineIdAndToolId.mockResolvedValue(null);

    const service = new AgentRunnerService(
      repositoryMock as unknown as AgentToolConfigRepository,
    );
    const serviceAny = service as any;

    const project = createProject({
      agentAdapter: 'codex',
      agentToolConfigs: [
        {
          id: 'cfg-global-codex',
          toolId: 'codex',
          isDefault: true,
          config: {
            sandbox: 'workspace-write',
            model: 'gpt-5.4',
          },
        },
      ],
    });

    const result = await serviceAny.resolveRunnerConfig(
      project,
      createTask(),
      createNode(),
    );

    expect(result.command).toBe('codex');
    expect(result.args).toEqual([
      'exec',
      '--json',
      '--skip-git-repo-check',
      '--model',
      'gpt-5.4',
      '--sandbox',
      'workspace-write',
      '-',
    ]);
    expect(result.env.AINATIVE_AGENT_TOOL_CONFIG_ID).toBe('cfg-global-codex');
  });

  it('should ignore legacy project agentRunner when node selects a different CLI adapter', async () => {
    const repositoryMock = createRepositoryMock();
    repositoryMock.findDefaultByBusinessLineIdAndToolId.mockResolvedValue({
      id: 'cfg-invalid',
      businessLineId: 'business-line-1',
      toolId: 'codex',
      name: 'Invalid Config',
      description: null,
      configJson: '{invalid-json',
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const service = new AgentRunnerService(
      repositoryMock as unknown as AgentToolConfigRepository,
    );
    const serviceAny = service as any;

    const project = createProject({
      agentAdapter: 'codex',
      agentRunner: {
        command: 'legacy-command',
      },
    });

    const result = await serviceAny.resolveRunnerConfig(project, createTask(), {
      ...createNode(),
      agentCliId: 'gemini-cli',
    });

    expect(result.adapter).toBe('gemini');
    expect(result.command).toBe('gemini');
    expect(result.env.AINATIVE_AGENT_TOOL_CONFIG_ID).toBeUndefined();
  });

  it('should support gemini-cli adapter alias', async () => {
    const repositoryMock = createRepositoryMock();
    repositoryMock.findDefaultByBusinessLineIdAndToolId.mockResolvedValue(null);

    const service = new AgentRunnerService(
      repositoryMock as unknown as AgentToolConfigRepository,
    );
    const serviceAny = service as any;

    const project = createProject({
      agentAdapter: 'gemini-cli',
      agentRunner: {
        args: ['-p'],
      },
    });

    const result = await serviceAny.resolveRunnerConfig(project, createTask(), {
      ...createNode(),
      agentCliId: 'gemini-cli',
    });

    expect(result.adapter).toBe('gemini');
    expect(result.command).toBe('gemini');
    expect(result.args).toEqual(['--output-format', 'stream-json', '--yolo']);
  });

  it('should use stream-json defaults for gemini cli', async () => {
    const repositoryMock = createRepositoryMock();
    repositoryMock.findDefaultByBusinessLineIdAndToolId.mockResolvedValue(null);

    const service = new AgentRunnerService(
      repositoryMock as unknown as AgentToolConfigRepository,
    );
    const serviceAny = service as any;

    const result = await serviceAny.resolveRunnerConfig(
      createProject({
        agentAdapter: 'gemini-cli',
      }),
      createTask(),
      {
        ...createNode(),
        agentCliId: 'gemini-cli',
      },
    );

    expect(result.adapter).toBe('gemini');
    expect(result.command).toBe('gemini');
    expect(result.args).toEqual(['--output-format', 'stream-json', '--yolo']);
  });

  it('should compile gemini structured config into headless args', async () => {
    const repositoryMock = createRepositoryMock();
    repositoryMock.findById.mockResolvedValue({
      id: 'cfg-gemini-advanced',
      businessLineId: 'business-line-1',
      toolId: 'gemini-cli',
      name: 'Advanced Gemini',
      description: null,
      configJson: JSON.stringify({
        model: 'gemini-2.5-pro',
        sandbox: true,
        yolo: false,
        approval_mode: 'plan',
        policy: ['/tmp/policy-a', '/tmp/policy-b'],
        allowed_mcp_server_names: ['figma', 'filesystem'],
        extensions: ['git', 'web'],
      }),
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const service = new AgentRunnerService(
      repositoryMock as unknown as AgentToolConfigRepository,
    );
    const serviceAny = service as any;

    const result = await serviceAny.resolveRunnerConfig(
      createProject({
        agentAdapter: 'gemini-cli',
      }),
      createTask(),
      {
        ...createNode(),
        agentCliId: 'gemini-cli',
        agentCliConfigId: 'cfg-gemini-advanced',
      },
    );

    expect(result.args).toEqual([
      '--output-format',
      'stream-json',
      '--model',
      'gemini-2.5-pro',
      '--sandbox',
      '--approval-mode',
      'plan',
      '--policy',
      '/tmp/policy-a',
      '--policy',
      '/tmp/policy-b',
      '--allowed-mcp-server-names',
      'figma',
      '--allowed-mcp-server-names',
      'filesystem',
      '--extensions',
      'git',
      '--extensions',
      'web',
    ]);
  });

  it('should ignore gemini approval mode when yolo is enabled', async () => {
    const repositoryMock = createRepositoryMock();
    repositoryMock.findById.mockResolvedValue({
      id: 'cfg-gemini-yolo',
      businessLineId: 'business-line-1',
      toolId: 'gemini-cli',
      name: 'YOLO Gemini',
      description: null,
      configJson: JSON.stringify({
        yolo: true,
        approval_mode: 'plan',
      }),
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const service = new AgentRunnerService(
      repositoryMock as unknown as AgentToolConfigRepository,
    );
    const serviceAny = service as any;

    const result = await serviceAny.resolveRunnerConfig(
      createProject({
        agentAdapter: 'gemini-cli',
      }),
      createTask(),
      {
        ...createNode(),
        agentCliId: 'gemini-cli',
        agentCliConfigId: 'cfg-gemini-yolo',
      },
    );

    expect(result.args).toEqual(['--output-format', 'stream-json', '--yolo']);
  });

  it('should inject gemini base_url and bearer auth when base_url is set', async () => {
    const repositoryMock = createRepositoryMock();
    repositoryMock.findById.mockResolvedValue({
      id: 'cfg-gemini-gateway',
      businessLineId: 'business-line-1',
      toolId: 'gemini-cli',
      name: 'Gemini Gateway',
      description: null,
      configJson: JSON.stringify({
        api_key: 'gemini-key-123',
        base_url: 'https://my-gateway.example.com',
        model: 'gemini-2.5-flash',
        yolo: true,
      }),
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const service = new AgentRunnerService(
      repositoryMock as unknown as AgentToolConfigRepository,
    );
    const serviceAny = service as any;

    const result = await serviceAny.resolveRunnerConfig(
      createProject({
        agentAdapter: 'gemini-cli',
      }),
      createTask(),
      {
        ...createNode(),
        agentCliId: 'gemini-cli',
        agentCliConfigId: 'cfg-gemini-gateway',
      },
    );

    expect(result.env).toMatchObject({
      GEMINI_API_KEY: 'gemini-key-123',
      GOOGLE_GEMINI_BASE_URL: 'https://my-gateway.example.com',
      GEMINI_API_KEY_AUTH_MECHANISM: 'bearer',
    });
    expect(result.args).toContain('--model');
    expect(result.args).toContain('gemini-2.5-flash');
  });

  it('should not inject bearer auth when gemini base_url is empty', async () => {
    const repositoryMock = createRepositoryMock();
    repositoryMock.findById.mockResolvedValue({
      id: 'cfg-gemini-official',
      businessLineId: 'business-line-1',
      toolId: 'gemini-cli',
      name: 'Gemini Official',
      description: null,
      configJson: JSON.stringify({
        api_key: 'AIzaSyXXX',
        model: 'gemini-2.5-flash',
        yolo: true,
      }),
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const service = new AgentRunnerService(
      repositoryMock as unknown as AgentToolConfigRepository,
    );
    const serviceAny = service as any;

    const result = await serviceAny.resolveRunnerConfig(
      createProject({
        agentAdapter: 'gemini-cli',
      }),
      createTask(),
      {
        ...createNode(),
        agentCliId: 'gemini-cli',
        agentCliConfigId: 'cfg-gemini-official',
      },
    );

    expect(result.env).toMatchObject({
      GEMINI_API_KEY: 'AIzaSyXXX',
    });
    expect(result.env).not.toHaveProperty('GOOGLE_GEMINI_BASE_URL');
    expect(result.env).not.toHaveProperty('GEMINI_API_KEY_AUTH_MECHANISM');
  });

  it('should use json run defaults for opencode', async () => {
    const repositoryMock = createRepositoryMock();
    repositoryMock.findDefaultByBusinessLineIdAndToolId.mockResolvedValue(null);

    const service = new AgentRunnerService(
      repositoryMock as unknown as AgentToolConfigRepository,
    );
    const serviceAny = service as any;

    const result = await serviceAny.resolveRunnerConfig(
      createProject({
        agentAdapter: 'opencode',
      }),
      createTask(),
      {
        ...createNode(),
        agentCliId: 'opencode',
      },
    );

    expect(result.adapter).toBe('opencode');
    expect(result.command).toBe('opencode');
    expect(result.args).toEqual(['run', '--format', 'json']);
  });

  it('should compile opencode structured config into run args', async () => {
    const repositoryMock = createRepositoryMock();
    repositoryMock.findById.mockResolvedValue({
      id: 'cfg-opencode-advanced',
      businessLineId: 'business-line-1',
      toolId: 'opencode',
      name: 'Advanced OpenCode',
      description: null,
      configJson: JSON.stringify({
        model: 'openai/gpt-5',
        agent: 'builder',
        prompt: 'Use project conventions first.',
      }),
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const service = new AgentRunnerService(
      repositoryMock as unknown as AgentToolConfigRepository,
    );
    const serviceAny = service as any;

    const result = await serviceAny.resolveRunnerConfig(
      createProject({
        agentAdapter: 'opencode',
      }),
      createTask(),
      {
        ...createNode(),
        agentCliId: 'opencode',
        agentCliConfigId: 'cfg-opencode-advanced',
      },
    );

    expect(result.args).toEqual([
      'run',
      '--format',
      'json',
      '--model',
      'openai/gpt-5',
      '--agent',
      'builder',
      '--prompt',
      'Use project conventions first.',
    ]);
  });

  it('should inject opencode base_url as OPENAI_BASE_URL when base_url is set', async () => {
    const repositoryMock = createRepositoryMock();
    repositoryMock.findById.mockResolvedValue({
      id: 'cfg-opencode-gateway',
      businessLineId: 'business-line-1',
      toolId: 'opencode',
      name: 'OpenCode Gateway',
      description: null,
      configJson: JSON.stringify({
        api_key: 'sk-gateway-key',
        base_url: 'https://my-gateway.example.com/v1',
        model: 'openai/gpt-5.4',
      }),
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const service = new AgentRunnerService(
      repositoryMock as unknown as AgentToolConfigRepository,
    );
    const serviceAny = service as any;

    const result = await serviceAny.resolveRunnerConfig(
      createProject({
        agentAdapter: 'opencode',
      }),
      createTask(),
      {
        ...createNode(),
        agentCliId: 'opencode',
        agentCliConfigId: 'cfg-opencode-gateway',
      },
    );

    expect(result.env).toMatchObject({
      OPENAI_API_KEY: 'sk-gateway-key',
      OPENAI_BASE_URL: 'https://my-gateway.example.com/v1',
    });
    expect(result.args).toContain('--model');
    expect(result.args).toContain('openai/gpt-5.4');
  });

  it('should not inject OPENAI_BASE_URL when opencode base_url is empty', async () => {
    const repositoryMock = createRepositoryMock();
    repositoryMock.findById.mockResolvedValue({
      id: 'cfg-opencode-direct',
      businessLineId: 'business-line-1',
      toolId: 'opencode',
      name: 'OpenCode Direct',
      description: null,
      configJson: JSON.stringify({
        api_key: 'sk-direct-key',
        model: 'openai/gpt-5.4',
      }),
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const service = new AgentRunnerService(
      repositoryMock as unknown as AgentToolConfigRepository,
    );
    const serviceAny = service as any;

    const result = await serviceAny.resolveRunnerConfig(
      createProject({
        agentAdapter: 'opencode',
      }),
      createTask(),
      {
        ...createNode(),
        agentCliId: 'opencode',
        agentCliConfigId: 'cfg-opencode-direct',
      },
    );

    expect(result.env).toMatchObject({
      OPENAI_API_KEY: 'sk-direct-key',
    });
    expect(result.env).not.toHaveProperty('OPENAI_BASE_URL');
  });

  it('should inject opencode anthropic provider env vars when provider is anthropic', async () => {
    const repositoryMock = createRepositoryMock();
    repositoryMock.findById.mockResolvedValue({
      id: 'cfg-opencode-anthropic',
      businessLineId: 'business-line-1',
      toolId: 'opencode',
      name: 'OpenCode Anthropic',
      description: null,
      configJson: JSON.stringify({
        provider: 'anthropic',
        api_key: 'sk-anthropic-key',
        base_url: 'https://my-gateway.example.com/v1',
        model: 'anthropic/claude-opus-4-6',
      }),
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const service = new AgentRunnerService(
      repositoryMock as unknown as AgentToolConfigRepository,
    );
    const serviceAny = service as any;

    const result = await serviceAny.resolveRunnerConfig(
      createProject({
        agentAdapter: 'opencode',
      }),
      createTask(),
      {
        ...createNode(),
        agentCliId: 'opencode',
        agentCliConfigId: 'cfg-opencode-anthropic',
      },
    );

    expect(result.env).toMatchObject({
      ANTHROPIC_API_KEY: 'sk-anthropic-key',
      ANTHROPIC_BASE_URL: 'https://my-gateway.example.com/v1',
    });
    expect(result.env).not.toHaveProperty('OPENAI_API_KEY');
    expect(result.env).not.toHaveProperty('OPENAI_BASE_URL');
    expect(result.args).toContain('--model');
    expect(result.args).toContain('anthropic/claude-opus-4-6');
  });

  it('should use stream-json defaults for cursor agent', async () => {
    const repositoryMock = createRepositoryMock();
    repositoryMock.findDefaultByBusinessLineIdAndToolId.mockResolvedValue(null);

    const service = new AgentRunnerService(
      repositoryMock as unknown as AgentToolConfigRepository,
    );
    const serviceAny = service as any;

    const result = await serviceAny.resolveRunnerConfig(
      createProject({
        agentAdapter: 'cursor-agent',
      }),
      createTask(),
      {
        ...createNode(),
        agentCliId: 'cursor-agent',
      },
    );

    expect(result.adapter).toBe('cursor');
    expect(result.command).toBe('agent');
    expect(result.args).toEqual([
      '-p',
      '--output-format',
      'stream-json',
      '--trust',
      '--force',
      '--sandbox',
      'enabled',
    ]);
  });

  it('should compile cursor structured config into print args', async () => {
    const repositoryMock = createRepositoryMock();
    repositoryMock.findById.mockResolvedValue({
      id: 'cfg-cursor-advanced',
      businessLineId: 'business-line-1',
      toolId: 'cursor-agent',
      name: 'Advanced Cursor',
      description: null,
      configJson: JSON.stringify({
        api_key: 'crsr_test_key',
        model: 'sonnet-4',
        headers: ['X-Trace-Id: 123', 'X-Team: ainative'],
        trust: true,
        force: true,
        sandbox: 'disabled',
        approve_mcps: true,
      }),
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const service = new AgentRunnerService(
      repositoryMock as unknown as AgentToolConfigRepository,
    );
    const serviceAny = service as any;

    const result = await serviceAny.resolveRunnerConfig(
      createProject({
        agentAdapter: 'cursor-agent',
      }),
      createTask(),
      {
        ...createNode(),
        agentCliId: 'cursor-agent',
        agentCliConfigId: 'cfg-cursor-advanced',
      },
    );

    expect(result.args).toEqual([
      '-p',
      '--output-format',
      'stream-json',
      '--model',
      'sonnet-4',
      '--header',
      'X-Trace-Id: 123',
      '--header',
      'X-Team: ainative',
      '--trust',
      '--force',
      '--sandbox',
      'disabled',
      '--approve-mcps',
    ]);
    expect(result.env.CURSOR_API_KEY).toBe('crsr_test_key');
  });

  it('should use json defaults for codex', async () => {
    const repositoryMock = createRepositoryMock();
    repositoryMock.findDefaultByBusinessLineIdAndToolId.mockResolvedValue(null);

    const service = new AgentRunnerService(
      repositoryMock as unknown as AgentToolConfigRepository,
    );
    const serviceAny = service as any;

    const result = await serviceAny.resolveRunnerConfig(
      createProject({
        agentAdapter: 'codex',
      }),
      createTask(),
      {
        ...createNode(),
        agentCliId: 'codex',
      },
    );

    expect(result.adapter).toBe('codex');
    expect(result.command).toBe('codex');
    expect(result.args).toEqual([
      'exec',
      '--json',
      '--skip-git-repo-check',
      '--full-auto',
      '-',
    ]);
  });

  it('should compile codex structured config into exec args', async () => {
    const repositoryMock = createRepositoryMock();
    repositoryMock.findDefaultByBusinessLineIdAndToolId.mockResolvedValue(null);
    repositoryMock.findById.mockResolvedValue({
      id: 'cfg-codex-advanced',
      businessLineId: 'business-line-1',
      toolId: 'codex',
      name: 'Advanced Codex',
      description: null,
      configJson: JSON.stringify({
        model: 'gpt-5.4',
        oss: true,
        local_provider: 'ollama',
        profile: 'workspace',
        sandbox: 'danger-full-access',
        execution_mode: 'standard',
        config_overrides: [
          'model_reasoning_summary="concise"',
          'model_reasoning_effort="high"',
        ],
      }),
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const service = new AgentRunnerService(
      repositoryMock as unknown as AgentToolConfigRepository,
    );
    const serviceAny = service as any;

    const advancedResult = await serviceAny.resolveRunnerConfig(
      createProject({
        agentAdapter: 'codex',
      }),
      createTask(),
      {
        ...createNode(),
        agentCliId: 'codex',
        agentCliConfigId: 'cfg-codex-advanced',
      },
    );

    expect(advancedResult.args).toEqual([
      'exec',
      '--json',
      '--skip-git-repo-check',
      '--model',
      'gpt-5.4',
      '--oss',
      '--local-provider',
      'ollama',
      '--profile',
      'workspace',
      '--sandbox',
      'danger-full-access',
      '-c',
      'model_reasoning_summary="concise"',
      '-c',
      'model_reasoning_effort="high"',
      '-',
    ]);
  });

  it('should ignore codex sandbox when execution mode is dangerous', async () => {
    const repositoryMock = createRepositoryMock();
    repositoryMock.findById.mockResolvedValue({
      id: 'cfg-codex-danger',
      businessLineId: 'business-line-1',
      toolId: 'codex',
      name: 'Danger Codex',
      description: null,
      configJson: JSON.stringify({
        sandbox: 'danger-full-access',
        execution_mode: 'dangerously-bypass-approvals-and-sandbox',
      }),
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const service = new AgentRunnerService(
      repositoryMock as unknown as AgentToolConfigRepository,
    );
    const serviceAny = service as any;

    const result = await serviceAny.resolveRunnerConfig(
      createProject({
        agentAdapter: 'codex',
      }),
      createTask(),
      {
        ...createNode(),
        agentCliId: 'codex',
        agentCliConfigId: 'cfg-codex-danger',
      },
    );

    expect(result.args).toEqual([
      'exec',
      '--json',
      '--skip-git-repo-check',
      '--dangerously-bypass-approvals-and-sandbox',
      '-',
    ]);
  });

  it('should inject codex base_url via auto-generated provider when provider_name is empty', async () => {
    const repositoryMock = createRepositoryMock();
    repositoryMock.findById.mockResolvedValue({
      id: 'cfg-codex-baseurl',
      businessLineId: 'business-line-1',
      toolId: 'codex',
      name: 'Codex BaseURL',
      description: null,
      configJson: JSON.stringify({
        api_key: 'sk-test-key',
        base_url: 'https://my-gateway.example.com',
        model: 'gpt-5.4',
        execution_mode: 'dangerously-bypass-approvals-and-sandbox',
      }),
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const service = new AgentRunnerService(
      repositoryMock as unknown as AgentToolConfigRepository,
    );
    const serviceAny = service as any;

    const result = await serviceAny.resolveRunnerConfig(
      createProject({ agentAdapter: 'codex' }),
      createTask(),
      {
        ...createNode(),
        agentCliId: 'codex',
        agentCliConfigId: 'cfg-codex-baseurl',
      },
    );

    expect(result.env).toMatchObject({
      OPENAI_API_KEY: 'sk-test-key',
    });
    expect(result.env).not.toHaveProperty('OPENAI_BASE_URL');
    expect(result.args).toContain('-c');
    expect(result.args).toContain('model_provider="ainative"');
    expect(result.args).toContain(
      'model_providers.ainative.base_url="https://my-gateway.example.com/v1"',
    );
    expect(result.args).toContain(
      'model_providers.ainative.env_key="OPENAI_API_KEY"',
    );
    expect(result.args).toContain(
      'model_providers.ainative.requires_openai_auth=true',
    );
  });

  it('should generate codex -c provider overrides when provider_name is set', async () => {
    const repositoryMock = createRepositoryMock();
    repositoryMock.findById.mockResolvedValue({
      id: 'cfg-codex-provider',
      businessLineId: 'business-line-1',
      toolId: 'codex',
      name: 'Codex Provider',
      description: null,
      configJson: JSON.stringify({
        api_key: 'sk-test-key',
        base_url: 'https://my-gateway.example.com',
        provider_name: 'mygateway',
        model: 'gpt-5.4',
        execution_mode: 'dangerously-bypass-approvals-and-sandbox',
      }),
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const service = new AgentRunnerService(
      repositoryMock as unknown as AgentToolConfigRepository,
    );
    const serviceAny = service as any;

    const result = await serviceAny.resolveRunnerConfig(
      createProject({ agentAdapter: 'codex' }),
      createTask(),
      {
        ...createNode(),
        agentCliId: 'codex',
        agentCliConfigId: 'cfg-codex-provider',
      },
    );

    expect(result.args).toContain('-c');
    expect(result.args).toContain('model_provider="mygateway"');
    expect(result.args).toContain(
      'model_providers.mygateway.base_url="https://my-gateway.example.com/v1"',
    );
    expect(result.args).toContain(
      'model_providers.mygateway.wire_api="responses"',
    );
    expect(result.args).toContain(
      'model_providers.mygateway.requires_openai_auth=true',
    );
    expect(result.args).toContain(
      'model_providers.mygateway.env_key="OPENAI_API_KEY"',
    );
    expect(result.env).toMatchObject({
      OPENAI_API_KEY: 'sk-test-key',
    });
    expect(result.env).not.toHaveProperty('OPENAI_BASE_URL');
  });

  it('should use stream-json defaults for claude code', async () => {
    const repositoryMock = createRepositoryMock();
    repositoryMock.findDefaultByBusinessLineIdAndToolId.mockResolvedValue(null);

    const service = new AgentRunnerService(
      repositoryMock as unknown as AgentToolConfigRepository,
    );
    const serviceAny = service as any;

    const result = await serviceAny.resolveRunnerConfig(
      createProject({
        agentAdapter: 'claude-code',
      }),
      createTask(),
      {
        ...createNode(),
        agentCliId: 'claude-code',
      },
    );

    expect(result.adapter).toBe('claude');
    expect(result.command).toBe('claude');
    expect(result.args).toEqual([
      '-p',
      '--output-format',
      'stream-json',
      '--verbose',
      '--permission-mode',
      'auto',
    ]);
  });

  it('should compile claude structured config into print args', async () => {
    const repositoryMock = createRepositoryMock();
    repositoryMock.findById.mockResolvedValue({
      id: 'cfg-claude-advanced',
      businessLineId: 'business-line-1',
      toolId: 'claude-code',
      name: 'Advanced Claude',
      description: null,
      configJson: JSON.stringify({
        model: 'claude-sonnet-4-6',
        effort: 'max',
        permission_mode: 'plan',
        dangerously_skip_permissions: false,
        allowed_tools: ['Read', 'Edit'],
        disallowed_tools: ['Bash(rm:*)'],
        settings: '{"theme":"dark"}',
        mcp_config: ['/tmp/mcp-a.json', '/tmp/mcp-b.json'],
      }),
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const service = new AgentRunnerService(
      repositoryMock as unknown as AgentToolConfigRepository,
    );
    const serviceAny = service as any;

    const result = await serviceAny.resolveRunnerConfig(
      createProject({
        agentAdapter: 'claude-code',
      }),
      createTask(),
      {
        ...createNode(),
        agentCliId: 'claude-code',
        agentCliConfigId: 'cfg-claude-advanced',
      },
    );

    expect(result.args).toEqual([
      '-p',
      '--output-format',
      'stream-json',
      '--verbose',
      '--model',
      'claude-sonnet-4-6',
      '--effort',
      'max',
      '--permission-mode',
      'plan',
      '--allowed-tools',
      'Read',
      'Edit',
      '--disallowed-tools',
      'Bash(rm:*)',
      '--settings',
      '{"theme":"dark"}',
      '--mcp-config',
      '/tmp/mcp-a.json',
      '/tmp/mcp-b.json',
    ]);
  });

  it('should ignore claude permission mode when dangerous skip is enabled', async () => {
    const repositoryMock = createRepositoryMock();
    repositoryMock.findById.mockResolvedValue({
      id: 'cfg-claude-danger',
      businessLineId: 'business-line-1',
      toolId: 'claude-code',
      name: 'Danger Claude',
      description: null,
      configJson: JSON.stringify({
        permission_mode: 'plan',
        dangerously_skip_permissions: true,
      }),
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const service = new AgentRunnerService(
      repositoryMock as unknown as AgentToolConfigRepository,
    );
    const serviceAny = service as any;

    const result = await serviceAny.resolveRunnerConfig(
      createProject({
        agentAdapter: 'claude-code',
      }),
      createTask(),
      {
        ...createNode(),
        agentCliId: 'claude-code',
        agentCliConfigId: 'cfg-claude-danger',
      },
    );

    expect(result.args).toEqual([
      '-p',
      '--output-format',
      'stream-json',
      '--verbose',
      '--dangerously-skip-permissions',
    ]);
  });

  it('should pass claude env map including auth token and base url', async () => {
    const repositoryMock = createRepositoryMock();
    repositoryMock.findById.mockResolvedValue({
      id: 'cfg-claude-env',
      businessLineId: 'business-line-1',
      toolId: 'claude-code',
      name: 'Claude with env',
      description: null,
      configJson: JSON.stringify({
        auth_type: 'ANTHROPIC_AUTH_TOKEN',
        auth_token: '',
        base_url: '',
        dangerously_skip_permissions: true,
        env: {
          ANTHROPIC_AUTH_TOKEN: 'sk-test-token',
          ANTHROPIC_BASE_URL: 'https://custom-gateway.example.com',
        },
      }),
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const service = new AgentRunnerService(
      repositoryMock as unknown as AgentToolConfigRepository,
    );
    const serviceAny = service as any;

    const result = await serviceAny.resolveRunnerConfig(
      createProject({
        agentAdapter: 'claude-code',
      }),
      createTask(),
      {
        ...createNode(),
        agentCliId: 'claude-code',
        agentCliConfigId: 'cfg-claude-env',
      },
    );

    expect(result.env.ANTHROPIC_AUTH_TOKEN).toBe('sk-test-token');
    expect(result.env.ANTHROPIC_BASE_URL).toBe(
      'https://custom-gateway.example.com',
    );
  });

  it('should handle legacy claude api_key field for backward compatibility', async () => {
    const repositoryMock = createRepositoryMock();
    repositoryMock.findById.mockResolvedValue({
      id: 'cfg-claude-legacy',
      businessLineId: 'business-line-1',
      toolId: 'claude-code',
      name: 'Claude legacy',
      description: null,
      configJson: JSON.stringify({
        api_key: 'sk-legacy-key',
        dangerously_skip_permissions: true,
      }),
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const service = new AgentRunnerService(
      repositoryMock as unknown as AgentToolConfigRepository,
    );
    const serviceAny = service as any;

    const result = await serviceAny.resolveRunnerConfig(
      createProject({
        agentAdapter: 'claude-code',
      }),
      createTask(),
      {
        ...createNode(),
        agentCliId: 'claude-code',
        agentCliConfigId: 'cfg-claude-legacy',
      },
    );

    expect(result.env.ANTHROPIC_API_KEY).toBe('sk-legacy-key');
  });

  it('should pass cursor api_key from persisted config as CURSOR_API_KEY env', async () => {
    const repositoryMock = createRepositoryMock();
    repositoryMock.findById.mockResolvedValue({
      id: 'cfg-cursor-default',
      businessLineId: 'business-line-1',
      toolId: 'cursor-agent',
      name: 'Default Cursor',
      description: null,
      configJson: JSON.stringify({
        api_key: 'crsr_test_key',
      }),
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const service = new AgentRunnerService(
      repositoryMock as unknown as AgentToolConfigRepository,
    );
    const serviceAny = service as any;

    const result = await serviceAny.resolveRunnerConfig(
      createProject({
        agentAdapter: 'cursor-agent',
      }),
      createTask(),
      {
        ...createNode(),
        agentCliId: 'cursor-agent',
        agentCliConfigId: 'cfg-cursor-default',
      },
    );

    expect(result.adapter).toBe('cursor');
    expect(result.env.CURSOR_API_KEY).toBe('crsr_test_key');
    expect(result.env.AINATIVE_AGENT_TOOL_CONFIG_ID).toBe('cfg-cursor-default');
  });

  it('should ignore configured cursor resume session in business-line config', async () => {
    const repositoryMock = createRepositoryMock();
    repositoryMock.findDefaultByBusinessLineIdAndToolId.mockResolvedValue({
      id: 'cfg-cursor-default',
      businessLineId: 'business-line-1',
      toolId: 'cursor-agent',
      name: 'Cursor Default',
      description: null,
      configJson: JSON.stringify({
        resume: 'cursor-session-1',
        additional_params: ['--bad-flag'],
        base_command_override: 'agent-custom',
      }),
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const service = new AgentRunnerService(
      repositoryMock as unknown as AgentToolConfigRepository,
    );
    const serviceAny = service as any;

    const result = await serviceAny.resolveRunnerConfig(
      createProject({
        agentAdapter: 'cursor-agent',
      }),
      createTask(),
      {
        ...createNode(),
        agentCliId: 'cursor-agent',
      },
    );

    expect(result.command).toBe('agent');
    expect(result.args).toEqual([
      '-p',
      '--output-format',
      'stream-json',
      '--sandbox',
      'enabled',
    ]);
  });

  it('should resolve cwd inside project worktree storage path', async () => {
    const repositoryMock = createRepositoryMock();
    repositoryMock.findDefaultByBusinessLineIdAndToolId.mockResolvedValue(null);

    const service = new AgentRunnerService(
      repositoryMock as unknown as AgentToolConfigRepository,
    );
    const serviceAny = service as any;
    const task = createTask({
      gitWorktree: path.join(worktreeRoot, 'wk-20260309-234934'),
    });

    const result = await serviceAny.resolveRunnerConfig(
      createProject({
        agentAdapter: 'codex',
      }),
      task,
      createNode(),
    );

    expect(result.cwd).toBe(path.join(worktreeRoot, 'wk-20260309-234934'));
  });

  it('should ignore configured gemini resume session in business-line config', async () => {
    const repositoryMock = createRepositoryMock();
    repositoryMock.findDefaultByBusinessLineIdAndToolId.mockResolvedValue({
      id: 'cfg-gemini-default',
      businessLineId: 'business-line-1',
      toolId: 'gemini-cli',
      name: 'Gemini Default',
      description: null,
      configJson: JSON.stringify({
        resume: 'gemini-session-1',
        additional_params: ['--bad-flag'],
        base_command_override: 'gemini-custom',
      }),
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const service = new AgentRunnerService(
      repositoryMock as unknown as AgentToolConfigRepository,
    );
    const serviceAny = service as any;

    const result = await serviceAny.resolveRunnerConfig(
      createProject({
        agentAdapter: 'gemini-cli',
      }),
      createTask(),
      {
        ...createNode(),
        agentCliId: 'gemini-cli',
      },
    );

    expect(result.command).toBe('gemini');
    expect(result.args).toEqual(['--output-format', 'stream-json']);
  });

  it('should apply node session id for gemini continuation', async () => {
    const repositoryMock = createRepositoryMock();
    repositoryMock.findDefaultByBusinessLineIdAndToolId.mockResolvedValue(null);

    const service = new AgentRunnerService(
      repositoryMock as unknown as AgentToolConfigRepository,
    );
    const serviceAny = service as any;

    const result = await serviceAny.resolveRunnerConfig(
      createProject({
        agentAdapter: 'gemini-cli',
      }),
      createTask(),
      {
        ...createNode(),
        agentCliId: 'gemini-cli',
        agentCliSessionId: 'gemini-session-1',
      },
    );

    expect(result.args).toEqual([
      '--output-format',
      'stream-json',
      '--yolo',
      '--resume',
      'gemini-session-1',
    ]);
  });

  it('should ignore configured claude resume session in business-line config', async () => {
    const repositoryMock = createRepositoryMock();
    repositoryMock.findDefaultByBusinessLineIdAndToolId.mockResolvedValue({
      id: 'cfg-claude-default',
      businessLineId: 'business-line-1',
      toolId: 'claude-code',
      name: 'Claude Default',
      description: null,
      configJson: JSON.stringify({
        resume: 'claude-session-1',
      }),
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const service = new AgentRunnerService(
      repositoryMock as unknown as AgentToolConfigRepository,
    );
    const serviceAny = service as any;

    const result = await serviceAny.resolveRunnerConfig(
      createProject({
        agentAdapter: 'claude-code',
      }),
      createTask(),
      {
        ...createNode(),
        agentCliId: 'claude-code',
      },
    );

    expect(result.args).toEqual([
      '-p',
      '--output-format',
      'stream-json',
      '--verbose',
      '--permission-mode',
      'auto',
    ]);
  });

  it('should apply node session id for opencode continuation', async () => {
    const repositoryMock = createRepositoryMock();
    repositoryMock.findDefaultByBusinessLineIdAndToolId.mockResolvedValue(null);

    const service = new AgentRunnerService(
      repositoryMock as unknown as AgentToolConfigRepository,
    );
    const serviceAny = service as any;

    const result = await serviceAny.resolveRunnerConfig(
      createProject({
        agentAdapter: 'opencode',
      }),
      createTask(),
      {
        ...createNode(),
        agentCliId: 'opencode',
        agentCliSessionId: 'opencode-session-1',
      },
    );

    expect(result.args).toEqual([
      'run',
      '--format',
      'json',
      '--continue',
      '--session',
      'opencode-session-1',
    ]);
  });

  it('should ignore configured opencode session in business-line config', async () => {
    const repositoryMock = createRepositoryMock();
    repositoryMock.findDefaultByBusinessLineIdAndToolId.mockResolvedValue({
      id: 'cfg-opencode-default',
      businessLineId: 'business-line-1',
      toolId: 'opencode',
      name: 'OpenCode Default',
      description: null,
      configJson: JSON.stringify({
        session: 'opencode-session-1',
        continue: true,
      }),
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const service = new AgentRunnerService(
      repositoryMock as unknown as AgentToolConfigRepository,
    );
    const serviceAny = service as any;

    const result = await serviceAny.resolveRunnerConfig(
      createProject({
        agentAdapter: 'opencode',
      }),
      createTask(),
      {
        ...createNode(),
        agentCliId: 'opencode',
      },
    );

    expect(result.args).toEqual(['run', '--format', 'json']);
  });

  it('should append fork when opencode runtime continuation uses a forking config', async () => {
    const repositoryMock = createRepositoryMock();
    repositoryMock.findDefaultByBusinessLineIdAndToolId.mockResolvedValue({
      id: 'cfg-opencode-default',
      businessLineId: 'business-line-1',
      toolId: 'opencode',
      name: 'OpenCode Default',
      description: null,
      configJson: JSON.stringify({
        fork: true,
      }),
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const service = new AgentRunnerService(
      repositoryMock as unknown as AgentToolConfigRepository,
    );
    const serviceAny = service as any;

    const result = await serviceAny.resolveRunnerConfig(
      createProject({
        agentAdapter: 'opencode',
      }),
      createTask(),
      {
        ...createNode(),
        agentCliId: 'opencode',
        agentCliSessionId: 'opencode-session-1',
      },
    );

    expect(result.args).toEqual([
      'run',
      '--format',
      'json',
      '--continue',
      '--session',
      'opencode-session-1',
      '--fork',
    ]);
  });

  it('should apply node session id for cursor continuation', async () => {
    const repositoryMock = createRepositoryMock();
    repositoryMock.findDefaultByBusinessLineIdAndToolId.mockResolvedValue(null);

    const service = new AgentRunnerService(
      repositoryMock as unknown as AgentToolConfigRepository,
    );
    const serviceAny = service as any;

    const result = await serviceAny.resolveRunnerConfig(
      createProject({
        agentAdapter: 'cursor',
      }),
      createTask(),
      {
        ...createNode(),
        agentCliId: 'cursor',
        agentCliSessionId: 'cursor-session-1',
      },
    );

    expect(result.args).toContain('--resume');
    expect(result.args).toContain('cursor-session-1');
  });

  it('should apply node session id for claude continuation', async () => {
    const repositoryMock = createRepositoryMock();
    repositoryMock.findDefaultByBusinessLineIdAndToolId.mockResolvedValue(null);

    const service = new AgentRunnerService(
      repositoryMock as unknown as AgentToolConfigRepository,
    );
    const serviceAny = service as any;

    const result = await serviceAny.resolveRunnerConfig(
      createProject({
        agentAdapter: 'claude-code',
      }),
      createTask(),
      {
        ...createNode(),
        agentCliId: 'claude-code',
        agentCliSessionId: 'claude-session-1',
      },
    );

    expect(result.args).toEqual([
      '-p',
      '--output-format',
      'stream-json',
      '--verbose',
      '--permission-mode',
      'auto',
      '--resume',
      'claude-session-1',
    ]);
  });

  it('should apply node session id for codex continuation', async () => {
    const repositoryMock = createRepositoryMock();
    repositoryMock.findDefaultByBusinessLineIdAndToolId.mockResolvedValue(null);

    const service = new AgentRunnerService(
      repositoryMock as unknown as AgentToolConfigRepository,
    );
    const serviceAny = service as any;

    const result = await serviceAny.resolveRunnerConfig(
      createProject({
        agentAdapter: 'codex',
      }),
      createTask(),
      {
        ...createNode(),
        agentCliId: 'codex',
        agentCliSessionId: '019d03cc-e251-7430-89c0-d3d662e676a9',
      },
    );

    expect(result.args).toEqual([
      'exec',
      'resume',
      '--json',
      '--skip-git-repo-check',
      '--full-auto',
      '019d03cc-e251-7430-89c0-d3d662e676a9',
      '-',
    ]);
  });

  it('should fallback to fresh codex exec when resume thread is invalid', async () => {
    const service = new AgentRunnerService(
      createRepositoryMock() as unknown as AgentToolConfigRepository,
    );
    const serviceAny = service as any;
    const callbacks = {
      onPrepared: jest.fn(),
    };

    jest
      .spyOn(serviceAny, 'resolveRunnerConfig')
      .mockResolvedValueOnce({
        adapter: 'codex',
        command: 'codex',
        args: [
          'exec',
          'resume',
          '--json',
          '--skip-git-repo-check',
          'thread-1',
          '-',
        ],
        cwd: '/tmp/worktree',
        env: {},
      })
      .mockResolvedValueOnce({
        adapter: 'codex',
        command: 'codex',
        args: ['exec', '--json', '--skip-git-repo-check', '-'],
        cwd: '/tmp/worktree',
        env: {},
      });
    jest
      .spyOn(serviceAny, 'resolvePrompt')
      .mockReturnValueOnce('continue prompt')
      .mockReturnValueOnce('fresh prompt');
    jest
      .spyOn(serviceAny, 'resolveContainerExecRefForTask')
      .mockResolvedValue(null);
    const runWithConfig = jest
      .spyOn(serviceAny, 'runWithConfig')
      .mockResolvedValueOnce({
        success: false,
        interrupted: false,
        exitCode: 1,
        signal: null,
        command: 'codex',
        args: [
          'exec',
          'resume',
          '--json',
          '--skip-git-repo-check',
          'thread-1',
          '-',
        ],
        cwd: '/tmp/worktree',
        durationMs: 120,
        stdout: '',
        stderr:
          'Error: thread/resume: thread/resume failed: no rollout found for thread id thread-1',
        prompt: 'continue prompt',
        sessionId: null,
      })
      .mockResolvedValueOnce({
        success: true,
        interrupted: false,
        exitCode: 0,
        signal: null,
        command: 'codex',
        args: ['exec', '--json', '--skip-git-repo-check', '-'],
        cwd: '/tmp/worktree',
        durationMs: 220,
        stdout: '{"event":"session.started","session_id":"thread-2"}',
        stderr: '',
        prompt: 'fresh prompt',
        sessionId: 'thread-2',
      });

    const result = await service.executeAgentNode({
      task: createTask(),
      node: {
        ...createNode(),
        agentCliSessionId: 'thread-1',
      },
      project: createProject({
        agentAdapter: 'codex',
      }),
      callbacks,
    });

    expect(runWithConfig).toHaveBeenCalledTimes(2);
    expect(callbacks.onPrepared).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ prompt: 'continue prompt' }),
    );
    expect(callbacks.onPrepared).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ prompt: 'fresh prompt' }),
    );
    expect(result).toMatchObject({
      success: true,
      sessionId: 'thread-2',
      clearPreviousSessionId: true,
    });
  });

  it('should not fallback for generic codex execution failures', async () => {
    const service = new AgentRunnerService(
      createRepositoryMock() as unknown as AgentToolConfigRepository,
    );
    const serviceAny = service as any;

    jest.spyOn(serviceAny, 'resolveRunnerConfig').mockResolvedValue({
      adapter: 'codex',
      command: 'codex',
      args: [
        'exec',
        'resume',
        '--json',
        '--skip-git-repo-check',
        'thread-1',
        '-',
      ],
      cwd: '/tmp/worktree',
      env: {},
    });
    jest.spyOn(serviceAny, 'resolvePrompt').mockReturnValue('continue prompt');
    jest
      .spyOn(serviceAny, 'resolveContainerExecRefForTask')
      .mockResolvedValue(null);
    const runWithConfig = jest
      .spyOn(serviceAny, 'runWithConfig')
      .mockResolvedValue({
        success: false,
        interrupted: false,
        exitCode: 1,
        signal: null,
        command: 'codex',
        args: [
          'exec',
          'resume',
          '--json',
          '--skip-git-repo-check',
          'thread-1',
          '-',
        ],
        cwd: '/tmp/worktree',
        durationMs: 120,
        stdout: '',
        stderr: 'Error: network timeout',
        prompt: 'continue prompt',
        sessionId: null,
      });

    const result = await service.executeAgentNode({
      task: createTask(),
      node: {
        ...createNode(),
        agentCliSessionId: 'thread-1',
      },
      project: createProject({
        agentAdapter: 'codex',
      }),
    });

    expect(runWithConfig).toHaveBeenCalledTimes(1);
    expect(result.clearPreviousSessionId).toBeUndefined();
  });

  it('should not fallback to a fresh prompt when a follow-up resume fails', async () => {
    const service = new AgentRunnerService(
      createRepositoryMock() as unknown as AgentToolConfigRepository,
    );
    const serviceAny = service as any;

    jest.spyOn(serviceAny, 'resolveRunnerConfig').mockResolvedValue({
      adapter: 'codex',
      command: 'codex',
      args: ['exec', '--json', '--skip-git-repo-check', '-'],
      cwd: '/tmp/worktree',
      env: {},
    });
    jest.spyOn(serviceAny, 'resolvePrompt').mockReturnValue('continue prompt');
    jest
      .spyOn(serviceAny, 'resolveContainerExecRefForTask')
      .mockResolvedValue(null);
    const runWithConfig = jest
      .spyOn(serviceAny, 'runWithConfig')
      .mockResolvedValueOnce({
        success: false,
        interrupted: false,
        exitCode: 1,
        signal: null,
        command: 'codex',
        args: [
          'exec',
          'resume',
          '--json',
          '--skip-git-repo-check',
          'thread-1',
          '-',
        ],
        cwd: '/tmp/worktree',
        durationMs: 120,
        stdout: '',
        stderr:
          'Error: thread/resume: thread/resume failed: no rollout found for thread id thread-1',
        prompt: 'continue prompt',
        sessionId: null,
      });

    const result = await service.executeAgentNode({
      task: createTask(),
      node: {
        ...createNode(),
        agentCliSessionId: 'thread-1',
        runtimeJson: {
          pendingUserMessage: '继续',
        },
      },
      project: createProject({
        agentAdapter: 'codex',
      }),
    });

    expect(runWithConfig).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      success: false,
      prompt: 'continue prompt',
      clearPreviousSessionId: true,
    });
  });

  it('should use rendered follow-up message only when resuming an existing cli session', () => {
    const service = new AgentRunnerService(
      createRepositoryMock() as unknown as AgentToolConfigRepository,
    );
    const serviceAny = service as any;

    const prompt = serviceAny.resolvePrompt(
      createTask({ gitBranch: 'feature/runtime-branch' }),
      {
        ...createNode(),
        agentCliSessionId: 'session-1',
        runtimeJson: {
          pendingUserMessage: 'Please continue from {{gitBranch}}',
        },
      },
      createProject(),
      {
        adapter: 'codex',
      },
    );

    expect(prompt).toBe('Please continue from feature/runtime-branch');
  });

  it('should compose node prompt and follow-up message before a session is established', () => {
    const service = new AgentRunnerService(
      createRepositoryMock() as unknown as AgentToolConfigRepository,
    );
    const serviceAny = service as any;

    const prompt = serviceAny.resolvePrompt(
      createTask(),
      {
        ...createNode(),
        runtimeJson: {
          pendingUserMessage: 'Please continue from the previous result',
        },
      },
      createProject(),
      {
        adapter: 'codex',
      },
    );

    expect(prompt).toBe(
      ['Run task', 'Please continue from the previous result'].join('\n\n'),
    );
  });

  it('should not fall back to task prompt when node prompt is empty', () => {
    const service = new AgentRunnerService(
      createRepositoryMock() as unknown as AgentToolConfigRepository,
    );
    const serviceAny = service as any;

    const prompt = serviceAny.resolvePrompt(
      createTask({
        prompt: 'Task {{taskId}}',
      }),
      {
        ...createNode(),
        input: {
          taskInput: 'Task {{taskId}}',
          nodeInput: '',
        },
      },
      createProject(),
      {
        adapter: 'codex',
      },
    );

    expect(prompt).toBe('');
  });

  it('should render supported prompt template variables before execution', () => {
    const service = new AgentRunnerService(
      createRepositoryMock() as unknown as AgentToolConfigRepository,
    );
    const serviceAny = service as any;

    const prompt = serviceAny.resolvePrompt(
      createTask({
        title: 'Fix checkout',
        prompt:
          'Task {{taskTitle}} on {{gitBranch}} from {{projectName}} in {{gitWorktree}}',
      }),
      {
        ...createNode(),
        name: 'Review step',
        input: {
          taskInput:
            'Task {{taskTitle}} on {{gitBranch}} from {{projectName}} in {{gitWorktree}}',
          nodeInput:
            'Use {{agentAdapter}} with {{agentToolConfigName}} at {{gitWorktreePath}}',
        },
      },
      createProject(),
      {
        adapter: 'codex',
        agentToolConfigId: 'cfg-1',
        agentToolConfigName: 'Default Codex',
      },
      {
        gitBranch: 'feature/runtime-branch',
        gitBaseBranch: 'develop',
        gitWorktree: 'wk-20260318-101500',
        gitWorktreePath: '/tmp/worktrees/wk-20260318-101500',
      },
    );

    expect(prompt).toBe(
      'Use codex with Default Codex at /tmp/worktrees/wk-20260318-101500',
    );
  });

  it('should render pending follow-up message placeholders before execution', () => {
    const service = new AgentRunnerService(
      createRepositoryMock() as unknown as AgentToolConfigRepository,
    );
    const serviceAny = service as any;

    const prompt = serviceAny.resolvePrompt(
      createTask({
        prompt: 'Task {{taskId}}',
      }),
      {
        ...createNode(),
        input: {
          taskInput: 'Task {{taskId}}',
          nodeInput: 'Run task',
        },
        runtimeJson: {
          pendingUserMessage: 'Please continue on {{gitBranch}}',
        },
      },
      createProject(),
      {
        adapter: 'codex',
      },
      {
        gitBranch: 'feature/runtime-branch',
        gitBaseBranch: 'develop',
        gitWorktree: 'wk-20260318-101500',
        gitWorktreePath: '/tmp/worktrees/wk-20260318-101500',
      },
    );

    expect(prompt).toBe(
      ['Run task', 'Please continue on feature/runtime-branch'].join('\n\n'),
    );
  });

  it('should extract agent session id from json and plain text output', () => {
    const service = new AgentRunnerService(
      createRepositoryMock() as unknown as AgentToolConfigRepository,
    );
    const serviceAny = service as any;

    expect(
      serviceAny.extractAgentSessionId(
        JSON.stringify({
          type: 'thread.started',
          thread_id: '019d03cc-e251-7430-89c0-d3d662e676a9',
        }),
      ),
    ).toBe('019d03cc-e251-7430-89c0-d3d662e676a9');
    expect(
      serviceAny.extractAgentSessionId(
        JSON.stringify({
          event: 'session.started',
          session_id: 'session-json-1',
        }),
      ),
    ).toBe('session-json-1');
    expect(
      serviceAny.extractAgentSessionId('conversation_id=conversation-text-1'),
    ).toBe('conversation-text-1');
  });

  it('should redact secret env values from execution logs', () => {
    const service = new AgentRunnerService(
      createRepositoryMock() as unknown as AgentToolConfigRepository,
    );
    const serviceAny = service as any;

    const payload = serviceAny.buildExecutionLogPayload({
      executionContext: {
        taskId: 'task-1',
        nodeId: 'node-1',
        projectId: 'project-1',
        businessLineId: 'business-line-1',
      },
      config: {
        adapter: 'cursor',
        command: 'agent',
        args: ['-p'],
        cwd: '/tmp/worktree',
        env: {
          CURSOR_API_KEY: 'crsr_secret',
        },
      },
      prompt: 'prompt',
      mergedEnv: {
        CURSOR_API_KEY: 'crsr_secret',
        PATH: '/usr/bin',
      },
    });

    expect(payload.hasCursorApiKey).toBe(true);
    expect(payload.envKeys).toEqual(['CURSOR_API_KEY', 'PATH']);
    expect(JSON.stringify(payload)).not.toContain('crsr_secret');
  });

  it('should treat interrupted execution as failed even when process exits with code 0', async () => {
    const stdout = new EventEmitter();
    const stderr = new EventEmitter();
    const childProcess = new EventEmitter() as any;
    childProcess.stdout = stdout;
    childProcess.stderr = stderr;
    childProcess.stdin = {
      write: jest.fn(),
      end: jest.fn(),
    };
    childProcess.kill = jest.fn().mockReturnValue(true);

    const launcher = {
      spawn: jest.fn().mockReturnValue(childProcess),
    };
    const containerExecutionConfig = {
      getRunnerWorkspace: jest.fn().mockReturnValue('/workspace'),
    };
    const service = new AgentRunnerService(
      createRepositoryMock() as unknown as AgentToolConfigRepository,
      undefined as any,
      undefined as any,
      undefined as any,
      undefined as any,
      containerExecutionConfig as any,
      launcher as any,
    );
    const serviceAny = service as any;

    const resultPromise = serviceAny.runWithConfig(
      {
        adapter: 'codex',
        command: 'codex',
        args: ['exec', '--json', '-'],
        cwd: '/tmp/worktree',
        env: {},
      },
      'Run task',
      {
        taskId: 'task-1',
        nodeId: 'node-1',
        projectId: 'project-1',
        businessLineId: 'business-line-1',
      },
      undefined,
      'container-123',
    );

    expect(service.interruptExecution('node-1')).toBe(true);
    expect(childProcess.kill).toHaveBeenCalledWith('SIGTERM');

    childProcess.emit('close', 0, null);

    await expect(resultPromise).resolves.toMatchObject({
      success: false,
      interrupted: true,
      exitCode: 0,
      signal: null,
      errorMessage: 'Agent execution interrupted',
    });
  });

  it('should pass GEMINI_API_KEY from process env into runner environment', () => {
    const previousGeminiApiKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = 'gemini_secret';

    try {
      const service = new AgentRunnerService(
        createRepositoryMock() as unknown as AgentToolConfigRepository,
      );
      const serviceAny = service as any;

      const env = serviceAny.buildRunnerEnvironment({
        PATH: '/usr/bin',
      });

      expect(env.PATH).toBe('/usr/bin');
      expect(env.GEMINI_API_KEY).toBe('gemini_secret');
    } finally {
      if (previousGeminiApiKey === undefined) {
        delete process.env.GEMINI_API_KEY;
      } else {
        process.env.GEMINI_API_KEY = previousGeminiApiKey;
      }
    }
  });

  it('should not forward host PATH into docker exec environment', () => {
    const previousPath = process.env.PATH;
    const previousHome = process.env.HOME;
    const previousGeminiApiKey = process.env.GEMINI_API_KEY;
    process.env.PATH = '/host/bin:/usr/bin';
    process.env.HOME = '/Users/fuzhifei';
    process.env.GEMINI_API_KEY = 'gemini_secret';

    try {
      const service = new AgentRunnerService(
        createRepositoryMock() as unknown as AgentToolConfigRepository,
      );
      const serviceAny = service as any;

      const env = serviceAny.buildDockerExecEnvironment({
        CURSOR_API_KEY: 'crsr_secret',
      });

      expect(env).toEqual(
        expect.objectContaining({
          CURSOR_API_KEY: 'crsr_secret',
          GEMINI_API_KEY: 'gemini_secret',
        }),
      );
      expect(env.PATH).toBeUndefined();
      expect(env.HOME).toBeUndefined();
    } finally {
      if (previousPath === undefined) {
        delete process.env.PATH;
      } else {
        process.env.PATH = previousPath;
      }
      if (previousHome === undefined) {
        delete process.env.HOME;
      } else {
        process.env.HOME = previousHome;
      }
      if (previousGeminiApiKey === undefined) {
        delete process.env.GEMINI_API_KEY;
      } else {
        process.env.GEMINI_API_KEY = previousGeminiApiKey;
      }
    }
  });

  it('should return a diagnostic docker handoff error when docker exec handoff is incomplete', async () => {
    const repositoryMock = createRepositoryMock();
    const containerExecutionConfig = {
      getRunnerWorkspace: jest.fn().mockReturnValue('/workspace'),
    };
    const service = new AgentRunnerService(
      repositoryMock as unknown as AgentToolConfigRepository,
      undefined as any,
      undefined as any,
      undefined as any,
      undefined as any,
      containerExecutionConfig as any,
    );
    const serviceAny = service as any;

    const result = await serviceAny.runWithConfig(
      {
        adapter: 'codex',
        command: 'codex',
        args: ['exec', '--json', '-'],
        cwd: '/tmp/worktree',
        env: {},
      },
      'Run task',
      {
        taskId: 'task-1',
        nodeId: 'node-1',
        projectId: 'project-1',
        businessLineId: 'business-line-1',
      },
    );

    expect(result.success).toBe(false);
    expect(result.errorMessage).toContain(
      'Runner execution requires docker exec handoff',
    );
    expect(result.errorMessage).toContain('containerExecRef is missing');
    expect(result.errorMessage).toContain(
      'DockerExecProcessLauncherService is unavailable',
    );
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it('should use docker exec launcher when docker handoff is complete', async () => {
    const repositoryMock = createRepositoryMock();
    const stdout = new EventEmitter();
    const stderr = new EventEmitter();
    const childProcess = new EventEmitter() as any;
    childProcess.stdout = stdout;
    childProcess.stderr = stderr;
    childProcess.stdin = {
      write: jest.fn(),
      end: jest.fn(),
    };
    childProcess.kill = jest.fn().mockReturnValue(true);

    const launcher = {
      spawn: jest.fn().mockReturnValue(childProcess),
    };
    const containerExecutionConfig = {
      getRunnerWorkspace: jest.fn().mockReturnValue('/workspace'),
    };
    const service = new AgentRunnerService(
      repositoryMock as unknown as AgentToolConfigRepository,
      undefined as any,
      undefined as any,
      undefined as any,
      undefined as any,
      containerExecutionConfig as any,
      launcher as any,
    );
    const serviceAny = service as any;

    const resultPromise = serviceAny.runWithConfig(
      {
        adapter: 'codex',
        command: 'codex',
        args: ['exec', '--json', '-'],
        cwd: '/tmp/worktree',
        env: {
          OPENAI_API_KEY: 'sk-test',
        },
      },
      'Run task',
      {
        taskId: 'task-1',
        nodeId: 'node-1',
        projectId: 'project-1',
        businessLineId: 'business-line-1',
      },
      undefined,
      'container-123',
    );

    stdout.emit(
      'data',
      '{"event":"session.started","session_id":"session-1"}\n',
    );
    childProcess.emit('close', 0, null);

    await expect(resultPromise).resolves.toMatchObject({
      success: true,
      exitCode: 0,
      sessionId: 'session-1',
    });
    expect(launcher.spawn).toHaveBeenCalledWith(
      expect.objectContaining({
        containerRef: 'container-123',
        command: 'codex',
        args: ['exec', '--json', '-'],
        cwd: '/workspace',
        env: expect.objectContaining({
          OPENAI_API_KEY: 'sk-test',
        }),
      }),
    );
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it('should use runnerContainerCwd for docker exec when provided', async () => {
    const repositoryMock = createRepositoryMock();
    const stdout = new EventEmitter();
    const stderr = new EventEmitter();
    const childProcess = new EventEmitter() as any;
    childProcess.stdout = stdout;
    childProcess.stderr = stderr;
    childProcess.stdin = {
      write: jest.fn(),
      end: jest.fn(),
    };
    childProcess.kill = jest.fn().mockReturnValue(true);

    const launcher = {
      spawn: jest.fn().mockReturnValue(childProcess),
    };
    const containerExecutionConfig = {
      getRunnerWorkspace: jest.fn().mockReturnValue('/workspace'),
    };
    const service = new AgentRunnerService(
      repositoryMock as unknown as AgentToolConfigRepository,
      undefined as any,
      undefined as any,
      undefined as any,
      undefined as any,
      containerExecutionConfig as any,
      launcher as any,
    );
    const serviceAny = service as any;

    const resultPromise = serviceAny.runWithConfig(
      {
        adapter: 'codex',
        command: 'codex',
        args: ['exec', '--json', '-'],
        cwd: '/host/worktrees/wk-1/packages/app',
        runnerContainerCwd: '/workspace/packages/app',
        env: {},
      },
      'Run task',
      {
        taskId: 'task-1',
        nodeId: 'node-1',
        projectId: 'project-1',
        businessLineId: 'business-line-1',
      },
      undefined,
      'container-123',
    );

    stdout.emit(
      'data',
      '{"event":"session.started","session_id":"session-1"}\n',
    );
    childProcess.emit('close', 0, null);

    await expect(resultPromise).resolves.toMatchObject({
      success: true,
      exitCode: 0,
      sessionId: 'session-1',
    });
    expect(launcher.spawn).toHaveBeenCalledWith(
      expect.objectContaining({
        cwd: '/workspace/packages/app',
      }),
    );
    expect(containerExecutionConfig.getRunnerWorkspace).not.toHaveBeenCalled();
  });

  it('should resolve runnerContainerCwd from runnerWorkingSubdirectory on runner plane', async () => {
    const repositoryMock = createRepositoryMock();
    const service = new AgentRunnerService(
      repositoryMock as unknown as AgentToolConfigRepository,
    );
    const resolver = (
      service as unknown as {
        configResolver: AgentExecutionConfigResolverService;
      }
    ).configResolver;
    const wt = path.join(worktreeRoot, 'task-1');
    const project = createProject({
      runnerWorkingSubdirectory: 'packages/app',
    });
    const task = createTask({ gitWorktree: wt });
    const node = createNode();

    const config = await resolver.resolveExecutionConfig(project, task, node, {
      executionPlane: 'runner',
      gitWorktreePath: wt,
      runnerWorkspaceMount: '/workspace',
    });

    expect(config.cwd).toBe(path.join(wt, 'packages', 'app'));
    expect(config.runnerContainerCwd).toBe('/workspace/packages/app');
  });
});
