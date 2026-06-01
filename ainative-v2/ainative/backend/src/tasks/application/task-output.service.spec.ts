import { mkdtemp, rm } from 'fs/promises';
import os from 'os';
import path from 'path';
import { ConfigService } from '@nestjs/config';
import { AgentCliAdapterRegistry } from '../../agent-execution/agent-cli/agent-cli-adapter.registry';
import { ProjectWorkspacePathsService } from '../../project-workspace/project-workspace-paths.service';
import { TaskOutputService } from './task-output.service';
import { Task } from '../domain/task';
import { TaskNode } from '../domain/task-node';
import { TaskMode } from '../dto/task-mode.enum';
import { TaskStatus } from '../dto/task-status.enum';

const createTask = (): Task => ({
  id: 'task-1',
  projectId: 'project-1',
  businessLineId: 'business-line-1',
  mode: TaskMode.workflow,
  title: 'Workflow task',
  prompt: 'task prompt',
  status: TaskStatus.inProgress,
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

const createNode = (): TaskNode => ({
  id: 'node-1',
  taskId: 'task-1',
  nodeOrder: 1,
  name: 'Agent node',
  input: {
    taskInput: 'task prompt',
    nodeInput: 'Run task',
  },
  agentClioutput: null,
  agentCliSessionId: null,
  agentCliId: 'codex',
  agentCliConfigId: 'cfg-1',
  configJson: null,
  loopJson: {
    enabled: false,
    loopCount: 0,
    maxLoops: 1,
  },
  runtimeJson: null,
  status: TaskStatus.inProgress,
  startedAt: new Date('2026-03-19T10:00:00.000Z'),
  finishedAt: null,
  createdAt: new Date('2026-03-19T10:00:00.000Z'),
  updatedAt: new Date('2026-03-19T10:05:00.000Z'),
});

const createTaskOutputService = (): TaskOutputService => {
  const configService = new ConfigService();

  return new TaskOutputService(
    new ProjectWorkspacePathsService(configService),
    new AgentCliAdapterRegistry(),
  );
};

describe('TaskOutputService', () => {
  const originalDataRootDir = process.env.AINATIVE_DATA_ROOT_DIR;

  afterEach(() => {
    if (originalDataRootDir === undefined) {
      delete process.env.AINATIVE_DATA_ROOT_DIR;
    } else {
      process.env.AINATIVE_DATA_ROOT_DIR = originalDataRootDir;
    }
  });

  it('should append structured jsonl records and classify injected Codex prompts as user messages', async () => {
    const tempRootDir = await mkdtemp(
      path.join(os.tmpdir(), 'ainative-task-output-'),
    );
    process.env.AINATIVE_DATA_ROOT_DIR = tempRootDir;

    try {
      const service = createTaskOutputService();
      const task = createTask();
      const node = createNode();

      await service.appendNodeOutputJsonlRecords({
        task,
        node,
        records: [
          {
            type: 'user_message',
            message: 'Investigate the login flow regression',
            created_at: '2026-03-19T10:01:00.000Z',
            source: 'ainative_injected_prompt',
          },
        ],
      });

      const messages = await service.readNodeOutputMessages(task, node);

      expect(messages).toEqual([
        expect.objectContaining({
          role: 'user',
          content: JSON.stringify({
            type: 'user_message',
            message: 'Investigate the login flow regression',
            created_at: '2026-03-19T10:01:00.000Z',
            source: 'ainative_injected_prompt',
          }),
          taskNodeId: node.id,
        }),
      ]);
      expect(messages[0]?.createdAt.toISOString()).toBe(
        '2026-03-19T10:01:00.000Z',
      );
    } finally {
      await rm(tempRootDir, { recursive: true, force: true });
    }
  });

  it('should cache parsed node output messages until the output file changes', async () => {
    const tempRootDir = await mkdtemp(
      path.join(os.tmpdir(), 'ainative-task-output-cache-'),
    );
    process.env.AINATIVE_DATA_ROOT_DIR = tempRootDir;

    try {
      const service = createTaskOutputService();
      const task = createTask();
      const node = createNode();

      await service.appendNodeOutputJsonlRecords({
        task,
        node,
        records: [
          {
            type: 'assistant_message',
            message: 'first',
            created_at: '2026-03-19T10:02:00.000Z',
          },
        ],
      });

      const firstRead = await service.readNodeOutputMessagesWithMetrics(
        task,
        node,
      );
      const secondRead = await service.readNodeOutputMessagesWithMetrics(
        task,
        node,
      );

      expect(firstRead.messages).toHaveLength(1);
      expect(firstRead.metrics.cacheHit).toBe(false);
      expect(secondRead.messages).toHaveLength(1);
      expect(secondRead.metrics.cacheHit).toBe(true);

      await service.appendNodeOutputJsonlRecords({
        task,
        node,
        records: [
          {
            type: 'assistant_message',
            message: 'second',
            created_at: '2026-03-19T10:03:00.000Z',
          },
        ],
      });

      const thirdRead = await service.readNodeOutputMessagesWithMetrics(
        task,
        node,
      );

      expect(thirdRead.metrics.cacheHit).toBe(false);
      expect(thirdRead.messages).toHaveLength(2);
    } finally {
      await rm(tempRootDir, { recursive: true, force: true });
    }
  });
});
