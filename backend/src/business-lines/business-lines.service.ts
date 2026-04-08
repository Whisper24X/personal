import { Injectable } from '@nestjs/common';
import type { Express } from 'express';
import { AccessService } from '../access/access.service';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { ProjectCustomRole } from '../projects/domain/project-custom-role';
import { CreateProjectCustomRoleDto } from '../projects/dto/create-project-custom-role.dto';
import { UpdateProjectCustomRoleDto } from '../projects/dto/update-project-custom-role.dto';
import { NullableType } from '../utils/types/nullable.type';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { BusinessLineAgentToolConfigService } from './business-line-agent-tool-config.service';
import { BusinessLineLifecycleService } from './business-line-lifecycle.service';
import { BusinessLineLocalAssetsService } from './business-line-local-assets.service';
import { BusinessLineMembershipService } from './business-line-membership.service';
import { BusinessLineRoleCatalogService } from './business-line-role-catalog.service';
import { AcceptBusinessLineInviteDto } from './dto/accept-business-line-invite.dto';
import { AcceptBusinessLineInviteResponseDto } from './dto/accept-business-line-invite-response.dto';
import { CreateAgentToolConfigDto } from './dto/create-agent-tool-config.dto';
import { CreateBusinessLineCustomRoleDto } from './dto/create-business-line-custom-role.dto';
import { CreateBusinessLineDto } from './dto/create-business-line.dto';
import { CreateBusinessLineInviteDto } from './dto/create-business-line-invite.dto';
import { CreateBusinessLineMemberDto } from './dto/create-business-line-member.dto';
import { CreateLocalMcpDto } from './dto/create-local-mcp.dto';
import { GetLocalMcpConfigDto } from './dto/get-local-mcp-config.dto';
import { ImportLocalMcpsDto } from './dto/import-local-mcps.dto';
import { ImportLocalMcpsResultDto } from './dto/import-local-mcps-result.dto';
import { LocalMcpConfigDto } from './dto/local-mcp-config.dto';
import { LocalSkillContentDto } from './dto/local-skill-content.dto';
import { UpdateAgentToolConfigDto } from './dto/update-agent-tool-config.dto';
import { UpdateBusinessLineCustomRoleDto } from './dto/update-business-line-custom-role.dto';
import { UpdateBusinessLineDto } from './dto/update-business-line.dto';
import { UpdateBusinessLineMemberDto } from './dto/update-business-line-member.dto';
import { UploadLocalSkillResultDto } from './dto/upload-local-skill-result.dto';
import { AgentToolConfig } from './domain/agent-tool-config';
import { BusinessLineCustomRole } from './domain/business-line-custom-role';
import { BusinessLineInviteDto } from './dto/business-line-invite.dto';
import { BusinessLineMember } from './domain/business-line-member';
import { BusinessLine } from './domain/business-line';
import { Mcp } from '../mcps/domain/mcp';
import { Skill } from '../skills/domain/skill';
import { type SkillTreeNode } from '../utils/local-agent-catalog';

@Injectable()
export class BusinessLinesService {
  constructor(
    private readonly accessService: AccessService,
    private readonly businessLineLifecycleService: BusinessLineLifecycleService,
    private readonly businessLineMembershipService: BusinessLineMembershipService,
    private readonly businessLineRoleCatalogService: BusinessLineRoleCatalogService,
    private readonly businessLineAgentToolConfigService: BusinessLineAgentToolConfigService,
    private readonly businessLineLocalAssetsService: BusinessLineLocalAssetsService,
  ) {}

  async create(
    createBusinessLineDto: CreateBusinessLineDto,
    currentUser: JwtPayloadType,
  ): Promise<BusinessLine> {
    return this.businessLineLifecycleService.create(
      createBusinessLineDto,
      currentUser,
    );
  }

  findAllWithPagination(args: {
    currentUser: JwtPayloadType;
    paginationOptions: IPaginationOptions;
  }): Promise<BusinessLine[]> {
    return this.businessLineLifecycleService.findAllWithPagination(args);
  }

  findById(
    id: BusinessLine['id'],
    _currentUser: JwtPayloadType,
  ): Promise<BusinessLine | null> {
    void _currentUser;
    return this.businessLineLifecycleService.findById(id);
  }

