import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { BusinessLineMemberRole } from './dto/business-line-member-role.enum';
import { CreateBusinessLineDto } from './dto/create-business-line.dto';
import { UpdateBusinessLineDto } from './dto/update-business-line.dto';
import { BusinessLine } from './domain/business-line';
import { BusinessLineMemberRepository } from './infrastructure/persistence/business-line-member.repository';
import { BusinessLineRepository } from './infrastructure/persistence/business-line.repository';
import { BusinessLineRoleCatalogService } from './business-line-role-catalog.service';
import { RunnerGenerationService } from './runner-generation.service';
import { ProjectMemberRole } from '../projects/dto/project-member-role.enum';
import { ProjectMemberRepository } from '../projects/infrastructure/persistence/project-member.repository';
import { ProjectRepository } from '../projects/infrastructure/persistence/project.repository';
import { RepositoryProvisioningStatus } from '../projects/domain/repository-provisioning-status.enum';
import { isBusinessLineOwnerCapabilities } from '../access/access.constants';
import { SubRepoConfig, resolveSubRepoConfigs } from '../git/sub-repo.types';
import type { AllConfigType } from '../config/config.type';
import { SubRepoValidationService } from '../git/sub-repo-validation.service';
import { assertGitRefSlugSegment } from '../git/git-ref-name.util';
import { BusinessLineLocalAssetsService } from './business-line-local-assets.service';

@Injectable()
export class BusinessLineLifecycleService {
  private readonly logger = new Logger(BusinessLineLifecycleService.name);

  constructor(
    private readonly businessLineRepository: BusinessLineRepository,
    private readonly businessLineMemberRepository: BusinessLineMemberRepository,
    private readonly businessLineRoleCatalogService: BusinessLineRoleCatalogService,
    private readonly runnerGenerationService: RunnerGenerationService,
    private readonly projectRepository: ProjectRepository,
    private readonly projectMemberRepository: ProjectMemberRepository,
    private readonly configService: ConfigService<AllConfigType>,
    private readonly subRepoValidationService: SubRepoValidationService,
    private readonly businessLineLocalAssetsService: BusinessLineLocalAssetsService,
  ) {}

  async create(
    createBusinessLineDto: CreateBusinessLineDto,
    currentUser: JwtPayloadType,
  ): Promise<BusinessLine> {
    if (!this.isAdmin(currentUser)) {
      throw new ForbiddenException('forbiddenCreateBusinessLine');
    }

    const existedBusinessLine = await this.businessLineRepository.findByName(
      createBusinessLineDto.name,
    );

    if (existedBusinessLine) {
      throw new ConflictException('Business line name already exists');
    }

    const slug = assertGitRefSlugSegment(
      createBusinessLineDto.slug,
      '业务线标识',
    );
    const existedSlug = await this.businessLineRepository.findBySlug(slug);
    if (existedSlug) {
      throw new ConflictException('Business line slug already exists');
    }

    if (createBusinessLineDto.configJson) {
      await this.subRepoValidationService.validateConfiguredSubRepositories(
        createBusinessLineDto.configJson as Record<string, unknown>,
      );
    }

    const businessLine = await this.businessLineRepository.create({
      name: createBusinessLineDto.name,
      slug,
      description: createBusinessLineDto.description ?? null,
      configJson: createBusinessLineDto.configJson ?? null,
    });

    await this.businessLineRoleCatalogService.ensureDefaultBusinessLineCustomRoles(
      businessLine.id,
    );
    await this.businessLineRoleCatalogService.ensureDefaultProjectCustomRoles(
      businessLine.id,
    );
    const ownerRole =
      await this.businessLineRoleCatalogService.findDefaultBusinessLineCustomRole(
        businessLine.id,
        BusinessLineMemberRole.owner,
      );

    await this.businessLineMemberRepository.create({
      businessLineId: businessLine.id,
      userId: currentUser.sub,
      roleId: ownerRole.id,
    });

    const subRepos = resolveSubRepoConfigs(businessLine.configJson);
    if (subRepos.length > 0) {
      await this.upsertHiddenProject(businessLine, subRepos);
      this.triggerRunnerGenerationIfNeeded(businessLine);
    }

    return businessLine;
  }

  async findAllWithPagination({
    currentUser,
    paginationOptions,
  }: {
    currentUser: JwtPayloadType;
    paginationOptions: IPaginationOptions;
  }): Promise<BusinessLine[]> {
    if (this.isAdmin(currentUser)) {
      return this.businessLineRepository.findAllWithPagination({
        paginationOptions: {
          page: paginationOptions.page,
          limit: paginationOptions.limit,
        },
      });
    }

    return this.findBusinessLinesForUser(currentUser.sub, paginationOptions);
  }

  findById(id: BusinessLine['id']): Promise<BusinessLine | null> {
    return this.businessLineRepository.findById(id);
  }

  findByIds(ids: BusinessLine['id'][]): Promise<BusinessLine[]> {
    return this.businessLineRepository.findByIds(ids);
  }

