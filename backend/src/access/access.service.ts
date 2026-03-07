import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { BusinessLineRepository } from '../business-lines/infrastructure/persistence/business-line.repository';
import { BusinessLineMemberRepository } from '../business-lines/infrastructure/persistence/business-line-member.repository';
import { ProjectRepository } from '../projects/infrastructure/persistence/project.repository';
import { ProjectMemberRepository } from '../projects/infrastructure/persistence/project-member.repository';
import { BusinessLineMemberRole } from '../business-lines/dto/business-line-member-role.enum';
import { ProjectMemberRole } from '../projects/dto/project-member-role.enum';
import type { GetCurrentAccessDto } from './dto/get-current-access.dto';
import type { CurrentAccessDto } from './dto/current-access.dto';
import type { BusinessLine } from '../business-lines/domain/business-line';
import type { Project } from '../projects/domain/project';

export const BUSINESS_LINE_CREATE_CAPABILITY = 'businessLine.create';

export const BUSINESS_LINE_ROLE_CAPABILITIES: Record<
  BusinessLineMemberRole,
  string[]
> = {
  [BusinessLineMemberRole.owner]: [
    'businessLine.read',
    'businessLine.update',
    'businessLine.delete',
    'businessLine.member.manage',
    'businessLine.project.list.all',
    'businessLine.project.create',
    'businessLine.project.update',
    'businessLine.project.delete',
  ],
  [BusinessLineMemberRole.admin]: [
    'businessLine.read',
    'businessLine.member.manage',
    'businessLine.project.list.all',
    'businessLine.project.create',
    'businessLine.project.update',
    'businessLine.project.delete',
  ],
  [BusinessLineMemberRole.member]: [
    'businessLine.read',
    'businessLine.project.list.joined',
  ],
};

export const PROJECT_ROLE_CAPABILITIES: Record<ProjectMemberRole, string[]> = {
  [ProjectMemberRole.owner]: [
    'project.read',
    'project.update',
    'project.delete',
    'project.member.manage',
    'project.task.read',
    'project.task.create',
    'project.task.execute',
    'project.task.cancel',
    'project.kanban.view',
    'project.workflow.view',
    'project.workflow.manage',
    'project.artifact.read',
  ],
  [ProjectMemberRole.maintainer]: [
    'project.read',
    'project.update',
    'project.member.manage',
    'project.task.read',
    'project.task.create',
    'project.task.execute',
    'project.task.cancel',
    'project.kanban.view',
    'project.workflow.view',
    'project.workflow.manage',
    'project.artifact.read',
  ],
  [ProjectMemberRole.developer]: [
    'project.read',
    'project.task.read',
    'project.task.create',
    'project.task.execute',
    'project.kanban.view',
    'project.workflow.view',
    'project.artifact.read',
  ],
  [ProjectMemberRole.viewer]: [
    'project.read',
    'project.task.read',
    'project.kanban.view',
    'project.workflow.view',
    'project.artifact.read',
  ],
};

const ALL_BUSINESS_LINE_CAPABILITIES = Array.from(
  new Set(Object.values(BUSINESS_LINE_ROLE_CAPABILITIES).flat()),
);

const ALL_PROJECT_CAPABILITIES = Array.from(
  new Set(Object.values(PROJECT_ROLE_CAPABILITIES).flat()),
);

@Injectable()
export class AccessService {
  constructor(
    private readonly usersService: UsersService,
    private readonly businessLineRepository: BusinessLineRepository,
    private readonly businessLineMemberRepository: BusinessLineMemberRepository,
    private readonly projectRepository: ProjectRepository,
    private readonly projectMemberRepository: ProjectMemberRepository,
  ) {}

