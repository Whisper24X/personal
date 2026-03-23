import { createReadStream } from 'fs';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QueryFailedError } from 'typeorm';
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
import {
  ProjectDocsPreviewQueryDto,
  ProjectDocsTreeQueryDto,
  QueryProjectDocsDto,
  QueryProjectDocsResponseDto,
  SaveProjectDocDto,
} from './dto/project-doc.dto';
import { UsersService } from '../users/users.service';
import { ProjectMemberRole } from './dto/project-member-role.enum';
import { resolveAinativeDataRootDir } from '../utils/workspace-paths';
import { TaskRepository } from '../tasks/infrastructure/persistence/task.repository';
import { AccessService } from '../access/access.service';
import { ProjectCustomRoleRepository } from './infrastructure/persistence/project-custom-role.repository';
import { ProjectCustomRole } from './domain/project-custom-role';
import { CreateProjectCustomRoleDto } from './dto/create-project-custom-role.dto';
import { UpdateProjectCustomRoleDto } from './dto/update-project-custom-role.dto';
import { WorkflowTemplateRepository } from '../workflow-templates/infrastructure/persistence/workflow-template.repository';
import {
  ALL_PROJECT_CAPABILITIES,
  PROJECT_DEFAULT_ROLE_TEMPLATES,
  getProjectDefaultRoleTemplate,
  hasProjectTemplateCapabilities,
  isDefaultTemplateRoleName,
  isProjectOwnerRoleName,
  normalizeProjectCapabilities,
} from '../access/access.constants';

type EnsureProjectRepositoryOptions = {
  syncRemote?: boolean;
};

@Injectable()
export class ProjectsService {
  private readonly defaultGitTimeoutMs = 60_000;
  private readonly maxProjectDocFiles = 500;
  private readonly maxProjectDocDepth = 8;
  private readonly maxQueryContextChars = 24_000;
  private readonly maxQueryDocSnippetChars = 1_600;
  private readonly repositorySyncLocks = new Map<
    string,
    { tail: Promise<void>; pending: number }
  >();
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
    private readonly workflowTemplateRepository: WorkflowTemplateRepository,
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

    let project: Project;

    try {
      project = await this.projectRepository.create({
        businessLineId: createProjectDto.businessLineId,
        name: createProjectDto.name,
        description: createProjectDto.description ?? null,
        gitUrl: createProjectDto.gitUrl,
        defaultBranch: createProjectDto.defaultBranch ?? 'main',
        configJson: createProjectDto.configJson ?? null,
      });
    } catch (error) {
      throw this.mapDatabaseErrorToHttpException(
        error,
        'Failed to create project',
      );
    }

    try {
      await this.ensureProjectRepository(project);
    } catch (error) {
      await this.rollbackCreatedProject(project.id);
      throw new BadRequestException(
        this.formatGitSyncFailureMessage(error, project.gitUrl),
      );
    }

    const userId = currentUser?.sub;
    if (!userId) {
      await this.rollbackCreatedProject(project.id);
      throw new BadRequestException('Invalid user session');
    }

