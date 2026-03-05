import { Injectable, NotFoundException } from '@nestjs/common';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { TaskArtifact } from '../tasks/domain/task-artifact';
import { TaskArtifactRepository } from '../tasks/infrastructure/persistence/task-artifact.repository';
import { TaskRepository } from '../tasks/infrastructure/persistence/task.repository';
import { TaskRuntimeService } from '../tasks/task-runtime.service';
import { ProjectsService } from '../projects/projects.service';
import { ArtifactPreviewDto } from './dto/artifact-preview.dto';
import { TaskArtifactType } from '../tasks/dto/task-artifact-type.enum';

@Injectable()
export class ArtifactsService {
  private readonly maxTextPreviewLength = 200 * 1024;

  constructor(
    private readonly taskArtifactRepository: TaskArtifactRepository,
    private readonly taskRepository: TaskRepository,
    private readonly taskRuntimeService: TaskRuntimeService,
    private readonly projectsService: ProjectsService,
  ) {}

  async findById(
    artifactId: TaskArtifact['id'],
    currentUser: JwtPayloadType,
  ): Promise<TaskArtifact> {
    const artifact = await this.taskArtifactRepository.findById(artifactId);

    if (!artifact) {
      throw new NotFoundException('Artifact not found');
    }

    const task = await this.taskRepository.findById(artifact.taskId);

    if (!task) {
      throw new NotFoundException('Task not found for artifact');
    }

    await this.projectsService.assertCanAccessProject(
      task.projectId,
      currentUser,
    );

    return artifact;
  }

  async resolveDownload(
    artifactId: TaskArtifact['id'],
    currentUser: JwtPayloadType,
    worktreePath?: string,
  ): Promise<{
    artifactId: string;
    downloadUrl?: string | null;
    content?: string | null;
    suggestedFileName?: string | null;
  }> {
    const artifact = await this.findById(artifactId, currentUser);

    const worktreeContent = await this.tryResolveWorktreeContent(
      artifact,
      worktreePath,
    );
    if (worktreeContent) {
      return {
        artifactId: artifact.id,
        downloadUrl: null,
        content: worktreeContent.content,
        suggestedFileName: worktreeContent.fileName,
      };
    }

    if (!artifact.downloadUrl && !artifact.content) {
      throw new NotFoundException('Artifact download is not available');
    }

    if (artifact.downloadUrl) {
      return {
        artifactId: artifact.id,
        downloadUrl: artifact.downloadUrl,
        content: null,
        suggestedFileName: null,
      };
    }

    if (
      artifact.artifactType === TaskArtifactType.diff &&
      artifact.content
    ) {
      const changedFiles = this.resolveChangedFiles(artifact);
      if (changedFiles.length === 1) {
        const diffPatch = this.extractDiffPatch(artifact.content);
        const extracted = diffPatch
          ? this.extractNewFileContentFromDiff(diffPatch)
          : null;
        if (extracted) {
          return {
            artifactId: artifact.id,
            downloadUrl: null,
            content: extracted.content,
            suggestedFileName: extracted.fileName,
          };
        }
      }
    }

    return {
      artifactId: artifact.id,
      downloadUrl: null,
      content: artifact.content ?? null,
      suggestedFileName: null,
    };
  }

  async resolvePreview(
    artifactId: TaskArtifact['id'],
    currentUser: JwtPayloadType,
    worktreePath?: string,
  ): Promise<ArtifactPreviewDto> {
    const artifact = await this.findById(artifactId, currentUser);
    const changedFiles = this.resolveChangedFiles(artifact);
    const fileTree = this.buildFileTree(changedFiles);

    const worktreeContent = await this.tryResolveWorktreeContent(
      artifact,
      worktreePath,
    );
    if (worktreeContent) {
      const truncated =
        worktreeContent.content.length > this.maxTextPreviewLength;
      const text = worktreeContent.content.slice(
        0,
        this.maxTextPreviewLength,
      );
      return {
        artifactId: artifact.id,
        mode: 'text',
        artifactType: artifact.artifactType,
        title: worktreeContent.fileName,
        patch: null,
        text,
        changedFiles: [worktreeContent.fileName],
        fileTree: this.buildFileTree([worktreeContent.fileName]),
        truncated,
        downloadUrl: artifact.downloadUrl ?? null,
      };
    }

    if (artifact.artifactType === TaskArtifactType.diff) {
      const diffPatch = this.extractDiffPatch(artifact.content);

      if (diffPatch) {
        const extracted = this.extractNewFileContentFromDiff(diffPatch);
        if (extracted && changedFiles.length === 1) {
          const truncated =
            extracted.content.length > this.maxTextPreviewLength;
          const text = extracted.content.slice(
            0,
            this.maxTextPreviewLength,
          );
          return {
            artifactId: artifact.id,
            mode: 'text',
            artifactType: artifact.artifactType,
            title: extracted.fileName,
            patch: null,
            text,
            changedFiles,
            fileTree,
            truncated,
            downloadUrl: artifact.downloadUrl ?? null,
          };
        }

        return {
          artifactId: artifact.id,
          mode: 'diff',
          artifactType: artifact.artifactType,
          title: artifact.name,
          patch: diffPatch,
          text: null,
          changedFiles,
          fileTree,
          truncated: false,
          downloadUrl: artifact.downloadUrl ?? null,
        };
      }
    }

    if (artifact.content) {
      const truncated = artifact.content.length > this.maxTextPreviewLength;
      const text = artifact.content.slice(0, this.maxTextPreviewLength);

      return {
        artifactId: artifact.id,
        mode: 'text',
        artifactType: artifact.artifactType,
        title: artifact.name,
        patch: null,
        text,
        changedFiles,
        fileTree,
        truncated,
        downloadUrl: artifact.downloadUrl ?? null,
      };
    }

    if (artifact.downloadUrl) {
      return {
        artifactId: artifact.id,
        mode: 'external',
        artifactType: artifact.artifactType,
        title: artifact.name,
        patch: null,
        text: null,
        changedFiles,
        fileTree,
        truncated: false,
        downloadUrl: artifact.downloadUrl,
      };
    }

    throw new NotFoundException('Artifact preview is not available');
  }