  async getCurrentAccess(
    currentUser: JwtPayloadType,
    query: GetCurrentAccessDto = {},
  ): Promise<CurrentAccessDto> {
    const user = await this.usersService.findById(currentUser.sub);

    if (!user) {
      throw new UnauthorizedException('userNotFound');
    }

    const [businessLineMemberships, projectMemberships] = await Promise.all([
      this.businessLineMemberRepository.findByUserId(currentUser.sub),
      this.projectMemberRepository.findByUserId(currentUser.sub),
    ]);

    const businessRoleById = new Map(
      businessLineMemberships.map((membership) => [
        membership.businessLineId,
        membership.role,
      ]),
    );
    const projectRoleById = new Map(
      projectMemberships.map((membership) => [membership.projectId, membership.role]),
    );

    let resolvedBusinessLineId = query.businessLineId;
    let resolvedProjectId = query.projectId;
    let businessRole: BusinessLineMemberRole | null = null;
    let projectRole: ProjectMemberRole | null = null;

    const capabilities = new Set<string>([BUSINESS_LINE_CREATE_CAPABILITY]);

    let visibleBusinessLineIds = businessLineMemberships.map(
      (membership) => membership.businessLineId,
    );
    let visibleProjectIds = await this.resolveVisibleProjectIds({
      businessLineMemberships,
      projectMemberships,
      currentBusinessLineId: resolvedBusinessLineId,
    });

    if (resolvedProjectId) {
      const project = await this.projectRepository.findById(resolvedProjectId);

      if (!project) {
        throw new NotFoundException('Project not found');
      }

      if (
        resolvedBusinessLineId &&
        resolvedBusinessLineId !== project.businessLineId
      ) {
        throw new BadRequestException(
          'businessLineId does not match project business line',
        );
      }

      resolvedBusinessLineId = project.businessLineId;

      if (!this.isAdmin(currentUser)) {
        const businessMembership = businessRoleById.get(project.businessLineId);
        const isVisibleByBusinessLine =
          businessMembership === BusinessLineMemberRole.owner ||
          businessMembership === BusinessLineMemberRole.admin;
        const isVisibleByProject = projectRoleById.has(project.id);

        if (!isVisibleByBusinessLine && !isVisibleByProject) {
          throw new ForbiddenException('forbiddenProject');
        }
      }
    }

    if (resolvedBusinessLineId) {
      const businessLine = await this.businessLineRepository.findById(
        resolvedBusinessLineId,
      );

      if (!businessLine) {
        throw new NotFoundException('Business line not found');
      }

      if (this.isAdmin(currentUser)) {
        businessRole = BusinessLineMemberRole.owner;
      } else {
        businessRole = businessRoleById.get(resolvedBusinessLineId) ?? null;

        if (!businessRole) {
          throw new ForbiddenException('forbiddenBusinessLine');
        }
      }

      for (const capability of this.resolveBusinessLineCapabilities(businessRole)) {
        capabilities.add(capability);
      }

      visibleBusinessLineIds = this.mergeUniqueIds(visibleBusinessLineIds, [
        businessLine.id,
      ]);
    }

    if (resolvedProjectId) {
      if (this.isAdmin(currentUser)) {
        projectRole = ProjectMemberRole.owner;
      } else {
        projectRole = projectRoleById.get(resolvedProjectId) ?? null;
      }

      for (const capability of this.resolveProjectCapabilities(projectRole)) {
        capabilities.add(capability);
      }

      visibleProjectIds = this.mergeUniqueIds(visibleProjectIds, [resolvedProjectId]);
    }

    if (this.isAdmin(currentUser)) {
      for (const capability of ALL_BUSINESS_LINE_CAPABILITIES) {
        capabilities.add(capability);
      }
      for (const capability of ALL_PROJECT_CAPABILITIES) {
        capabilities.add(capability);
      }

      if (resolvedBusinessLineId) {
        const businessProjects = await this.projectRepository.findByBusinessLineId(
          resolvedBusinessLineId,
        );
        visibleProjectIds = this.mergeUniqueIds(
          visibleProjectIds,
          businessProjects.map((project) => project.id),
        );
      }
    }

    return {
      user: {
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        avatar: user.avatar,
      },
      currentContext: {
        businessLineId: resolvedBusinessLineId,
        projectId: resolvedProjectId,
        businessRole,
        projectRole,
      },
      capabilities: Array.from(capabilities).sort(),
      visibility: {
        visibleBusinessLineIds: visibleBusinessLineIds.sort(),
        visibleProjectIds: visibleProjectIds.sort(),
      },
    };
  }

