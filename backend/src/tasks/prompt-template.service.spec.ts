import { Project } from '../projects/domain/project';
import { Task } from './domain/task';
import { TaskNode } from './domain/task-node';
import { TaskMode } from './dto/task-mode.enum';
import { TaskStatus } from './dto/task-status.enum';
import { PromptTemplateService } from './prompt-template.service';

const createTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'task-1',
  projectId: 'project-1',
  businessLineId: 'business-line-1',
  mode: TaskMode.workflow,
  title: 'Fix checkout flow',
  prompt: 'Investigate {{gitBranch}} against {{projectDefaultBranch}}',
  status: TaskStatus.todo,
  gitBranch: 'feature/checkout-fix',
  gitBaseBranch: 'main',
  gitWorktree: 'wk-20260318-101500',
  configJson: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  ...overrides,
});

const createNode = (overrides: Partial<TaskNode> = {}): TaskNode => ({
  id: 'node-1',
  taskId: 'task-1',
  nodeOrder: 1,
  name: 'Implement fix',
  input: {
    taskInput: 'task input',
    nodeInput: 'node input',
  },
  agentCliId: 'codex',
  agentCliConfigId: 'cfg-1',
  agentClioutput: null,
  agentCliSessionId: null,
  loopJson: {
    enabled: false,
    loopCount: 0,
    maxLoops: 1,
  },
  runtimeJson: null,
  status: TaskStatus.todo,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const createProject = (overrides: Partial<Project> = {}): Project => ({
  id: 'project-1',
  businessLineId: 'business-line-1',
  name: 'Storefront',
  description: null,
  gitUrl: 'git@example.com:group/storefront.git',
  defaultBranch: 'main',
  configJson: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  ...overrides,
});

describe('PromptTemplateService', () => {
  const service = new PromptTemplateService();

  it('should render the supported prompt variables from runtime and domain context', () => {
    const result = service.renderPromptTemplate(
      [
        '{{taskTitle}}',
        '{{taskId}}',
        '{{projectName}}',
        '{{projectGitUrl}}',
        '{{projectDefaultBranch}}',
        '{{gitBranch}}',
        '{{gitBaseBranch}}',
        '{{gitWorktree}}',
        '{{gitWorktreePath}}',
      ].join('\n'),
      {
        task: createTask(),
        node: createNode(),
        project: createProject(),
        runtime: {
          gitBranch: 'feature/runtime-branch',
          gitBaseBranch: 'develop',
          gitWorktree: 'wk-20260318-101500',
          gitWorktreePath: '/tmp/worktrees/wk-20260318-101500',
        },
      },
    );

    expect(result).toBe(
      [
        'Fix checkout flow',
        'task-1',
        'Storefront',
        'git@example.com:group/storefront.git',
        'main',
        'feature/runtime-branch',
        'develop',
        'wk-20260318-101500',
        '/tmp/worktrees/wk-20260318-101500',
      ].join('\n'),
    );
  });

  it('should render supported agent variables and preserve unsupported variables', () => {
    const result = service.renderPromptTemplate(
      '{{gitWorktree}}|{{gitWorktreePath}}|{{unknownVariable}}|{{nodeName}}|{{agentAdapter}}|{{agentToolConfigId}}|{{agentToolConfigName}}',
      {
        task: createTask({
          gitWorktree: '/tmp/worktrees/wk-20260318-101500',
        }),
        node: createNode(),
        project: createProject(),
        runtime: {
          agentAdapter: 'codex',
          agentToolConfigId: 'cfg-default',
          agentToolConfigName: 'Default Codex',
        },
      },
    );

    expect(result).toBe(
      'wk-20260318-101500|/tmp/worktrees/wk-20260318-101500|{{unknownVariable}}|{{nodeName}}|codex|cfg-default|Default Codex',
    );
  });
});