  async update(
    id: BusinessLine['id'],
    updateBusinessLineDto: UpdateBusinessLineDto,
  ): Promise<BusinessLine | null> {
    if (updateBusinessLineDto.slug !== undefined) {
      throw new BadRequestException('Business line slug cannot be changed');
    }

    if (updateBusinessLineDto.name) {
      const existedBusinessLine = await this.businessLineRepository.findByName(
        updateBusinessLineDto.name,
      );

      if (existedBusinessLine && existedBusinessLine.id !== id) {
        throw new ConflictException('Business line name already exists');
      }
    }

    const existingBl = await this.businessLineRepository.findById(id);
    const previousSubRepos = existingBl
      ? resolveSubRepoConfigs(existingBl.configJson)
      : [];

    const payload: Partial<BusinessLine> = {};
    if (updateBusinessLineDto.name !== undefined) {
      payload.name = updateBusinessLineDto.name;
    }
    if (updateBusinessLineDto.description !== undefined) {
      payload.description = updateBusinessLineDto.description;
    }
    if (updateBusinessLineDto.configJson !== undefined) {
      const existingConfig = (existingBl?.configJson ?? {}) as Record<
        string,
        unknown
      >;
      const incomingConfig = (updateBusinessLineDto.configJson ?? {}) as Record<
        string,
        unknown
      >;
      payload.configJson = { ...existingConfig, ...incomingConfig };

      if (incomingConfig.subRepos !== undefined) {
        await this.subRepoValidationService.validateConfiguredSubRepositories(
          payload.configJson as Record<string, unknown>,
        );
      }
    }

    const updated = await this.businessLineRepository.update(id, payload);

    if (updated && updateBusinessLineDto.configJson !== undefined) {
      const newSubRepos = resolveSubRepoConfigs(updated.configJson);
      if (this.subReposChanged(previousSubRepos, newSubRepos)) {
        if (newSubRepos.length > 0) {
          await this.upsertHiddenProject(updated, newSubRepos);
          this.triggerRunnerGenerationIfNeeded(updated);
        } else {
          await this.disableHiddenProject(updated);
        }
      } else if (newSubRepos.length > 0) {
        await this.ensureHiddenProjectAccess(updated);
      }
    }

    return updated;
  }

