import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { Project } from './domain/project';
import { RepositoryProvisioningStatus } from './domain/repository-provisioning-status.enum';
import { NotificationsService } from '../notifications/notifications.service';
import { ProjectMemberRepository } from './infrastructure/persistence/project-member.repository';
import { ProjectRepository } from './infrastructure/persistence/project.repository';
import { ProjectRepositoryWorkspaceService } from './project-repository-workspace.service';

@Injectable()
export class ProjectRepositoryProvisioningService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(
    ProjectRepositoryProvisioningService.name,
  );
  private readonly queuedProjectIds = new Set<Project['id']>();
  private draining = false;
  private recoverTimerRef: NodeJS.Timeout | null = null;
  private readonly recoverDelayMs = 2_000;

  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly projectMemberRepository: ProjectMemberRepository,
    private readonly projectRepositoryWorkspaceService: ProjectRepositoryWorkspaceService,
    private readonly notificationsService: NotificationsService,
  ) {}

  onApplicationBootstrap(): void {
    this.recoverTimerRef = setTimeout(() => {
      void this.recoverPendingProjects();
    }, this.recoverDelayMs);
  }

  onModuleDestroy(): void {
    if (this.recoverTimerRef) {
      clearTimeout(this.recoverTimerRef);
      this.recoverTimerRef = null;
    }
  }

  enqueue(projectId: Project['id']): void {
    if (!projectId?.trim()) {
      return;
    }
    this.queuedProjectIds.add(projectId);
    this.scheduleDrain();
  }

  async markPendingAndEnqueue(projectId: Project['id']): Promise<void> {
    await this.projectRepository.update(projectId, {
      repositoryProvisioningStatus: RepositoryProvisioningStatus.Pending,
      repositoryProvisioningError: null,
      repositoryProvisionedAt: null,
    });
    this.enqueue(projectId);
  }

  private scheduleDrain(): void {
    if (this.draining) {
      return;
    }
    this.draining = true;
    setImmediate(() => {
      void this.drainQueue();
    });
  }

  private async drainQueue(): Promise<void> {
    try {
      while (this.queuedProjectIds.size > 0) {
        const [projectId] = this.queuedProjectIds;
        if (!projectId) {
          break;
        }
        this.queuedProjectIds.delete(projectId);
        await this.provisionProjectRepository(projectId);
      }
    } finally {
      this.draining = false;
      if (this.queuedProjectIds.size > 0) {
        this.scheduleDrain();
      }
    }
  }

  private async recoverPendingProjects(): Promise<void> {
    try {
      const pendingProjects =
        await this.projectRepository.findByRepositoryProvisioningStatus(
          RepositoryProvisioningStatus.Pending,
        );
      for (const project of pendingProjects) {
        this.enqueue(project.id);
      }
      if (pendingProjects.length > 0) {
        this.logger.log(
          `git_provision_recover ${JSON.stringify({ recovered: pendingProjects.length })}`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `git_provision_recover_failed ${JSON.stringify({
          errorMessage: error instanceof Error ? error.message : String(error),
        })}`,
      );
    }
  }

  private async provisionProjectRepository(
    projectId: Project['id'],
  ): Promise<void> {
    const project = await this.projectRepository.findById(projectId);
    if (!project) {
      return;
    }

    const startedAt = Date.now();
    this.logger.log(
      `git_provision_start ${JSON.stringify({
        projectId: project.id,
        gitUrl: project.gitUrl,
      })}`,
    );

    try {
      const repositoryRoot =
        await this.projectRepositoryWorkspaceService.ensureProjectRepository(
          project,
        );
      await this.projectRepositoryWorkspaceService.syncRunnerConfigBackup(
        project,
        repositoryRoot,
      );
      await this.projectRepository.update(project.id, {
        repositoryProvisioningStatus: RepositoryProvisioningStatus.Ready,
        repositoryProvisioningError: null,
        repositoryProvisionedAt: new Date(),
      });
      await this.notifyProjectMembers(project, {
        status: 'ready',
      });
      this.logger.log(
        `git_provision_success ${JSON.stringify({
          projectId: project.id,
          elapsedMs: Date.now() - startedAt,
        })}`,
      );
    } catch (error) {
      const errorMessage = this.truncateError(
        error instanceof Error ? error.message : String(error),
      );
      await this.projectRepository.update(project.id, {
        repositoryProvisioningStatus: RepositoryProvisioningStatus.Failed,
        repositoryProvisioningError: errorMessage,
      });
      await this.notifyProjectMembers(project, {
        status: 'failed',
        errorMessage,
      });
      this.logger.warn(
        `git_provision_failed ${JSON.stringify({
          projectId: project.id,
          elapsedMs: Date.now() - startedAt,
          errorMessage,
        })}`,
      );
    }
  }

  private truncateError(message: string): string {
    const normalized = message.trim();
    if (!normalized) {
      return 'Unknown git error';
    }
    if (normalized.length <= 500) {
      return normalized;
    }
    return `${normalized.slice(0, 500)}...`;
  }

  private async notifyProjectMembers(
    project: Project,
    {
      status,
      errorMessage,
    }: {
      status: 'ready' | 'failed';
      errorMessage?: string | null;
    },
  ): Promise<void> {
    try {
      const projectMembers = await this.projectMemberRepository.findByProjectId(
        project.id,
      );
      if (projectMembers.length === 0) {
        return;
      }
      const uniqueUserIds = Array.from(
        new Set(projectMembers.map((member) => member.userId)),
      );
      await Promise.all(
        uniqueUserIds.map((userId) =>
          this.notificationsService.notifyProjectRepositoryProvisioningChanged({
            userId,
            projectId: project.id,
            projectName: project.name,
            businessLineId: project.businessLineId,
            status,
            errorMessage: errorMessage ?? null,
          }),
        ),
      );
    } catch (error) {
      this.logger.warn(
        `git_provision_notify_failed ${JSON.stringify({
          projectId: project.id,
          status,
          errorMessage: error instanceof Error ? error.message : String(error),
        })}`,
      );
    }
  }
}
