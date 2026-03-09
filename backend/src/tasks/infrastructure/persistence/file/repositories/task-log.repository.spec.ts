import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { TaskLogLevel } from '../../../../dto/task-log-level.enum';
import { TaskLogFileRepository } from './task-log.repository';

describe('TaskLogFileRepository', () => {
  const originalDataRootDir = process.env.AINATIVE_DATA_ROOT_DIR;
  let dataRootDir: string;
  let repository: TaskLogFileRepository;

  beforeEach(async () => {
    dataRootDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'ainative-task-log-repo-'),
    );
    process.env.AINATIVE_DATA_ROOT_DIR = dataRootDir;
    repository = new TaskLogFileRepository();
  });

  afterEach(async () => {
    if (originalDataRootDir === undefined) {
      delete process.env.AINATIVE_DATA_ROOT_DIR;
    } else {
      process.env.AINATIVE_DATA_ROOT_DIR = originalDataRootDir;
    }

    await fs.rm(dataRootDir, { recursive: true, force: true });
  });

  it('should persist logs to task-scoped jsonl files', async () => {
    const createdLog = await repository.create({
      taskId: 'task-1',
      taskNodeId: 'node-1',
      level: TaskLogLevel.info,
      message: 'queued',
      payload: { actor: 'user-1' },
    });

    const logs = await repository.findByTaskIdSince({
      taskId: 'task-1',
    });

    expect(logs).toHaveLength(1);
    expect(logs[0]).toEqual(createdLog);

    const logFile = path.join(dataRootDir, 'meta', 'task-logs', 'task-1.jsonl');
    await expect(fs.readFile(logFile, 'utf-8')).resolves.toContain('queued');
  });

  it('should filter incremental reads by since cursor', async () => {
    const firstLog = await repository.create({
      taskId: 'task-1',
      taskNodeId: null,
      level: TaskLogLevel.info,
      message: 'first',
      payload: null,
    });

    await new Promise((resolve) => setTimeout(resolve, 10));

    await repository.create({
      taskId: 'task-1',
      taskNodeId: null,
      level: TaskLogLevel.warn,
      message: 'second',
      payload: null,
    });

    const logs = await repository.findByTaskIdSince({
      taskId: 'task-1',
      since: firstLog.createdAt,
    });

    expect(logs).toHaveLength(1);
    expect(logs[0].message).toBe('second');
  });
});
