import { TaskNode } from '../domain/task-node';
import { TaskStatus } from '../dto/task-status.enum';
import { TaskConfigResolverService } from './task-config-resolver.service';

const createNode = (overrides: Partial<TaskNode> = {}): TaskNode => ({
  id: 'node-1',
  taskId: 'task-1',
  nodeOrder: 1,
  name: 'Agent node',
  input: null,
  agentClioutput: null,
  agentCliSessionId: null,
  agentCliId: 'codex',
  agentCliConfigId: 'cfg-1',
  configJson: null,
  loopJson: null,
  runtimeJson: null,
  beforeRunCommitSha: null,
  afterRunCommitSha: null,
  status: TaskStatus.todo,
  startedAt: null,
  finishedAt: null,
  createdAt: new Date('2026-04-13T00:00:00.000Z'),
  updatedAt: new Date('2026-04-13T00:00:00.000Z'),
  ...overrides,
});

describe('TaskConfigResolverService', () => {
  const service = new TaskConfigResolverService();

  it('should build node config with requiresArtifact only when requested', () => {
    expect(
      service.buildTaskNodeConfig({
        requiresApproval: false,
        requiresArtifact: true,
      }),
    ).toEqual({
      requiresArtifact: true,
    });
  });

  it('should read requiresArtifact from node config', () => {
    const node = createNode({
      configJson: {
        requiresArtifact: true,
      },
    });

    expect(service.readNodeRequiresArtifact(node)).toBe(true);
  });

  it('should default requiresArtifact to false', () => {
    expect(service.readNodeRequiresArtifact(createNode())).toBe(false);
  });
});
