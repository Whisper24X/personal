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
import { BusinessLineCustomRoleRepository } from '../business-lines/infrastructure/persistence/business-line-custom-role.repository';
import { ProjectRepository } from '../projects/infrastructure/persistence/project.repository';
import { ProjectMemberRepository } from '../projects/infrastructure/persistence/project-member.repository';
import { ProjectCustomRoleRepository } from '../projects/infrastructure/persistence/project-custom-role.repository';
import type { GetCurrentAccessDto } from './dto/get-current-access.dto';
import type { CurrentAccessDto } from './dto/current-access.dto';
import type { BusinessLine } from '../business-lines/domain/business-line';
import type { BusinessLineMember } from '../business-lines/domain/business-line-member';
import type { BusinessLineCustomRole } from '../business-lines/domain/business-line-custom-role';
import type { Project } from '../projects/domain/project';
import type { ProjectMember } from '../projects/domain/project-member';
import type { ProjectCustomRole } from '../projects/domain/project-custom-role';
import {
  ALL_BUSINESS_LINE_CAPABILITIES,
  ALL_PROJECT_CAPABILITIES,
  BUSINESS_LINE_CREATE_CAPABILITY,
  normalizeBusinessLineCapabilities,
  normalizeProjectCapabilities,
} from './access.constants';

