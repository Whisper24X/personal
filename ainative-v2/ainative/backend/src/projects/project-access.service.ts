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
