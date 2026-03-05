import path from 'path';
import { AgentToolConfigRepository } from '../business-lines/infrastructure/persistence/agent-tool-config.repository';
import { Project } from '../projects/domain/project';
import { resolveAinativeDataRootDir } from '../utils/workspace-paths';
import { Task } from './domain/task';
import { TaskNode } from './domain/task-node';
import { AgentRunnerService } from './agent-runner.service';
import { TaskMode } from './dto/task-mode.enum';
import { TaskNodeType } from './dto/task-node-type.enum';
import { TaskStatus } from './dto/task-status.enum';

const worktreeRoot = path.resolve(
  resolveAinativeDataRootDir(),
  'business-line-1',
  'worktrees',
  'project-1',
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
  cliToolId: null,
  agentToolConfigId: null,
  clientInputSnapshot: null,
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
  nodeType: TaskNodeType.agent,
  input: {
    prompt: 'Run task',
  },
  output: null,
  requiresApproval: false,
  status: TaskStatus.todo,
  attempt: 0,
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

describe('AgentRunnerService', () => {
  it('should apply business-line default agent tool config overrides', async () => {
    const repositoryMock = createRepositoryMock();
    repositoryMock.findDefaultByBusinessLineIdAndToolId.mockResolvedValue({
      id: 'cfg-retail-codex',
      businessLineId: 'business-line-1',
      toolId: 'codex',
      name: 'Retail Codex',
      description: null,
      configJson: JSON.stringify({
        base_command_override: 'codex-business',
        additional_params: ['exec', '--full-auto', '-'],
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
    expect(result.command).toBe('codex-business');
    expect(result.args).toEqual(['exec', '--full-auto', '-']);
    expect(result.env).toMatchObject({
      BASE_ENV: 'base',
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
        base_command_override: 'codex-explicit',
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

    const result = await serviceAny.resolveRunnerConfig(
      project,
      createTask({
        agentToolConfigId: 'cfg-explicit',
      }),
      createNode(),
    );

    expect(result.command).toBe('codex-explicit');
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
              base_command_override: 'codex-alias',
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

    expect(result.command).toBe('codex-alias');
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
            base_command_override: 'codex-legacy',
          },
        },
      ],
    });

    const result = await serviceAny.resolveRunnerConfig(
      project,
      createTask(),
      createNode(),
    );

    expect(result.command).toBe('codex-legacy');
    expect(result.env.AINATIVE_AGENT_TOOL_CONFIG_ID).toBe('cfg-global-codex');
  });

  it('should ignore invalid persisted config json and keep legacy runner config', async () => {
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

    const result = await serviceAny.resolveRunnerConfig(
      project,
      createTask(),
      createNode(),
    );

    expect(result.command).toBe('legacy-command');
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

    const result = await serviceAny.resolveRunnerConfig(
      project,
      createTask(),
      createNode(),
    );

    expect(result.adapter).toBe('gemini');
    expect(result.command).toBe('gemini');
    expect(result.args).toEqual(['-p']);
  });
});
