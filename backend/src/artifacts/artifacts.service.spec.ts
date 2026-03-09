import { ArtifactsService } from './artifacts.service';
import { TaskArtifactType } from '../tasks/dto/task-artifact-type.enum';

const createArtifact = (overrides?: Partial<any>) => ({
  id: 'artifact-1',
  taskId: 'task-1',
  taskNodeId: 'node-1',
  artifactType: TaskArtifactType.diff,
  name: 'changes.diff',
  downloadUrl: null,
  content: `# Task task-1 git diff

\`\`\`diff
diff --git a/src/a.ts b/src/a.ts
index 000..111 100644
--- a/src/a.ts
+++ b/src/a.ts
@@ -1 +1 @@
-a
+b
\`\`\`
`,
  metadata: {
    changedFiles: ['src/a.ts', 'src/nested/b.ts'],
  },
  createdAt: new Date(),
  ...(overrides ?? {}),
});

describe('ArtifactsService', () => {
  it('should resolve diff preview with changed files and file tree', async () => {
    const taskArtifactRepository = {
      findById: jest.fn().mockResolvedValue(createArtifact()),
      create: jest.fn(),
      findByTaskId: jest.fn(),
    };
    const taskRepository = {
      findById: jest.fn().mockResolvedValue({
        id: 'task-1',
        projectId: 'project-1',
      }),
    };
    const taskRuntimeService = {
      listWorktreeFiles: jest.fn(),
      readFileFromWorktree: jest.fn(),
    };
    const projectsService = {
      assertProjectCapability: jest.fn().mockResolvedValue({
        id: 'project-1',
      }),
    };

    const service = new ArtifactsService(
      taskArtifactRepository as never,
      taskRepository as never,
      taskRuntimeService as never,
      projectsService as never,
    );

    const preview = await service.resolvePreview('artifact-1', {
      sub: 'user-1',
      roles: ['admin'],
    } as never);

    expect(preview.mode).toBe('diff');
    expect(preview.patch).toContain('diff --git a/src/a.ts b/src/a.ts');
    expect(preview.changedFiles).toEqual(['src/a.ts', 'src/nested/b.ts']);
    expect(preview.fileTree.length).toBeGreaterThan(0);
  });

  it('should fallback to external preview when artifact has only download url', async () => {
    const taskArtifactRepository = {
      findById: jest.fn().mockResolvedValue(
        createArtifact({
          artifactType: TaskArtifactType.file,
          content: null,
          downloadUrl: 'https://example.com/file.zip',
          metadata: null,
        }),
      ),
      create: jest.fn(),
      findByTaskId: jest.fn(),
    };
    const taskRepository = {
      findById: jest.fn().mockResolvedValue({
        id: 'task-1',
        projectId: 'project-1',
      }),
    };
    const taskRuntimeService = {
      listWorktreeFiles: jest.fn(),
      readFileFromWorktree: jest.fn(),
    };
    const projectsService = {
      assertProjectCapability: jest.fn().mockResolvedValue({
        id: 'project-1',
      }),
    };

    const service = new ArtifactsService(
      taskArtifactRepository as never,
      taskRepository as never,
      taskRuntimeService as never,
      projectsService as never,
    );

    const preview = await service.resolvePreview('artifact-1', {
      sub: 'user-1',
      roles: ['admin'],
    } as never);

    expect(preview.mode).toBe('external');
    expect(preview.downloadUrl).toBe('https://example.com/file.zip');
  });
});
