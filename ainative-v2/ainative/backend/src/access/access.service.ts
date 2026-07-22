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
  createSlowApiDiagnostics,
  SlowApiDiagnosticsSession,
} from '../observability/slow-api-diagnostics';
import { readMemberRoleCapabilities } from '../utils/member-role-capabilities';
import {
  ALL_BUSINESS_LINE_CAPABILITIES,
  ALL_PROJECT_CAPABILITIES,
  BUSINESS_LINE_CREATE_CAPABILITY,
  PROJECT_ROLE_CAPABILITIES,
  normalizeBusinessLineCapabilities,
  normalizeProjectCapabilities,
} from './access.constants';
import { ProjectMemberRole } from '../projects/dto/project-member-role.enum';

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
      let resolvedProject: Project | null = null;
      let businessRole: string | null = null;
      let projectRole: string | null = null;

      const capabilities = new Set<string>();

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
        resolvedProject = project;

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
          const hasBusinessLineMembership =
            businessMembershipByBusinessLineId.has(project.businessLineId);
          const isWorkspaceManagedVisible =
            this.isWorkspaceManagedProject(project) &&
            hasBusinessLineMembership;

          if (
            !isVisibleByBusinessLine &&
            !isVisibleByProject &&
            !isWorkspaceManagedVisible
          ) {
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
          const isWorkspaceManaged =
            resolvedProject && this.isWorkspaceManagedProject(resolvedProject);
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
            : isWorkspaceManaged && businessRole
              ? this.resolveWorkspaceManagedProjectRole(businessRole)
              : null;

          const projectCapabilities =
            projectCapabilityMap.get(resolvedProjectId) ??
            (isWorkspaceManaged && resolvedBusinessLineId
              ? this.resolveWorkspaceManagedProjectCapabilities(
                  businessCapabilityMap.get(resolvedBusinessLineId) ?? [],
                )
              : []);

          for (const capability of projectCapabilities) {
            capabilities.add(capability);
          }
        }

        visibleProjectIds = this.mergeUniqueIds(visibleProjectIds, [
          resolvedProjectId,
        ]);
      }

      if (isAdmin) {
        capabilities.add(BUSINESS_LINE_CREATE_CAPABILITY);
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
        isAdmin,
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
    const businessLine =
      await this.businessLineRepository.findById(businessLineId);

    if (!businessLine) {
      throw new NotFoundException('Business line not found');
    }

    if (this.isAdmin(currentUser)) {
      return businessLine;
    }

    const hasCapability = await this.hasBusinessLineCapability(
      currentUser,
      businessLineId,
      capability,
    );

    if (!hasCapability) {
      throw new ForbiddenException('forbiddenBusinessLine');
    }

    return businessLine;
  }

  async assertProjectCapability(
    _currentUser: JwtPayloadType,
    projectId: string,
    _capability: string,
    diagnostics?: SlowApiDiagnosticsSession,
  ): Promise<Project> {
    void _currentUser;
    void _capability;
    const project = await this.projectRepository.findById(projectId, {
      diagnostics,
      metricPrefix: 'projectCapability',
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  async hasBusinessLineCapability(
    currentUser: JwtPayloadType,
    businessLineId: string,
    capability: string,
  ): Promise<boolean> {
    if (this.isAdmin(currentUser)) {
      return Boolean(
        await this.businessLineRepository.findById(businessLineId),
      );
    }

    const membership =
      await this.businessLineMemberRepository.findByBusinessLineIdAndUserId(
        businessLineId,
        currentUser.sub,
      );
    const capabilities =
      await this.resolveBusinessLineCapabilitiesForMembership(membership);

    return capabilities.includes(capability);
  }

  async hasBusinessLineCapabilityAny(
    currentUser: JwtPayloadType,
    businessLineId: string,
    capabilities: string[],
  ): Promise<boolean> {
    if (capabilities.length === 0) {
      return true;
    }

    if (this.isAdmin(currentUser)) {
      return Boolean(
        await this.businessLineRepository.findById(businessLineId),
      );
    }

    const membership =
      await this.businessLineMemberRepository.findByBusinessLineIdAndUserId(
        businessLineId,
        currentUser.sub,
      );
    const resolvedCapabilities =
      await this.resolveBusinessLineCapabilitiesForMembership(membership);

    return capabilities.some((capability) =>
      resolvedCapabilities.includes(capability),
    );
  }

  async hasProjectCapability(
    _currentUser: JwtPayloadType,
    projectId: string,
    _capability: string,
  ): Promise<boolean> {
    void _currentUser;
    void _capability;
    return Boolean(await this.projectRepository.findById(projectId));
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

  private isWorkspaceManagedProject(project: Project): boolean {
    const config = project.configJson;
    return (
      Boolean(config && typeof config === 'object') &&
      (config as Record<string, unknown>).workspaceManaged === true
    );
  }

  private resolveWorkspaceManagedProjectCapabilities(
    businessCapabilities: string[],
  ): string[] {
    const canManageProjects = businessCapabilities.some((capability) =>
      [
        'businessLine.project.list.all',
        'businessLine.project.create',
        'businessLine.project.update',
        'businessLine.project.delete',
      ].includes(capability),
    );

    if (canManageProjects) {
      return [...ALL_PROJECT_CAPABILITIES];
    }

    return normalizeProjectCapabilities(
      PROJECT_ROLE_CAPABILITIES[ProjectMemberRole.viewer],
    );
  }

  private resolveWorkspaceManagedProjectRole(
    businessRole: string,
  ): ProjectMemberRole {
    return ['owner', 'admin'].includes(businessRole)
      ? ProjectMemberRole.owner
      : ProjectMemberRole.viewer;
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