  findByIds(ids: BusinessLine['id'][]): Promise<BusinessLine[]> {
    return this.businessLineLifecycleService.findByIds(ids);
  }

  async update(
    id: BusinessLine['id'],
    updateBusinessLineDto: UpdateBusinessLineDto,
    currentUser: JwtPayloadType,
  ): Promise<BusinessLine | null> {
    await this.ensureCanManageBusinessLine(id, currentUser);

    return this.businessLineLifecycleService.update(id, updateBusinessLineDto);
  }

  async remove(
    id: BusinessLine['id'],
    currentUser: JwtPayloadType,
  ): Promise<void> {
    await this.ensureCanManageBusinessLine(id, currentUser);

    await this.businessLineLifecycleService.remove(id);
  }

  async findMembers(
    businessLineId: BusinessLine['id'],
    currentUser: JwtPayloadType,
  ): Promise<BusinessLineMember[]> {
    await this.ensureCanReadMembers(businessLineId, currentUser);

    return this.businessLineMembershipService.findMembers(businessLineId);
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

    return this.businessLineMembershipService.addMember({
      businessLineId,
      createBusinessLineMemberDto,
      actorMember,
      currentUser,
    });
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

    return this.businessLineMembershipService.createInvite({
      businessLineId,
      createBusinessLineInviteDto,
      actorMember,
      currentUser,
    });
  }

  async findLatestInvite(
    businessLineId: BusinessLine['id'],
    currentUser: JwtPayloadType,
  ): Promise<NullableType<BusinessLineInviteDto>> {
    await this.ensureCanInviteMembers(businessLineId, currentUser);

    return this.businessLineMembershipService.findLatestInvite(businessLineId);
  }

  acceptInvite(
    acceptBusinessLineInviteDto: AcceptBusinessLineInviteDto,
    currentUser: JwtPayloadType,
  ): Promise<AcceptBusinessLineInviteResponseDto> {
    return this.businessLineMembershipService.acceptInvite(
      acceptBusinessLineInviteDto,
      currentUser,
    );
  }

  async findMemberProjectRoles(
    businessLineId: BusinessLine['id'],
    userId: string,
    currentUser: JwtPayloadType,
  ): Promise<{ projectRoles: Record<string, string> }> {
    await this.ensureCanReadMembers(businessLineId, currentUser);

    return this.businessLineMembershipService.findMemberProjectRoles(
      businessLineId,
      userId,
    );
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

    return this.businessLineMembershipService.updateMemberRole({
      businessLineId,
      userId,
      updateBusinessLineMemberDto,
      actorMember,
      currentUser,
    });
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

    await this.businessLineMembershipService.removeMember({
      businessLineId,
      userId,
      actorMember,
      currentUser,
    });
  }

  async findCustomRoles(
    businessLineId: BusinessLine['id'],
    currentUser: JwtPayloadType,
  ): Promise<BusinessLineCustomRole[]> {
    await this.ensureCanReadBusinessLineRole(businessLineId, currentUser);

    return this.businessLineRoleCatalogService.findCustomRoles(businessLineId);
  }

  findCustomRoleLibrary(
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

    return this.businessLineRoleCatalogService.createCustomRole(
      businessLineId,
      createBusinessLineCustomRoleDto,
    );
  }

  async updateCustomRole(
    businessLineId: BusinessLine['id'],
    roleId: string,
    updateBusinessLineCustomRoleDto: UpdateBusinessLineCustomRoleDto,
    currentUser: JwtPayloadType,
  ): Promise<BusinessLineCustomRole> {
    await this.ensureCanUpdateBusinessLineRole(businessLineId, currentUser);

    return this.businessLineRoleCatalogService.updateCustomRole(
      businessLineId,
      roleId,
      updateBusinessLineCustomRoleDto,
    );
  }

  async removeCustomRole(
    businessLineId: BusinessLine['id'],
    roleId: string,
    currentUser: JwtPayloadType,
  ): Promise<void> {
    await this.ensureCanDeleteBusinessLineRole(businessLineId, currentUser);

    await this.businessLineRoleCatalogService.removeCustomRole(
      businessLineId,
      roleId,
    );
  }

  async findProjectCustomRoles(
    businessLineId: BusinessLine['id'],
    currentUser: JwtPayloadType,
  ): Promise<ProjectCustomRole[]> {
    await this.ensureCanReadProjectRole(businessLineId, currentUser);

    return this.businessLineRoleCatalogService.findProjectCustomRoles(
      businessLineId,
    );
  }

