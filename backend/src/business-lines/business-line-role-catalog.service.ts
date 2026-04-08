import { Injectable } from '@nestjs/common';
import { ProjectCustomRole } from '../projects/domain/project-custom-role';
import { ProjectMemberRole } from '../projects/dto/project-member-role.enum';
import { BusinessLineCustomRoleService } from './business-line-custom-role.service';
import { BusinessLineProjectRoleCatalogService } from './business-line-project-role-catalog.service';
import { BusinessLineRoleTemplateService } from './business-line-role-template.service';
import { BusinessLineMemberRole } from './dto/business-line-member-role.enum';
import { CreateBusinessLineCustomRoleDto } from './dto/create-business-line-custom-role.dto';
import { UpdateBusinessLineCustomRoleDto } from './dto/update-business-line-custom-role.dto';
import { BusinessLineCustomRole } from './domain/business-line-custom-role';
import { BusinessLineMember } from './domain/business-line-member';
import { UpdateProjectCustomRoleDto } from '../projects/dto/update-project-custom-role.dto';

@Injectable()
export class BusinessLineRoleCatalogService {
  constructor(
    private readonly businessLineRoleTemplateService: BusinessLineRoleTemplateService,
    private readonly businessLineCustomRoleService: BusinessLineCustomRoleService,
    private readonly businessLineProjectRoleCatalogService: BusinessLineProjectRoleCatalogService,
  ) {}

  async findCustomRoles(
    businessLineId: string,
  ): Promise<BusinessLineCustomRole[]> {
    await this.ensureDefaultBusinessLineCustomRoles(businessLineId);

    return this.businessLineCustomRoleService.findCustomRoles(businessLineId);
  }

  createCustomRole(
    businessLineId: string,
    createBusinessLineCustomRoleDto: CreateBusinessLineCustomRoleDto,
  ): Promise<BusinessLineCustomRole> {
    return this.businessLineCustomRoleService.createCustomRole(
      businessLineId,
      createBusinessLineCustomRoleDto,
    );
  }

  async updateCustomRole(
    businessLineId: string,
    roleId: string,
    updateBusinessLineCustomRoleDto: UpdateBusinessLineCustomRoleDto,
  ): Promise<BusinessLineCustomRole> {
    const currentRole =
      await this.businessLineCustomRoleService.getBusinessLineCustomRoleOrThrow(
        businessLineId,
        roleId,
      );

    return this.businessLineCustomRoleService.updateCustomRole(
      businessLineId,
      roleId,
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
    );
  }

  removeCustomRole(businessLineId: string, roleId: string): Promise<void> {
    return this.businessLineCustomRoleService.removeCustomRole(
      businessLineId,
      roleId,
    );
  }

  async findProjectCustomRoles(
    businessLineId: string,
  ): Promise<ProjectCustomRole[]> {
    await this.ensureDefaultProjectCustomRoles(businessLineId);

    return this.businessLineProjectRoleCatalogService.findProjectCustomRoles(
      businessLineId,
    );
  }

  createProjectCustomRole(
    businessLineId: string,
    input: {
      name: string;
      description?: string | null;
      capabilities?: string[];
    },
  ): Promise<ProjectCustomRole> {
    return this.businessLineProjectRoleCatalogService.createProjectCustomRole(
      businessLineId,
      input,
    );
  }

  async updateProjectCustomRole(
    businessLineId: string,
    roleId: string,
    updateProjectCustomRoleDto: UpdateProjectCustomRoleDto,
  ): Promise<ProjectCustomRole> {
    const currentRole =
      await this.businessLineProjectRoleCatalogService.getBusinessLineProjectCustomRoleOrThrow(
        businessLineId,
        roleId,
      );

    return this.businessLineProjectRoleCatalogService.updateProjectCustomRole(
      businessLineId,
      roleId,
      {
        name: updateProjectCustomRoleDto.name ?? currentRole.name,
        description:
          updateProjectCustomRoleDto.description !== undefined
            ? updateProjectCustomRoleDto.description
            : (currentRole.description ?? undefined),
        capabilities:
          updateProjectCustomRoleDto.capabilities ?? currentRole.capabilities,
      },
    );
  }

  removeProjectCustomRole(
    businessLineId: string,
    roleId: string,
  ): Promise<void> {
    return this.businessLineProjectRoleCatalogService.removeProjectCustomRole(
      businessLineId,
      roleId,
    );
  }

  ensureDefaultBusinessLineCustomRoles(
    businessLineId: string,
  ): Promise<BusinessLineCustomRole[]> {
    return this.businessLineRoleTemplateService.ensureDefaultBusinessLineCustomRoles(
      businessLineId,
    );
  }

  findDefaultBusinessLineCustomRole(
    businessLineId: string,
    role: BusinessLineMemberRole,
  ): Promise<BusinessLineCustomRole> {
    return this.businessLineRoleTemplateService.findDefaultBusinessLineCustomRole(
      businessLineId,
      role,
    );
  }

  resolveBusinessLineMemberAssignment(
    businessLineId: string,
    roleId: string,
  ): Promise<{ roleId: string }> {
    return this.businessLineCustomRoleService.resolveBusinessLineMemberAssignment(
      businessLineId,
      roleId,
    );
  }

  ensureDefaultProjectCustomRoles(
    businessLineId: string,
  ): Promise<ProjectCustomRole[]> {
    return this.businessLineRoleTemplateService.ensureDefaultProjectCustomRoles(
      businessLineId,
    );
  }

  findDefaultProjectCustomRole(
    businessLineId: string,
    role: ProjectMemberRole,
  ): Promise<ProjectCustomRole> {
    return this.businessLineRoleTemplateService.findDefaultProjectCustomRole(
      businessLineId,
      role,
    );
  }

  isBusinessLineOwnerRole(
    businessLineId: string,
    roleId: string,
  ): Promise<boolean> {
    return this.businessLineCustomRoleService.isBusinessLineOwnerRole(
      businessLineId,
      roleId,
    );
  }

  isProjectOwnerRole(businessLineId: string, roleId: string): Promise<boolean> {
    return this.businessLineProjectRoleCatalogService.isProjectOwnerRole(
      businessLineId,
      roleId,
    );
  }

  getBusinessLineProjectCustomRoleOrThrow(
    businessLineId: string,
    roleId: string,
  ): Promise<ProjectCustomRole> {
    return this.businessLineProjectRoleCatalogService.getBusinessLineProjectCustomRoleOrThrow(
      businessLineId,
      roleId,
    );
  }

  getBusinessLineCustomRoleOrThrow(
    businessLineId: string,
    roleId: string,
  ): Promise<BusinessLineCustomRole> {
    return this.businessLineCustomRoleService.getBusinessLineCustomRoleOrThrow(
      businessLineId,
      roleId,
    );
  }

  attachCustomRoleNamesToBusinessLineMembers(
    members: BusinessLineMember[],
  ): Promise<BusinessLineMember[]> {
    return this.businessLineCustomRoleService.attachCustomRoleNamesToBusinessLineMembers(
      members,
    );
  }

  attachCustomRoleNameToBusinessLineMember(
    member: BusinessLineMember,
  ): Promise<BusinessLineMember> {
    return this.businessLineCustomRoleService.attachCustomRoleNameToBusinessLineMember(
      member,
    );
  }

  findBusinessLineCustomRoleName(roleId: string): Promise<string | null> {
    return this.businessLineCustomRoleService.findBusinessLineCustomRoleName(
      roleId,
    );
  }
}