    const existedCreatorMember =
      await this.projectMemberRepository.findByProjectIdAndUserId(
        project.id,
        userId,
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

  private mapDatabaseErrorToHttpException(
    error: unknown,
    context: string,
  ): BadRequestException | ConflictException | InternalServerErrorException {
    if (error instanceof QueryFailedError) {
      const pgError = error as QueryFailedError & { code?: string };
      const code = pgError.code;

      if (code === '23503') {
        return new BadRequestException(
          `${context}: Referenced record not found (e.g. business line or user does not exist)`,
        );
      }

      if (code === '23505') {
        return new ConflictException(
          `${context}: Duplicate entry (e.g. project name already exists)`,
        );
      }
    }

    const message =
      error instanceof Error ? error.message : 'Unknown database error';
    return new InternalServerErrorException(
      `${context}: ${this.truncateError(message)}`,
    );
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

      await this.workflowTemplateRepository.bulkUpdateBusinessLineIdByProjectId(
        {
          projectId: updatedProject.id,
          businessLineId: updatedProject.businessLineId,
        },
      );
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
    const { project } = await this.ensureCanManageProjectMembers(
      projectId,
      currentUser,
    );

    const members =
      await this.projectMemberRepository.findByProjectId(projectId);

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
      await this.accessService.hasBusinessLineCapabilityAny(
        currentUser,
        project.businessLineId,
        [
          'businessLine.projectRole.read',
          'businessLine.projectRole.create',
          'businessLine.projectRole.update',
          'businessLine.projectRole.delete',
        ],
      )
    ) {
      return project;
    }

    await this.accessService.assertProjectCapability(
      currentUser,
      projectId,
      'project.dashboard.read',
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
      await this.accessService.hasBusinessLineCapabilityAny(
        currentUser,
        project.businessLineId,
        [
          'businessLine.projectRole.create',
          'businessLine.projectRole.update',
          'businessLine.projectRole.delete',
        ],
      );

    if (!hasBusinessLinePermission) {
      throw new ForbiddenException('forbiddenBusinessLineManage');
    }

    return project;
  }

  async ensureProjectRepositoryReady(
    projectId: Project['id'],
    currentUser: JwtPayloadType,
    options: EnsureProjectRepositoryOptions = {},
  ): Promise<{ project: Project; repositoryRoot: string }> {
    const project = await this.ensureCanAccessProject(projectId, currentUser);

    try {
      const repositoryRoot = await this.ensureProjectRepository(
        project,
        options,
      );
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

  private readonly maxTextPreviewBytes = 256 * 1024;
  private readonly maxImagePreviewBytes = 4 * 1024 * 1024;

  async docsTree(
    projectId: Project['id'],
    query: ProjectDocsTreeQueryDto,
    currentUser: JwtPayloadType,
  ): Promise<{
    cwd: string;
    entries: Array<{ name: string; path: string; isDir: boolean }>;
  }> {
    const { repositoryRoot } = await this.ensureProjectRepositoryReady(
      projectId,
      currentUser,
      { syncRemote: false },
    );
    const docsRoot = path.resolve(path.join(repositoryRoot, 'docs'));
    await fs.mkdir(docsRoot, { recursive: true });

    const targetPath = this.resolveDocsBrowsePath(docsRoot, query.path);

    const stat = await fs.stat(targetPath).catch(() => null);
    if (!stat || !stat.isDirectory()) {
      throw new NotFoundException('Docs path not found or not a directory');
    }

    const dirEntries = await fs.readdir(targetPath, { withFileTypes: true });

    const entries = dirEntries
      .filter((entry) => entry.isDirectory() || entry.isFile())
      .map((entry) => {
        const absoluteEntryPath = path.join(targetPath, entry.name);
        return {
          name: entry.name,
          path: path
            .relative(docsRoot, absoluteEntryPath)
            .split(path.sep)
            .join('/'),
          isDir: entry.isDirectory(),
        };
      })
      .sort((left, right) => {
        if (left.isDir && !right.isDir) return -1;
        if (!left.isDir && right.isDir) return 1;
        return left.name.localeCompare(right.name, undefined, {
          numeric: true,
          sensitivity: 'base',
        });
      });

    const cwd = path.relative(docsRoot, targetPath);
    return { cwd: cwd || '.', entries };
  }

  async docsFileStream(
    projectId: Project['id'],
    query: ProjectDocsPreviewQueryDto,
    currentUser: JwtPayloadType,
  ) {
    const { repositoryRoot } = await this.ensureProjectRepositoryReady(
      projectId,
      currentUser,
      { syncRemote: false },
    );
    const docsRoot = path.resolve(path.join(repositoryRoot, 'docs'));
    const relativePath = this.normalizeProjectDocPath(query.path);
    const absolutePath = this.resolveProjectDocAbsolutePath(
      docsRoot,
      relativePath,
    );

    const stat = await fs.stat(absolutePath).catch(() => null);
    if (!stat || !stat.isFile()) {
      throw new NotFoundException('Doc file not found');
    }

    const mimeType = this.resolveDocMimeType(absolutePath);
    const stream = createReadStream(absolutePath);

    return {
      stream,
      mimeType,
      size: stat.size,
    };
  }

  async docsPreview(
    projectId: Project['id'],
    query: ProjectDocsPreviewQueryDto,
    currentUser: JwtPayloadType,
  ): Promise<{
    path: string;
    previewType: 'text' | 'image' | 'binary' | 'pdf' | 'video' | 'audio';
    tooLarge: boolean;
    size: number;
    mimeType?: string | null;
    text?: string | null;
    dataUrl?: string | null;
  }> {
    const { repositoryRoot } = await this.ensureProjectRepositoryReady(
      projectId,
      currentUser,
      { syncRemote: false },
    );
    const docsRoot = path.resolve(path.join(repositoryRoot, 'docs'));
    const relativePath = this.normalizeProjectDocPath(query.path);
    const absolutePath = this.resolveProjectDocAbsolutePath(
      docsRoot,
      relativePath,
    );

    const stat = await fs.stat(absolutePath).catch(() => null);
    if (!stat || !stat.isFile()) {
      throw new NotFoundException('Docs file not found');
    }

    const mimeType = this.resolveDocMimeType(absolutePath);

    if (mimeType === 'application/pdf') {
      return {
        path: relativePath,
        previewType: 'pdf',
        tooLarge: false,
        size: stat.size,
        mimeType,
      };
    }

    if (mimeType.startsWith('video/')) {
      return {
        path: relativePath,
        previewType: 'video',
        tooLarge: false,
        size: stat.size,
        mimeType,
      };
    }

    if (mimeType.startsWith('audio/')) {
      return {
        path: relativePath,
        previewType: 'audio',
        tooLarge: false,
        size: stat.size,
        mimeType,
      };
    }

    if (mimeType.startsWith('image/')) {
      if (stat.size > this.maxImagePreviewBytes) {
        return {
          path: relativePath,
          previewType: 'image',
          tooLarge: true,
          size: stat.size,
          mimeType,
          dataUrl: null,
        };
      }
      const fileBuffer = await fs.readFile(absolutePath);
      return {
        path: relativePath,
        previewType: 'image',
        tooLarge: false,
        size: stat.size,
        mimeType,
        dataUrl: `data:${mimeType};base64,${fileBuffer.toString('base64')}`,
      };
    }

    if (stat.size > this.maxTextPreviewBytes) {
      return {
        path: relativePath,
        previewType: this.isDocTextLikeMime(mimeType) ? 'text' : 'binary',
        tooLarge: true,
        size: stat.size,
        mimeType,
      };
    }

    const fileBuffer = await fs.readFile(absolutePath);
    const isText =
      this.isDocTextLikeMime(mimeType) || this.isDocTextBuffer(fileBuffer);

    if (!isText) {
      return {
        path: relativePath,
        previewType: 'binary',
        tooLarge: false,
        size: stat.size,
        mimeType,
      };
    }

    return {
      path: relativePath,
      previewType: 'text',
      tooLarge: false,
      size: stat.size,
      mimeType,
      text: fileBuffer.toString('utf-8'),
    };
  }

  async listDocs(
    projectId: Project['id'],
    currentUser: JwtPayloadType,
  ): Promise<
    Array<{ path: string; name: string; size: number; updatedAt: Date }>
  > {
    const { repositoryRoot } = await this.ensureProjectRepositoryReady(
      projectId,
      currentUser,
      { syncRemote: false },
    );
    const docsRoot = path.join(repositoryRoot, 'docs');
    const docsRootExists = await this.pathExists(docsRoot);
    if (!docsRootExists) {
      return [];
    }

    const results: Array<{
      path: string;
      name: string;
      size: number;
      updatedAt: Date;
    }> = [];

    const walk = async (dir: string, depth: number): Promise<void> => {
      if (
        depth > this.maxProjectDocDepth ||
        results.length >= this.maxProjectDocFiles
      ) {
        return;
      }

      let entries: Array<{
        name: string;
        isDirectory: () => boolean;
        isFile: () => boolean;
      }>;
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }

      entries.sort((left, right) => left.name.localeCompare(right.name));

      for (const entry of entries) {
        if (results.length >= this.maxProjectDocFiles) {
          return;
        }

        const absolutePath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(absolutePath, depth + 1);
          continue;
        }

        if (!entry.isFile()) {
          continue;
        }

        const stat = await fs.stat(absolutePath).catch(() => null);
        if (!stat?.isFile()) {
          continue;
        }

        const relativePath = path
          .relative(docsRoot, absolutePath)
          .split(path.sep)
          .join('/');
        if (
          !relativePath ||
          relativePath.startsWith('..') ||
          path.isAbsolute(relativePath)
        ) {
          continue;
        }

        results.push({
          path: relativePath,
          name: path.basename(absolutePath),
          size: stat.size,
          updatedAt: stat.mtime,
        });
      }
    };

    await walk(docsRoot, 0);
    return results.sort((left, right) => left.path.localeCompare(right.path));
  }

  async readDoc(
    projectId: Project['id'],
    rawDocPath: string,
    currentUser: JwtPayloadType,
  ): Promise<{
    path: string;
    name: string;
    size: number;
    updatedAt: Date;
    content: string;
  }> {
    const { repositoryRoot } = await this.ensureProjectRepositoryReady(
      projectId,
      currentUser,
      { syncRemote: false },
    );
    const docsRoot = path.join(repositoryRoot, 'docs');
    const relativePath = this.normalizeProjectDocPath(rawDocPath);
    const absolutePath = this.resolveProjectDocAbsolutePath(
      docsRoot,
      relativePath,
    );
    const stat = await fs.stat(absolutePath).catch(() => null);

    if (!stat || !stat.isFile()) {
      throw new NotFoundException('Project doc not found');
    }

    const content = await fs.readFile(absolutePath, 'utf-8');

    return {
      path: relativePath,
      name: path.basename(absolutePath),
      size: stat.size,
      updatedAt: stat.mtime,
      content,
    };
  }

  async createDoc(
    projectId: Project['id'],
    payload: SaveProjectDocDto,
    currentUser: JwtPayloadType,
  ): Promise<{
    path: string;
    name: string;
    size: number;
    updatedAt: Date;
    content: string;
  }> {
    const { repositoryRoot } = await this.ensureProjectRepositoryReady(
      projectId,
      currentUser,
      { syncRemote: false },
    );
    const docsRoot = path.join(repositoryRoot, 'docs');
    const relativePath = this.normalizeProjectDocPath(payload.path);
    const absolutePath = this.resolveProjectDocAbsolutePath(
      docsRoot,
      relativePath,
    );

    const existed = await this.pathExists(absolutePath);
    if (existed) {
      throw new ConflictException('Project doc already exists');
    }

    const parentDir = path.dirname(absolutePath);
    const parentStat = await fs.stat(parentDir).catch(() => null);
    if (parentStat?.isFile()) {
      const parentRelative = path
        .relative(docsRoot, parentDir)
        .replace(/\\/g, '/');
      throw new ConflictException(
        `路径「${parentRelative}」已存在为文件，无法在其下创建子文件。请删除该文件或选择其他路径。`,
      );
    }

    await fs.mkdir(parentDir, { recursive: true });

    if (payload.contentBase64 != null && payload.contentBase64 !== '') {
      const buf = Buffer.from(payload.contentBase64, 'base64');
      await fs.writeFile(absolutePath, buf);
    } else {
      await fs.writeFile(absolutePath, payload.content ?? '', 'utf-8');
    }

    return this.readDoc(projectId, relativePath, currentUser);
  }

  async updateDoc(
    projectId: Project['id'],
    payload: SaveProjectDocDto,
    currentUser: JwtPayloadType,
  ): Promise<{
    path: string;
    name: string;
    size: number;
    updatedAt: Date;
    content: string;
  }> {
    const { repositoryRoot } = await this.ensureProjectRepositoryReady(
      projectId,
      currentUser,
      { syncRemote: false },
    );
    const docsRoot = path.join(repositoryRoot, 'docs');
    const relativePath = this.normalizeProjectDocPath(payload.path);
    const absolutePath = this.resolveProjectDocAbsolutePath(
      docsRoot,
      relativePath,
    );
    const stat = await fs.stat(absolutePath).catch(() => null);
    if (!stat || !stat.isFile()) {
      throw new NotFoundException('Project doc not found');
    }

    if (payload.contentBase64 != null && payload.contentBase64 !== '') {
      const buf = Buffer.from(payload.contentBase64, 'base64');
      await fs.writeFile(absolutePath, buf);
    } else {
      await fs.writeFile(absolutePath, payload.content ?? '', 'utf-8');
    }
    return this.readDoc(projectId, relativePath, currentUser);
  }

  async removeDoc(
    projectId: Project['id'],
    rawDocPath: string,
    currentUser: JwtPayloadType,
  ): Promise<void> {
    const { repositoryRoot } = await this.ensureProjectRepositoryReady(
      projectId,
      currentUser,
      { syncRemote: false },
    );
    const docsRoot = path.join(repositoryRoot, 'docs');
    const relativePath = this.normalizeProjectDocPath(rawDocPath);
    const absolutePath = this.resolveProjectDocAbsolutePath(
      docsRoot,
      relativePath,
    );
    const stat = await fs.stat(absolutePath).catch(() => null);
    if (!stat || !stat.isFile()) {
      throw new NotFoundException('Project doc not found');
    }

    await fs.unlink(absolutePath);
  }

  async queryDocs(
    projectId: Project['id'],
    payload: QueryProjectDocsDto,
    currentUser: JwtPayloadType,
  ): Promise<QueryProjectDocsResponseDto> {
    const startAt = Date.now();
    const { project, repositoryRoot } = await this.ensureProjectRepositoryReady(
      projectId,
      currentUser,
      { syncRemote: false },
    );
    const docsRoot = path.join(repositoryRoot, 'docs');
    const docsRootExists = await this.pathExists(docsRoot);

    if (!docsRootExists) {
      return {
        answer:
          '当前项目还没有 docs 文档，无法执行知识问答。请先上传或创建文档。',
        citations: [],
        durationMs: Date.now() - startAt,
      };
    }

    const normalizedQuestion = payload.question.trim();
    const maxContextDocs = Math.max(
      1,
      Math.min(payload.maxContextDocs ?? 6, 20),
    );
    const candidateDocs = await this.selectCandidateDocs({
      projectId,
      docsRoot,
      question: normalizedQuestion,
      maxContextDocs,
      scope: payload.scope ?? 'project',
      currentPath: payload.currentPath,
      currentUser,
    });

    if (!candidateDocs.length) {
      return {
        answer: '没有检索到相关文档内容。建议换个问法，或补充更明确的关键词。',
        citations: [],
        durationMs: Date.now() - startAt,
      };
    }

    const citations = candidateDocs.map((doc) => ({
      path: doc.path,
      snippet: this.buildCitationSnippet(doc.content),
    }));

    const prompt = this.buildKnowledgeQueryPrompt({
      question: normalizedQuestion,
      docs: candidateDocs,
    });

    const agentResult = await this.executeKnowledgeAgent({
      project,
      repositoryRoot,
      prompt,
      onChunk: undefined,
    });

    const answer =
      agentResult.success && agentResult.stdout.trim()
        ? agentResult.stdout.trim()
        : this.buildFallbackAnswer(citations, agentResult.stderr);

    return {
      answer,
      citations,
      durationMs: Date.now() - startAt,
      traceId: `docs-query-${projectId}-${Date.now()}`,
    };
  }

  async streamDocsQuery(
    projectId: Project['id'],
    payload: QueryProjectDocsDto,
    currentUser: JwtPayloadType,
    emit: (event: string, data: unknown) => void,
  ): Promise<void> {
    const startAt = Date.now();
    const { project, repositoryRoot } = await this.ensureProjectRepositoryReady(
      projectId,
      currentUser,
      { syncRemote: false },
    );
    const docsRoot = path.join(repositoryRoot, 'docs');
    const docsRootExists = await this.pathExists(docsRoot);

    if (!docsRootExists) {
      emit('error', {
        message: '当前项目还没有 docs 文档，无法执行知识问答。',
      });
      emit('done', {
        durationMs: Date.now() - startAt,
      });
      return;
    }

    const normalizedQuestion = payload.question.trim();
    const maxContextDocs = Math.max(
      1,
      Math.min(payload.maxContextDocs ?? 6, 20),
    );
    const candidateDocs = await this.selectCandidateDocs({
      projectId,
      docsRoot,
      question: normalizedQuestion,
      maxContextDocs,
      scope: payload.scope ?? 'project',
      currentPath: payload.currentPath,
      currentUser,
    });

    if (!candidateDocs.length) {
      emit('error', {
        message: '没有检索到相关文档内容。建议换个问法，或补充更明确的关键词。',
      });
      emit('done', {
        durationMs: Date.now() - startAt,
      });
      return;
    }

    const citations = candidateDocs.map((doc) => ({
      path: doc.path,
      snippet: this.buildCitationSnippet(doc.content),
    }));

    const prompt = this.buildKnowledgeQueryPrompt({
      question: normalizedQuestion,
      docs: candidateDocs,
    });

    const agentResult = await this.executeKnowledgeAgent({
      project,
      repositoryRoot,
      prompt,
      onChunk: (chunk) => {
        if (!chunk.trim()) {
          return;
        }
        emit('chunk', { delta: chunk });
      },
    });

    if (!agentResult.success && !agentResult.stdout.trim()) {
      emit('chunk', {
        delta: this.buildFallbackAnswer(citations, agentResult.stderr),
      });
    }

    emit('citations', { citations });
    emit('done', {
      durationMs: Date.now() - startAt,
      traceId: `docs-query-${projectId}-${Date.now()}`,
    });
  }

  private isAdmin(currentUser: JwtPayloadType): boolean {
    return currentUser.roles?.includes('admin') ?? false;
  }

  private async selectCandidateDocs({
    projectId,
    docsRoot,
    question,
    maxContextDocs,
    scope,
    currentPath,
    currentUser,
  }: {
    projectId: string;
    docsRoot: string;
    question: string;
    maxContextDocs: number;
    scope: 'project' | 'current_doc';
    currentPath?: string;
    currentUser: JwtPayloadType;
  }): Promise<Array<{ path: string; content: string }>> {
    const docs = await this.listDocs(projectId, currentUser);
    if (!docs.length) {
      return [];
    }

    const normalizedCurrentPath = currentPath
      ? this.normalizeProjectDocPath(currentPath)
      : null;
    const tokens = this.extractQueryTokens(question);

    const scored = docs.map((doc) => {
      let score = 0;
      const lowerPath = doc.path.toLowerCase();

      for (const token of tokens) {
        if (lowerPath.includes(token)) {
          score += 3;
        }
      }

      if (normalizedCurrentPath && doc.path === normalizedCurrentPath) {
        score += 100;
      }

      return { doc, score };
    });

    scored.sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.doc.path.localeCompare(right.doc.path);
    });