  async createProjectCustomRole(
    businessLineId: BusinessLine['id'],
    createProjectCustomRoleDto: CreateProjectCustomRoleDto,
    currentUser: JwtPayloadType,
  ): Promise<ProjectCustomRole> {
    await this.ensureCanCreateProjectRole(businessLineId, currentUser);

    return this.businessLineRoleCatalogService.createProjectCustomRole(
      businessLineId,
      createProjectCustomRoleDto,
    );
  }

  async updateProjectCustomRole(
    businessLineId: BusinessLine['id'],
    roleId: string,
    updateProjectCustomRoleDto: UpdateProjectCustomRoleDto,
    currentUser: JwtPayloadType,
  ): Promise<ProjectCustomRole> {
    await this.ensureCanUpdateProjectRole(businessLineId, currentUser);

    return this.businessLineRoleCatalogService.updateProjectCustomRole(
      businessLineId,
      roleId,
      updateProjectCustomRoleDto,
    );
  }

  async removeProjectCustomRole(
    businessLineId: BusinessLine['id'],
    roleId: string,
    currentUser: JwtPayloadType,
  ): Promise<void> {
    await this.ensureCanDeleteProjectRole(businessLineId, currentUser);

    await this.businessLineRoleCatalogService.removeProjectCustomRole(
      businessLineId,
      roleId,
    );
  }

  async findAgentToolConfigs(
    businessLineId: BusinessLine['id'],
    currentUser: JwtPayloadType,
    toolId?: string,
  ): Promise<AgentToolConfig[]> {
    await this.ensureCanReadAgentCli(businessLineId, currentUser);

    return this.businessLineAgentToolConfigService.findAgentToolConfigs(
      businessLineId,
      toolId,
    );
  }

  async findLocalSkills(
    businessLineId: BusinessLine['id'],
    currentUser: JwtPayloadType,
    keyword?: string,
  ): Promise<Skill[]> {
    await this.ensureCanReadSkills(businessLineId, currentUser);

    return this.businessLineLocalAssetsService.findLocalSkills(
      businessLineId,
      keyword,
    );
  }

  async findLocalSkillContent(
    businessLineId: BusinessLine['id'],
    skillId: string,
    currentUser: JwtPayloadType,
  ): Promise<LocalSkillContentDto> {
    await this.ensureCanReadSkills(businessLineId, currentUser);

    return this.businessLineLocalAssetsService.findLocalSkillContent(
      businessLineId,
      skillId,
    );
  }

  async findLocalSkillTree(
    businessLineId: BusinessLine['id'],
    skillId: string,
    currentUser: JwtPayloadType,
  ): Promise<{ id: string; name: string; tree: SkillTreeNode[] }> {
    await this.ensureCanReadSkills(businessLineId, currentUser);

    return this.businessLineLocalAssetsService.findLocalSkillTree(
      businessLineId,
      skillId,
    );
  }

  async findLocalSkillFile(
    businessLineId: BusinessLine['id'],
    skillId: string,
    filePath: string,
    currentUser: JwtPayloadType,
  ): Promise<{ path: string; content: string }> {
    await this.ensureCanReadSkills(businessLineId, currentUser);

    return this.businessLineLocalAssetsService.findLocalSkillFile(
      businessLineId,
      skillId,
      filePath,
    );
  }

  async downloadLocalSkill(
    businessLineId: BusinessLine['id'],
    skillId: string,
    currentUser: JwtPayloadType,
  ): Promise<{ buffer: Buffer; fileName: string }> {
    await this.ensureCanReadSkills(businessLineId, currentUser);

    return this.businessLineLocalAssetsService.downloadLocalSkill(
      businessLineId,
      skillId,
    );
  }

  async removeLocalSkill(
    businessLineId: BusinessLine['id'],
    skillId: string,
    currentUser: JwtPayloadType,
  ): Promise<void> {
    await this.ensureCanDeleteSkills(businessLineId, currentUser);

    await this.businessLineLocalAssetsService.removeLocalSkill(
      businessLineId,
      skillId,
    );
  }

