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
import { createSlowApiDiagnostics } from '../observability/slow-api-diagnostics';
import { readMemberRoleCapabilities } from '../utils/member-role-capabilities';
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
    const diagnostics = createSlowApiDiagnostics('access.current', {
      userId: currentUser.sub,
      requestedBusinessLineId: query.businessLineId ?? null,
      requestedProjectId: query.projectId ?? null,
    });
    const isAdmin = this.isAdmin(currentUser);

    try {
      const user = await diagnostics.measure(
        'user',
        () => this.usersService.findById(currentUser.sub),
        (result) => ({
          userFound: Boolean(result),
        }),
      );

      if (!user) {
        throw new UnauthorizedException('userNotFound');
      }

      const [businessLineMemberships, projectMemberships] =
        await diagnostics.measure(
          'memberships',
          () =>
            Promise.all([
              this.businessLineMemberRepository.findByUserId(currentUser.sub),
              this.projectMemberRepository.findByUserId(currentUser.sub),
            ]),
          ([businessMemberships, projectMembershipsResult]) => ({
            businessMembershipCount: businessMemberships.length,
            projectMembershipCount: projectMembershipsResult.length,
          }),
        );

      const [businessCapabilityMap, projectCapabilityMap] =
        await diagnostics.measure(
          'capabilityMaps',
          () =>
            Promise.all([
              this.buildBusinessLineCapabilityMap(businessLineMemberships),
              this.buildProjectCapabilityMap(projectMemberships),
            ]),
          ([businessCapabilityMapResult, projectCapabilityMapResult]) => ({
            businessCapabilityMapSize: businessCapabilityMapResult.size,
            projectCapabilityMapSize: projectCapabilityMapResult.size,
          }),
        );

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
      let visibleProjectIds = await diagnostics.measure(
        'visibleProjects',
        () =>
          this.resolveVisibleProjectIds({
            businessLineMemberships,
            businessCapabilityMap,
            projectMemberships,
            currentBusinessLineId: resolvedBusinessLineId,
          }),
        (result) => ({
          visibleProjectCount: result.length,
        }),
      );

      if (resolvedProjectId) {
        const project = await diagnostics.measure(
          'projectLookup',
          () => this.projectRepository.findById(resolvedProjectId),
          (result) => ({
            projectFound: Boolean(result),
          }),
        );

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

        if (!isAdmin) {
          const businessCapabilities =
            businessCapabilityMap.get(project.businessLineId) ?? [];
          const isVisibleByBusinessLine = businessCapabilities.includes(
            'businessLine.project.list.all',
          );
          const isVisibleByProject = projectMembershipByProjectId.has(
            project.id,
          );

          if (!isVisibleByBusinessLine && !isVisibleByProject) {
            throw new ForbiddenException('forbiddenProject');
          }
        }
      }

      if (resolvedBusinessLineId) {
        const businessLine = await diagnostics.measure(
          'businessLineLookup',
          () => this.businessLineRepository.findById(resolvedBusinessLineId),
          (result) => ({
            businessLineFound: Boolean(result),
          }),
        );

        if (!businessLine) {
          throw new NotFoundException('Business line not found');
        }

        if (isAdmin) {
          businessRole = 'owner';
        } else {
          const membership = businessMembershipByBusinessLineId.get(
            resolvedBusinessLineId,
          );
          businessRole = membership
            ? await diagnostics.measure(
                'businessRole',
                async () => {
                  if (membership.customRoleName?.trim()) {
                    return membership.customRoleName.trim();
                  }

                  return (
                    (
                      await this.resolveBusinessLineCustomRole(
                        membership.roleId,
                      )
                    )?.name ?? null
                  );
                },
                (result) => ({
                  businessRoleName: result ?? null,
                }),
              )
            : null;

          if (!membership || !businessRole) {
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
        if (isAdmin) {
          projectRole = 'owner';
        } else {
          const membership =
            projectMembershipByProjectId.get(resolvedProjectId);
          projectRole = membership
            ? await diagnostics.measure(
                'projectRole',
                async () => {
                  if (membership.customRoleName?.trim()) {
                    return membership.customRoleName.trim();
                  }

                  return (
                    (await this.resolveProjectCustomRole(membership.roleId))
                      ?.name ?? null
                  );
                },
                (result) => ({
                  projectRoleName: result ?? null,
                }),
              )
            : null;

          for (const capability of projectCapabilityMap.get(
            resolvedProjectId,
          ) ?? []) {
            capabilities.add(capability);
          }
        }

        visibleProjectIds = this.mergeUniqueIds(visibleProjectIds, [
          resolvedProjectId,
        ]);
      }

      if (isAdmin) {
        for (const capability of ALL_BUSINESS_LINE_CAPABILITIES) {
          capabilities.add(capability);
        }
        for (const capability of ALL_PROJECT_CAPABILITIES) {
          capabilities.add(capability);
        }

        if (resolvedBusinessLineId) {
          const businessProjects = await diagnostics.measure(
            'adminBusinessProjects',
            () =>
              this.projectRepository.findByBusinessLineId(
                resolvedBusinessLineId,
              ),
            (result) => ({
              adminBusinessProjectCount: result.length,
            }),
          );
          visibleProjectIds = this.mergeUniqueIds(
            visibleProjectIds,
            businessProjects.map((project) => project.id),
          );
        }
      }

      const response = {
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

      diagnostics.add({
        isAdmin,
        resolvedBusinessLineId: resolvedBusinessLineId ?? null,
        resolvedProjectId: resolvedProjectId ?? null,
        businessRole,
        projectRole,
        capabilityCount: response.capabilities.length,
        visibleBusinessLineCount:
          response.visibility.visibleBusinessLineIds.length,
        visibleProjectCount: response.visibility.visibleProjectIds.length,
      });

      return response;
    } finally {
      diagnostics.flush();
    }
  }

  async assertBusinessLineCapability(
    currentUser: JwtPayloadType,
    businessLineId: string,
    capability: string,
  ): Promise<BusinessLine> {
    const [businessLine, membership] = await Promise.all([
      this.businessLineRepository.findById(businessLineId),
      this.isAdmin(currentUser)
        ? Promise.resolve<BusinessLineMember | null>(null)
        : this.businessLineMemberRepository.findByBusinessLineIdAndUserId(
            businessLineId,
            currentUser.sub,
          ),
    ]);

    if (!businessLine) {
      throw new NotFoundException('Business line not found');
    }

    if (this.isAdmin(currentUser)) {
      return businessLine;
    }

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
    const [project, membership] = await Promise.all([
      this.projectRepository.findById(projectId),
      this.isAdmin(currentUser)
        ? Promise.resolve<ProjectMember | null>(null)
        : this.projectMemberRepository.findByProjectIdAndUserId(
            projectId,
            currentUser.sub,
          ),
    ]);

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (this.isAdmin(currentUser)) {
      return project;
    }

    if (!membership) {
      throw new ForbiddenException(
        this.isProjectReadCapability(capability)
          ? 'forbiddenProject'
          : 'forbiddenProjectManage',
      );
    }

    const availableCapabilities =
      await this.resolveProjectCapabilitiesForMembership(membership);

    if (!availableCapabilities.includes(capability)) {
      throw new ForbiddenException(
        this.isProjectReadCapability(capability)
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

    const [membership, project] = await Promise.all([
      this.projectMemberRepository.findByProjectIdAndUserId(
        projectId,
        currentUser.sub,
      ),
      this.projectRepository.findById(projectId),
    ]);

    if (!membership) {
      return false;
    }

    if (!project) {
      return false;
    }

    return (
      await this.resolveProjectCapabilitiesForMembership(membership)
    ).includes(capability);
  }

  async buildBusinessLineCapabilityMap(
    memberships: BusinessLineMember[],
  ): Promise<Map<string, string[]>> {
    const customRoleMap = this.membershipsNeedRoleLookup(memberships)
      ? await this.loadBusinessLineCustomRoleMap(
          memberships.map((membership) => membership.roleId),
        )
      : undefined;

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
    const customRoleMap = this.membershipsNeedRoleLookup(memberships)
      ? await this.loadProjectCustomRoleMap(
          memberships.map((membership) => membership.roleId),
        )
      : undefined;

    const entries = await Promise.all(
      memberships.map(async (membership) => {
        return [
          membership.projectId,
          await this.resolveProjectCapabilitiesForMembership(
            membership,
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

    const inlineCapabilities = this.resolveMembershipCapabilities(membership);
    if (inlineCapabilities) {
      return normalizeBusinessLineCapabilities(inlineCapabilities);
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
    customRoleMap?: Map<string, ProjectCustomRole>,
  ): Promise<string[]> {
    if (!membership) {
      return [];
    }

    const inlineCapabilities = this.resolveMembershipCapabilities(membership);
    if (inlineCapabilities) {
      return normalizeProjectCapabilities(inlineCapabilities);
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
    roleIds: string[],
  ): Promise<Map<string, BusinessLineCustomRole>> {
    const ids = Array.from(new Set(roleIds.filter(Boolean)));
    if (!ids.length) {
      return new Map();
    }

    const roles = await this.businessLineCustomRoleRepository.findByIds(ids);
    return new Map(roles.map((role) => [role.id, role] as const));
  }

  private async loadProjectCustomRoleMap(
    roleIds: string[],
  ): Promise<Map<string, ProjectCustomRole>> {
    const ids = Array.from(new Set(roleIds.filter(Boolean)));
    if (!ids.length) {
      return new Map();
    }

    const roles = await this.projectCustomRoleRepository.findByIds(ids);
    return new Map(roles.map((role) => [role.id, role] as const));
  }

  private isAdmin(currentUser: JwtPayloadType): boolean {
    return currentUser.roles?.includes('admin') ?? false;
  }

  private isProjectReadCapability(capability: string): boolean {
    return [
      'project.dashboard.read',
      'project.task.read',
      'project.kanban.read',
      'project.automation.read',
      'project.knowledge.read',
      'project.workflow.read',
      'project.skill.read',
      'project.mcp.read',
      'project.git.read',
      'project.read',
      'project.kanban.view',
      'project.automation.view',
      'project.workflow.view',
    ].includes(capability);
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

    const visibleProjectsByBusinessLine = await Promise.all(
      listAllBusinessLineIds.map((businessLineId) =>
        this.projectRepository.findByBusinessLineId(businessLineId),
      ),
    );

    for (const projects of visibleProjectsByBusinessLine) {
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

  private membershipsNeedRoleLookup(
    memberships: Array<BusinessLineMember | ProjectMember>,
  ): boolean {
    return memberships.some((membership) => {
      return !this.resolveMembershipCapabilities(membership);
    });
  }

  private resolveMembershipCapabilities(
    membership: BusinessLineMember | ProjectMember | null | undefined,
  ): string[] | null {
    return readMemberRoleCapabilities(membership);
  }
}
