import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { TaskArtifactType } from '../../../../dto/task-artifact-type.enum';
import { TaskArtifactFileRepository } from './task-artifact.repository';

describe('TaskArtifactFileRepository', () => {
  const originalDataRootDir = process.env.AINATIVE_DATA_ROOT_DIR;
  let dataRootDir: string;
  let repository: TaskArtifactFileRepository;

  beforeEach(async () => {
    dataRootDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'ainative-task-artifact-repo-'),
    );
    process.env.AINATIVE_DATA_ROOT_DIR = dataRootDir;
    repository = new TaskArtifactFileRepository();
  });

  afterEach(async () => {
    if (originalDataRootDir === undefined) {
      delete process.env.AINATIVE_DATA_ROOT_DIR;
    } else {
      process.env.AINATIVE_DATA_ROOT_DIR = originalDataRootDir;
    }

    await fs.rm(dataRootDir, { recursive: true, force: true });
  });

  it('should store artifacts by task and id', async () => {
    const createdArtifact = await repository.create({
      taskId: 'task-1',
      taskNodeId: 'node-1',
      artifactType: TaskArtifactType.diff,
      name: 'changes.diff',
      downloadUrl: null,
      content: 'diff --git a/a.ts b/a.ts',
      metadata: { changedFiles: ['a.ts'] },
    });

    const byTask = await repository.findByTaskId('task-1');
    const byId = await repository.findById(createdArtifact.id);

    expect(byTask).toHaveLength(1);
    expect(byTask[0]).toEqual(createdArtifact);
    expect(byId).toEqual(createdArtifact);

    const byTaskFile = path.join(
      dataRootDir,
      'meta',
      'task-artifacts',
      'by-task',
      'task-1.jsonl',
    );
    await expect(fs.readFile(byTaskFile, 'utf-8')).resolves.toContain(
      'changes.diff',
    );
  });

  it('should return artifacts in reverse chronological order', async () => {
    await repository.create({
      taskId: 'task-1',
      taskNodeId: null,
      artifactType: TaskArtifactType.report,
      name: 'older.md',
      downloadUrl: null,
      content: 'older',
      metadata: null,
    });

    await new Promise((resolve) => setTimeout(resolve, 10));

    await repository.create({
      taskId: 'task-1',
      taskNodeId: null,
      artifactType: TaskArtifactType.report,
      name: 'newer.md',
      downloadUrl: null,
      content: 'newer',
      metadata: null,
    });

    const artifacts = await repository.findByTaskId('task-1');

    expect(artifacts.map((artifact) => artifact.name)).toEqual([
      'newer.md',
      'older.md',
    ]);
  });
});