  async findLocalMcps(
    businessLineId: BusinessLine['id'],
    currentUser: JwtPayloadType,
  ): Promise<Mcp[]> {
    await this.ensureCanReadMcp(businessLineId, currentUser);

    return this.businessLineLocalAssetsService.findLocalMcps(businessLineId);
  }

  async getLocalMcpConfig(
    businessLineId: BusinessLine['id'],
    query: GetLocalMcpConfigDto,
    currentUser: JwtPayloadType,
  ): Promise<LocalMcpConfigDto> {
    await this.ensureCanReadMcp(businessLineId, currentUser);

    return this.businessLineLocalAssetsService.getLocalMcpConfig(
      businessLineId,
      query,
    );
  }

  async createLocalMcp(
    businessLineId: BusinessLine['id'],
    createLocalMcpDto: CreateLocalMcpDto,
    currentUser: JwtPayloadType,
  ): Promise<Mcp> {
    await this.ensureCanManageMcp(businessLineId, currentUser);

    return this.businessLineLocalAssetsService.createLocalMcp(
      businessLineId,
      createLocalMcpDto,
    );
  }

  async removeLocalMcp(
    businessLineId: BusinessLine['id'],
    query: GetLocalMcpConfigDto,
    currentUser: JwtPayloadType,
  ): Promise<void> {
    await this.ensureCanManageMcp(businessLineId, currentUser);

    await this.businessLineLocalAssetsService.removeLocalMcp(
      businessLineId,
      query,
    );
  }

  async importLocalMcps(
    businessLineId: BusinessLine['id'],
    importLocalMcpsDto: ImportLocalMcpsDto,
    currentUser: JwtPayloadType,
  ): Promise<ImportLocalMcpsResultDto> {
    await this.ensureCanManageMcp(businessLineId, currentUser);

    return this.businessLineLocalAssetsService.importLocalMcps(
      businessLineId,
      importLocalMcpsDto,
    );
  }

  async uploadLocalSkill(
    businessLineId: BusinessLine['id'],
    file: Express.Multer.File | undefined,
    currentUser: JwtPayloadType,
  ): Promise<UploadLocalSkillResultDto> {
    await this.ensureCanUploadSkills(businessLineId, currentUser);

    return this.businessLineLocalAssetsService.uploadLocalSkill(
      businessLineId,
      file,
    );
  }

  async createAgentToolConfig(
    businessLineId: BusinessLine['id'],
    createAgentToolConfigDto: CreateAgentToolConfigDto,
    currentUser: JwtPayloadType,
  ): Promise<AgentToolConfig> {
    await this.ensureCanCreateAgentCli(businessLineId, currentUser);

    return this.businessLineAgentToolConfigService.createAgentToolConfig(
      businessLineId,
      createAgentToolConfigDto,
    );
  }

  async updateAgentToolConfig(
    businessLineId: BusinessLine['id'],
    configId: AgentToolConfig['id'],
    updateAgentToolConfigDto: UpdateAgentToolConfigDto,
    currentUser: JwtPayloadType,
  ): Promise<AgentToolConfig> {
    await this.ensureCanUpdateAgentCli(businessLineId, currentUser);

    return this.businessLineAgentToolConfigService.updateAgentToolConfig(
      businessLineId,
      configId,
      updateAgentToolConfigDto,
    );
  }

  async removeAgentToolConfig(
    businessLineId: BusinessLine['id'],
    configId: AgentToolConfig['id'],
    currentUser: JwtPayloadType,
  ): Promise<void> {
    await this.ensureCanDeleteAgentCli(businessLineId, currentUser);

    await this.businessLineAgentToolConfigService.removeAgentToolConfig(
      businessLineId,
      configId,
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

    return this.findActorMemberIfNeeded(businessLineId, currentUser);
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

    return this.findActorMemberIfNeeded(businessLineId, currentUser);
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

    return this.findActorMemberIfNeeded(businessLineId, currentUser);
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

  private async findActorMemberIfNeeded(
    businessLineId: BusinessLine['id'],
    currentUser: JwtPayloadType,
  ): Promise<BusinessLineMember | null> {
    if (this.isAdmin(currentUser)) {
      return null;
    }

    return this.businessLineMembershipService.findMemberByBusinessLineIdAndUserId(
      businessLineId,
      currentUser.sub,
    );
  }

  private isAdmin(currentUser: JwtPayloadType): boolean {
    return currentUser.roles?.includes('admin') ?? false;
  }
}
