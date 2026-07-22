import { Injectable, NotFoundException } from '@nestjs/common';
import { AccessService } from '../access/access.service';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { SlowApiDiagnosticsSession } from '../observability/slow-api-diagnostics';
import { Project } from './domain/project';
import { ProjectRepository } from './infrastructure/persistence/project.repository';

@Injectable()
export class ProjectAccessService {
  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly accessService: AccessService,
  ) {}

  async assertCanAccessProject(
    projectId: Project['id'],
    currentUser: JwtPayloadType,
  ): Promise<Project> {
    return this.accessService.assertProjectCapability(
      currentUser,
      projectId,
      'project.dashboard.read',
    );
  }

  async assertCanManageProject(
    projectId: Project['id'],
    currentUser: JwtPayloadType,
  ): Promise<Project> {
    const project = await this.getProjectOrThrow(projectId);

    if (this.isAdmin(currentUser)) {
      return project;
    }

    await this.accessService.assertBusinessLineCapability(
      currentUser,
      project.businessLineId,
      'businessLine.project.update',
    );

    return project;
  }

  async assertCanRegenerateRunnerConfig(
    projectId: Project['id'],
    currentUser: JwtPayloadType,
  ): Promise<Project> {
    const project = await this.getProjectOrThrow(projectId);

    if (this.isAdmin(currentUser)) {
      return project;
    }

    try {
      await this.accessService.assertProjectCapability(
        currentUser,
        projectId,
        'project.task.manage',
      );
      return project;
    } catch {
      await this.accessService.assertBusinessLineCapability(
        currentUser,
        project.businessLineId,
        'businessLine.project.update',
      );
      return project;
    }
  }

  async assertProjectCapability(
    projectId: Project['id'],
    currentUser: JwtPayloadType,
    capability: string,
    diagnostics?: SlowApiDiagnosticsSession,
  ): Promise<Project> {
    return this.accessService.assertProjectCapability(
      currentUser,
      projectId,
      capability,
      diagnostics,
    );
  }

  async assertWorkspaceProjectByBusinessLineCapability(
    businessLineId: Project['businessLineId'],
    currentUser: JwtPayloadType,
    capability: string,
  ): Promise<Project> {
    await this.accessService.assertBusinessLineCapability(
      currentUser,
      businessLineId,
      capability,
    );

    const project =
      await this.projectRepository.findWorkspaceManagedByBusinessLineId(
        businessLineId,
      );

    if (!project) {
      throw new NotFoundException('Workspace project not found');
    }

    return project;
  }

  private async getProjectOrThrow(projectId: Project['id']): Promise<Project> {
    const project = await this.projectRepository.findById(projectId);

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  private isAdmin(currentUser: JwtPayloadType): boolean {
    return currentUser.roles?.includes('admin') ?? false;
  }
}
