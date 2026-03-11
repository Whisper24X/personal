import {
  // common
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import type { Express } from 'express';
import os from 'os';
import path from 'path';
import { CreateBusinessLineDto } from './dto/create-business-line.dto';
import { UpdateBusinessLineDto } from './dto/update-business-line.dto';
import { BusinessLineRepository } from './infrastructure/persistence/business-line.repository';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { BusinessLine } from './domain/business-line';
import { BusinessLineMember } from './domain/business-line-member';
import { CreateBusinessLineMemberDto } from './dto/create-business-line-member.dto';
import { UpdateBusinessLineMemberDto } from './dto/update-business-line-member.dto';
import { BusinessLineMemberRepository } from './infrastructure/persistence/business-line-member.repository';
import { BusinessLineInvitationRepository } from './infrastructure/persistence/business-line-invitation.repository';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { BusinessLineMemberRole } from './dto/business-line-member-role.enum';
import { UsersService } from '../users/users.service';
import { ProjectRepository } from '../projects/infrastructure/persistence/project.repository';
import { ProjectMemberRepository } from '../projects/infrastructure/persistence/project-member.repository';
import { ProjectCustomRoleRepository } from '../projects/infrastructure/persistence/project-custom-role.repository';
import { ProjectMemberRole } from '../projects/dto/project-member-role.enum';
import { ProjectCustomRole } from '../projects/domain/project-custom-role';
import { CreateProjectCustomRoleDto } from '../projects/dto/create-project-custom-role.dto';
import { UpdateProjectCustomRoleDto } from '../projects/dto/update-project-custom-role.dto';
import { AccessService } from '../access/access.service';
import { BusinessLineCustomRoleRepository } from './infrastructure/persistence/business-line-custom-role.repository';
import { CreateBusinessLineInviteDto } from './dto/create-business-line-invite.dto';
import { BusinessLineInviteDto } from './dto/business-line-invite.dto';
import { BusinessLineInviteProjectRole } from './dto/business-line-invite-project-role.enum';
import { AcceptBusinessLineInviteDto } from './dto/accept-business-line-invite.dto';
import { AcceptBusinessLineInviteResponseDto } from './dto/accept-business-line-invite-response.dto';
import ms from 'ms';
import { randomBytes } from 'crypto';
import { NullableType } from '../utils/types/nullable.type';
import { BusinessLineInvitation } from './domain/business-line-invitation';
import { AgentToolConfig } from './domain/agent-tool-config';
import { AgentToolConfigRepository } from './infrastructure/persistence/agent-tool-config.repository';
import { CreateAgentToolConfigDto } from './dto/create-agent-tool-config.dto';
import { UpdateAgentToolConfigDto } from './dto/update-agent-tool-config.dto';
import { Skill } from '../skills/domain/skill';
import { Mcp } from '../mcps/domain/mcp';
import {
  buildSkillDirectoryTree,
  loadBusinessLineLocalMcps,
  loadBusinessLineLocalSkillMarkdownContent,
  loadBusinessLineLocalSkills,
  packSkillAsZip,
  readSkillFile,
  resolveSkillRootDirectory,
  type SkillTreeNode,
} from '../utils/local-agent-catalog';
import { resolveAinativeDataRootDir } from '../utils/workspace-paths';
import { UploadLocalSkillResultDto } from './dto/upload-local-skill-result.dto';
import { CreateLocalMcpDto } from './dto/create-local-mcp.dto';
import { ImportLocalMcpsDto } from './dto/import-local-mcps.dto';
import { ImportLocalMcpsResultDto } from './dto/import-local-mcps-result.dto';
import { GetLocalMcpConfigDto } from './dto/get-local-mcp-config.dto';
import { LocalMcpConfigDto } from './dto/local-mcp-config.dto';
import { LocalSkillContentDto } from './dto/local-skill-content.dto';
import { BusinessLineCustomRole } from './domain/business-line-custom-role';
import { CreateBusinessLineCustomRoleDto } from './dto/create-business-line-custom-role.dto';
import { UpdateBusinessLineCustomRoleDto } from './dto/update-business-line-custom-role.dto';
import {
  ALL_PROJECT_CAPABILITIES,
  ALL_BUSINESS_LINE_CAPABILITIES,
  BUSINESS_LINE_DEFAULT_ROLE_TEMPLATES,
  PROJECT_DEFAULT_ROLE_TEMPLATES,
  getBusinessLineDefaultRoleTemplate,
  getProjectDefaultRoleTemplate,
  hasBusinessLineTemplateCapabilities,
  hasProjectTemplateCapabilities,
  isBusinessLineOwnerCapabilities,
  isDefaultTemplateRoleName,
  isProjectOwnerCapabilities,
  normalizeBusinessLineCapabilities,
  normalizeProjectCapabilities,
} from '../access/access.constants';

@Injectable()
export class BusinessLinesService {
  private static readonly INVITE_TOKEN_EXPIRES_IN: ms.StringValue = '7d';
  private static readonly MAX_SKILL_ARCHIVE_SIZE_BYTES = 20 * 1024 * 1024;
  private static readonly SKILL_UPLOAD_EXTENSIONS = new Set(['.zip']);
  private static readonly SKILL_UPLOAD_COMMAND_TIMEOUT_MS = 15_000;
  private static readonly LOCAL_MCP_CONFIG_FILE_NAME = 'mcp.json';
  private static readonly TOOL_ID_ALIASES: Record<string, string> = {
    claude: 'claude-code',
    'claude-code': 'claude-code',
    codex: 'codex',
    'codex-cli': 'codex',
    cursor: 'cursor-agent',
    'cursor-agent': 'cursor-agent',
    gemini: 'gemini-cli',
    'gemini-cli': 'gemini-cli',
    opencode: 'opencode',
  };

  constructor(
    // Dependencies here
    private readonly businessLineRepository: BusinessLineRepository,
    private readonly businessLineMemberRepository: BusinessLineMemberRepository,
    private readonly businessLineInvitationRepository: BusinessLineInvitationRepository,
    private readonly usersService: UsersService,
    private readonly projectRepository: ProjectRepository,
    private readonly projectMemberRepository: ProjectMemberRepository,
    private readonly projectCustomRoleRepository: ProjectCustomRoleRepository,
    private readonly agentToolConfigRepository: AgentToolConfigRepository,
    private readonly businessLineCustomRoleRepository: BusinessLineCustomRoleRepository,
    private readonly accessService: AccessService,
  ) {}

  async create(
    createBusinessLineDto: CreateBusinessLineDto,
    currentUser: JwtPayloadType,
  ): Promise<BusinessLine> {
    // Do not remove comment below.
    // <creating-property />

    const existedBusinessLine = await this.businessLineRepository.findByName(
      createBusinessLineDto.name,
    );

    if (existedBusinessLine) {
      throw new ConflictException('Business line name already exists');
    }

    const businessLine = await this.businessLineRepository.create({
      // Do not remove comment below.
      // <creating-property-payload />
      name: createBusinessLineDto.name,
      description: createBusinessLineDto.description ?? null,
    });

    await this.ensureDefaultBusinessLineCustomRoles(businessLine.id);
    await this.ensureDefaultProjectCustomRoles(businessLine.id);
    const ownerRole = await this.findDefaultBusinessLineCustomRole(
      businessLine.id,
      BusinessLineMemberRole.owner,
    );

    await this.businessLineMemberRepository.create({
      businessLineId: businessLine.id,
      userId: currentUser.sub,
      roleId: ownerRole.id,
    });

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

  async findById(
    id: BusinessLine['id'],
    currentUser: JwtPayloadType,
  ): Promise<BusinessLine | null> {
    const businessLine = await this.businessLineRepository.findById(id);

    if (!businessLine) {
      return null;
    }

    if (this.isAdmin(currentUser)) {
      return businessLine;
    }

    const member =
      await this.businessLineMemberRepository.findByBusinessLineIdAndUserId(
        id,
        currentUser.sub,
      );

    if (!member) {
      throw new ForbiddenException('forbiddenBusinessLine');
    }

    return businessLine;
  }

  findByIds(ids: BusinessLine['id'][]): Promise<BusinessLine[]> {
    return this.businessLineRepository.findByIds(ids);
  }

  async update(
    id: BusinessLine['id'],
    updateBusinessLineDto: UpdateBusinessLineDto,
    currentUser: JwtPayloadType,
  ): Promise<BusinessLine | null> {
    // Do not remove comment below.
    // <updating-property />

    await this.ensureCanManageBusinessLine(id, currentUser);

    if (updateBusinessLineDto.name) {
      const existedBusinessLine = await this.businessLineRepository.findByName(
        updateBusinessLineDto.name,
      );

      if (existedBusinessLine && existedBusinessLine.id !== id) {
        throw new ConflictException('Business line name already exists');
      }
    }

    return this.businessLineRepository.update(id, {
      // Do not remove comment below.
      // <updating-property-payload />
      ...(updateBusinessLineDto.name !== undefined
        ? { name: updateBusinessLineDto.name }
        : {}),
      ...(updateBusinessLineDto.description !== undefined
        ? { description: updateBusinessLineDto.description }
        : {}),
    });
  }

  async remove(
    id: BusinessLine['id'],
    currentUser: JwtPayloadType,
  ): Promise<void> {
    await this.ensureCanManageBusinessLine(id, currentUser);

    await this.businessLineRepository.remove(id);
  }

  async findMembers(
    businessLineId: BusinessLine['id'],
    currentUser: JwtPayloadType,
  ): Promise<BusinessLineMember[]> {
    await this.ensureCanReadMembers(businessLineId, currentUser);

    const members =
      await this.businessLineMemberRepository.findByBusinessLineId(
        businessLineId,
      );

    return this.attachCustomRoleNamesToBusinessLineMembers(members);
  }

  async addMember(
    businessLineId: BusinessLine['id'],
    createBusinessLineMemberDto: CreateBusinessLineMemberDto,
    currentUser: JwtPayloadType,
  ): Promise<BusinessLineMember> {
    const actorMember = await this.ensureCanInviteMembers(
      businessLineId,
      currentUser,
    );
    const assignment = await this.resolveBusinessLineMemberAssignment(
      businessLineId,
      createBusinessLineMemberDto.roleId,
    );

    await this.ensureActorCanManageMemberMutation({
      currentUser,
      businessLineId,
      actorMember,
      nextRoleId: assignment.roleId,
    });

    const existedMember =
      await this.businessLineMemberRepository.findByBusinessLineIdAndUserId(
        businessLineId,
        createBusinessLineMemberDto.userId,
      );

    if (existedMember) {
      throw new ConflictException('Member already exists in business line');
    }

    const user = await this.usersService.findById(
      createBusinessLineMemberDto.userId,
    );

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const member = await this.businessLineMemberRepository.create({
      businessLineId,
      userId: createBusinessLineMemberDto.userId,
      roleId: assignment.roleId,
    });

    return this.attachCustomRoleNameToBusinessLineMember(member);
  }

  async createInvite(
    businessLineId: BusinessLine['id'],
    createBusinessLineInviteDto: CreateBusinessLineInviteDto,
    currentUser: JwtPayloadType,
  ): Promise<BusinessLineInviteDto> {
    const actorMember = await this.ensureCanInviteMembers(
      businessLineId,
      currentUser,
    );
    const assignment = await this.resolveBusinessLineMemberAssignment(
      businessLineId,
      createBusinessLineInviteDto.roleId,
    );

    await this.ensureActorCanManageMemberMutation({
      currentUser,
      businessLineId,
      actorMember,
      nextRoleId: assignment.roleId,
    });

    const projectRoles = this.normalizeInviteProjectRoles(
      createBusinessLineInviteDto.projectRoles,
    );

    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + ms(BusinessLinesService.INVITE_TOKEN_EXPIRES_IN),
    );
    const token = this.generateInviteToken();

    await this.businessLineInvitationRepository.revokeActiveByBusinessLineId(
      businessLineId,
      now,
    );

    const invitation = await this.businessLineInvitationRepository.create({
      businessLineId,
      token,
      roleId: assignment.roleId,
      projectRoles,
      createdBy: currentUser.sub,
      expiresAt,
    });

    return this.mapInvitationToInviteDto(invitation);
  }

  async findLatestInvite(
    businessLineId: BusinessLine['id'],
    currentUser: JwtPayloadType,
  ): Promise<NullableType<BusinessLineInviteDto>> {
    await this.ensureCanInviteMembers(businessLineId, currentUser);

    const invitation =
      await this.businessLineInvitationRepository.findLatestActiveByBusinessLineId(
        businessLineId,
        new Date(),
      );

    if (!invitation) {
      return null;
    }

    return this.mapInvitationToInviteDto(invitation);
  }

  async acceptInvite(
    acceptBusinessLineInviteDto: AcceptBusinessLineInviteDto,
    currentUser: JwtPayloadType,
  ): Promise<AcceptBusinessLineInviteResponseDto> {
    const invitation =
      await this.businessLineInvitationRepository.findActiveByToken(
        acceptBusinessLineInviteDto.token,
        new Date(),
      );

    if (!invitation) {
      throw new ForbiddenException('Invalid or expired invitation token');
    }

    await this.ensureBusinessLineExists(invitation.businessLineId);

    const existedMember =
      await this.businessLineMemberRepository.findByBusinessLineIdAndUserId(
        invitation.businessLineId,
        currentUser.sub,
      );

    if (existedMember) {
      throw new ConflictException('Member already exists in business line');
    }

    const member = await this.businessLineMemberRepository.create({
      businessLineId: invitation.businessLineId,
      userId: currentUser.sub,
      roleId: invitation.roleId,
    });

    const failedProjects = await this.syncProjectRoleAssignments({
      businessLineId: invitation.businessLineId,
      userId: currentUser.sub,
      projectRoles: invitation.projectRoles,
    });

    return {
      member: await this.attachCustomRoleNameToBusinessLineMember(member),
      failedProjects,
    };
  }

  async findMemberProjectRoles(
    businessLineId: BusinessLine['id'],
    userId: string,
    currentUser: JwtPayloadType,
  ): Promise<{ projectRoles: Record<string, string> }> {
    await this.ensureCanReadMembers(businessLineId, currentUser);

    const [projects, memberships, roles] = await Promise.all([
      this.projectRepository.findByBusinessLineId(businessLineId),
      this.projectMemberRepository.findByUserId(userId),
      this.projectCustomRoleRepository.findAllByBusinessLineId(businessLineId),
    ]);

    const projectIdSet = new Set(projects.map((project) => project.id));
    const projectMembershipMap = new Map(
      memberships
        .filter((membership) => projectIdSet.has(membership.projectId))
        .map((membership) => [membership.projectId, membership]),
    );
    const roleMap = new Map(roles.map((role) => [role.id, role]));
    const projectRoles: Record<string, string> = {};

    for (const project of projects) {
      const membership = projectMembershipMap.get(project.id);
      const role = membership ? (roleMap.get(membership.roleId) ?? null) : null;
      projectRoles[project.id] = role?.id ?? 'none';
    }

    return { projectRoles };
  }

  async updateMemberRole(
    businessLineId: BusinessLine['id'],
    userId: string,
    updateBusinessLineMemberDto: UpdateBusinessLineMemberDto,
    currentUser: JwtPayloadType,
  ): Promise<BusinessLineMember> {
    const actorMember = await this.ensureCanUpdateMemberRole(
      businessLineId,
      currentUser,
    );

    const currentMember =
      await this.businessLineMemberRepository.findByBusinessLineIdAndUserId(
        businessLineId,
        userId,
      );

    if (!currentMember) {
      throw new NotFoundException('Business line member not found');
    }

    const assignment = await this.resolveBusinessLineMemberAssignment(
      businessLineId,
      updateBusinessLineMemberDto.roleId,
    );

    await this.ensureActorCanManageMemberMutation({
      currentUser,
      businessLineId,
      actorMember,
      targetMember: currentMember,
      nextRoleId: assignment.roleId,
    });

    if (
      (await this.isBusinessLineOwnerRole(
        businessLineId,
        currentMember.roleId,
      )) &&
      !(await this.isBusinessLineOwnerRole(businessLineId, assignment.roleId))
    ) {
      this.ensureOwnerSelfProtection(currentMember, currentUser);
      await this.ensureOwnerCanBeModified(businessLineId);
    }

    const updatedMember = await this.businessLineMemberRepository.update(
      businessLineId,
      userId,
      {
        roleId: assignment.roleId,
      },
    );

    if (!updatedMember) {
      throw new NotFoundException('Business line member not found');
    }

    await this.syncExplicitProjectRoleAssignments({
      businessLineId,
      userId,
      projectRoles: this.normalizeExplicitProjectRoles(
        updateBusinessLineMemberDto.projectRoles,
      ),
    });

    return this.attachCustomRoleNameToBusinessLineMember(updatedMember);
  }

  async removeMember(
    businessLineId: BusinessLine['id'],
    userId: string,
    currentUser: JwtPayloadType,
  ): Promise<void> {
    const actorMember = await this.ensureCanRemoveMembers(
      businessLineId,
      currentUser,
    );

    const existedMember =
      await this.businessLineMemberRepository.findByBusinessLineIdAndUserId(
        businessLineId,
        userId,
      );

    if (!existedMember) {
      throw new NotFoundException('Business line member not found');
    }

    await this.ensureActorCanManageMemberMutation({
      currentUser,
      businessLineId,
      actorMember,
      targetMember: existedMember,
    });

    if (
      await this.isBusinessLineOwnerRole(businessLineId, existedMember.roleId)
    ) {
      this.ensureOwnerSelfProtection(existedMember, currentUser);
      await this.ensureOwnerCanBeModified(businessLineId);
    }

    await this.businessLineMemberRepository.remove(businessLineId, userId);
  }

  async findCustomRoles(
    businessLineId: BusinessLine['id'],
    currentUser: JwtPayloadType,
  ): Promise<BusinessLineCustomRole[]> {
    await this.ensureCanReadBusinessLineRole(businessLineId, currentUser);
    await this.ensureDefaultBusinessLineCustomRoles(businessLineId);

    return this.businessLineCustomRoleRepository.findAllByBusinessLineId(
      businessLineId,
    );
  }

  async findCustomRoleLibrary(
    businessLineId: BusinessLine['id'],
    currentUser: JwtPayloadType,
  ): Promise<BusinessLineCustomRole[]> {
    return this.findCustomRoles(businessLineId, currentUser);
  }

  async createCustomRole(
    businessLineId: BusinessLine['id'],
    createBusinessLineCustomRoleDto: CreateBusinessLineCustomRoleDto,
    currentUser: JwtPayloadType,
  ): Promise<BusinessLineCustomRole> {
    await this.ensureCanCreateBusinessLineRole(businessLineId, currentUser);

    const payload = await this.buildBusinessLineCustomRolePayload(
      businessLineId,
      createBusinessLineCustomRoleDto,
    );

    return this.businessLineCustomRoleRepository.create({
      businessLineId,
      ...payload,
    });
  }

  async updateCustomRole(
    businessLineId: BusinessLine['id'],
    roleId: string,
    updateBusinessLineCustomRoleDto: UpdateBusinessLineCustomRoleDto,
    currentUser: JwtPayloadType,
  ): Promise<BusinessLineCustomRole> {
    await this.ensureCanUpdateBusinessLineRole(businessLineId, currentUser);

    const currentRole = await this.getBusinessLineCustomRoleOrThrow(
      businessLineId,
      roleId,
    );

    const payload = await this.buildBusinessLineCustomRolePayload(
      businessLineId,
      {
        name: updateBusinessLineCustomRoleDto.name ?? currentRole.name,
        description:
          updateBusinessLineCustomRoleDto.description !== undefined
            ? updateBusinessLineCustomRoleDto.description
            : (currentRole.description ?? undefined),
        capabilities:
          updateBusinessLineCustomRoleDto.capabilities ??
          currentRole.capabilities,
      },
      currentRole.id,
    );

    const updatedRole = await this.businessLineCustomRoleRepository.update(
      currentRole.id,
      payload,
    );

    if (!updatedRole) {
      throw new NotFoundException('Business line custom role not found');
    }

    return updatedRole;
  }

  async removeCustomRole(
    businessLineId: BusinessLine['id'],
    roleId: string,
    currentUser: JwtPayloadType,
  ): Promise<void> {
    await this.ensureCanDeleteBusinessLineRole(businessLineId, currentUser);

    const customRole = await this.getBusinessLineCustomRoleOrThrow(
      businessLineId,
      roleId,
    );

    const [memberCount, invitationCount] = await Promise.all([
      this.businessLineMemberRepository.countByBusinessLineIdAndRoleId(
        businessLineId,
        customRole.id,
      ),
      this.businessLineInvitationRepository.countActiveByBusinessLineIdAndRoleId(
        businessLineId,
        customRole.id,
        new Date(),
      ),
    ]);

    if (memberCount > 0 || invitationCount > 0) {
      throw new ConflictException('Role is assigned and cannot be deleted');
    }

    await this.businessLineCustomRoleRepository.remove(customRole.id);
  }

  async findProjectCustomRoles(
    businessLineId: BusinessLine['id'],
    currentUser: JwtPayloadType,
  ): Promise<ProjectCustomRole[]> {
    await this.ensureCanReadProjectRole(businessLineId, currentUser);
    await this.ensureDefaultProjectCustomRoles(businessLineId);

    return this.projectCustomRoleRepository.findAllByBusinessLineId(
      businessLineId,
    );
  }

  async createProjectCustomRole(
    businessLineId: BusinessLine['id'],
    createProjectCustomRoleDto: CreateProjectCustomRoleDto,
    currentUser: JwtPayloadType,
  ): Promise<ProjectCustomRole> {
    await this.ensureCanCreateProjectRole(businessLineId, currentUser);

    const payload = await this.buildProjectCustomRolePayload(
      businessLineId,
      createProjectCustomRoleDto,
    );

    return this.projectCustomRoleRepository.create({
      businessLineId,
      ...payload,
    });
  }

  async updateProjectCustomRole(
    businessLineId: BusinessLine['id'],
    roleId: string,
    updateProjectCustomRoleDto: UpdateProjectCustomRoleDto,
    currentUser: JwtPayloadType,
  ): Promise<ProjectCustomRole> {
    await this.ensureCanUpdateProjectRole(businessLineId, currentUser);

    const currentRole = await this.getBusinessLineProjectCustomRoleOrThrow(
      businessLineId,
      roleId,
    );

    const payload = await this.buildProjectCustomRolePayload(
      businessLineId,
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

  async removeProjectCustomRole(
    businessLineId: BusinessLine['id'],
    roleId: string,
    currentUser: JwtPayloadType,
  ): Promise<void> {
    await this.ensureCanDeleteProjectRole(businessLineId, currentUser);

    const customRole = await this.getBusinessLineProjectCustomRoleOrThrow(
      businessLineId,
      roleId,
    );
    const businessLineProjects =
      await this.projectRepository.findByBusinessLineId(
        customRole.businessLineId,
      );
    const memberCount = (
      await Promise.all(
        businessLineProjects.map((project) =>
          this.projectMemberRepository.countByProjectIdAndRoleId(
            project.id,
            customRole.id,
          ),
        ),
      )
    ).reduce((sum, count) => sum + count, 0);

    if (memberCount > 0) {
      throw new ConflictException('Role is assigned and cannot be deleted');
    }

    await this.projectCustomRoleRepository.remove(customRole.id);
  }

  async findAgentToolConfigs(
    businessLineId: BusinessLine['id'],
    currentUser: JwtPayloadType,
    toolId?: string,
  ): Promise<AgentToolConfig[]> {
    await this.ensureCanReadAgentCli(businessLineId, currentUser);

    return this.agentToolConfigRepository.findByBusinessLineId(
      businessLineId,
      toolId ? this.normalizeToolId(toolId) : undefined,
    );
  }

  async findLocalSkills(
    businessLineId: BusinessLine['id'],
    currentUser: JwtPayloadType,
    keyword?: string,
  ): Promise<Skill[]> {
    await this.ensureCanReadSkills(businessLineId, currentUser);

    const skills = await loadBusinessLineLocalSkills(businessLineId);

    const normalizedKeyword = keyword?.trim().toLowerCase() ?? '';
    const filtered = normalizedKeyword
      ? skills.filter((skill) => {
          const haystack =
            `${skill.name} ${skill.version} ${skill.description ?? ''}`
              .toLowerCase()
              .trim();
          return haystack.includes(normalizedKeyword);
        })
      : skills;

    return filtered.map((skill) => ({
      ...skill,
      deletedAt: null,
    }));
  }

  async findLocalSkillContent(
    businessLineId: BusinessLine['id'],
    skillId: string,
    currentUser: JwtPayloadType,
  ): Promise<LocalSkillContentDto> {
    await this.ensureCanReadSkills(businessLineId, currentUser);

    const skillContent = await loadBusinessLineLocalSkillMarkdownContent(
      businessLineId,
      skillId,
    );

    if (!skillContent) {
      throw new NotFoundException('Skill content not found');
    }

    return skillContent;
  }

  async findLocalSkillTree(
    businessLineId: BusinessLine['id'],
    skillId: string,
    currentUser: JwtPayloadType,
  ): Promise<{ id: string; name: string; tree: SkillTreeNode[] }> {
    await this.ensureCanReadSkills(businessLineId, currentUser);

    const skills = await loadBusinessLineLocalSkills(businessLineId);
    const targetSkill = skills.find((item) => item.id === skillId);
    if (!targetSkill) {
      throw new NotFoundException('Skill not found');
    }

    const rootDir = resolveSkillRootDirectory(targetSkill);
    if (!rootDir) {
      throw new NotFoundException('Skill directory not found');
    }

    const tree = await buildSkillDirectoryTree(rootDir);

    return { id: targetSkill.id, name: targetSkill.name, tree };
  }

  async findLocalSkillFile(
    businessLineId: BusinessLine['id'],
    skillId: string,
    filePath: string,
    currentUser: JwtPayloadType,
  ): Promise<{ path: string; content: string }> {
    await this.ensureCanReadSkills(businessLineId, currentUser);

    const skills = await loadBusinessLineLocalSkills(businessLineId);
    const targetSkill = skills.find((item) => item.id === skillId);
    if (!targetSkill) {
      throw new NotFoundException('Skill not found');
    }

    const rootDir = resolveSkillRootDirectory(targetSkill);
    if (!rootDir) {
      throw new NotFoundException('Skill directory not found');
    }

    const content = await readSkillFile(rootDir, filePath);
    if (content === null) {
      throw new NotFoundException('File not found');
    }

    return { path: filePath, content };
  }

  async downloadLocalSkill(
    businessLineId: BusinessLine['id'],
    skillId: string,
    currentUser: JwtPayloadType,
  ): Promise<{ buffer: Buffer; fileName: string }> {
    await this.ensureCanReadSkills(businessLineId, currentUser);

    const skills = await loadBusinessLineLocalSkills(businessLineId);
    const targetSkill = skills.find((item) => item.id === skillId);
    if (!targetSkill) {
      throw new NotFoundException('Skill not found');
    }

    const rootDir = resolveSkillRootDirectory(targetSkill);
    if (!rootDir) {
      throw new NotFoundException('Skill directory not found');
    }

    const buffer = await packSkillAsZip(rootDir);
    const safeName =
      targetSkill.name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-_]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'skill';

    return { buffer, fileName: `${safeName}.zip` };
  }

  async removeLocalSkill(
    businessLineId: BusinessLine['id'],
    skillId: string,
    currentUser: JwtPayloadType,
  ): Promise<void> {
    await this.ensureCanDeleteSkills(businessLineId, currentUser);

    const skills = await loadBusinessLineLocalSkills(businessLineId);
    const targetSkill = skills.find((item) => item.id === skillId);
    if (!targetSkill) {
      throw new NotFoundException('Skill not found');
    }

    const sourcePath =
      targetSkill.metadataJson && typeof targetSkill.metadataJson === 'object'
        ? (targetSkill.metadataJson as Record<string, unknown>).sourcePath
        : null;

    if (typeof sourcePath !== 'string' || !sourcePath.trim()) {
      throw new BadRequestException('Skill source path is unavailable');
    }

    const absoluteSourcePath = path.resolve(sourcePath.trim());
    const businessLineSkillsRoot = path.resolve(
      resolveAinativeDataRootDir(),
      businessLineId,
      'skills',
    );

    const relativePath = path.relative(
      businessLineSkillsRoot,
      absoluteSourcePath,
    );
    if (
      !relativePath ||
      relativePath.startsWith('..') ||
      path.isAbsolute(relativePath)
    ) {
      throw new BadRequestException('Skill path is outside allowed directory');
    }

    const stat = await fs.stat(absoluteSourcePath).catch(() => null);
    const directoryToRemove = stat?.isDirectory()
      ? absoluteSourcePath
      : path.dirname(absoluteSourcePath);

    const dirRelativePath = path.relative(
      businessLineSkillsRoot,
      directoryToRemove,
    );
    if (
      !dirRelativePath ||
      dirRelativePath.startsWith('..') ||
      path.isAbsolute(dirRelativePath)
    ) {
      throw new BadRequestException('Skill path is outside allowed directory');
    }

    await fs.rm(directoryToRemove, { recursive: true, force: true });
  }

  async findLocalMcps(
    businessLineId: BusinessLine['id'],
    currentUser: JwtPayloadType,
  ): Promise<Mcp[]> {
    await this.ensureCanReadMcp(businessLineId, currentUser);

    const mcps = await loadBusinessLineLocalMcps(businessLineId);

    return mcps.map((mcp) => ({
      ...mcp,
      deletedAt: null,
    }));
  }

  async getLocalMcpConfig(
    businessLineId: BusinessLine['id'],
    query: GetLocalMcpConfigDto,
    currentUser: JwtPayloadType,
  ): Promise<LocalMcpConfigDto> {
    await this.ensureCanReadMcp(businessLineId, currentUser);

    const sourcePath = query.sourcePath.trim();
    const mcpName = query.name.trim();
    const mcpRoot = path.resolve(
      resolveAinativeDataRootDir(),
      businessLineId,
      'mcp',
    );
    const resolvedSourcePath = path.resolve(sourcePath);

    if (!this.isPathWithin(mcpRoot, resolvedSourcePath)) {
      throw new BadRequestException('Invalid MCP source path');
    }

    const content = await fs
      .readFile(resolvedSourcePath, 'utf-8')
      .catch((error) => {
        if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
          throw new NotFoundException('MCP source file not found');
        }
        throw error;
      });
    let parsedPayload: Record<string, unknown>;
    try {
      const parsed = JSON.parse(content);
      if (!this.isObjectRecord(parsed)) {
        throw new BadRequestException('MCP source file must be a JSON object');
      }
      parsedPayload = parsed;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException(
        error instanceof Error
          ? `Failed to parse MCP source JSON: ${error.message}`
          : 'Failed to parse MCP source JSON',
      );
    }

    const mcpServers = this.resolveImportedMcpServers(parsedPayload);
    if (!this.isObjectRecord(mcpServers)) {
      throw new BadRequestException('Invalid MCP servers payload');
    }

    const mcpConfig = mcpServers[mcpName];
    if (!this.isObjectRecord(mcpConfig)) {
      throw new NotFoundException('MCP config not found');
    }

    return {
      name: mcpName,
      sourcePath: resolvedSourcePath,
      config: mcpConfig,
    };
  }

  async createLocalMcp(
    businessLineId: BusinessLine['id'],
    createLocalMcpDto: CreateLocalMcpDto,
    currentUser: JwtPayloadType,
  ): Promise<Mcp> {
    await this.ensureCanManageMcp(businessLineId, currentUser);

    const name = createLocalMcpDto.name.trim();
    const transportType = createLocalMcpDto.transportType;
    const command = createLocalMcpDto.command?.trim();
    const url = createLocalMcpDto.url?.trim();
    const args = (createLocalMcpDto.args ?? [])
      .map((item) => item.trim())
      .filter(Boolean);
    const env = this.normalizeStringMap(createLocalMcpDto.env);
    const headers = this.normalizeStringMap(createLocalMcpDto.headers);

    if (transportType === 'stdio' && !command) {
      throw new BadRequestException('MCP command is required for stdio type');
    }

    if ((transportType === 'http' || transportType === 'sse') && !url) {
      throw new BadRequestException('MCP url is required for http/sse type');
    }

    if (transportType !== 'stdio' && args.length > 0) {
      throw new BadRequestException('MCP args are only allowed for stdio type');
    }

    if (transportType !== 'stdio' && Object.keys(env).length > 0) {
      throw new BadRequestException('MCP env is only allowed for stdio type');
    }

    if (transportType === 'stdio' && Object.keys(headers).length > 0) {
      throw new BadRequestException(
        'MCP headers are only allowed for http/sse type',
      );
    }

    const targetMcpRoot = path.resolve(
      resolveAinativeDataRootDir(),
      businessLineId,
      'mcp',
    );
    const targetMcpConfigPath = path.join(
      targetMcpRoot,
      BusinessLinesService.LOCAL_MCP_CONFIG_FILE_NAME,
    );

    const payload = await this.readLocalMcpConfig(targetMcpConfigPath);
    const mcpServers = this.resolveMcpServersFromPayload(payload);

    if (
      Object.keys(mcpServers).some((serverName) => serverName.trim() === name)
    ) {
      throw new ConflictException('MCP name already exists');
    }

    mcpServers[name] = this.buildLocalMcpServerConfig({
      transportType,
      command,
      args,
      env,
      url,
      headers,
    });
    payload.mcpServers = mcpServers;

    await fs.mkdir(targetMcpRoot, { recursive: true });
    await fs.writeFile(
      targetMcpConfigPath,
      `${JSON.stringify(payload, null, 2)}\n`,
      'utf-8',
    );

    const mcps = await loadBusinessLineLocalMcps(businessLineId);
    const createdMcp = mcps.find((mcp) => mcp.name.trim() === name);
    if (!createdMcp) {
      throw new BadRequestException('Created MCP entry could not be loaded');
    }

    return {
      ...createdMcp,
      deletedAt: null,
    };
  }

  async removeLocalMcp(
    businessLineId: BusinessLine['id'],
    query: GetLocalMcpConfigDto,
    currentUser: JwtPayloadType,
  ): Promise<void> {
    await this.ensureCanManageMcp(businessLineId, currentUser);

    const sourcePath = query.sourcePath.trim();
    const mcpName = query.name.trim();
    if (!mcpName) {
      throw new BadRequestException('MCP name is required');
    }

    const mcpRoot = path.resolve(
      resolveAinativeDataRootDir(),
      businessLineId,
      'mcp',
    );
    const resolvedSourcePath = path.resolve(sourcePath);

    if (!this.isPathWithin(mcpRoot, resolvedSourcePath)) {
      throw new BadRequestException('Invalid MCP source path');
    }

    const content = await fs
      .readFile(resolvedSourcePath, 'utf-8')
      .catch((error) => {
        if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
          throw new NotFoundException('MCP source file not found');
        }
        throw error;
      });

    let parsedPayload: Record<string, unknown>;
    try {
      const parsed = JSON.parse(content);
      if (!this.isObjectRecord(parsed)) {
        throw new BadRequestException('MCP source file must be a JSON object');
      }
      parsedPayload = parsed;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        error instanceof Error
          ? `Failed to parse MCP source JSON: ${error.message}`
          : 'Failed to parse MCP source JSON',
      );
    }

    const mcpServers = this.resolveImportedMcpServers(parsedPayload);
    if (!this.isObjectRecord(mcpServers)) {
      throw new BadRequestException('Invalid MCP servers payload');
    }

    if (!this.isObjectRecord(mcpServers[mcpName])) {
      throw new NotFoundException('MCP config not found');
    }

    delete mcpServers[mcpName];
    parsedPayload.mcpServers = mcpServers;

    await fs.writeFile(
      resolvedSourcePath,
      `${JSON.stringify(parsedPayload, null, 2)}\n`,
      'utf-8',
    );
  }

  async importLocalMcps(
    businessLineId: BusinessLine['id'],
    importLocalMcpsDto: ImportLocalMcpsDto,
    currentUser: JwtPayloadType,
  ): Promise<ImportLocalMcpsResultDto> {
    await this.ensureCanManageMcp(businessLineId, currentUser);

    const importedRawServers = this.resolveImportedMcpServers(
      importLocalMcpsDto.payload,
    );
    const importedEntries = Object.entries(importedRawServers);
    if (importedEntries.length === 0) {
      throw new BadRequestException('No MCP server found in import payload');
    }

    const targetMcpRoot = path.resolve(
      resolveAinativeDataRootDir(),
      businessLineId,
      'mcp',
    );
    const targetMcpConfigPath = path.join(
      targetMcpRoot,
      BusinessLinesService.LOCAL_MCP_CONFIG_FILE_NAME,
    );

    const payload = await this.readLocalMcpConfig(targetMcpConfigPath);
    const mcpServers = this.resolveMcpServersFromPayload(payload);

    let importedCount = 0;
    let overwrittenCount = 0;

    for (const [rawName, rawConfig] of importedEntries) {
      const name = rawName.trim();
      if (!name) {
        continue;
      }

      const normalizedConfig = this.normalizeImportedMcpServerConfig(
        rawConfig,
        name,
      );

      if (mcpServers[name]) {
        overwrittenCount += 1;
      }

      importedCount += 1;
      mcpServers[name] = normalizedConfig;
    }

    if (importedCount === 0) {
      throw new BadRequestException(
        'No valid MCP server found in import payload',
      );
    }

    payload.mcpServers = mcpServers;

    await fs.mkdir(targetMcpRoot, { recursive: true });
    await fs.writeFile(
      targetMcpConfigPath,
      `${JSON.stringify(payload, null, 2)}\n`,
      'utf-8',
    );

    return {
      importedCount,
      overwrittenCount,
    };
  }

  async uploadLocalSkill(
    businessLineId: BusinessLine['id'],
    file: Express.Multer.File | undefined,
    currentUser: JwtPayloadType,
  ): Promise<UploadLocalSkillResultDto> {
    await this.ensureCanUploadSkills(businessLineId, currentUser);

    if (!file?.buffer?.length) {
      throw new BadRequestException('Skill package file is required');
    }

    if (file.size > BusinessLinesService.MAX_SKILL_ARCHIVE_SIZE_BYTES) {
      throw new BadRequestException(
        `Skill package size must be <= ${BusinessLinesService.MAX_SKILL_ARCHIVE_SIZE_BYTES} bytes`,
      );
    }

    const normalizedName = file.originalname?.trim() ?? '';
    const extension = path.extname(normalizedName).toLowerCase();
    if (!BusinessLinesService.SKILL_UPLOAD_EXTENSIONS.has(extension)) {
      throw new BadRequestException('Only .zip package files are supported');
    }

    const temporaryRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), 'ainative-skill-upload-'),
    );
    const archivePath = path.join(temporaryRoot, `upload${extension}`);
    const extractedPath = path.join(temporaryRoot, 'extracted');

    try {
      await fs.writeFile(archivePath, file.buffer);

      const archiveEntries = await this.listArchiveEntries(archivePath);
      this.ensureArchiveEntriesSafe(archiveEntries);

      const packageRoot = this.resolveSkillPackageRoot(archiveEntries);
      if (!packageRoot) {
        throw new BadRequestException(
          'Package root must contain SKILL.md file',
        );
      }

      await fs.mkdir(extractedPath, { recursive: true });
      await this.extractArchiveToDirectory(archivePath, extractedPath);

      const descriptorAbsolutePath = path.join(
        extractedPath,
        packageRoot.descriptorEntry,
      );
      const descriptorContent = await fs.readFile(
        descriptorAbsolutePath,
        'utf-8',
      );
      const descriptorMetadata =
        this.parseSkillDescriptorYaml(descriptorContent);

      if (!descriptorMetadata.name || !descriptorMetadata.description) {
        throw new BadRequestException(
          'SKILL.md YAML frontmatter must include name and description',
        );
      }

      const targetSkillDirectoryName = this.toSafeSkillDirectoryName(
        descriptorMetadata.name,
      );
      if (!targetSkillDirectoryName) {
        throw new BadRequestException('Invalid skill name in SKILL.md');
      }

      const targetSkillsRoot = path.resolve(
        resolveAinativeDataRootDir(),
        businessLineId,
        'skills',
      );
      const targetSkillPath = path.join(
        targetSkillsRoot,
        targetSkillDirectoryName,
      );
      const sourceSkillPath = packageRoot.rootDirPath
        ? path.join(extractedPath, packageRoot.rootDirPath)
        : extractedPath;

      await fs.mkdir(targetSkillsRoot, { recursive: true });

      const existedStat = await this.safeStat(targetSkillPath);
      if (existedStat) {
        throw new ConflictException(
          `Skill package directory already exists: ${targetSkillDirectoryName}`,
        );
      }

      await fs.cp(sourceSkillPath, targetSkillPath, {
        recursive: true,
        force: false,
        errorOnExist: true,
        filter: (sourcePath) => {
          if (packageRoot.rootDirPath) {
            return true;
          }

          const relativePath = path
            .relative(sourceSkillPath, sourcePath)
            .replace(/\\/g, '/');

          if (!relativePath) {
            return true;
          }

          if (relativePath.startsWith('__MACOSX/')) {
            return false;
          }

          if (relativePath === '.DS_Store') {
            return false;
          }

          return true;
        },
      });

      return {
        name: descriptorMetadata.name,
        description: descriptorMetadata.description,
        directoryName: targetSkillDirectoryName,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      if (error instanceof ConflictException) {
        throw error;
      }

      throw new BadRequestException(
        error instanceof Error
          ? `Skill package upload failed: ${error.message}`
          : 'Skill package upload failed',
      );
    } finally {
      await fs.rm(temporaryRoot, { recursive: true, force: true });
    }
  }

  async createAgentToolConfig(
    businessLineId: BusinessLine['id'],
    createAgentToolConfigDto: CreateAgentToolConfigDto,
    currentUser: JwtPayloadType,
  ): Promise<AgentToolConfig> {
    await this.ensureCanCreateAgentCli(businessLineId, currentUser);

    const toolId = this.normalizeToolId(createAgentToolConfigDto.toolId);
    const existedConfigs =
      await this.agentToolConfigRepository.findByBusinessLineId(
        businessLineId,
        toolId,
      );

    if (
      existedConfigs.some(
        (item) => item.name.trim() === createAgentToolConfigDto.name.trim(),
      )
    ) {
      throw new ConflictException('Agent tool config name already exists');
    }

    if (createAgentToolConfigDto.isDefault === true) {
      await this.agentToolConfigRepository.clearDefaultByBusinessLineIdAndToolId(
        businessLineId,
        toolId,
      );
    }

    return this.agentToolConfigRepository.create({
      businessLineId,
      toolId,
      name: createAgentToolConfigDto.name.trim(),
      description: createAgentToolConfigDto.description?.trim() || null,
      configJson: JSON.stringify(createAgentToolConfigDto.configJson ?? {}),
      isDefault: createAgentToolConfigDto.isDefault === true,
    });
  }

  async updateAgentToolConfig(
    businessLineId: BusinessLine['id'],
    configId: AgentToolConfig['id'],
    updateAgentToolConfigDto: UpdateAgentToolConfigDto,
    currentUser: JwtPayloadType,
  ): Promise<AgentToolConfig> {
    await this.ensureCanUpdateAgentCli(businessLineId, currentUser);

    const existedConfig =
      await this.agentToolConfigRepository.findById(configId);
    if (!existedConfig || existedConfig.businessLineId !== businessLineId) {
      throw new NotFoundException('Agent tool config not found');
    }

    const nextToolId =
      updateAgentToolConfigDto.toolId !== undefined
        ? this.normalizeToolId(updateAgentToolConfigDto.toolId)
        : existedConfig.toolId;
    const nextName =
      updateAgentToolConfigDto.name !== undefined
        ? updateAgentToolConfigDto.name.trim()
        : existedConfig.name;
    const nextIsDefault =
      updateAgentToolConfigDto.isDefault !== undefined
        ? updateAgentToolConfigDto.isDefault
        : existedConfig.isDefault;

    const sameToolConfigs =
      await this.agentToolConfigRepository.findByBusinessLineId(
        businessLineId,
        nextToolId,
      );
    const duplicate = sameToolConfigs.find(
      (item) => item.id !== configId && item.name.trim() === nextName,
    );
    if (duplicate) {
      throw new ConflictException('Agent tool config name already exists');
    }

    if (nextIsDefault) {
      await this.agentToolConfigRepository.clearDefaultByBusinessLineIdAndToolId(
        businessLineId,
        nextToolId,
        configId,
      );
    }

    const updatedConfig = await this.agentToolConfigRepository.update(
      configId,
      {
        ...(updateAgentToolConfigDto.toolId !== undefined
          ? {
              toolId: nextToolId,
            }
          : {}),
        ...(updateAgentToolConfigDto.name !== undefined
          ? {
              name: nextName,
            }
          : {}),
        ...(updateAgentToolConfigDto.description !== undefined
          ? {
              description: updateAgentToolConfigDto.description?.trim() || null,
            }
          : {}),
        ...(updateAgentToolConfigDto.configJson !== undefined
          ? {
              configJson: JSON.stringify(
                updateAgentToolConfigDto.configJson ?? {},
              ),
            }
          : {}),
        ...(updateAgentToolConfigDto.isDefault !== undefined
          ? {
              isDefault: updateAgentToolConfigDto.isDefault,
            }
          : {}),
      },
    );

    if (!updatedConfig) {
      throw new NotFoundException('Agent tool config not found');
    }

    return updatedConfig;
  }

  async removeAgentToolConfig(
    businessLineId: BusinessLine['id'],
    configId: AgentToolConfig['id'],
    currentUser: JwtPayloadType,
  ): Promise<void> {
    await this.ensureCanDeleteAgentCli(businessLineId, currentUser);

    const existedConfig =
      await this.agentToolConfigRepository.findById(configId);
    if (!existedConfig || existedConfig.businessLineId !== businessLineId) {
      throw new NotFoundException('Agent tool config not found');
    }

    await this.agentToolConfigRepository.remove(configId);
  }

  private async ensureOwnerCanBeModified(
    businessLineId: BusinessLine['id'],
  ): Promise<void> {
    const members =
      await this.businessLineMemberRepository.findByBusinessLineId(
        businessLineId,
      );

    const roles =
      await this.businessLineCustomRoleRepository.findAllByBusinessLineId(
        businessLineId,
      );
    const ownerRoleIdSet = new Set(
      roles
        .filter((role) => isBusinessLineOwnerCapabilities(role.capabilities))
        .map((role) => role.id),
    );
    const ownerCount = members.filter((member) =>
      ownerRoleIdSet.has(member.roleId),
    ).length;

    if (ownerCount <= 1) {
      throw new ConflictException('At least one owner is required');
    }
  }

  private ensureOwnerSelfProtection(
    member: BusinessLineMember,
    currentUser: JwtPayloadType,
  ): void {
    if (member.userId === currentUser.sub && !this.isAdmin(currentUser)) {
      throw new ConflictException('Owner cannot remove or downgrade self');
    }
  }

  private async ensureActorCanManageMemberMutation({
    currentUser,
    businessLineId,
    actorMember,
    targetMember,
    nextRoleId,
  }: {
    currentUser: JwtPayloadType;
    businessLineId: string;
    actorMember: BusinessLineMember | null;
    targetMember?: BusinessLineMember;
    nextRoleId?: string;
  }): Promise<void> {
    if (this.isAdmin(currentUser)) {
      return;
    }

    if (!actorMember) {
      throw new ForbiddenException('forbiddenBusinessLineManage');
    }

    if (
      await this.isBusinessLineOwnerRole(businessLineId, actorMember.roleId)
    ) {
      return;
    }

    if (
      targetMember &&
      (await this.isBusinessLineOwnerRole(businessLineId, targetMember.roleId))
    ) {
      throw new ForbiddenException('forbiddenBusinessLineManage');
    }

    if (
      nextRoleId &&
      (await this.isBusinessLineOwnerRole(businessLineId, nextRoleId))
    ) {
      throw new ForbiddenException('forbiddenBusinessLineManage');
    }
  }

  private normalizeExplicitProjectRoles(
    rawProjectRoles?: Record<string, string>,
  ): Record<string, string> {
    if (!rawProjectRoles) {
      return {};
    }

    if (Array.isArray(rawProjectRoles)) {
      throw new BadRequestException('Invalid project role payload');
    }

    const nextProjectRoles: Record<string, string> = {};

    for (const [projectId, roleId] of Object.entries(rawProjectRoles)) {
      if (!this.isUuid(projectId)) {
        throw new BadRequestException('Invalid project id in member payload');
      }

      if (typeof roleId !== 'string') {
        throw new BadRequestException('Invalid project role in member payload');
      }

      const normalizedRoleId = roleId.trim();
      if (normalizedRoleId !== 'none' && !this.isUuid(normalizedRoleId)) {
        throw new BadRequestException('Invalid project role in member payload');
      }

      nextProjectRoles[projectId] = normalizedRoleId || 'none';
    }

    return nextProjectRoles;
  }

  private normalizeInviteProjectRoles(
    rawProjectRoles?: Record<string, BusinessLineInviteProjectRole>,
  ): Record<string, BusinessLineInviteProjectRole> {
    if (!rawProjectRoles) {
      return {};
    }

    if (Array.isArray(rawProjectRoles)) {
      throw new BadRequestException('Invalid project role payload');
    }

    const nextProjectRoles: Record<string, BusinessLineInviteProjectRole> = {};

    for (const [projectId, role] of Object.entries(rawProjectRoles)) {
      if (!this.isUuid(projectId)) {
        throw new BadRequestException('Invalid project id in invite payload');
      }

      if (!Object.values(BusinessLineInviteProjectRole).includes(role)) {
        throw new BadRequestException('Invalid project role in invite payload');
      }

      nextProjectRoles[projectId] = role;
    }

    return nextProjectRoles;
  }

  private async syncExplicitProjectRoleAssignments({
    businessLineId,
    userId,
    projectRoles,
  }: {
    businessLineId: string;
    userId: string;
    projectRoles: Record<string, string>;
  }): Promise<string[]> {
    const failedProjects: string[] = [];

    for (const [projectId, roleId] of Object.entries(projectRoles)) {
      try {
        const project = await this.projectRepository.findById(projectId);
        if (!project || project.businessLineId !== businessLineId) {
          failedProjects.push(projectId);
          continue;
        }

        const existedMember =
          await this.projectMemberRepository.findByProjectIdAndUserId(
            projectId,
            userId,
          );

        if (roleId === 'none') {
          if (!existedMember) {
            continue;
          }

          if (
            await this.isProjectOwnerRole(businessLineId, existedMember.roleId)
          ) {
            continue;
          }

          await this.projectMemberRepository.remove(projectId, userId);
          continue;
        }

        const nextProjectRole =
          await this.getBusinessLineProjectCustomRoleOrThrow(
            businessLineId,
            roleId,
          );

        if (!existedMember) {
          await this.projectMemberRepository.create({
            projectId,
            userId,
            roleId: nextProjectRole.id,
          });
          continue;
        }

        if (
          await this.isProjectOwnerRole(businessLineId, existedMember.roleId)
        ) {
          continue;
        }

        if (existedMember.roleId !== nextProjectRole.id) {
          await this.projectMemberRepository.update(projectId, userId, {
            roleId: nextProjectRole.id,
          });
        }
      } catch (error) {
        void error;
        failedProjects.push(projectId);
      }
    }

    return failedProjects;
  }

  private async syncProjectRoleAssignments({
    businessLineId,
    userId,
    projectRoles,
  }: {
    businessLineId: string;
    userId: string;
    projectRoles: Record<string, BusinessLineInviteProjectRole>;
  }): Promise<string[]> {
    const failedProjects: string[] = [];

    for (const [projectId, role] of Object.entries(projectRoles)) {
      try {
        const project = await this.projectRepository.findById(projectId);
        if (!project || project.businessLineId !== businessLineId) {
          failedProjects.push(projectId);
          continue;
        }

        const existedMember =
          await this.projectMemberRepository.findByProjectIdAndUserId(
            projectId,
            userId,
          );

        if (role === BusinessLineInviteProjectRole.none) {
          if (!existedMember) {
            continue;
          }

          if (
            await this.isProjectOwnerRole(businessLineId, existedMember.roleId)
          ) {
            continue;
          }

          await this.projectMemberRepository.remove(projectId, userId);
          continue;
        }

        const nextRole = this.mapInviteProjectRoleToProjectRole(role);
        if (!nextRole) {
          continue;
        }

        if (!existedMember) {
          const nextProjectRole = await this.findDefaultProjectCustomRole(
            businessLineId,
            nextRole,
          );

          await this.projectMemberRepository.create({
            projectId,
            userId,
            roleId: nextProjectRole.id,
          });
          continue;
        }

        if (
          await this.isProjectOwnerRole(businessLineId, existedMember.roleId)
        ) {
          continue;
        }

        const nextProjectRole = await this.findDefaultProjectCustomRole(
          businessLineId,
          nextRole,
        );

        if (existedMember.roleId !== nextProjectRole.id) {
          await this.projectMemberRepository.update(projectId, userId, {
            roleId: nextProjectRole.id,
          });
        }
      } catch (error) {
        void error;
        failedProjects.push(projectId);
      }
    }

    return failedProjects;
  }

  private async resolveBusinessLineMemberAssignment(
    businessLineId: string,
    roleId: string,
  ): Promise<{ roleId: string }> {
    const normalizedRoleId = roleId.trim();
    if (!normalizedRoleId) {
      throw new BadRequestException('Business line role id is required');
    }

    const role =
      await this.businessLineCustomRoleRepository.findById(normalizedRoleId);

    if (!role || role.businessLineId !== businessLineId) {
      throw new NotFoundException('Business line role not found');
    }

    return {
      roleId: role.id,
    };
  }

  private async ensureDefaultBusinessLineCustomRoles(
    businessLineId: BusinessLine['id'],
  ): Promise<BusinessLineCustomRole[]> {
    const existingRoles =
      await this.businessLineCustomRoleRepository.findAllByBusinessLineId(
        businessLineId,
      );
    const roleNameSet = new Set(existingRoles.map((role) => role.name));

    for (const template of BUSINESS_LINE_DEFAULT_ROLE_TEMPLATES) {
      const existedRole = existingRoles.find(
        (role) =>
          hasBusinessLineTemplateCapabilities(
            role.capabilities,
            template.role,
          ) || isDefaultTemplateRoleName(role.name, template.name),
      );
      if (existedRole) {
        continue;
      }

      const roleName = this.buildAvailableDefaultRoleName(
        template.name,
        roleNameSet,
      );

      const createdRole = await this.businessLineCustomRoleRepository.create({
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

  private async findDefaultBusinessLineCustomRole(
    businessLineId: BusinessLine['id'],
    role: BusinessLineMemberRole,
  ): Promise<BusinessLineCustomRole> {
    await this.ensureDefaultBusinessLineCustomRoles(businessLineId);

    const template = getBusinessLineDefaultRoleTemplate(role);
    const roles =
      await this.ensureDefaultBusinessLineCustomRoles(businessLineId);
    const customRole =
      roles.find((item) =>
        hasBusinessLineTemplateCapabilities(item.capabilities, role),
      ) ??
      roles.find((item) =>
        isDefaultTemplateRoleName(item.name, template.name),
      ) ??
      null;

    if (!customRole) {
      throw new NotFoundException('Business line default role not found');
    }

    return customRole;
  }

  private async buildBusinessLineCustomRolePayload(
    businessLineId: BusinessLine['id'],
    input: CreateBusinessLineCustomRoleDto,
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

    const existedRole = await this.businessLineCustomRoleRepository.findByName(
      businessLineId,
      name,
    );
    if (existedRole && existedRole.id !== currentRoleId) {
      throw new ConflictException(
        'Custom role name already exists in business line',
      );
    }

    const capabilities = normalizeBusinessLineCapabilities(
      Array.from(
        new Set(
          (input.capabilities ?? [])
            .filter((capability) => typeof capability === 'string')
            .map((capability) => capability.trim())
            .filter(Boolean),
        ),
      ),
    );
    const allowedCapabilities = new Set(ALL_BUSINESS_LINE_CAPABILITIES);

    const invalidCapability = capabilities.find(
      (capability) => !allowedCapabilities.has(capability),
    );
    if (invalidCapability) {
      throw new BadRequestException(
        `Capability ${invalidCapability} is not supported in business line scope`,
      );
    }

    return {
      name,
      description: this.normalizeOptionalText(input.description),
      capabilities,
    };
  }

  private async ensureDefaultProjectCustomRoles(
    businessLineId: BusinessLine['id'],
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

  private async findDefaultProjectCustomRole(
    businessLineId: BusinessLine['id'],
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

  private async isBusinessLineOwnerRole(
    businessLineId: string,
    roleId: string,
  ): Promise<boolean> {
    const role = await this.businessLineCustomRoleRepository.findById(roleId);
    return (
      !!role &&
      role.businessLineId === businessLineId &&
      isBusinessLineOwnerCapabilities(role.capabilities)
    );
  }

  private async isProjectOwnerRole(
    businessLineId: string,
    roleId: string,
  ): Promise<boolean> {
    const role = await this.projectCustomRoleRepository.findById(roleId);
    return (
      !!role &&
      role.businessLineId === businessLineId &&
      isProjectOwnerCapabilities(role.capabilities)
    );
  }

  private async buildProjectCustomRolePayload(
    businessLineId: BusinessLine['id'],
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
    businessLineId: BusinessLine['id'],
    roleId: string,
  ): Promise<ProjectCustomRole> {
    const customRole = await this.projectCustomRoleRepository.findById(roleId);

    if (!customRole || customRole.businessLineId !== businessLineId) {
      throw new NotFoundException('Project role not found');
    }

    return customRole;
  }

  private async getBusinessLineCustomRoleOrThrow(
    businessLineId: BusinessLine['id'],
    roleId: string,
  ): Promise<BusinessLineCustomRole> {
    const customRole =
      await this.businessLineCustomRoleRepository.findById(roleId);

    if (!customRole || customRole.businessLineId !== businessLineId) {
      throw new NotFoundException('Business line role not found');
    }

    return customRole;
  }

  private async attachCustomRoleNamesToBusinessLineMembers(
    members: BusinessLineMember[],
  ): Promise<BusinessLineMember[]> {
    const businessLineIds = Array.from(
      new Set(members.map((member) => member.businessLineId)),
    );
    const roleMap = new Map<string, string>();

    for (const businessLineId of businessLineIds) {
      const roles =
        await this.businessLineCustomRoleRepository.findAllByBusinessLineId(
          businessLineId,
        );
      for (const role of roles) {
        roleMap.set(role.id, role.name);
      }
    }

    return members.map((member) => ({
      ...member,
      customRoleName: roleMap.get(member.roleId) ?? null,
    }));
  }

  private async attachCustomRoleNameToBusinessLineMember(
    member: BusinessLineMember,
  ): Promise<BusinessLineMember> {
    const [nextMember] = await this.attachCustomRoleNamesToBusinessLineMembers([
      member,
    ]);
    return nextMember ?? member;
  }

  private async resolveInvitationCustomRoleName(
    invitation: BusinessLineInvitation,
  ): Promise<string | null> {
    const role = await this.businessLineCustomRoleRepository.findById(
      invitation.roleId,
    );
    return role?.name ?? null;
  }

  private mapProjectCustomRoleToInviteProjectRole(
    role: ProjectCustomRole | null,
  ): BusinessLineInviteProjectRole {
    if (!role) {
      return BusinessLineInviteProjectRole.none;
    }

    if (
      hasProjectTemplateCapabilities(
        role.capabilities,
        ProjectMemberRole.owner,
      ) ||
      hasProjectTemplateCapabilities(
        role.capabilities,
        ProjectMemberRole.maintainer,
      ) ||
      role.capabilities.includes('project.member.manage') ||
      role.capabilities.includes('project.workflow.manage') ||
      role.capabilities.includes('project.update') ||
      role.capabilities.includes('project.delete')
    ) {
      return BusinessLineInviteProjectRole.manage;
    }

    if (
      hasProjectTemplateCapabilities(
        role.capabilities,
        ProjectMemberRole.developer,
      ) ||
      role.capabilities.includes('project.task.create') ||
      role.capabilities.includes('project.task.execute')
    ) {
      return BusinessLineInviteProjectRole.developer;
    }

    if (
      hasProjectTemplateCapabilities(
        role.capabilities,
        ProjectMemberRole.viewer,
      ) ||
      role.capabilities.includes('project.read') ||
      role.capabilities.includes('project.task.read')
    ) {
      return BusinessLineInviteProjectRole.viewer;
    }

    return BusinessLineInviteProjectRole.none;
  }

  private mapInviteProjectRoleToProjectRole(
    role: BusinessLineInviteProjectRole,
  ): ProjectMemberRole | null {
    if (role === BusinessLineInviteProjectRole.none) {
      return null;
    }

    if (role === BusinessLineInviteProjectRole.manage) {
      return ProjectMemberRole.maintainer;
    }

    if (role === BusinessLineInviteProjectRole.developer) {
      return ProjectMemberRole.developer;
    }

    return ProjectMemberRole.viewer;
  }

  private generateInviteToken(): string {
    return randomBytes(32).toString('hex');
  }

  private async mapInvitationToInviteDto(
    invitation: BusinessLineInvitation,
  ): Promise<BusinessLineInviteDto> {
    return {
      token: invitation.token,
      expiresAt: invitation.expiresAt.toISOString(),
      businessLineId: invitation.businessLineId,
      roleId: invitation.roleId,
      projectRoles: invitation.projectRoles,
      customRoleName: await this.resolveInvitationCustomRoleName(invitation),
    };
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

  private async ensureCanAccessBusinessLine(
    businessLineId: BusinessLine['id'],
    currentUser: JwtPayloadType,
  ): Promise<void> {
    await this.accessService.assertBusinessLineCapability(
      currentUser,
      businessLineId,
      'businessLine.read',
    );
  }

  private async ensureCanManageBusinessLine(
    businessLineId: BusinessLine['id'],
    currentUser: JwtPayloadType,
  ): Promise<void> {
    await this.accessService.assertBusinessLineCapability(
      currentUser,
      businessLineId,
      'businessLine.update',
    );
  }

  private async ensureCanReadMembers(
    businessLineId: BusinessLine['id'],
    currentUser: JwtPayloadType,
  ): Promise<void> {
    await this.accessService.assertBusinessLineCapability(
      currentUser,
      businessLineId,
      'businessLine.member.read',
    );
  }

  private async ensureCanInviteMembers(
    businessLineId: BusinessLine['id'],
    currentUser: JwtPayloadType,
  ): Promise<BusinessLineMember | null> {
    await this.accessService.assertBusinessLineCapability(
      currentUser,
      businessLineId,
      'businessLine.member.invite',
    );
    if (this.isAdmin(currentUser)) return null;
    return this.businessLineMemberRepository.findByBusinessLineIdAndUserId(
      businessLineId,
      currentUser.sub,
    );
  }

  private async ensureCanUpdateMemberRole(
    businessLineId: BusinessLine['id'],
    currentUser: JwtPayloadType,
  ): Promise<BusinessLineMember | null> {
    await this.accessService.assertBusinessLineCapability(
      currentUser,
      businessLineId,
      'businessLine.member.updateRole',
    );
    if (this.isAdmin(currentUser)) return null;
    return this.businessLineMemberRepository.findByBusinessLineIdAndUserId(
      businessLineId,
      currentUser.sub,
    );
  }

  private async ensureCanRemoveMembers(
    businessLineId: BusinessLine['id'],
    currentUser: JwtPayloadType,
  ): Promise<BusinessLineMember | null> {
    await this.accessService.assertBusinessLineCapability(
      currentUser,
      businessLineId,
      'businessLine.member.remove',
    );
    if (this.isAdmin(currentUser)) return null;
    return this.businessLineMemberRepository.findByBusinessLineIdAndUserId(
      businessLineId,
      currentUser.sub,
    );
  }

  private async ensureCanReadBusinessLineRole(
    businessLineId: BusinessLine['id'],
    currentUser: JwtPayloadType,
  ): Promise<void> {
    await this.accessService.assertBusinessLineCapability(
      currentUser,
      businessLineId,
      'businessLine.role.read',
    );
  }

  private async ensureCanCreateBusinessLineRole(
    businessLineId: BusinessLine['id'],
    currentUser: JwtPayloadType,
  ): Promise<void> {
    await this.accessService.assertBusinessLineCapability(
      currentUser,
      businessLineId,
      'businessLine.role.create',
    );
  }

  private async ensureCanUpdateBusinessLineRole(
    businessLineId: BusinessLine['id'],
    currentUser: JwtPayloadType,
  ): Promise<void> {
    await this.accessService.assertBusinessLineCapability(
      currentUser,
      businessLineId,
      'businessLine.role.update',
    );
  }

  private async ensureCanDeleteBusinessLineRole(
    businessLineId: BusinessLine['id'],
    currentUser: JwtPayloadType,
  ): Promise<void> {
    await this.accessService.assertBusinessLineCapability(
      currentUser,
      businessLineId,
      'businessLine.role.delete',
    );
  }

  private async ensureCanReadProjectRole(
    businessLineId: BusinessLine['id'],
    currentUser: JwtPayloadType,
  ): Promise<void> {
    await this.accessService.assertBusinessLineCapability(
      currentUser,
      businessLineId,
      'businessLine.projectRole.read',
    );
  }

  private async ensureCanCreateProjectRole(
    businessLineId: BusinessLine['id'],
    currentUser: JwtPayloadType,
  ): Promise<void> {
    await this.accessService.assertBusinessLineCapability(
      currentUser,
      businessLineId,
      'businessLine.projectRole.create',
    );
  }

  private async ensureCanUpdateProjectRole(
    businessLineId: BusinessLine['id'],
    currentUser: JwtPayloadType,
  ): Promise<void> {
    await this.accessService.assertBusinessLineCapability(
      currentUser,
      businessLineId,
      'businessLine.projectRole.update',
    );
  }

  private async ensureCanDeleteProjectRole(
    businessLineId: BusinessLine['id'],
    currentUser: JwtPayloadType,
  ): Promise<void> {
    await this.accessService.assertBusinessLineCapability(
      currentUser,
      businessLineId,
      'businessLine.projectRole.delete',
    );
  }

  private async ensureCanReadAgentCli(
    businessLineId: BusinessLine['id'],
    currentUser: JwtPayloadType,
  ): Promise<void> {
    await this.accessService.assertBusinessLineCapability(
      currentUser,
      businessLineId,
      'businessLine.agentCli.read',
    );
  }

  private async ensureCanCreateAgentCli(
    businessLineId: BusinessLine['id'],
    currentUser: JwtPayloadType,
  ): Promise<void> {
    await this.accessService.assertBusinessLineCapability(
      currentUser,
      businessLineId,
      'businessLine.agentCli.create',
    );
  }

  private async ensureCanUpdateAgentCli(
    businessLineId: BusinessLine['id'],
    currentUser: JwtPayloadType,
  ): Promise<void> {
    await this.accessService.assertBusinessLineCapability(
      currentUser,
      businessLineId,
      'businessLine.agentCli.update',
    );
  }

  private async ensureCanDeleteAgentCli(
    businessLineId: BusinessLine['id'],
    currentUser: JwtPayloadType,
  ): Promise<void> {
    await this.accessService.assertBusinessLineCapability(
      currentUser,
      businessLineId,
      'businessLine.agentCli.delete',
    );
  }

  private async ensureCanReadSkills(
    businessLineId: BusinessLine['id'],
    currentUser: JwtPayloadType,
  ): Promise<void> {
    await this.accessService.assertBusinessLineCapability(
      currentUser,
      businessLineId,
      'businessLine.skill.read',
    );
  }

  private async ensureCanUploadSkills(
    businessLineId: BusinessLine['id'],
    currentUser: JwtPayloadType,
  ): Promise<void> {
    await this.accessService.assertBusinessLineCapability(
      currentUser,
      businessLineId,
      'businessLine.skill.upload',
    );
  }

  private async ensureCanDeleteSkills(
    businessLineId: BusinessLine['id'],
    currentUser: JwtPayloadType,
  ): Promise<void> {
    await this.accessService.assertBusinessLineCapability(
      currentUser,
      businessLineId,
      'businessLine.skill.delete',
    );
  }

  private async ensureCanReadMcp(
    businessLineId: BusinessLine['id'],
    currentUser: JwtPayloadType,
  ): Promise<void> {
    await this.accessService.assertBusinessLineCapability(
      currentUser,
      businessLineId,
      'businessLine.mcp.read',
    );
  }

  private async ensureCanManageMcp(
    businessLineId: BusinessLine['id'],
    currentUser: JwtPayloadType,
  ): Promise<void> {
    await this.accessService.assertBusinessLineCapability(
      currentUser,
      businessLineId,
      'businessLine.mcp.manage',
    );
  }

  private async ensureBusinessLineExists(
    businessLineId: BusinessLine['id'],
  ): Promise<void> {
    const businessLine =
      await this.businessLineRepository.findById(businessLineId);

    if (!businessLine) {
      throw new NotFoundException('Business line not found');
    }
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    );
  }

  private parseSkillDescriptorYaml(content: string): {
    name: string | null;
    description: string | null;
  } {
    const yamlFrontmatterMatch = content.match(
      /^---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/,
    );
    if (!yamlFrontmatterMatch?.[1]) {
      return { name: null, description: null };
    }

    const yamlKeyValueMap = this.parseSimpleYamlFrontmatter(
      yamlFrontmatterMatch[1],
    );

    return {
      name: this.normalizeOptionalText(yamlKeyValueMap.name),
      description: this.normalizeOptionalText(yamlKeyValueMap.description),
    };
  }

  private parseSimpleYamlFrontmatter(content: string): Record<string, string> {
    const result: Record<string, string> = {};

    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) {
        continue;
      }

      const delimiterIndex = line.indexOf(':');
      if (delimiterIndex <= 0) {
        continue;
      }

      const key = line.slice(0, delimiterIndex).trim();
      const value = this.stripWrappedQuotes(
        line.slice(delimiterIndex + 1).trim(),
      );
      if (!key || !value) {
        continue;
      }

      result[key] = value;
    }

    return result;
  }

  private stripWrappedQuotes(value: string): string {
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      return value.slice(1, -1).trim();
    }

    return value;
  }

  private normalizeOptionalText(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  private toSafeSkillDirectoryName(skillName: string): string {
    return skillName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private normalizeArchiveEntryPath(rawPath: string): string {
    return rawPath
      .replace(/\\/g, '/')
      .replace(/^\.\/+/, '')
      .replace(/\/+/g, '/')
      .trim();
  }

  private ensureArchiveEntriesSafe(entries: string[]): void {
    if (entries.length === 0) {
      throw new BadRequestException('Skill package is empty');
    }

    for (const rawEntry of entries) {
      const entry = this.normalizeArchiveEntryPath(rawEntry);
      if (!entry) {
        continue;
      }

      if (entry.includes('\u0000')) {
        throw new BadRequestException('Skill package contains invalid path');
      }

      if (entry.startsWith('/') || entry.startsWith('~')) {
        throw new BadRequestException('Skill package contains unsafe path');
      }

      const segments = entry.split('/').filter(Boolean);
      if (segments.some((segment) => segment === '..')) {
        throw new BadRequestException(
          'Skill package contains path traversal entry',
        );
      }
    }
  }

  private resolveSkillPackageRoot(entries: string[]): {
    descriptorEntry: string;
    rootDirPath: string;
  } | null {
    const normalizedEntries = entries
      .map((item) => this.normalizeArchiveEntryPath(item))
      .filter(Boolean);

    const validFileEntries = normalizedEntries.filter(
      (item) =>
        !item.endsWith('/') &&
        !item.startsWith('__MACOSX/') &&
        item !== '.DS_Store',
    );

    if (validFileEntries.includes('SKILL.md')) {
      return {
        descriptorEntry: 'SKILL.md',
        rootDirPath: '',
      };
    }

    const skillEntriesInSubDirectory = validFileEntries.filter((entry) =>
      /^[^/]+\/SKILL\.md$/.test(entry),
    );
    if (skillEntriesInSubDirectory.length === 0) {
      return null;
    }

    const rootDirCandidates = Array.from(
      new Set(
        skillEntriesInSubDirectory.map((entry) =>
          entry.slice(0, entry.indexOf('/')),
        ),
      ),
    );

    if (rootDirCandidates.length !== 1) {
      return null;
    }

    const rootDirPath = rootDirCandidates[0];
    if (!rootDirPath) {
      return null;
    }

    const hasOutsideRootFiles = validFileEntries.some((entry) => {
      return entry !== rootDirPath && !entry.startsWith(`${rootDirPath}/`);
    });
    if (hasOutsideRootFiles) {
      return null;
    }

    return {
      descriptorEntry: `${rootDirPath}/SKILL.md`,
      rootDirPath,
    };
  }

  private async listArchiveEntries(archivePath: string): Promise<string[]> {
    const commandResult = await this.runCommand('unzip', ['-Z1', archivePath]);
    if (!commandResult.success) {
      throw new BadRequestException('Invalid skill package archive');
    }

    return commandResult.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  private async extractArchiveToDirectory(
    archivePath: string,
    directoryPath: string,
  ): Promise<void> {
    const commandResult = await this.runCommand('unzip', [
      '-oq',
      archivePath,
      '-d',
      directoryPath,
    ]);
    if (!commandResult.success) {
      throw new BadRequestException('Failed to extract skill package');
    }
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
      }, BusinessLinesService.SKILL_UPLOAD_COMMAND_TIMEOUT_MS);

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

  private async readLocalMcpConfig(
    targetMcpConfigPath: string,
  ): Promise<Record<string, unknown>> {
    try {
      const content = await fs.readFile(targetMcpConfigPath, 'utf-8');
      const parsed = JSON.parse(content);
      if (this.isObjectRecord(parsed)) {
        return parsed;
      }
      return {};
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
        return {};
      }

      throw new BadRequestException(
        error instanceof Error
          ? `Invalid local MCP config JSON: ${error.message}`
          : 'Invalid local MCP config JSON',
      );
    }
  }

  private resolveMcpServersFromPayload(
    payload: Record<string, unknown>,
  ): Record<string, Record<string, unknown>> {
    if (!this.isObjectRecord(payload.mcpServers)) {
      return {};
    }

    const result: Record<string, Record<string, unknown>> = {};
    for (const [serverName, serverValue] of Object.entries(
      payload.mcpServers,
    )) {
      if (!this.isObjectRecord(serverValue)) {
        continue;
      }
      result[serverName] = { ...serverValue };
    }

    return result;
  }

  private buildLocalMcpServerConfig(params: {
    transportType: 'stdio' | 'http' | 'sse';
    command?: string;
    args: string[];
    env: Record<string, string>;
    url?: string;
    headers: Record<string, string>;
  }): Record<string, unknown> {
    if (params.transportType === 'stdio') {
      return {
        command: params.command,
        ...(params.args.length > 0 ? { args: params.args } : {}),
        ...(Object.keys(params.env).length > 0 ? { env: params.env } : {}),
      };
    }

    return {
      url: params.url,
      ...(params.transportType === 'sse' ? { type: 'sse' } : {}),
      ...(Object.keys(params.headers).length > 0
        ? {
            headers: params.headers,
          }
        : {}),
    };
  }

  private resolveImportedMcpServers(
    payload: Record<string, unknown>,
  ): Record<string, unknown> {
    if (this.isObjectRecord(payload.mcpServers)) {
      return payload.mcpServers;
    }

    return payload;
  }

  private normalizeImportedMcpServerConfig(
    value: unknown,
    serverName: string,
  ): Record<string, unknown> {
    if (!this.isObjectRecord(value)) {
      throw new BadRequestException(
        `Invalid MCP config for server "${serverName}"`,
      );
    }

    const url = this.normalizeOptionalText(value.url);
    if (url) {
      const type = this.normalizeOptionalText(value.type)?.toLowerCase();
      if (type && type !== 'http' && type !== 'sse') {
        throw new BadRequestException(
          `Invalid MCP type for server "${serverName}"`,
        );
      }

      const headers = this.normalizeStringMap(value.headers);
      const description = this.normalizeOptionalText(value.description);
      return {
        url,
        ...(type === 'sse' ? { type: 'sse' } : {}),
        ...(Object.keys(headers).length > 0 ? { headers } : {}),
        ...(description ? { description } : {}),
      };
    }

    const command = this.normalizeOptionalText(value.command);
    if (!command) {
      throw new BadRequestException(
        `MCP server "${serverName}" must include command or url`,
      );
    }

    const args = this.normalizeStringArray(value.args, serverName);
    const env = this.normalizeStringMap(value.env);
    const description = this.normalizeOptionalText(value.description);

    return {
      command,
      ...(args.length > 0 ? { args } : {}),
      ...(Object.keys(env).length > 0 ? { env } : {}),
      ...(description ? { description } : {}),
    };
  }

  private normalizeStringArray(value: unknown, serverName: string): string[] {
    if (value === undefined || value === null) {
      return [];
    }

    if (!Array.isArray(value)) {
      throw new BadRequestException(
        `Invalid MCP args for server "${serverName}"`,
      );
    }

    return value
      .map((item) => {
        if (typeof item !== 'string') {
          throw new BadRequestException(
            `Invalid MCP args for server "${serverName}"`,
          );
        }
        return item.trim();
      })
      .filter(Boolean);
  }

  private normalizeStringMap(value: unknown): Record<string, string> {
    if (!this.isObjectRecord(value)) {
      return {};
    }

    const result: Record<string, string> = {};
    for (const [key, entry] of Object.entries(value)) {
      const normalizedKey = key.trim();
      if (!normalizedKey || typeof entry !== 'string') {
        continue;
      }

      result[normalizedKey] = entry;
    }

    return result;
  }

  private isObjectRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  private isPathWithin(rootPath: string, targetPath: string): boolean {
    const relativePath = path.relative(rootPath, targetPath);
    if (!relativePath) {
      return true;
    }

    return !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
  }

  private async safeStat(
    targetPath: string,
  ): Promise<import('fs').Stats | null> {
    try {
      return await fs.stat(targetPath);
    } catch {
      return null;
    }
  }

  private normalizeToolId(value: string): string {
    const normalized = value.trim().toLowerCase();

    if (!normalized) {
      throw new BadRequestException('Invalid tool id');
    }

    return BusinessLinesService.TOOL_ID_ALIASES[normalized] ?? normalized;
  }
}