  private async tryResolveWorktreeContent(
    artifact: TaskArtifact,
    worktreePath?: string,
  ): Promise<{ fileName: string; content: string } | null> {
    if (artifact.artifactType !== TaskArtifactType.report) {
      return null;
    }

    const task = await this.taskRepository.findById(artifact.taskId);
    if (!task?.gitWorktree?.trim()) {
      return null;
    }

    const worktreeFiles =
      await this.taskRuntimeService.listWorktreeFiles(task);
    if (worktreeFiles.length === 0) {
      return null;
    }

    const targetPath = worktreePath?.trim();
    const fileToRead = targetPath
      ? worktreeFiles.includes(targetPath)
        ? targetPath
        : worktreeFiles[0]
      : worktreeFiles[0];

    const content =
      await this.taskRuntimeService.readFileFromWorktree(task, fileToRead);
    if (content === null) {
      return null;
    }

    return {
      fileName: fileToRead,
      content,
    };
  }

  private resolveChangedFiles(artifact: TaskArtifact): string[] {
    const metadata =
      artifact.metadata && typeof artifact.metadata === 'object'
        ? (artifact.metadata as Record<string, unknown>)
        : null;
    const metadataChangedFiles = Array.isArray(metadata?.changedFiles)
      ? metadata.changedFiles
          .map((item) => (typeof item === 'string' ? item.trim() : ''))
          .filter(Boolean)
      : [];

    if (metadataChangedFiles.length > 0) {
      return Array.from(new Set(metadataChangedFiles));
    }

    if (!artifact.content) {
      return [];
    }

    const parsedFiles: string[] = [];
    const pattern = /^diff --git a\/(.+?) b\/(.+)$/gm;
    let match: RegExpExecArray | null = pattern.exec(artifact.content);

    while (match) {
      const candidate = (match[2] || match[1] || '').trim();
      if (candidate) {
        parsedFiles.push(candidate);
      }
      match = pattern.exec(artifact.content);
    }

    return Array.from(new Set(parsedFiles));
  }

  private extractDiffPatch(content?: string | null): string | null {
    if (!content) {
      return null;
    }

    const fencedMatch = content.match(/```diff\s*([\s\S]*?)```/i);
    if (fencedMatch?.[1]?.trim()) {
      return fencedMatch[1].trim();
    }

    const fallbackMatch = content.match(/^diff --git[\s\S]*$/m);
    if (fallbackMatch?.[0]?.trim()) {
      return fallbackMatch[0].trim();
    }

    return null;
  }

  private extractNewFileContentFromDiff(
    diffPatch: string,
  ): { fileName: string; content: string } | null {
    const gitMatch = diffPatch.match(/^diff --git a\/(.+?) b\/(.+)$/m);
    if (!gitMatch) {
      return null;
    }

    const fileName = (gitMatch[2] || gitMatch[1] || '').trim();
    if (!fileName) {
      return null;
    }

    const contentLines: string[] = [];
    const lines = diffPatch.split('\n');
    let inHunk = false;

    for (const line of lines) {
      if (line.startsWith('diff --git ') && contentLines.length > 0) {
        break;
      }
      if (line.startsWith('@@ ')) {
        inHunk = true;
        continue;
      }
      if (inHunk && line.startsWith('+') && !line.startsWith('+++')) {
        contentLines.push(line.slice(1));
      }
    }

    if (contentLines.length === 0) {
      return null;
    }

    return {
      fileName,
      content: contentLines.join('\n'),
    };
  }

  private buildFileTree(paths: string[]): ArtifactPreviewDto['fileTree'] {
    type MutableNode = {
      name: string;
      path: string;
      type: 'file' | 'directory';
      children: Map<string, MutableNode>;
    };

    const root = new Map<string, MutableNode>();

    for (const rawPath of paths) {
      const normalizedPath = rawPath.replace(/\\/g, '/').replace(/^\/+/, '');
      if (!normalizedPath) {
        continue;
      }

      const segments = normalizedPath.split('/').filter(Boolean);
      if (segments.length === 0) {
        continue;
      }

      let parent = root;
      let currentPath = '';

      for (let index = 0; index < segments.length; index += 1) {
        const segment = segments[index];
        currentPath = currentPath ? `${currentPath}/${segment}` : segment;

        const existedNode = parent.get(segment);
        if (existedNode) {
          parent = existedNode.children;
          continue;
        }

        const isLeaf = index === segments.length - 1;
        const nextNode: MutableNode = {
          name: segment,
          path: currentPath,
          type: isLeaf ? 'file' : 'directory',
          children: new Map(),
        };
        parent.set(segment, nextNode);
        parent = nextNode.children;
      }
    }

    const toReadonlyTree = (
      source: Map<string, MutableNode>,
    ): ArtifactPreviewDto['fileTree'] => {
      return Array.from(source.values())
        .sort((left, right) => left.name.localeCompare(right.name))
        .map((node) => ({
          name: node.name,
          path: node.path,
          type: node.type,
          children: toReadonlyTree(node.children),
        }));
    };

    return toReadonlyTree(root);
  }
}
