import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectRepository } from './infrastructure/persistence/project.repository';
import { ProjectMemberRepository } from './infrastructure/persistence/project-member.repository';
import { Project } from './domain/project';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { BusinessLineRepository } from '../business-lines/infrastructure/persistence/business-line.repository';
import { BusinessLineMemberRepository } from '../business-lines/infrastructure/persistence/business-line-member.repository';
import { BusinessLineMemberRole } from '../business-lines/dto/business-line-member-role.enum';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { FindAllProjectsDto } from './dto/find-all-projects.dto';
import { ProjectMember } from './domain/project-member';
import { CreateProjectMemberDto } from './dto/create-project-member.dto';
import { UpdateProjectMemberDto } from './dto/update-project-member.dto';
import { UsersService } from '../users/users.service';
import { ProjectMemberRole } from './dto/project-member-role.enum';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly projectMemberRepository: ProjectMemberRepository,
    private readonly businessLineRepository: BusinessLineRepository,
    private readonly businessLineMemberRepository: BusinessLineMemberRepository,
    private readonly usersService: UsersService,
  ) {}

  async create(
    createProjectDto: CreateProjectDto,
    currentUser: JwtPayloadType,
  ): Promise<Project> {
    await this.ensureCanManageBusinessLine(
      createProjectDto.businessLineId,
      currentUser,
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

    const project = await this.projectRepository.create({
      businessLineId: createProjectDto.businessLineId,
      name: createProjectDto.name,
      description: createProjectDto.description ?? null,
      gitUrl: createProjectDto.gitUrl,
      defaultBranch: createProjectDto.defaultBranch ?? 'main',
      configJson: createProjectDto.configJson ?? null,
    });

    const existedCreatorMember =
      await this.projectMemberRepository.findByProjectIdAndUserId(
        project.id,
        currentUser.sub,
      );

    if (!existedCreatorMember) {
      await this.projectMemberRepository.create({
        projectId: project.id,
        userId: currentUser.sub,
        role: ProjectMemberRole.owner,
      });
    }

    return project;
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

    const manageableBusinessLineIds = businessLineMemberships
      .filter(
        (membership) =>
          membership.role === BusinessLineMemberRole.owner ||
          membership.role === BusinessLineMemberRole.admin,
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
    const currentProject = await this.ensureCanManageProject(id, currentUser);

    const nextBusinessLineId =
      updateProjectDto.businessLineId ?? currentProject.businessLineId;

    if (updateProjectDto.businessLineId) {
      await this.ensureCanManageBusinessLine(
        updateProjectDto.businessLineId,
        currentUser,
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

    return updatedProject;
  }

  async remove(id: Project['id'], currentUser: JwtPayloadType): Promise<void> {
    await this.ensureCanManageProject(id, currentUser);
    await this.projectRepository.remove(id);
  }

  async findMembers(
    projectId: Project['id'],
    currentUser: JwtPayloadType,
  ): Promise<ProjectMember[]> {
    await this.ensureCanAccessProject(projectId, currentUser);

    return this.projectMemberRepository.findByProjectId(projectId);
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

    this.ensureActorCanManageMemberMutation({
      currentUser,
      actorProjectMember: manageContext.actorProjectMember,
      byBusinessLinePermission: manageContext.byBusinessLinePermission,
      nextRole: createProjectMemberDto.role,
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

    if (!user.isAdmin) {
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
    }

    return this.projectMemberRepository.create({
      projectId,
      userId: createProjectMemberDto.userId,
      role: createProjectMemberDto.role,
    });
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

    this.ensureActorCanManageMemberMutation({
      currentUser,
      actorProjectMember: manageContext.actorProjectMember,
      byBusinessLinePermission: manageContext.byBusinessLinePermission,
      targetMember,
      nextRole: updateProjectMemberDto.role,
    });

    if (
      targetMember.role === ProjectMemberRole.owner &&
      updateProjectMemberDto.role !== ProjectMemberRole.owner
    ) {
      this.ensureOwnerSelfProtection(
        targetMember,
        currentUser,
        manageContext.byBusinessLinePermission,
      );
      await this.ensureOwnerCanBeModified(projectId);
    }

    const updatedMember = await this.projectMemberRepository.update(
      projectId,
      userId,
      {
        role: updateProjectMemberDto.role,
      },
    );

    if (!updatedMember) {
      throw new NotFoundException('Project member not found');
    }

    return updatedMember;
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

    this.ensureActorCanManageMemberMutation({
      currentUser,
      actorProjectMember: manageContext.actorProjectMember,
      byBusinessLinePermission: manageContext.byBusinessLinePermission,
      targetMember,
    });

    if (targetMember.role === ProjectMemberRole.owner) {
      this.ensureOwnerSelfProtection(
        targetMember,
        currentUser,
        manageContext.byBusinessLinePermission,
      );
      await this.ensureOwnerCanBeModified(projectId);
    }

    await this.projectMemberRepository.remove(projectId, userId);
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

  private isAdmin(currentUser: JwtPayloadType): boolean {
    return currentUser.roles?.includes('admin') ?? false;
  }

  private async ensureCanAccessProject(
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

    const [projectMember, businessLineMember] = await Promise.all([
      this.projectMemberRepository.findByProjectIdAndUserId(
        project.id,
        currentUser.sub,
      ),
      this.businessLineMemberRepository.findByBusinessLineIdAndUserId(
        project.businessLineId,
        currentUser.sub,
      ),
    ]);

    if (projectMember) {
      return project;
    }

    if (
      businessLineMember &&
      (businessLineMember.role === BusinessLineMemberRole.owner ||
        businessLineMember.role === BusinessLineMemberRole.admin)
    ) {
      return project;
    }

    throw new ForbiddenException('forbiddenProject');
  }

  private async ensureCanManageProject(
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

    const [projectMember, businessLineMember] = await Promise.all([
      this.projectMemberRepository.findByProjectIdAndUserId(
        project.id,
        currentUser.sub,
      ),
      this.businessLineMemberRepository.findByBusinessLineIdAndUserId(
        project.businessLineId,
        currentUser.sub,
      ),
    ]);

    if (
      businessLineMember &&
      (businessLineMember.role === BusinessLineMemberRole.owner ||
        businessLineMember.role === BusinessLineMemberRole.admin)
    ) {
      return project;
    }

    if (
      projectMember &&
      (projectMember.role === ProjectMemberRole.owner ||
        projectMember.role === ProjectMemberRole.maintainer)
    ) {
      return project;
    }

    throw new ForbiddenException('forbiddenProjectManage');
  }

  private async ensureCanManageProjectMembers(
    projectId: Project['id'],
    currentUser: JwtPayloadType,
  ): Promise<{
    project: Project;
    actorProjectMember: ProjectMember | null;
    byBusinessLinePermission: boolean;
  }> {
    const project = await this.projectRepository.findById(projectId);

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (this.isAdmin(currentUser)) {
      return {
        project,
        actorProjectMember: null,
        byBusinessLinePermission: false,
      };
    }

    const [projectMember, businessLineMember] = await Promise.all([
      this.projectMemberRepository.findByProjectIdAndUserId(
        project.id,
        currentUser.sub,
      ),
      this.businessLineMemberRepository.findByBusinessLineIdAndUserId(
        project.businessLineId,
        currentUser.sub,
      ),
    ]);

    const byBusinessLinePermission =
      !!businessLineMember &&
      (businessLineMember.role === BusinessLineMemberRole.owner ||
        businessLineMember.role === BusinessLineMemberRole.admin);

    if (byBusinessLinePermission) {
      return {
        project,
        actorProjectMember: projectMember,
        byBusinessLinePermission: true,
      };
    }

    if (
      projectMember &&
      (projectMember.role === ProjectMemberRole.owner ||
        projectMember.role === ProjectMemberRole.maintainer)
    ) {
      return {
        project,
        actorProjectMember: projectMember,
        byBusinessLinePermission: false,
      };
    }

    throw new ForbiddenException('forbiddenProjectManage');
  }

  private ensureActorCanManageMemberMutation({
    currentUser,
    actorProjectMember,
    byBusinessLinePermission,
    targetMember,
    nextRole,
  }: {
    currentUser: JwtPayloadType;
    actorProjectMember: ProjectMember | null;
    byBusinessLinePermission: boolean;
    targetMember?: ProjectMember;
    nextRole?: ProjectMemberRole;
  }): void {
    if (this.isAdmin(currentUser)) {
      return;
    }

    if (byBusinessLinePermission) {
      return;
    }

    if (!actorProjectMember) {
      throw new ForbiddenException('forbiddenProjectManage');
    }

    if (actorProjectMember.role === ProjectMemberRole.owner) {
      return;
    }

    if (actorProjectMember.role !== ProjectMemberRole.maintainer) {
      throw new ForbiddenException('forbiddenProjectManage');
    }

    if (targetMember?.role === ProjectMemberRole.owner) {
      throw new ForbiddenException('forbiddenProjectManage');
    }

    if (nextRole === ProjectMemberRole.owner) {
      throw new ForbiddenException('forbiddenProjectManage');
    }
  }

  private async ensureCanManageBusinessLine(
    businessLineId: string,
    currentUser: JwtPayloadType,
  ): Promise<void> {
    const businessLine =
      await this.businessLineRepository.findById(businessLineId);

    if (!businessLine) {
      throw new NotFoundException('Business line not found');
    }

    if (this.isAdmin(currentUser)) {
      return;
    }

    const businessLineMember =
      await this.businessLineMemberRepository.findByBusinessLineIdAndUserId(
        businessLineId,
        currentUser.sub,
      );

    if (!businessLineMember) {
      throw new ForbiddenException('forbiddenBusinessLine');
    }

    if (
      businessLineMember.role !== BusinessLineMemberRole.owner &&
      businessLineMember.role !== BusinessLineMemberRole.admin
    ) {
      throw new ForbiddenException('forbiddenBusinessLineManage');
    }
  }

  private async ensureOwnerCanBeModified(projectId: string): Promise<void> {
    const members =
      await this.projectMemberRepository.findByProjectId(projectId);

    const ownerCount = members.filter(
      (member) => member.role === ProjectMemberRole.owner,
    ).length;

    if (ownerCount <= 1) {
      throw new ConflictException('At least one project owner is required');
    }
  }

  private ensureOwnerSelfProtection(
    targetMember: ProjectMember,
    currentUser: JwtPayloadType,
    byBusinessLinePermission: boolean,
  ): void {
    if (this.isAdmin(currentUser)) {
      return;
    }

    if (byBusinessLinePermission) {
      return;
    }

    if (targetMember.userId === currentUser.sub) {
      throw new ConflictException(
        'Project owner cannot remove or downgrade self',
      );
    }
  }
}