    const picked = scored
      .filter((item, index) => {
        if (scope === 'current_doc' && normalizedCurrentPath) {
          if (item.doc.path === normalizedCurrentPath) {
            return true;
          }

          return index < Math.max(2, Math.floor(maxContextDocs / 2));
        }

        return true;
      })
      .slice(0, maxContextDocs)
      .map((item) => item.doc);

    const contexts: Array<{ path: string; content: string }> = [];
    let totalChars = 0;

    for (const doc of picked) {
      const absolutePath = this.resolveProjectDocAbsolutePath(
        docsRoot,
        doc.path,
      );
      const rawContent = await fs
        .readFile(absolutePath, 'utf-8')
        .catch(() => '');
      if (!rawContent.trim()) {
        continue;
      }

      const clipped = rawContent.slice(0, this.maxQueryDocSnippetChars);
      if (totalChars + clipped.length > this.maxQueryContextChars) {
        break;
      }

      contexts.push({
        path: doc.path,
        content: clipped,
      });
      totalChars += clipped.length;
    }

    return contexts;
  }

  private extractQueryTokens(question: string): string[] {
    const rawTokens = question
      .toLowerCase()
      .split(/[\s,，。！？!?:：;；、/\\|()[\]{}"'`]+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 2);

    return Array.from(new Set(rawTokens)).slice(0, 12);
  }

  private buildCitationSnippet(content: string): string {
    const normalized = content.replace(/\s+/g, ' ').trim();
    if (!normalized) {
      return '';
    }

    if (normalized.length <= 220) {
      return normalized;
    }

    return `${normalized.slice(0, 220)}...`;
  }

  private buildKnowledgeQueryPrompt({
    question,
    docs,
  }: {
    question: string;
    docs: Array<{ path: string; content: string }>;
  }): string {
    const contextBlocks = docs.map((doc, index) => {
      return [
        `## Document ${index + 1}`,
        `Path: ${doc.path}`,
        'Content:',
        doc.content,
      ].join('\n');
    });

    return [
      'You are an assistant for project docs Q&A.',
      'Use ONLY the provided document content to answer.',
      'If the answer is not in the docs, explicitly say you do not know.',
      'Keep the answer concise and in Chinese.',
      'At the end, include a short "References" section listing used paths.',
      '',
      `Question: ${question}`,
      '',
      'Context documents:',
      ...contextBlocks,
    ].join('\n');
  }

  private async executeKnowledgeAgent({
    project,
    repositoryRoot,
    prompt,
    onChunk,
  }: {
    project: Project;
    repositoryRoot: string;
    prompt: string;
    onChunk?: (chunk: string) => void;
  }): Promise<{ success: boolean; stdout: string; stderr: string }> {
    const projectConfig =
      project.configJson && typeof project.configJson === 'object'
        ? (project.configJson as Record<string, unknown>)
        : {};
    const adapter =
      typeof projectConfig.agentAdapter === 'string'
        ? projectConfig.agentAdapter.trim().toLowerCase()
        : 'codex';

    const command =
      typeof process.env.AINATIVE_CODEX_RUNNER_COMMAND === 'string' &&
      process.env.AINATIVE_CODEX_RUNNER_COMMAND.trim()
        ? process.env.AINATIVE_CODEX_RUNNER_COMMAND.trim()
        : adapter === 'cursor'
          ? 'agent'
          : 'codex';
    const args =
      adapter === 'cursor'
        ? ['-p', '--trust', '--force', prompt]
        : ['exec', '--skip-git-repo-check', '-'];

    return new Promise((resolve) => {
      const child = spawn(command, args, {
        cwd: repositoryRoot,
        env: process.env,
        stdio: 'pipe',
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (chunk) => {
        const text = chunk.toString('utf-8');
        stdout += text;
        onChunk?.(text);
      });
      child.stderr?.on('data', (chunk) => {
        stderr += chunk.toString('utf-8');
      });

      child.on('error', (error) => {
        resolve({
          success: false,
          stdout: '',
          stderr: error.message,
        });
      });

      if (adapter !== 'cursor') {
        child.stdin?.write(prompt);
        child.stdin?.end();
      }

      child.on('close', (code) => {
        resolve({
          success: code === 0,
          stdout: stdout.trim(),
          stderr: stderr.trim() || `Agent exit code ${code ?? 'null'}`,
        });
      });
    });
  }

  private buildFallbackAnswer(
    citations: Array<{ path: string; snippet: string }>,
    errorMessage: string,
  ): string {
    const lines = [
      '当前未能成功调用 Agent 生成答案，已返回候选文档摘要供参考。',
      `原因：${errorMessage || '未知错误'}`,
      '',
      '你可以根据以下内容手动判断，或重试提问：',
      ...citations.slice(0, 4).map((item) => `- ${item.path}: ${item.snippet}`),
    ];

    return lines.join('\n');
  }

  private async ensureCanAccessProject(
    projectId: Project['id'],
    currentUser: JwtPayloadType,
  ): Promise<Project> {
    return this.accessService.assertProjectCapability(
      currentUser,
      projectId,
      'project.dashboard.read',
    );
  }

  private async ensureCanManageProject(
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

  private async ensureCanManageProjectMembers(
    projectId: Project['id'],
    currentUser: JwtPayloadType,
  ): Promise<{
    project: Project;
    actorProjectMember: ProjectMember | null;
  }> {
    const project = await this.ensureCanAccessProject(projectId, currentUser);

    if (this.isAdmin(currentUser)) {
      return {
        project,
        actorProjectMember: null,
      };
    }

    await this.accessService.assertBusinessLineCapability(
      currentUser,
      project.businessLineId,
      'businessLine.member.updateRole',
    );

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

    if (
      await this.isProjectOwnerRole(businessLineId, actorProjectMember.roleId)
    ) {
      return;
    }

    if (
      targetMember &&
      (await this.isProjectOwnerRole(businessLineId, targetMember.roleId))
    ) {
      throw new ForbiddenException('forbiddenProjectManage');
    }

    if (
      nextRoleId &&
      (await this.isProjectOwnerRole(businessLineId, nextRoleId))
    ) {
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

    await this.accessService.assertBusinessLineCapability(
      currentUser,
      project.businessLineId,
      'businessLine.project.update',
    );

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

    await this.accessService.assertBusinessLineCapability(
      currentUser,
      project.businessLineId,
      'businessLine.project.delete',
    );

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

  private async ensureProjectRepository(
    project: Project,
    options: EnsureProjectRepositoryOptions = {},
  ): Promise<string> {
    const repositoryRoot = this.resolveRepositoryRoot(project);
    const defaultBranch = project.defaultBranch?.trim() || 'main';
    return this.withRepositorySyncLock(repositoryRoot, async () => {
      const gitDirPath = path.join(repositoryRoot, '.git');
      const hasGit = await this.pathExists(gitDirPath);
      const shouldSyncRemote = options.syncRemote ?? true;

      if (!hasGit) {
        try {
          await fs.mkdir(path.dirname(repositoryRoot), { recursive: true });
        } catch (mkdirError) {
          const msg =
            mkdirError instanceof Error ? mkdirError.message : 'Unknown error';
          throw new Error(
            `Cannot create project repository directory: ${this.truncateError(msg)}`,
          );
        }

        const cloneResult = await this.runCommand('git', [
          'clone',
          '--origin',
          'origin',
          '--branch',
          defaultBranch,
          project.gitUrl,
          repositoryRoot,
        ]);

        if (!cloneResult.success) {
          throw new Error(
            cloneResult.stderr || `git clone failed for ${project.gitUrl}`,
          );
        }
      } else if (shouldSyncRemote) {
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

      if (shouldSyncRemote) {
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
      }

      return repositoryRoot;
    });
  }

  private async withRepositorySyncLock<T>(
    repositoryRoot: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    let state = this.repositorySyncLocks.get(repositoryRoot);

    if (!state) {
      state = {
        tail: Promise.resolve(),
        pending: 0,
      };
      this.repositorySyncLocks.set(repositoryRoot, state);
    }

    const previous = state.tail;
    state.pending += 1;

    let releaseCurrent!: () => void;
    state.tail = new Promise<void>((resolve) => {
      releaseCurrent = resolve;
    });

    await previous.catch(() => undefined);

    try {
      return await operation();
    } finally {
      releaseCurrent();
      state.pending -= 1;
      if (state.pending === 0) {
        this.repositorySyncLocks.delete(repositoryRoot);
      }
    }
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

  private normalizeProjectDocPath(value: string): string {
    const raw = value?.trim();
    if (!raw) {
      throw new BadRequestException('Project doc path is required');
    }

    if (path.isAbsolute(raw)) {
      throw new BadRequestException('Absolute path is not allowed');
    }

    const normalized = path
      .normalize(raw.replace(/\\/g, '/'))
      .replace(/^\.(?:[\\/]|$)/, '')
      .replace(/[\\/]+$/, '');

    if (!normalized || normalized === '.') {
      throw new BadRequestException('Project doc path is required');
    }

    const pathSegments = normalized.split(path.sep);
    if (pathSegments.some((segment) => segment === '..')) {
      throw new BadRequestException('Project doc path cannot escape docs root');
    }

    return pathSegments.join('/');
  }

  private resolveProjectDocAbsolutePath(
    docsRoot: string,
    relativePath: string,
  ): string {
    const resolvedDocsRoot = path.resolve(docsRoot);
    const absolutePath = path.resolve(resolvedDocsRoot, relativePath);
    const relative = path.relative(resolvedDocsRoot, absolutePath);

    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new BadRequestException('Project doc path cannot escape docs root');
    }

    return absolutePath;
  }

  private resolveDocsBrowsePath(
    docsRoot: string,
    relativePath?: string,
  ): string {
    const raw = relativePath?.trim();
    if (!raw || raw === '.') {
      return docsRoot;
    }

    if (path.isAbsolute(raw)) {
      throw new BadRequestException('Absolute path is not allowed');
    }

    const normalized = path
      .normalize(raw.replace(/\\/g, '/'))
      .replace(/[\\/]+$/, '');

    if (normalized.split(path.sep).some((segment) => segment === '..')) {
      throw new BadRequestException('Docs path cannot escape docs root');
    }

    const absolutePath = path.resolve(docsRoot, normalized);
    const relative = path.relative(docsRoot, absolutePath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new BadRequestException('Docs path cannot escape docs root');
    }

    return absolutePath;
  }

  private resolveDocMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.mdx': 'text/markdown',
      '.markdown': 'text/markdown',
      '.json': 'application/json',
      '.yml': 'text/yaml',
      '.yaml': 'text/yaml',
      '.ts': 'text/typescript',
      '.tsx': 'text/typescript',
      '.js': 'text/javascript',
      '.jsx': 'text/javascript',
      '.vue': 'text/plain',
      '.css': 'text/css',
      '.scss': 'text/x-scss',
      '.html': 'text/html',
      '.xml': 'application/xml',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.bmp': 'image/bmp',
      '.ico': 'image/x-icon',
      '.pdf': 'application/pdf',
      '.zip': 'application/zip',
      '.tar': 'application/x-tar',
      '.gz': 'application/gzip',
    };
    return mimeMap[ext] ?? 'application/octet-stream';
  }

  private isDocTextLikeMime(mimeType: string): boolean {
    return (
      mimeType.startsWith('text/') ||
      mimeType === 'application/json' ||
      mimeType === 'application/xml'
    );
  }

  private isDocTextBuffer(value: Buffer): boolean {
    const inspectLength = Math.min(value.length, 8_192);
    for (let index = 0; index < inspectLength; index += 1) {
      if (value[index] === 0) return false;
    }
    return true;
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

    const role =
      await this.projectCustomRoleRepository.findById(normalizedRoleId);

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
      const existedRole = existingRoles.find((role) =>
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
      roles.find((item) =>
        hasProjectTemplateCapabilities(item.capabilities, role),
      ) ??
      roles.find((item) =>
        isDefaultTemplateRoleName(item.name, template.name),
      ) ??
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
    return (
      !!role &&
      role.businessLineId === businessLineId &&
      isProjectOwnerRoleName(role.name)
    );
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
    const customRole = await this.projectCustomRoleRepository.findById(roleId);

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
    const roles =
      await this.projectCustomRoleRepository.findAllByBusinessLineId(
        project.businessLineId,
      );
    const ownerRoleIdSet = new Set(
      roles
        .filter((role) => isProjectOwnerRoleName(role.name))
        .map((role) => role.id),
    );
    const ownerCount = members.filter((member) =>
      ownerRoleIdSet.has(member.roleId),
    ).length;

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
