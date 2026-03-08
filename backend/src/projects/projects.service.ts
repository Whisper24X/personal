import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectRepository } from './infrastructure/persistence/project.repository';
import { ProjectMemberRepository } from './infrastructure/persistence/project-member.repository';
import { Project } from './domain/project';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { BusinessLineRepository } from '../business-lines/infrastructure/persistence/business-line.repository';
import { BusinessLineMemberRepository } from '../business-lines/infrastructure/persistence/business-line-member.repository';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { FindAllProjectsDto } from './dto/find-all-projects.dto';
import { ProjectMember } from './domain/project-member';
import { CreateProjectMemberDto } from './dto/create-project-member.dto';
import { UpdateProjectMemberDto } from './dto/update-project-member.dto';
import {
  InspectProjectRepositoryDto,
  ProjectRepositoryInspectionDto,
} from './dto/inspect-project-repository.dto';
import { UsersService } from '../users/users.service';
import { ProjectMemberRole } from './dto/project-member-role.enum';
import { resolveAinativeDataRootDir } from '../utils/workspace-paths';
import { TaskRepository } from '../tasks/infrastructure/persistence/task.repository';
import { AccessService } from '../access/access.service';
import { ProjectCustomRoleRepository } from './infrastructure/persistence/project-custom-role.repository';
import { ProjectCustomRole } from './domain/project-custom-role';
import { CreateProjectCustomRoleDto } from './dto/create-project-custom-role.dto';
import { UpdateProjectCustomRoleDto } from './dto/update-project-custom-role.dto';
import {
  ALL_PROJECT_CAPABILITIES,
  PROJECT_DEFAULT_ROLE_TEMPLATES,
  getProjectDefaultRoleTemplate,
  hasProjectTemplateCapabilities,
  isDefaultTemplateRoleName,
  isProjectOwnerCapabilities,
  normalizeProjectCapabilities,
} from '../access/access.constants';

