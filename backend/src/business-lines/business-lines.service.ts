import {
  // common
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
import { ProjectMemberRole } from '../projects/dto/project-member-role.enum';
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

@Injectable()
export class BusinessLinesService {
  private static readonly INVITE_TOKEN_EXPIRES_IN: ms.StringValue = '7d';
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
    private readonly agentToolConfigRepository: AgentToolConfigRepository,
  ) {}

  async create(
    createBusinessLineDto: CreateBusinessLineDto,
    currentUser: JwtPayloadType,
  ): Promise<BusinessLine> {
    // Do not remove comment below.
    // <creating-property />

    this.ensureAdmin(currentUser);

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

    await this.businessLineMemberRepository.create({
      businessLineId: businessLine.id,
      userId: currentUser.sub,
      role: BusinessLineMemberRole.owner,
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
    await this.ensureCanAccessBusinessLine(businessLineId, currentUser);

    return this.businessLineMemberRepository.findByBusinessLineId(
      businessLineId,
    );
  }

  async addMember(
    businessLineId: BusinessLine['id'],
    createBusinessLineMemberDto: CreateBusinessLineMemberDto,
    currentUser: JwtPayloadType,
  ): Promise<BusinessLineMember> {
    const actorMember = await this.ensureCanManageBusinessLineMembers(
      businessLineId,
      currentUser,
    );

    this.ensureActorCanManageMemberMutation({
      currentUser,
      actorMember,
      nextRole: createBusinessLineMemberDto.role,
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

    return this.businessLineMemberRepository.create({
      businessLineId,
      userId: createBusinessLineMemberDto.userId,
      role: createBusinessLineMemberDto.role,
    });
  }

  async createInvite(
    businessLineId: BusinessLine['id'],
    createBusinessLineInviteDto: CreateBusinessLineInviteDto,
    currentUser: JwtPayloadType,
  ): Promise<BusinessLineInviteDto> {
    const actorMember = await this.ensureCanManageBusinessLineMembers(
      businessLineId,
      currentUser,
    );

    this.ensureActorCanManageMemberMutation({
      currentUser,
      actorMember,
      nextRole: createBusinessLineInviteDto.role,
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
      role: createBusinessLineInviteDto.role,
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
    await this.ensureCanManageBusinessLineMembers(businessLineId, currentUser);

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
      role: invitation.role,
    });

    const failedProjects = await this.syncInviteProjectRoles({
      businessLineId: invitation.businessLineId,
      userId: currentUser.sub,
      projectRoles: invitation.projectRoles,
    });

    return {
      member,
      failedProjects,
    };
  }

  async updateMemberRole(
    businessLineId: BusinessLine['id'],
    userId: string,
    updateBusinessLineMemberDto: UpdateBusinessLineMemberDto,
    currentUser: JwtPayloadType,
  ): Promise<BusinessLineMember> {
    const actorMember = await this.ensureCanManageBusinessLineMembers(
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

    this.ensureActorCanManageMemberMutation({
      currentUser,
      actorMember,
      targetMember: currentMember,
      nextRole: updateBusinessLineMemberDto.role,
    });

    if (
      currentMember.role === BusinessLineMemberRole.owner &&
      updateBusinessLineMemberDto.role !== BusinessLineMemberRole.owner
    ) {
      this.ensureOwnerSelfProtection(currentMember, currentUser);
      await this.ensureOwnerCanBeModified(businessLineId);
    }

    const updatedMember = await this.businessLineMemberRepository.update(
      businessLineId,
      userId,
      {
        role: updateBusinessLineMemberDto.role,
      },
    );

    if (!updatedMember) {
      throw new NotFoundException('Business line member not found');
    }

    return updatedMember;
  }

  async removeMember(
    businessLineId: BusinessLine['id'],
    userId: string,
    currentUser: JwtPayloadType,
  ): Promise<void> {
    const actorMember = await this.ensureCanManageBusinessLineMembers(
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

    this.ensureActorCanManageMemberMutation({
      currentUser,
      actorMember,
      targetMember: existedMember,
    });

    if (existedMember.role === BusinessLineMemberRole.owner) {
      this.ensureOwnerSelfProtection(existedMember, currentUser);
      await this.ensureOwnerCanBeModified(businessLineId);
    }

    await this.businessLineMemberRepository.remove(businessLineId, userId);
  }

  async findAgentToolConfigs(
    businessLineId: BusinessLine['id'],
    currentUser: JwtPayloadType,
    toolId?: string,
  ): Promise<AgentToolConfig[]> {
    await this.ensureCanManageBusinessLineMembers(businessLineId, currentUser);

    return this.agentToolConfigRepository.findByBusinessLineId(
      businessLineId,
      toolId ? this.normalizeToolId(toolId) : undefined,
    );
  }

  async createAgentToolConfig(
    businessLineId: BusinessLine['id'],
    createAgentToolConfigDto: CreateAgentToolConfigDto,
    currentUser: JwtPayloadType,
  ): Promise<AgentToolConfig> {
    await this.ensureCanManageBusinessLineMembers(businessLineId, currentUser);

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
    await this.ensureCanManageBusinessLineMembers(businessLineId, currentUser);

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
    await this.ensureCanManageBusinessLineMembers(businessLineId, currentUser);

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

    const ownerCount = members.filter(
      (member) => member.role === BusinessLineMemberRole.owner,
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

  private ensureActorCanManageMemberMutation({
    currentUser,
    actorMember,
    targetMember,
    nextRole,
  }: {
    currentUser: JwtPayloadType;
    actorMember: BusinessLineMember | null;
    targetMember?: BusinessLineMember;
    nextRole?: BusinessLineMemberRole;
  }): void {
    if (this.isAdmin(currentUser)) {
      return;
    }

    if (!actorMember) {
      throw new ForbiddenException('forbiddenBusinessLineManage');
    }

    if (actorMember.role === BusinessLineMemberRole.owner) {
      return;
    }

    if (actorMember.role !== BusinessLineMemberRole.admin) {
      throw new ForbiddenException('forbiddenBusinessLineManage');
    }

    if (targetMember?.role === BusinessLineMemberRole.owner) {
      throw new ForbiddenException('forbiddenBusinessLineManage');
    }

    if (nextRole === BusinessLineMemberRole.owner) {
      throw new ForbiddenException('forbiddenBusinessLineManage');
    }
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

  private async syncInviteProjectRoles({
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
      if (role === BusinessLineInviteProjectRole.none) {
        continue;
      }

      const nextRole = this.mapInviteProjectRoleToProjectRole(role);
      if (!nextRole) {
        continue;
      }

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

        if (!existedMember) {
          await this.projectMemberRepository.create({
            projectId,
            userId,
            role: nextRole,
          });
          continue;
        }

        if (existedMember.role === ProjectMemberRole.owner) {
          continue;
        }

        if (existedMember.role !== nextRole) {
          await this.projectMemberRepository.update(projectId, userId, {
            role: nextRole,
          });
        }
      } catch (error) {
        void error;
        failedProjects.push(projectId);
      }
    }

    return failedProjects;
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

  private mapInvitationToInviteDto(
    invitation: BusinessLineInvitation,
  ): BusinessLineInviteDto {
    return {
      token: invitation.token,
      expiresAt: invitation.expiresAt.toISOString(),
      businessLineId: invitation.businessLineId,
      role: invitation.role,
      projectRoles: invitation.projectRoles,
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

  private ensureAdmin(currentUser: JwtPayloadType): void {
    if (!this.isAdmin(currentUser)) {
      throw new ForbiddenException('forbiddenBusinessLineManage');
    }
  }

  private async ensureCanAccessBusinessLine(
    businessLineId: BusinessLine['id'],
    currentUser: JwtPayloadType,
  ): Promise<void> {
    await this.ensureBusinessLineExists(businessLineId);

    if (this.isAdmin(currentUser)) {
      return;
    }

    const member =
      await this.businessLineMemberRepository.findByBusinessLineIdAndUserId(
        businessLineId,
        currentUser.sub,
      );

    if (!member) {
      throw new ForbiddenException('forbiddenBusinessLine');
    }
  }

  private async ensureCanManageBusinessLine(
    businessLineId: BusinessLine['id'],
    currentUser: JwtPayloadType,
  ): Promise<void> {
    await this.ensureBusinessLineExists(businessLineId);

    if (this.isAdmin(currentUser)) {
      return;
    }

    const member =
      await this.businessLineMemberRepository.findByBusinessLineIdAndUserId(
        businessLineId,
        currentUser.sub,
      );

    if (!member) {
      throw new ForbiddenException('forbiddenBusinessLine');
    }

    if (member.role !== BusinessLineMemberRole.owner) {
      throw new ForbiddenException('forbiddenBusinessLineManage');
    }
  }

  private async ensureCanManageBusinessLineMembers(
    businessLineId: BusinessLine['id'],
    currentUser: JwtPayloadType,
  ): Promise<BusinessLineMember | null> {
    await this.ensureBusinessLineExists(businessLineId);

    if (this.isAdmin(currentUser)) {
      return null;
    }

    const member =
      await this.businessLineMemberRepository.findByBusinessLineIdAndUserId(
        businessLineId,
        currentUser.sub,
      );

    if (!member) {
      throw new ForbiddenException('forbiddenBusinessLine');
    }

    if (
      member.role !== BusinessLineMemberRole.owner &&
      member.role !== BusinessLineMemberRole.admin
    ) {
      throw new ForbiddenException('forbiddenBusinessLineManage');
    }

    return member;
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

  private normalizeToolId(value: string): string {
    const normalized = value.trim().toLowerCase();

    if (!normalized) {
      throw new BadRequestException('Invalid tool id');
    }

    return BusinessLinesService.TOOL_ID_ALIASES[normalized] ?? normalized;
  }
}
