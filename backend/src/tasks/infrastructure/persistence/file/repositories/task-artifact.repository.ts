import { Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { resolveAinativeDataRootDir } from '../../../../../utils/workspace-paths';
import { TaskArtifact } from '../../../../domain/task-artifact';
import { TaskArtifactRepository } from '../../task-artifact.repository';

@Injectable()
export class TaskArtifactFileRepository implements TaskArtifactRepository {
  private readonly baseDir = path.resolve(
    resolveAinativeDataRootDir(),
    'meta',
    'task-artifacts',
  );

  async create(
    data: Omit<TaskArtifact, 'id' | 'createdAt'>,
  ): Promise<TaskArtifact> {
    const createdAt = new Date();
    const artifact: TaskArtifact = {
      id: randomUUID(),
      taskId: data.taskId,
      taskNodeId: data.taskNodeId ?? null,
      artifactType: data.artifactType,
      name: data.name,
      downloadUrl: data.downloadUrl ?? null,
      content: data.content ?? null,
      metadata: data.metadata ?? null,
      createdAt,
    };

    const byTaskPath = this.resolveByTaskPath(artifact.taskId);
    const byIdPath = this.resolveByIdPath(artifact.id);

    await fs.mkdir(path.dirname(byTaskPath), { recursive: true });
    await fs.mkdir(path.dirname(byIdPath), { recursive: true });
    await fs.appendFile(byTaskPath, `${JSON.stringify(this.serialize(artifact))}\n`, 'utf-8');
    await fs.writeFile(byIdPath, JSON.stringify(this.serialize(artifact), null, 2), 'utf-8');

    return artifact;
  }

  async findByTaskId(taskId: TaskArtifact['taskId']): Promise<TaskArtifact[]> {
    const artifacts = await this.readByTaskId(taskId);
    return artifacts.sort((left, right) => {
      const createdAtDiff = right.createdAt.getTime() - left.createdAt.getTime();
      if (createdAtDiff !== 0) {
        return createdAtDiff;
      }

      return right.id.localeCompare(left.id);
    });
  }

  async findById(id: TaskArtifact['id']): Promise<NullableType<TaskArtifact>> {
    const filePath = this.resolveByIdPath(id);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return this.deserialize(content);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        return null;
      }

      throw error;
    }
  }

  private resolveByTaskPath(taskId: string): string {
    return path.resolve(this.baseDir, 'by-task', `${taskId}.jsonl`);
  }

  private resolveByIdPath(artifactId: string): string {
    return path.resolve(this.baseDir, 'by-id', `${artifactId}.json`);
  }

  private async readByTaskId(taskId: string): Promise<TaskArtifact[]> {
    const filePath = this.resolveByTaskPath(taskId);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => this.deserialize(line))
        .filter((artifact): artifact is TaskArtifact => Boolean(artifact));
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        return [];
      }

      throw error;
    }
  }

  private serialize(artifact: TaskArtifact): Record<string, unknown> {
    return {
      ...artifact,
      createdAt: artifact.createdAt.toISOString(),
    };
  }

  private deserialize(content: string): TaskArtifact | null {
    try {
      const raw = JSON.parse(content) as Record<string, unknown>;
      if (
        typeof raw.id !== 'string' ||
        typeof raw.taskId !== 'string' ||
        typeof raw.artifactType !== 'string' ||
        typeof raw.name !== 'string'
      ) {
        return null;
      }

      const createdAt = new Date(String(raw.createdAt ?? ''));
      if (Number.isNaN(createdAt.getTime())) {
        return null;
      }

      return {
        id: raw.id,
        taskId: raw.taskId,
        taskNodeId: typeof raw.taskNodeId === 'string' ? raw.taskNodeId : null,
        artifactType: raw.artifactType as TaskArtifact['artifactType'],
        name: raw.name,
        downloadUrl: typeof raw.downloadUrl === 'string' ? raw.downloadUrl : null,
        content: typeof raw.content === 'string' ? raw.content : null,
        metadata:
          raw.metadata && typeof raw.metadata === 'object' && !Array.isArray(raw.metadata)
            ? (raw.metadata as Record<string, unknown>)
            : null,
        createdAt,
      };
    } catch {
      return null;
    }
  }
}