@Injectable()
export class AccessService {
  constructor(
    private readonly usersService: UsersService,
    private readonly businessLineRepository: BusinessLineRepository,
    private readonly businessLineMemberRepository: BusinessLineMemberRepository,
    private readonly businessLineCustomRoleRepository: BusinessLineCustomRoleRepository,
    private readonly projectRepository: ProjectRepository,
    private readonly projectMemberRepository: ProjectMemberRepository,
    private readonly projectCustomRoleRepository: ProjectCustomRoleRepository,
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

    const [businessCapabilityMap, projectCapabilityMap] = await Promise.all([
      this.buildBusinessLineCapabilityMap(businessLineMemberships),
      this.buildProjectCapabilityMap(projectMemberships),
    ]);

    const businessMembershipByBusinessLineId = new Map(
      businessLineMemberships.map((membership) => [
        membership.businessLineId,
        membership,
      ]),
    );
    const projectMembershipByProjectId = new Map(
      projectMemberships.map((membership) => [
        membership.projectId,
        membership,
      ]),
    );

    let resolvedBusinessLineId = query.businessLineId;
    const resolvedProjectId = query.projectId;
    let businessRole: string | null = null;
    let projectRole: string | null = null;

    const capabilities = new Set<string>([BUSINESS_LINE_CREATE_CAPABILITY]);

    let visibleBusinessLineIds = businessLineMemberships.map(
      (membership) => membership.businessLineId,
    );
    let visibleProjectIds = await this.resolveVisibleProjectIds({
      businessLineMemberships,
      businessCapabilityMap,
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
        const businessCapabilities =
          businessCapabilityMap.get(project.businessLineId) ?? [];
        const isVisibleByBusinessLine = businessCapabilities.includes(
          'businessLine.project.list.all',
        );
        const isVisibleByProject = projectMembershipByProjectId.has(project.id);

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
        businessRole = 'owner';
      } else {
        const membership = businessMembershipByBusinessLineId.get(
          resolvedBusinessLineId,
        );
        const currentRole = membership
          ? await this.resolveBusinessLineCustomRole(membership.roleId)
          : null;
        businessRole = currentRole?.name ?? null;

        if (!membership || !currentRole) {
          throw new ForbiddenException('forbiddenBusinessLine');
        }

        for (const capability of businessCapabilityMap.get(
          resolvedBusinessLineId,
        ) ?? []) {
          capabilities.add(capability);
        }
      }

      visibleBusinessLineIds = this.mergeUniqueIds(visibleBusinessLineIds, [
        businessLine.id,
      ]);
    }

    if (resolvedProjectId) {
      if (this.isAdmin(currentUser)) {
        projectRole = 'owner';
      } else {
        const membership = projectMembershipByProjectId.get(resolvedProjectId);
        const currentRole = membership
          ? await this.resolveProjectCustomRole(membership.roleId)
          : null;
        projectRole = currentRole?.name ?? null;

        for (const capability of projectCapabilityMap.get(resolvedProjectId) ??
          []) {
          capabilities.add(capability);
        }
      }

      visibleProjectIds = this.mergeUniqueIds(visibleProjectIds, [
        resolvedProjectId,
      ]);
    }

    if (this.isAdmin(currentUser)) {
      for (const capability of ALL_BUSINESS_LINE_CAPABILITIES) {
        capabilities.add(capability);
      }
      for (const capability of ALL_PROJECT_CAPABILITIES) {
        capabilities.add(capability);
      }

      if (resolvedBusinessLineId) {
        const businessProjects =
          await this.projectRepository.findByBusinessLineId(
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
    const businessLine =
      await this.businessLineRepository.findById(businessLineId);

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

    const availableCapabilities =
      await this.resolveBusinessLineCapabilitiesForMembership(membership);

    if (!availableCapabilities.includes(capability)) {
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

    const membership =
      await this.projectMemberRepository.findByProjectIdAndUserId(
        projectId,
        currentUser.sub,
      );

    if (!membership) {
      throw new ForbiddenException(
        capability === 'project.read' || capability === 'project.task.read'
          ? 'forbiddenProject'
          : 'forbiddenProjectManage',
      );
    }

    const availableCapabilities =
      await this.resolveProjectCapabilitiesForMembership(
        membership,
        project.businessLineId,
      );

    if (!availableCapabilities.includes(capability)) {
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

    return (
      await this.resolveBusinessLineCapabilitiesForMembership(membership)
    ).includes(capability);
  }

  async hasBusinessLineCapabilityAny(
    currentUser: JwtPayloadType,
    businessLineId: string,
    capabilities: string[],
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

    const userCapabilities =
      await this.resolveBusinessLineCapabilitiesForMembership(membership);
    return capabilities.some((cap) => userCapabilities.includes(cap));
  }

  async hasProjectCapability(
    currentUser: JwtPayloadType,
    projectId: string,
    capability: string,
  ): Promise<boolean> {
    if (this.isAdmin(currentUser)) {
      return true;
    }

    const membership =
      await this.projectMemberRepository.findByProjectIdAndUserId(
        projectId,
        currentUser.sub,
      );

    if (!membership) {
      return false;
    }

    const project = await this.projectRepository.findById(projectId);
    if (!project) {
      return false;
    }

    return (
      await this.resolveProjectCapabilitiesForMembership(
        membership,
        project.businessLineId,
      )
    ).includes(capability);
  }

  async buildBusinessLineCapabilityMap(
    memberships: BusinessLineMember[],
  ): Promise<Map<string, string[]>> {
    const customRoleMap = await this.loadBusinessLineCustomRoleMap(
      memberships.map((membership) => membership.businessLineId),
    );

    const entries = await Promise.all(
      memberships.map(async (membership) => {
        return [
          membership.businessLineId,
          await this.resolveBusinessLineCapabilitiesForMembership(
            membership,
            customRoleMap,
          ),
        ] as const;
      }),
    );

    return new Map(entries);
  }

  async buildProjectCapabilityMap(
    memberships: ProjectMember[],
  ): Promise<Map<string, string[]>> {
    const projects = await this.projectRepository.findByIds(
      Array.from(
        new Set(memberships.map((membership) => membership.projectId)),
      ),
    );
    const projectBusinessLineMap = new Map(
      projects.map((project) => [project.id, project.businessLineId]),
    );
    const customRoleMap = await this.loadProjectCustomRoleMap(
      Array.from(new Set(projects.map((project) => project.businessLineId))),
    );

    const entries = await Promise.all(
      memberships.map(async (membership) => {
        return [
          membership.projectId,
          await this.resolveProjectCapabilitiesForMembership(
            membership,
            projectBusinessLineMap.get(membership.projectId),
            customRoleMap,
          ),
        ] as const;
      }),
    );

    return new Map(entries);
  }

  private async resolveBusinessLineCapabilitiesForMembership(
    membership: BusinessLineMember | null,
    customRoleMap?: Map<string, BusinessLineCustomRole>,
  ): Promise<string[]> {
    if (!membership) {
      return [];
    }

    const customRole = await this.resolveBusinessLineCustomRole(
      membership.roleId,
      customRoleMap,
    );

    if (!customRole) {
      return [];
    }

    return normalizeBusinessLineCapabilities(customRole.capabilities);
  }

  private async resolveProjectCapabilitiesForMembership(
    membership: ProjectMember | null,
    businessLineId?: string,
    customRoleMap?: Map<string, ProjectCustomRole>,
  ): Promise<string[]> {
    if (!membership || !businessLineId) {
      return [];
    }

    const customRole = await this.resolveProjectCustomRole(
      membership.roleId,
      customRoleMap,
    );

    if (!customRole) {
      return [];
    }

    return normalizeProjectCapabilities(customRole.capabilities);
  }

  private async resolveBusinessLineCustomRole(
    roleId: string,
    customRoleMap?: Map<string, BusinessLineCustomRole>,
  ): Promise<BusinessLineCustomRole | null> {
    if (customRoleMap?.has(roleId)) {
      return customRoleMap.get(roleId) ?? null;
    }

    return this.businessLineCustomRoleRepository.findById(roleId);
  }

  private async resolveProjectCustomRole(
    roleId: string,
    customRoleMap?: Map<string, ProjectCustomRole>,
  ): Promise<ProjectCustomRole | null> {
    if (customRoleMap?.has(roleId)) {
      return customRoleMap.get(roleId) ?? null;
    }

    return this.projectCustomRoleRepository.findById(roleId);
  }

  private async loadBusinessLineCustomRoleMap(
    businessLineIds: string[],
  ): Promise<Map<string, BusinessLineCustomRole>> {
    const ids = Array.from(new Set(businessLineIds.filter(Boolean)));
    const roleMap = new Map<string, BusinessLineCustomRole>();

    for (const businessLineId of ids) {
      const roles =
        await this.businessLineCustomRoleRepository.findAllByBusinessLineId(
          businessLineId,
        );
      for (const role of roles) {
        roleMap.set(role.id, role);
      }
    }

    return roleMap;
  }

  private async loadProjectCustomRoleMap(
    businessLineIds: string[],
  ): Promise<Map<string, ProjectCustomRole>> {
    const ids = Array.from(new Set(businessLineIds.filter(Boolean)));
    const roleMap = new Map<string, ProjectCustomRole>();

    for (const businessLineId of ids) {
      const roles =
        await this.projectCustomRoleRepository.findAllByBusinessLineId(
          businessLineId,
        );
      for (const role of roles) {
        roleMap.set(role.id, role);
      }
    }

    return roleMap;
  }

  private isAdmin(currentUser: JwtPayloadType): boolean {
    return currentUser.roles?.includes('admin') ?? false;
  }

  private async resolveVisibleProjectIds({
    businessLineMemberships,
    businessCapabilityMap,
    projectMemberships,
    currentBusinessLineId,
  }: {
    businessLineMemberships: BusinessLineMember[];
    businessCapabilityMap: Map<string, string[]>;
    projectMemberships: Array<{
      projectId: string;
    }>;
    currentBusinessLineId?: string;
  }): Promise<string[]> {
    const projectIds = new Set(
      projectMemberships.map((membership) => membership.projectId),
    );

    const listAllBusinessLineIds = businessLineMemberships
      .filter((membership) =>
        (businessCapabilityMap.get(membership.businessLineId) ?? []).includes(
          'businessLine.project.list.all',
        ),
      )
      .map((membership) => membership.businessLineId)
      .filter((businessLineId) =>
        currentBusinessLineId ? businessLineId === currentBusinessLineId : true,
      );

    for (const businessLineId of listAllBusinessLineIds) {
      const projects =
        await this.projectRepository.findByBusinessLineId(businessLineId);
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