@Injectable()
export class ProjectsService {
  private readonly defaultGitTimeoutMs = 60_000;
  private readonly defaultDataRootDir = path.resolve(
    resolveAinativeDataRootDir(),
  );

  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly projectMemberRepository: ProjectMemberRepository,
    private readonly businessLineRepository: BusinessLineRepository,
    private readonly businessLineMemberRepository: BusinessLineMemberRepository,
    private readonly usersService: UsersService,
    private readonly taskRepository: TaskRepository,
    private readonly projectCustomRoleRepository: ProjectCustomRoleRepository,
    private readonly accessService: AccessService,
    private readonly configService: ConfigService = new ConfigService(),
  ) {}

  async create(
    createProjectDto: CreateProjectDto,
    currentUser: JwtPayloadType,
  ): Promise<Project> {
    await this.ensureCanManageBusinessLine(
      createProjectDto.businessLineId,
      currentUser,
      'businessLine.project.create',
    );

    const existedProject =
      await this.projectRepository.findByBusinessLineIdAndName(
        createProjectDto.businessLineId,
        createProjectDto.name,
      );

    if (existedProject) {
      throw new ConflictException(
        'Project name already exists in business line',
      );
    }

    await this.validateGitRepositoryAccessible(createProjectDto.gitUrl);

    const project = await this.projectRepository.create({
      businessLineId: createProjectDto.businessLineId,
      name: createProjectDto.name,
      description: createProjectDto.description ?? null,
      gitUrl: createProjectDto.gitUrl,
      defaultBranch: createProjectDto.defaultBranch ?? 'main',
      configJson: createProjectDto.configJson ?? null,
    });

    try {
      await this.ensureProjectRepository(project);
    } catch (error) {
      await this.rollbackCreatedProject(project.id);
      throw new BadRequestException(
        this.formatGitSyncFailureMessage(error, project.gitUrl),
      );
    }

    const existedCreatorMember =
      await this.projectMemberRepository.findByProjectIdAndUserId(
        project.id,
        currentUser.sub,
      );

    if (!existedCreatorMember) {
      await this.ensureDefaultProjectCustomRoles(project.businessLineId);
      const ownerRole = await this.findDefaultProjectCustomRole(
        project.businessLineId,
        ProjectMemberRole.owner,
      );

      await this.projectMemberRepository.create({
        projectId: project.id,
        userId: currentUser.sub,
        roleId: ownerRole.id,
      });
    }

    return project;
  }

  async inspectRepository(
    inspectProjectRepositoryDto: InspectProjectRepositoryDto,
    currentUser: JwtPayloadType,
  ): Promise<ProjectRepositoryInspectionDto> {
    await this.ensureCanManageBusinessLine(
      inspectProjectRepositoryDto.businessLineId,
      currentUser,
      'businessLine.project.create',
    );

    const gitUrl = inspectProjectRepositoryDto.gitUrl.trim();
    const result = await this.runCommand('git', [
      'ls-remote',
      '--heads',
      '--refs',
      gitUrl,
    ]);

    if (!result.success) {
      throw new BadRequestException(
        `Git repository is unreachable or unauthorized: ${this.truncateError(result.stderr)}`,
      );
    }

    const branches = this.sortBranches(this.parseRemoteBranches(result.stdout));
    const recommendedDefaultBranch =
      this.resolveRecommendedDefaultBranch(branches);

    return {
      repoName: this.extractRepositoryName(gitUrl) ?? 'repository',
      branches,
      recommendedDefaultBranch,
    };
  }

  async findAllWithPagination({
    currentUser,
    query,
  }: {
    currentUser: JwtPayloadType;
    query: FindAllProjectsDto;
  }): Promise<Project[]> {
    const paginationOptions: IPaginationOptions = {
      page: query.page ?? 1,
      limit: query.limit ?? 10,
    };

    if (this.isAdmin(currentUser)) {
      return this.projectRepository.findAllWithPagination({
        paginationOptions,
        businessLineId: query.businessLineId,
        keyword: query.keyword,
      });
    }

    const [projectMemberships, businessLineMemberships] = await Promise.all([
      this.projectMemberRepository.findByUserId(currentUser.sub),
      this.businessLineMemberRepository.findByUserId(currentUser.sub),
    ]);

    const accessibleProjectIds = projectMemberships.map(
      (membership) => membership.projectId,
    );

    const businessCapabilityMap =
      await this.accessService.buildBusinessLineCapabilityMap(
        businessLineMemberships,
      );

    const manageableBusinessLineIds = businessLineMemberships
      .filter((membership) =>
        (businessCapabilityMap.get(membership.businessLineId) ?? []).includes(
          'businessLine.project.list.all',
        ),
      )
      .map((membership) => membership.businessLineId);

    return this.projectRepository.findAccessibleWithPagination({
      paginationOptions,
      projectIds: accessibleProjectIds,
      businessLineIds: manageableBusinessLineIds,
      keyword: query.keyword,
      businessLineId: query.businessLineId,
    });
  }

  async findById(
    id: Project['id'],
    currentUser: JwtPayloadType,
  ): Promise<Project | null> {
    return this.ensureCanAccessProject(id, currentUser);
  }

  async update(
    id: Project['id'],
    updateProjectDto: UpdateProjectDto,
    currentUser: JwtPayloadType,
  ): Promise<Project> {
    const currentProject = await this.ensureCanUpdateProjectItem(
      id,
      currentUser,
    );

    const nextBusinessLineId =
      updateProjectDto.businessLineId ?? currentProject.businessLineId;

    if (updateProjectDto.businessLineId) {
      await this.ensureCanManageBusinessLine(
        updateProjectDto.businessLineId,
        currentUser,
        'businessLine.project.update',
      );
    }

    if (updateProjectDto.name) {
      const existedProject =
        await this.projectRepository.findByBusinessLineIdAndName(
          nextBusinessLineId,
          updateProjectDto.name,
        );

      if (existedProject && existedProject.id !== id) {
        throw new ConflictException(
          'Project name already exists in business line',
        );
      }
    }

    const updatedProject = await this.projectRepository.update(id, {
      ...(updateProjectDto.name !== undefined
        ? { name: updateProjectDto.name }
        : {}),
      ...(updateProjectDto.description !== undefined
        ? { description: updateProjectDto.description }
        : {}),
      ...(updateProjectDto.gitUrl !== undefined
        ? { gitUrl: updateProjectDto.gitUrl }
        : {}),
      ...(updateProjectDto.defaultBranch !== undefined
        ? { defaultBranch: updateProjectDto.defaultBranch }
        : {}),
      ...(updateProjectDto.configJson !== undefined
        ? { configJson: updateProjectDto.configJson }
        : {}),
      ...(updateProjectDto.businessLineId !== undefined
        ? { businessLineId: updateProjectDto.businessLineId }
        : {}),
    });

    if (!updatedProject) {
      throw new NotFoundException('Project not found');
    }

    if (updatedProject.businessLineId !== currentProject.businessLineId) {
      await this.taskRepository.bulkUpdateBusinessLineIdByProjectId({
        projectId: updatedProject.id,
        businessLineId: updatedProject.businessLineId,
      });
    }

    return updatedProject;
  }

  async remove(id: Project['id'], currentUser: JwtPayloadType): Promise<void> {
    await this.ensureCanDeleteProjectItem(id, currentUser);
    await this.projectRepository.remove(id);
  }

  async findMembers(
    projectId: Project['id'],
    currentUser: JwtPayloadType,
  ): Promise<ProjectMember[]> {
    await this.accessService.assertProjectCapability(
      currentUser,
      projectId,
      'project.member.manage',
    );

    const [project, members] = await Promise.all([
      this.projectRepository.findById(projectId),
      this.projectMemberRepository.findByProjectId(projectId),
    ]);

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return this.attachCustomRoleNamesToProjectMembers(
      members,
      project.businessLineId,
    );
  }

  async addMember(
    projectId: Project['id'],
    createProjectMemberDto: CreateProjectMemberDto,
    currentUser: JwtPayloadType,
  ): Promise<ProjectMember> {
    const manageContext = await this.ensureCanManageProjectMembers(
      projectId,
      currentUser,
    );

    const assignment = await this.resolveProjectMemberAssignment(
      manageContext.project,
      createProjectMemberDto.roleId,
    );

    await this.ensureActorCanManageMemberMutation({
      currentUser,
      businessLineId: manageContext.project.businessLineId,
      actorProjectMember: manageContext.actorProjectMember,
      nextRoleId: assignment.roleId,
    });

    const existedMember =
      await this.projectMemberRepository.findByProjectIdAndUserId(
        projectId,
        createProjectMemberDto.userId,
      );

    if (existedMember) {
      throw new ConflictException('Member already exists in project');
    }

    const user = await this.usersService.findById(
      createProjectMemberDto.userId,
    );
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const businessLineMember =
      await this.businessLineMemberRepository.findByBusinessLineIdAndUserId(
        manageContext.project.businessLineId,
        createProjectMemberDto.userId,
      );

    if (!businessLineMember) {
      throw new ConflictException(
        'User is not a member of project business line',
      );
    }

    const member = await this.projectMemberRepository.create({
      projectId,
      userId: createProjectMemberDto.userId,
      roleId: assignment.roleId,
    });

    return this.attachCustomRoleNameToProjectMember(
      member,
      manageContext.project.businessLineId,
    );
  }

  async updateMemberRole(
    projectId: Project['id'],
    userId: string,
    updateProjectMemberDto: UpdateProjectMemberDto,
    currentUser: JwtPayloadType,
  ): Promise<ProjectMember> {
    const manageContext = await this.ensureCanManageProjectMembers(
      projectId,
      currentUser,
    );

    const targetMember =
      await this.projectMemberRepository.findByProjectIdAndUserId(
        projectId,
        userId,
      );

    if (!targetMember) {
      throw new NotFoundException('Project member not found');
    }

    const assignment = await this.resolveProjectMemberAssignment(
      manageContext.project,
      updateProjectMemberDto.roleId,
    );

    await this.ensureActorCanManageMemberMutation({
      currentUser,
      businessLineId: manageContext.project.businessLineId,
      actorProjectMember: manageContext.actorProjectMember,
      targetMember,
      nextRoleId: assignment.roleId,
    });

    if (
      (await this.isProjectOwnerRole(
        manageContext.project.businessLineId,
        targetMember.roleId,
      )) &&
      !(await this.isProjectOwnerRole(
        manageContext.project.businessLineId,
        assignment.roleId,
      ))
    ) {
      this.ensureOwnerSelfProtection(targetMember, currentUser);
      await this.ensureOwnerCanBeModified(projectId);
    }

    const updatedMember = await this.projectMemberRepository.update(
      projectId,
      userId,
      {
        roleId: assignment.roleId,
      },
    );

    if (!updatedMember) {
      throw new NotFoundException('Project member not found');
    }

    return this.attachCustomRoleNameToProjectMember(
      updatedMember,
      manageContext.project.businessLineId,
    );
  }

  async removeMember(
    projectId: Project['id'],
    userId: string,
    currentUser: JwtPayloadType,
  ): Promise<void> {
    const manageContext = await this.ensureCanManageProjectMembers(
      projectId,
      currentUser,
    );

    const targetMember =
      await this.projectMemberRepository.findByProjectIdAndUserId(
        projectId,
        userId,
      );

    if (!targetMember) {
      throw new NotFoundException('Project member not found');
    }

    await this.ensureActorCanManageMemberMutation({
      currentUser,
      businessLineId: manageContext.project.businessLineId,
      actorProjectMember: manageContext.actorProjectMember,
      targetMember,
    });

    if (
      await this.isProjectOwnerRole(
        manageContext.project.businessLineId,
        targetMember.roleId,
      )
    ) {
      this.ensureOwnerSelfProtection(targetMember, currentUser);
      await this.ensureOwnerCanBeModified(projectId);
    }

    await this.projectMemberRepository.remove(projectId, userId);
  }

  async findCustomRoles(
    projectId: Project['id'],
    currentUser: JwtPayloadType,
  ): Promise<ProjectCustomRole[]> {
    return this.findCustomRoleLibrary(projectId, currentUser);
  }

  async findCustomRoleLibrary(
    projectId: Project['id'],
    currentUser: JwtPayloadType,
  ): Promise<ProjectCustomRole[]> {
    const project = await this.ensureCanViewProjectRoleConfig(
      projectId,
      currentUser,
    );
    await this.ensureDefaultProjectCustomRoles(project.businessLineId);
    return this.projectCustomRoleRepository.findAllByBusinessLineId(
      project.businessLineId,
    );
  }

  async createCustomRole(
    projectId: Project['id'],
    createProjectCustomRoleDto: CreateProjectCustomRoleDto,
    currentUser: JwtPayloadType,
  ): Promise<ProjectCustomRole> {
    const project = await this.ensureCanManageProjectRoleConfig(
      projectId,
      currentUser,
    );

    const payload = await this.buildProjectCustomRolePayload(
      project.businessLineId,
      createProjectCustomRoleDto,
    );

    return this.projectCustomRoleRepository.create({
      businessLineId: project.businessLineId,
      ...payload,
    });
  }

  async updateCustomRole(
    projectId: Project['id'],
    roleId: string,
    updateProjectCustomRoleDto: UpdateProjectCustomRoleDto,
    currentUser: JwtPayloadType,
  ): Promise<ProjectCustomRole> {
    const project = await this.ensureCanManageProjectRoleConfig(
      projectId,
      currentUser,
    );

    const currentRole = await this.getBusinessLineProjectCustomRoleOrThrow(
      project.businessLineId,
      roleId,
    );

    const payload = await this.buildProjectCustomRolePayload(
      project.businessLineId,
      {
        name: updateProjectCustomRoleDto.name ?? currentRole.name,
        description:
          updateProjectCustomRoleDto.description !== undefined
            ? updateProjectCustomRoleDto.description
            : (currentRole.description ?? undefined),
        capabilities:
          updateProjectCustomRoleDto.capabilities ?? currentRole.capabilities,
      },
      currentRole.id,
    );

    const updatedRole = await this.projectCustomRoleRepository.update(
      currentRole.id,
      payload,
    );

    if (!updatedRole) {
      throw new NotFoundException('Project custom role not found');
    }

    return updatedRole;
  }

  async removeCustomRole(
    projectId: Project['id'],
    roleId: string,
    currentUser: JwtPayloadType,
  ): Promise<void> {
    const project = await this.ensureCanManageProjectRoleConfig(
      projectId,
      currentUser,
    );

    const currentRole = await this.getBusinessLineProjectCustomRoleOrThrow(
      project.businessLineId,
      roleId,
    );

    const businessLineProjects =
      await this.projectRepository.findByBusinessLineId(project.businessLineId);
    const memberCount = (
      await Promise.all(
        businessLineProjects.map((item) =>
          this.projectMemberRepository.countByProjectIdAndRoleId(
            item.id,
            currentRole.id,
          ),
        ),
      )
    ).reduce((sum, count) => sum + count, 0);

    if (memberCount > 0) {
      throw new ConflictException('Role is assigned and cannot be deleted');
    }

    await this.projectCustomRoleRepository.remove(currentRole.id);
  }

  async assertCanAccessProject(
    projectId: Project['id'],
    currentUser: JwtPayloadType,
  ): Promise<Project> {
    return this.ensureCanAccessProject(projectId, currentUser);
  }

  async assertCanManageProject(
    projectId: Project['id'],
    currentUser: JwtPayloadType,
  ): Promise<Project> {
    return this.ensureCanManageProject(projectId, currentUser);
  }

  async assertProjectCapability(
    projectId: Project['id'],
    currentUser: JwtPayloadType,
    capability: string,
  ): Promise<Project> {
    return this.accessService.assertProjectCapability(
      currentUser,
      projectId,
      capability,
    );
  }

  private async ensureCanViewProjectRoleConfig(
    projectId: Project['id'],
    currentUser: JwtPayloadType,
  ): Promise<Project> {
    const project = await this.projectRepository.findById(projectId);

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (this.isAdmin(currentUser)) {
      return project;
    }

    if (
      await this.accessService.hasBusinessLineCapability(
        currentUser,
        project.businessLineId,
        'businessLine.member.manage',
      )
    ) {
      return project;
    }

    await this.accessService.assertProjectCapability(
      currentUser,
      projectId,
      'project.read',
    );

    return project;
  }

  private async ensureCanManageProjectRoleConfig(
    projectId: Project['id'],
    currentUser: JwtPayloadType,
  ): Promise<Project> {
    const project = await this.projectRepository.findById(projectId);

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (this.isAdmin(currentUser)) {
      return project;
    }

    const hasBusinessLinePermission =
      await this.accessService.hasBusinessLineCapability(
        currentUser,
        project.businessLineId,
        'businessLine.member.manage',
      );

    if (!hasBusinessLinePermission) {
      throw new ForbiddenException('forbiddenBusinessLineManage');
    }

    return project;
  }

  async ensureProjectRepositoryReady(
    projectId: Project['id'],
    currentUser: JwtPayloadType,
  ): Promise<{ project: Project; repositoryRoot: string }> {
    const project = await this.ensureCanAccessProject(projectId, currentUser);

    try {
      const repositoryRoot = await this.ensureProjectRepository(project);
      return {
        project,
        repositoryRoot,
      };
    } catch (error) {
      throw new BadRequestException(
        this.formatGitSyncFailureMessage(error, project.gitUrl),
      );
    }
  }

  private isAdmin(currentUser: JwtPayloadType): boolean {
    return currentUser.roles?.includes('admin') ?? false;
  }

  private async ensureCanAccessProject(
    projectId: Project['id'],
    currentUser: JwtPayloadType,
  ): Promise<Project> {
    return this.accessService.assertProjectCapability(
      currentUser,
      projectId,
      'project.read',
    );
  }

  private async ensureCanManageProject(
    projectId: Project['id'],
    currentUser: JwtPayloadType,
  ): Promise<Project> {
    return this.accessService.assertProjectCapability(
      currentUser,
      projectId,
      'project.update',
    );
  }

  private async ensureCanManageProjectMembers(
    projectId: Project['id'],
    currentUser: JwtPayloadType,
  ): Promise<{
    project: Project;
    actorProjectMember: ProjectMember | null;
  }> {
    const project = await this.accessService.assertProjectCapability(
      currentUser,
      projectId,
      'project.member.manage',
    );

    if (this.isAdmin(currentUser)) {
      return {
        project,
        actorProjectMember: null,
      };
    }

    const actorProjectMember =
      await this.projectMemberRepository.findByProjectIdAndUserId(
        project.id,
        currentUser.sub,
      );

    return {
      project,
      actorProjectMember,
    };
  }

  private async ensureActorCanManageMemberMutation({
    currentUser,
    businessLineId,
    actorProjectMember,
    targetMember,
    nextRoleId,
  }: {
    currentUser: JwtPayloadType;
    businessLineId: string;
    actorProjectMember: ProjectMember | null;
    targetMember?: ProjectMember;
    nextRoleId?: string;
  }): Promise<void> {
    if (this.isAdmin(currentUser)) {
      return;
    }

    if (!actorProjectMember) {
      throw new ForbiddenException('forbiddenProjectManage');
    }

    if (await this.isProjectOwnerRole(businessLineId, actorProjectMember.roleId)) {
      return;
    }

    if (
      targetMember &&
      (await this.isProjectOwnerRole(businessLineId, targetMember.roleId))
    ) {
      throw new ForbiddenException('forbiddenProjectManage');
    }

    if (nextRoleId && (await this.isProjectOwnerRole(businessLineId, nextRoleId))) {
      throw new ForbiddenException('forbiddenProjectManage');
    }
  }

  private async ensureCanManageBusinessLine(
    businessLineId: string,
    currentUser: JwtPayloadType,
    capability: string,
  ): Promise<void> {
    await this.accessService.assertBusinessLineCapability(
      currentUser,
      businessLineId,
      capability,
    );
  }

  private async ensureCanUpdateProjectItem(
    projectId: Project['id'],
    currentUser: JwtPayloadType,
  ): Promise<Project> {
    const project = await this.getProjectOrThrow(projectId);

    if (this.isAdmin(currentUser)) {
      return project;
    }

    const [canManageByBusinessLine, canManageByProject] = await Promise.all([
      this.accessService.hasBusinessLineCapability(
        currentUser,
        project.businessLineId,
        'businessLine.project.update',
      ),
      this.accessService.hasProjectCapability(
        currentUser,
        project.id,
        'project.update',
      ),
    ]);

    if (!canManageByBusinessLine && !canManageByProject) {
      throw new ForbiddenException('forbiddenProjectManage');
    }

    return project;
  }

  private async ensureCanDeleteProjectItem(
    projectId: Project['id'],
    currentUser: JwtPayloadType,
  ): Promise<Project> {
    const project = await this.getProjectOrThrow(projectId);

    if (this.isAdmin(currentUser)) {
      return project;
    }

    const [canManageByBusinessLine, canManageByProject] = await Promise.all([
      this.accessService.hasBusinessLineCapability(
        currentUser,
        project.businessLineId,
        'businessLine.project.delete',
      ),
      this.accessService.hasProjectCapability(
        currentUser,
        project.id,
        'project.delete',
      ),
    ]);

    if (!canManageByBusinessLine && !canManageByProject) {
      throw new ForbiddenException('forbiddenProjectManage');
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

  private async validateGitRepositoryAccessible(gitUrl: string): Promise<void> {
    const result = await this.runCommand('git', [
      'ls-remote',
      '--heads',
      '--tags',
      gitUrl,
    ]);

    if (result.success) {
      return;
    }

    throw new BadRequestException(
      `Git repository is unreachable or unauthorized: ${this.truncateError(result.stderr)}`,
    );
  }

  private async ensureProjectRepository(project: Project): Promise<string> {
    const repositoryRoot = this.resolveRepositoryRoot(project);
    const gitDirPath = path.join(repositoryRoot, '.git');
    const hasGit = await this.pathExists(gitDirPath);

    if (!hasGit) {
      await fs.mkdir(path.dirname(repositoryRoot), { recursive: true });

      const cloneResult = await this.runCommand('git', [
        'clone',
        '--origin',
        'origin',
        project.gitUrl,
        repositoryRoot,
      ]);

      if (!cloneResult.success) {
        throw new Error(
          cloneResult.stderr || `git clone failed for ${project.gitUrl}`,
        );
      }
    } else {
      const setUrlResult = await this.runCommand('git', [
        '-C',
        repositoryRoot,
        'remote',
        'set-url',
        'origin',
        project.gitUrl,
      ]);

      if (!setUrlResult.success) {
        throw new Error(setUrlResult.stderr || 'git remote set-url failed');
      }
    }

    const fetchResult = await this.runCommand('git', [
      '-C',
      repositoryRoot,
      'fetch',
      '--all',
      '--prune',
    ]);

    if (!fetchResult.success) {
      throw new Error(fetchResult.stderr || 'git fetch failed');
    }

    return repositoryRoot;
  }

  private resolveRepositoryRoot(project: Project): string {
    const config = (project.configJson ?? {}) as Record<string, unknown>;

    if (
      typeof config.repoLocalPath === 'string' &&
      config.repoLocalPath.trim()
    ) {
      return path.resolve(config.repoLocalPath.trim());
    }

    const cacheBaseDir =
      typeof config.repoCacheBaseDir === 'string' &&
      config.repoCacheBaseDir.trim()
        ? config.repoCacheBaseDir.trim()
        : this.configService
            .get<string>('AINATIVE_REPO_CACHE_BASE_DIR', { infer: true })
            ?.trim();

    const repositoryDirName = this.resolveRepositoryDirectoryName(project);

    if (!cacheBaseDir) {
      return path.join(
        this.resolveProjectStorageBaseDir(project),
        repositoryDirName,
      );
    }

    return path.resolve(cacheBaseDir, `${repositoryDirName}-${project.id}`);
  }

  private resolveProjectStorageBaseDir(project: Project): string {
    const businessLineId =
      project.businessLineId?.trim() || 'unknown-business-line';
    const projectId = project.id?.trim() || 'unknown-project';

    return path.resolve(
      this.defaultDataRootDir,
      businessLineId,
      'projects',
      projectId,
    );
  }

  private resolveRepositoryDirectoryName(project: Project): string {
    const parsedFromGitUrl = this.extractRepositoryName(project.gitUrl);
    if (parsedFromGitUrl) {
      return parsedFromGitUrl;
    }

    const projectSegment = this.sanitizeSegment(project.name) || 'project';
    return projectSegment;
  }

  private extractRepositoryName(gitUrl: string): string | null {
    const trimmedUrl = gitUrl.trim();
    if (!trimmedUrl) {
      return null;
    }

    const withoutQuery = trimmedUrl.replace(/[?#].*$/, '').replace(/\/+$/, '');
    const lastSeparatorIndex = Math.max(
      withoutQuery.lastIndexOf('/'),
      withoutQuery.lastIndexOf(':'),
    );
    const rawName =
      lastSeparatorIndex >= 0
        ? withoutQuery.slice(lastSeparatorIndex + 1)
        : withoutQuery;
    const withoutGitSuffix = rawName.replace(/\.git$/i, '');
    const normalized = this.sanitizeSegment(withoutGitSuffix);

    return normalized || null;
  }

  private parseRemoteBranches(stdout: string): string[] {
    const branchNames = stdout
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.split(/\s+/)[1] ?? '')
      .map((ref) => ref.replace(/^refs\/heads\//, ''))
      .filter(Boolean);

    return Array.from(new Set(branchNames));
  }

  private sortBranches(branches: string[]): string[] {
    return [...new Set(branches)].sort((left, right) => {
      const priorityDiff =
        this.resolveBranchPriority(left) - this.resolveBranchPriority(right);

      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      return left.localeCompare(right);
    });
  }

  private resolveBranchPriority(branch: string): number {
    if (branch === 'master') {
      return 0;
    }

    if (branch === 'main') {
      return 1;
    }

    return 2;
  }

  private resolveRecommendedDefaultBranch(branches: string[]): string | null {
    if (branches.includes('master')) {
      return 'master';
    }

    if (branches.includes('main')) {
      return 'main';
    }

    return branches[0] ?? null;
  }

  private sanitizeSegment(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private async rollbackCreatedProject(projectId: string): Promise<void> {
    try {
      await this.projectRepository.remove(projectId);
    } catch {
      // Keep original error from git sync path.
    }
  }

  private formatGitSyncFailureMessage(error: unknown, gitUrl: string): string {
    if (error instanceof BadRequestException) {
      return String(error.message);
    }

    if (error instanceof Error) {
      return `Failed to sync repository for ${gitUrl}: ${this.truncateError(error.message)}`;
    }

    return `Failed to sync repository for ${gitUrl}`;
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

  private async runCommand(
    command: string,
    args: string[],
  ): Promise<{ success: boolean; stdout: string; stderr: string }> {
    return new Promise((resolve) => {
      const childProcess = spawn(command, args, {
        env: process.env,
        stdio: 'pipe',
      });

      let stdout = '';
      let stderr = '';

      childProcess.stdout?.on('data', (chunk) => {
        stdout += chunk.toString('utf-8');
      });

      childProcess.stderr?.on('data', (chunk) => {
        stderr += chunk.toString('utf-8');
      });

      const timeoutRef = setTimeout(() => {
        childProcess.kill('SIGTERM');
      }, this.defaultGitTimeoutMs);

      childProcess.on('error', (error) => {
        clearTimeout(timeoutRef);
        resolve({
          success: false,
          stdout: stdout.trimEnd(),
          stderr: error.message,
        });
      });

      childProcess.on('close', (code) => {
        clearTimeout(timeoutRef);
        resolve({
          success: code === 0,
          stdout: stdout.trimEnd(),
          stderr: stderr.trimEnd(),
        });
      });
    });
  }

  private async pathExists(targetPath: string): Promise<boolean> {
    try {
      await fs.access(targetPath);
      return true;
    } catch {
      return false;
    }
  }

  private async resolveProjectMemberAssignment(
    project: Pick<Project, 'id' | 'businessLineId'>,
    roleId: string,
  ): Promise<{ roleId: string }> {
    const normalizedRoleId = roleId.trim();
    if (!normalizedRoleId) {
      throw new BadRequestException('Project role id is required');
    }

    const role = await this.projectCustomRoleRepository.findById(
      normalizedRoleId,
    );

    if (!role || role.businessLineId !== project.businessLineId) {
      throw new NotFoundException('Project role not found');
    }

    return {
      roleId: role.id,
    };
  }

  private async ensureDefaultProjectCustomRoles(
    businessLineId: Project['businessLineId'],
  ): Promise<ProjectCustomRole[]> {
    const existingRoles =
      await this.projectCustomRoleRepository.findAllByBusinessLineId(
        businessLineId,
      );
    const roleNameSet = new Set(existingRoles.map((role) => role.name));

    for (const template of PROJECT_DEFAULT_ROLE_TEMPLATES) {
      const existedRole = existingRoles.find(
        (role) =>
          hasProjectTemplateCapabilities(role.capabilities, template.role) ||
          isDefaultTemplateRoleName(role.name, template.name),
      );
      if (existedRole) {
        continue;
      }

      const roleName = this.buildAvailableDefaultRoleName(
        template.name,
        roleNameSet,
      );

      const createdRole = await this.projectCustomRoleRepository.create({
        businessLineId,
        name: roleName,
        description: template.description,
        capabilities: template.capabilities,
      });
      existingRoles.push(createdRole);
      roleNameSet.add(roleName);
    }

    return existingRoles;
  }

  private buildAvailableDefaultRoleName(
    preferredName: string,
    occupiedNames: Set<string>,
  ): string {
    if (!occupiedNames.has(preferredName)) {
      return preferredName;
    }

    const baseName = `${preferredName}-default`;
    if (!occupiedNames.has(baseName)) {
      return baseName;
    }

    let suffix = 2;
    while (occupiedNames.has(`${baseName}-${suffix}`)) {
      suffix += 1;
    }

    return `${baseName}-${suffix}`;
  }

  private async findDefaultProjectCustomRole(
    businessLineId: Project['businessLineId'],
    role: ProjectMemberRole,
  ): Promise<ProjectCustomRole> {
    await this.ensureDefaultProjectCustomRoles(businessLineId);

    const template = getProjectDefaultRoleTemplate(role);
    const roles = await this.ensureDefaultProjectCustomRoles(businessLineId);
    const customRole =
      roles.find((item) => hasProjectTemplateCapabilities(item.capabilities, role)) ??
      roles.find((item) => isDefaultTemplateRoleName(item.name, template.name)) ??
      null;

    if (!customRole) {
      throw new NotFoundException('Project default role not found');
    }

    return customRole;
  }


  private async isProjectOwnerRole(
    businessLineId: string,
    roleId: string,
  ): Promise<boolean> {
    const role = await this.projectCustomRoleRepository.findById(roleId);
    return !!role && role.businessLineId === businessLineId && isProjectOwnerCapabilities(role.capabilities);
  }

  private async buildProjectCustomRolePayload(
    businessLineId: Project['businessLineId'],
    input: CreateProjectCustomRoleDto,
    currentRoleId?: string,
  ): Promise<{
    name: string;
    description: string | null;
    capabilities: string[];
  }> {
    const name = input.name.trim();
    if (!name) {
      throw new BadRequestException('Custom role name is required');
    }

    const existedRole = await this.projectCustomRoleRepository.findByName(
      businessLineId,
      name,
    );
    if (existedRole && existedRole.id !== currentRoleId) {
      throw new ConflictException(
        'Custom role name already exists in business line',
      );
    }

    const capabilities = normalizeProjectCapabilities(
      Array.from(
        new Set(
          (input.capabilities ?? [])
            .filter((capability) => typeof capability === 'string')
            .map((capability) => capability.trim())
            .filter(Boolean),
        ),
      ),
    );
    const allowedCapabilities = new Set(ALL_PROJECT_CAPABILITIES);

    const invalidCapability = capabilities.find(
      (capability) => !allowedCapabilities.has(capability),
    );
    if (invalidCapability) {
      throw new BadRequestException(
        `Capability ${invalidCapability} is not supported in project scope`,
      );
    }

    return {
      name,
      description: this.normalizeOptionalText(input.description),
      capabilities,
    };
  }

  private async getBusinessLineProjectCustomRoleOrThrow(
    businessLineId: Project['businessLineId'],
    roleId: string,
  ): Promise<ProjectCustomRole> {
    const customRole =
      await this.projectCustomRoleRepository.findById(roleId);

    if (!customRole || customRole.businessLineId !== businessLineId) {
      throw new NotFoundException('Project role not found');
    }

    return customRole;
  }

  private async attachCustomRoleNamesToProjectMembers(
    members: ProjectMember[],
    businessLineId: string,
  ): Promise<ProjectMember[]> {
    const roles =
      await this.projectCustomRoleRepository.findAllByBusinessLineId(
        businessLineId,
      );
    const roleMap = new Map(roles.map((role) => [role.id, role.name]));

    return members.map((member) => ({
      ...member,
      customRoleName: roleMap.get(member.roleId) ?? null,
    }));
  }

  private async attachCustomRoleNameToProjectMember(
    member: ProjectMember,
    businessLineId: string,
  ): Promise<ProjectMember> {
    const [nextMember] = await this.attachCustomRoleNamesToProjectMembers(
      [member],
      businessLineId,
    );
    return nextMember ?? member;
  }

  private normalizeOptionalText(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  private async ensureOwnerCanBeModified(projectId: string): Promise<void> {
    const members =
      await this.projectMemberRepository.findByProjectId(projectId);

    const project = await this.getProjectOrThrow(projectId);
    const roles = await this.projectCustomRoleRepository.findAllByBusinessLineId(
      project.businessLineId,
    );
    const ownerRoleIdSet = new Set(
      roles
        .filter((role) => isProjectOwnerCapabilities(role.capabilities))
        .map((role) => role.id),
    );
    const ownerCount = members.filter((member) => ownerRoleIdSet.has(member.roleId)).length;

    if (ownerCount <= 1) {
      throw new ConflictException('At least one project owner is required');
    }
  }

  private ensureOwnerSelfProtection(
    targetMember: ProjectMember,
    currentUser: JwtPayloadType,
  ): void {
    if (this.isAdmin(currentUser)) {
      return;
    }

    if (targetMember.userId === currentUser.sub) {
      throw new ConflictException(
        'Project owner cannot remove or downgrade self',
      );
    }
  }
}