  async assertBusinessLineCapability(
    currentUser: JwtPayloadType,
    businessLineId: string,
    capability: string,
  ): Promise<BusinessLine> {
    const businessLine = await this.businessLineRepository.findById(businessLineId);

    if (!businessLine) {
      throw new NotFoundException('Business line not found');
    }

    if (this.isAdmin(currentUser)) {
      return businessLine;
    }

    const membership =
      await this.businessLineMemberRepository.findByBusinessLineIdAndUserId(
        businessLineId,
        currentUser.sub,
      );

    if (!membership) {
      throw new ForbiddenException('forbiddenBusinessLine');
    }

    if (!this.resolveBusinessLineCapabilities(membership.role).includes(capability)) {
      throw new ForbiddenException(
        capability === 'businessLine.read'
          ? 'forbiddenBusinessLine'
          : 'forbiddenBusinessLineManage',
      );
    }

    return businessLine;
  }

  async assertProjectCapability(
    currentUser: JwtPayloadType,
    projectId: string,
    capability: string,
  ): Promise<Project> {
    const project = await this.projectRepository.findById(projectId);

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (this.isAdmin(currentUser)) {
      return project;
    }

    const membership = await this.projectMemberRepository.findByProjectIdAndUserId(
      projectId,
      currentUser.sub,
    );

    if (!membership) {
      throw new ForbiddenException('forbiddenProject');
    }

    if (!this.resolveProjectCapabilities(membership.role).includes(capability)) {
      throw new ForbiddenException(
        capability === 'project.read' || capability === 'project.task.read'
          ? 'forbiddenProject'
          : 'forbiddenProjectManage',
      );
    }

    return project;
  }

  async hasBusinessLineCapability(
    currentUser: JwtPayloadType,
    businessLineId: string,
    capability: string,
  ): Promise<boolean> {
    if (this.isAdmin(currentUser)) {
      return true;
    }

    const membership =
      await this.businessLineMemberRepository.findByBusinessLineIdAndUserId(
        businessLineId,
        currentUser.sub,
      );

    if (!membership) {
      return false;
    }

    return this.resolveBusinessLineCapabilities(membership.role).includes(
      capability,
    );
  }

  async hasProjectCapability(
    currentUser: JwtPayloadType,
    projectId: string,
    capability: string,
  ): Promise<boolean> {
    if (this.isAdmin(currentUser)) {
      return true;
    }

    const membership = await this.projectMemberRepository.findByProjectIdAndUserId(
      projectId,
      currentUser.sub,
    );

    if (!membership) {
      return false;
    }

    return this.resolveProjectCapabilities(membership.role).includes(capability);
  }

  private resolveBusinessLineCapabilities(
    role: BusinessLineMemberRole | null,
  ): string[] {
    if (!role) {
      return [];
    }

    return BUSINESS_LINE_ROLE_CAPABILITIES[role] ?? [];
  }

  private resolveProjectCapabilities(role: ProjectMemberRole | null): string[] {
    if (!role) {
      return [];
    }

    return PROJECT_ROLE_CAPABILITIES[role] ?? [];
  }

  private isAdmin(currentUser: JwtPayloadType): boolean {
    return currentUser.roles?.includes('admin') ?? false;
  }

  private async resolveVisibleProjectIds({
    businessLineMemberships,
    projectMemberships,
    currentBusinessLineId,
  }: {
    businessLineMemberships: Array<{
      businessLineId: string;
      role: BusinessLineMemberRole;
    }>;
    projectMemberships: Array<{
      projectId: string;
    }>;
    currentBusinessLineId?: string;
  }): Promise<string[]> {
    const projectIds = new Set(projectMemberships.map((membership) => membership.projectId));

    const manageableBusinessLineIds = businessLineMemberships
      .filter(
        (membership) =>
          membership.role === BusinessLineMemberRole.owner ||
          membership.role === BusinessLineMemberRole.admin,
      )
      .map((membership) => membership.businessLineId)
      .filter((businessLineId) =>
        currentBusinessLineId ? businessLineId === currentBusinessLineId : true,
      );

    for (const businessLineId of manageableBusinessLineIds) {
      const projects = await this.projectRepository.findByBusinessLineId(
        businessLineId,
      );
      for (const project of projects) {
        projectIds.add(project.id);
      }
    }

    if (!currentBusinessLineId) {
      return Array.from(projectIds);
    }

    const visibleProjects = await this.projectRepository.findByIds(
      Array.from(projectIds),
    );

    return visibleProjects
      .filter((project) => project.businessLineId === currentBusinessLineId)
      .map((project) => project.id);
  }

  private mergeUniqueIds(currentIds: string[], nextIds: string[]): string[] {
    return Array.from(new Set([...currentIds, ...nextIds]));
  }
}
