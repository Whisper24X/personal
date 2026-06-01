import { Injectable, NotFoundException } from '@nestjs/common';
import {
  BUSINESS_LINE_DEFAULT_ROLE_TEMPLATES,
  PROJECT_DEFAULT_ROLE_TEMPLATES,
  getBusinessLineDefaultRoleTemplate,
  getProjectDefaultRoleTemplate,
  hasBusinessLineTemplateCapabilities,
  hasProjectTemplateCapabilities,
  isDefaultTemplateRoleName,
} from '../access/access.constants';
import { ProjectCustomRole } from '../projects/domain/project-custom-role';
import { ProjectMemberRole } from '../projects/dto/project-member-role.enum';
import { ProjectCustomRoleRepository } from '../projects/infrastructure/persistence/project-custom-role.repository';
import { BusinessLineMemberRole } from './dto/business-line-member-role.enum';
import { BusinessLineCustomRole } from './domain/business-line-custom-role';
import { BusinessLineCustomRoleRepository } from './infrastructure/persistence/business-line-custom-role.repository';

@Injectable()
export class BusinessLineRoleTemplateService {
  constructor(
    private readonly businessLineCustomRoleRepository: BusinessLineCustomRoleRepository,
    private readonly projectCustomRoleRepository: ProjectCustomRoleRepository,
  ) {}

  async ensureDefaultBusinessLineCustomRoles(
    businessLineId: string,
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

  async findDefaultBusinessLineCustomRole(
    businessLineId: string,
    role: BusinessLineMemberRole,
  ): Promise<BusinessLineCustomRole> {
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

  async ensureDefaultProjectCustomRoles(
    businessLineId: string,
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

  async findDefaultProjectCustomRole(
    businessLineId: string,
    role: ProjectMemberRole,
  ): Promise<ProjectCustomRole> {
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
}