  async remove(id: BusinessLine['id']): Promise<void> {
    await this.businessLineRepository.remove(id);

    try {
      await this.businessLineLocalAssetsService.removeBusinessLineLocalAssets(
        id,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown local asset error';
      this.logger.warn(
        `Failed to remove local assets for business line ${id}: ${message}`,
      );
    }
  }

  /**
   * Upsert the hidden, platform-managed Project that backs the ainative-workspace repo
   * for this business line. One BL → one hidden project (enforced by unique index).
   */
  private async upsertHiddenProject(
    bl: BusinessLine,
    subRepos: SubRepoConfig[],
  ): Promise<void> {
    const workspaceGitUrl = this.configService.get('app.workspaceGitUrl', {
      infer: true,
    }) as string;
    const workspaceBaseBranch = this.configService.get(
      'app.workspaceBaseBranch',
      { infer: true },
    ) as string;

    const projectConfigJson: Record<string, unknown> = {
      subtreeMode: 'workspace-native',
      workspaceManaged: true,
      workspaceNativeDisabled: false,
      subRepos,
    };

    const existing =
      await this.projectRepository.findWorkspaceManagedByBusinessLineId(bl.id);

    if (existing) {
      await this.projectRepository.update(existing.id, {
        configJson: { ...(existing.configJson ?? {}), ...projectConfigJson },
      });
      await this.ensureHiddenProjectMembers(bl, existing.id);
      this.logger.debug(
        `Updated hidden project ${existing.id} for BusinessLine ${bl.id}`,
      );
    } else {
      const project = await this.projectRepository.create({
        businessLineId: bl.id,
        name: bl.name,
        slug: '_managed',
        description: '',
        gitUrl: workspaceGitUrl,
        defaultBranch: workspaceBaseBranch,
        configJson: projectConfigJson,
        repositoryProvisioningStatus: RepositoryProvisioningStatus.Ready,
        repositoryProvisioningError: null,
        repositoryProvisionedAt: new Date(),
      });
      this.logger.log(
        `Created hidden project ${project.id} for BusinessLine ${bl.id}`,
      );
      await this.ensureHiddenProjectMembers(bl, project.id);
    }
  }

  async ensureHiddenProjectAccess(bl: Pick<BusinessLine, 'id'>): Promise<void> {
    const existing =
      await this.projectRepository.findWorkspaceManagedByBusinessLineId(bl.id);
    if (!existing) return;

    await this.ensureHiddenProjectMembers(bl, existing.id);
  }

  async syncHiddenProjectMember(args: {
    businessLineId: string;
    userId: string;
    roleId: string;
  }): Promise<void> {
    const existing =
      await this.projectRepository.findWorkspaceManagedByBusinessLineId(
        args.businessLineId,
      );
    if (!existing) return;

    const projectRoleId = await this.resolveInheritedProjectRoleId(
      args.businessLineId,
      args.roleId,
    );
    const membership =
      await this.projectMemberRepository.findByProjectIdAndUserId(
        existing.id,
        args.userId,
      );

    if (!membership) {
      await this.projectMemberRepository.create({
        projectId: existing.id,
        userId: args.userId,
        roleId: projectRoleId,
      });
      return;
    }

    if (membership.roleId !== projectRoleId) {
      await this.projectMemberRepository.update(existing.id, args.userId, {
        roleId: projectRoleId,
      });
    }
  }

  async removeHiddenProjectMember(args: {
    businessLineId: string;
    userId: string;
  }): Promise<void> {
    const existing =
      await this.projectRepository.findWorkspaceManagedByBusinessLineId(
        args.businessLineId,
      );
    if (!existing) return;

    const membership =
      await this.projectMemberRepository.findByProjectIdAndUserId(
        existing.id,
        args.userId,
      );
    if (!membership) return;

    await this.projectMemberRepository.remove(existing.id, args.userId);
  }

  private async ensureHiddenProjectMembers(
    bl: Pick<BusinessLine, 'id'>,
    projectId: string,
  ): Promise<void> {
    const members =
      await this.businessLineMemberRepository.findByBusinessLineId(bl.id);
    if (members.length === 0) return;

    await this.businessLineRoleCatalogService.ensureDefaultProjectCustomRoles(
      bl.id,
    );

    for (const member of members) {
      const projectRoleId = await this.resolveInheritedProjectRoleId(
        bl.id,
        member.roleId,
      );
      const existing =
        await this.projectMemberRepository.findByProjectIdAndUserId(
          projectId,
          member.userId,
        );
      if (existing) {
        if (existing.roleId !== projectRoleId) {
          await this.projectMemberRepository.update(projectId, member.userId, {
            roleId: projectRoleId,
          });
        }
        continue;
      }

      await this.projectMemberRepository.create({
        projectId,
        userId: member.userId,
        roleId: projectRoleId,
      });
    }
  }

  private async resolveInheritedProjectRoleId(
    businessLineId: string,
    businessLineRoleId: string,
  ): Promise<string> {
    const businessLineRole =
      await this.businessLineRoleCatalogService.getBusinessLineCustomRoleOrThrow(
        businessLineId,
        businessLineRoleId,
      );
    const targetProjectRole = this.mapBusinessLineCapabilitiesToProjectRole(
      businessLineRole.capabilities,
    );
    const projectRole =
      await this.businessLineRoleCatalogService.findDefaultProjectCustomRole(
        businessLineId,
        targetProjectRole,
      );

    return projectRole.id;
  }

  private mapBusinessLineCapabilitiesToProjectRole(
    capabilities: string[],
  ): ProjectMemberRole {
    if (isBusinessLineOwnerCapabilities(capabilities)) {
      return ProjectMemberRole.owner;
    }

    if (
      capabilities.includes('businessLine.project.update') ||
      capabilities.includes('businessLine.project.delete') ||
      capabilities.includes('businessLine.projectRole.update') ||
      capabilities.includes('businessLine.member.updateRole')
    ) {
      return ProjectMemberRole.maintainer;
    }

    return ProjectMemberRole.viewer;
  }

  private async disableHiddenProject(bl: BusinessLine): Promise<void> {
    const existing =
      await this.projectRepository.findWorkspaceManagedByBusinessLineId(bl.id);
    if (!existing) return;

    await this.projectRepository.update(existing.id, {
      configJson: {
        ...(existing.configJson ?? {}),
        subtreeMode: null,
        workspaceManaged: true,
        workspaceNativeDisabled: true,
        subRepos: [],
      },
    });
    this.logger.log(
      `Disabled workspace-native for hidden project ${existing.id} (BusinessLine ${bl.id}, subRepos cleared)`,
    );
  }

  private triggerRunnerGenerationIfNeeded(bl: BusinessLine): void {
    const subRepos = resolveSubRepoConfigs(bl.configJson);
    if (subRepos.length === 0) return;

    this.logger.log(
      `Enqueuing runner generation for BusinessLine ${bl.id} (${subRepos.length} subRepos)`,
    );
    this.runnerGenerationService.enqueue(bl.id);
  }

  private subReposChanged(
    previous: { url: string; prefix: string; branch: string }[],
    current: { url: string; prefix: string; branch: string }[],
  ): boolean {
    if (previous.length !== current.length) return true;

    const serialize = (
      repos: { url: string; prefix: string; branch: string }[],
    ) =>
      [...repos]
        .sort((a, b) => a.prefix.localeCompare(b.prefix))
        .map((r) => `${r.prefix}|${r.url}|${r.branch}`)
        .join('\n');

    return serialize(previous) !== serialize(current);
  }

  private async findBusinessLinesForUser(
    userId: string,
    paginationOptions: IPaginationOptions,
  ): Promise<BusinessLine[]> {
    const memberships =
      await this.businessLineMemberRepository.findByUserId(userId);
    const ids = memberships.map((membership) => membership.businessLineId);

    return this.businessLineRepository.findAllByIdsWithPagination({
      ids,
      paginationOptions,
    });
  }

  private isAdmin(currentUser: JwtPayloadType): boolean {
    return currentUser.roles?.includes('admin') ?? false;
  }
}
