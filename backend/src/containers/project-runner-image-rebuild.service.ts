import { Injectable, Logger } from '@nestjs/common';
import { ProjectRepository } from '../projects/infrastructure/persistence/project.repository';
import { ContainerExecutionConfigService } from './container-execution-config.service';
import { ProjectRunnerImageService } from './project-runner-image.service';

export type ProjectRunnerImageBuildStatus = {
  status: 'building' | 'success' | 'failed';
  startedAt: string;
  finishedAt: string | null;
  errorMessage: string | null;
  imageTag: string | null;
};

@Injectable()
export class ProjectRunnerImageRebuildService {
  private readonly logger = new Logger(ProjectRunnerImageRebuildService.name);
  private readonly rebuildQueue = new Map<string, Promise<void>>();

  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly projectRunnerImageService: ProjectRunnerImageService,
    private readonly containerConfig: ContainerExecutionConfigService,
  ) {}

  createPendingStatus(startedAt = new Date()): ProjectRunnerImageBuildStatus {
    return {
      status: 'building',
      startedAt: startedAt.toISOString(),
      finishedAt: null,
      errorMessage: null,
      imageTag: null,
    };
  }

  readBuildStatus(
    configJson?: Record<string, unknown> | null,
  ): ProjectRunnerImageBuildStatus | null {
    const raw =
      configJson && typeof configJson === 'object' && !Array.isArray(configJson)
        ? (configJson.runnerImageBuild as Record<string, unknown> | undefined)
        : undefined;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return null;
    }

    const status =
      raw.status === 'building' ||
      raw.status === 'success' ||
      raw.status === 'failed'
        ? raw.status
        : null;
    const startedAt =
      typeof raw.startedAt === 'string' && raw.startedAt.trim()
        ? raw.startedAt
        : null;

    if (!status || !startedAt) {
      return null;
    }

    return {
      status,
      startedAt,
      finishedAt:
        typeof raw.finishedAt === 'string' && raw.finishedAt.trim()
          ? raw.finishedAt
          : null,
      errorMessage:
        typeof raw.errorMessage === 'string' && raw.errorMessage.trim()
          ? raw.errorMessage
          : null,
      imageTag:
        typeof raw.imageTag === 'string' && raw.imageTag.trim()
          ? raw.imageTag
          : null,
    };
  }

  mergeBuildStatus(
    configJson: Record<string, unknown> | null | undefined,
    buildStatus: ProjectRunnerImageBuildStatus,
  ): Record<string, unknown> {
    return {
      ...(configJson ?? {}),
      runnerImageBuild: buildStatus,
    };
  }

  scheduleProjectRebuild(projectId: string): void {
    const previous = this.rebuildQueue.get(projectId) ?? Promise.resolve();
    const next = previous
      .catch(() => undefined)
      .then(async () => {
        await this.runProjectRebuild(projectId);
      });

    this.rebuildQueue.set(projectId, next);
    void next.finally(() => {
      if (this.rebuildQueue.get(projectId) === next) {
        this.rebuildQueue.delete(projectId);
      }
    });
  }

  private async runProjectRebuild(projectId: string): Promise<void> {
    const project = await this.projectRepository.findById(projectId);
    if (!project) {
      return;
    }

    const currentStatus = this.readBuildStatus(project.configJson);
    const startedAt = currentStatus?.startedAt ?? new Date().toISOString();

    try {
      const imageTag =
        await this.projectRunnerImageService.resolveRunnerImage(project);
      await this.updateBuildStatus(
        projectId,
        {
          status: 'success',
          startedAt,
          finishedAt: new Date().toISOString(),
          errorMessage: null,
          imageTag,
        },
        startedAt,
      );
      this.logger.log(
        `project_runner_image_rebuild_succeeded ${JSON.stringify({
          projectId,
          imageTag,
          usesGlobalImage: imageTag === this.containerConfig.getRunnerImage(),
        })}`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Unknown project runner image rebuild error';
      await this.updateBuildStatus(
        projectId,
        {
          status: 'failed',
          startedAt,
          finishedAt: new Date().toISOString(),
          errorMessage,
          imageTag: null,
        },
        startedAt,
      );
      this.logger.error(
        `project_runner_image_rebuild_failed ${JSON.stringify({
          projectId,
          errorMessage,
        })}`,
      );
    }
  }

  private async updateBuildStatus(
    projectId: string,
    buildStatus: ProjectRunnerImageBuildStatus,
    expectedStartedAt?: string,
  ): Promise<void> {
    const project = await this.projectRepository.findById(projectId);
    if (!project) {
      return;
    }

    if (expectedStartedAt) {
      const currentStatus = this.readBuildStatus(project.configJson);
      if (
        currentStatus?.status === 'building' &&
        currentStatus.startedAt !== expectedStartedAt
      ) {
        return;
      }
    }

    await this.projectRepository.update(projectId, {
      configJson: this.mergeBuildStatus(project.configJson, buildStatus),
    });
  }
}
