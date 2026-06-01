import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ALL_PROJECT_CAPABILITIES,
  isProjectOwnerRoleName,
  normalizeProjectCapabilities,
} from '../access/access.constants';
import { ProjectCustomRole } from '../projects/domain/project-custom-role';
import { ProjectCustomRoleRepository } from '../projects/infrastructure/persistence/project-custom-role.repository';
import { ProjectMemberRepository } from '../projects/infrastructure/persistence/project-member.repository';
import { ProjectRepository } from '../projects/infrastructure/persistence/project.repository';

@Injectable()
export class BusinessLineProjectRoleCatalogService {
  constructor(
    private readonly projectCustomRoleRepository: ProjectCustomRoleRepository,
    private readonly projectRepository: ProjectRepository,
    private readonly projectMemberRepository: ProjectMemberRepository,
  ) {}

  findProjectCustomRoles(businessLineId: string): Promise<ProjectCustomRole[]> {
    return this.projectCustomRoleRepository.findAllByBusinessLineId(
      businessLineId,
    );
  }

  async createProjectCustomRole(
    businessLineId: string,
    input: {
      name: string;
      description?: string | null;
      capabilities?: string[];
    },
  ): Promise<ProjectCustomRole> {
    const payload = await this.buildProjectCustomRolePayload(
      businessLineId,
      input,
    );

    return this.projectCustomRoleRepository.create({
      businessLineId,
      ...payload,
    });
  }

  async updateProjectCustomRole(
    businessLineId: string,
    roleId: string,
    input: {
      name: string;
      description?: string | null;
      capabilities?: string[];
    },
  ): Promise<ProjectCustomRole> {
    const currentRole = await this.getBusinessLineProjectCustomRoleOrThrow(
      businessLineId,
      roleId,
    );
    const payload = await this.buildProjectCustomRolePayload(
      businessLineId,
      input,
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
    businessLineId: string,
    roleId: string,
  ): Promise<void> {
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

  async isProjectOwnerRole(
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

  async getBusinessLineProjectCustomRoleOrThrow(
    businessLineId: string,
    roleId: string,
  ): Promise<ProjectCustomRole> {
    const customRole = await this.projectCustomRoleRepository.findById(roleId);

    if (!customRole || customRole.businessLineId !== businessLineId) {
      throw new NotFoundException('Project role not found');
    }

    return customRole;
  }

  private async buildProjectCustomRolePayload(
    businessLineId: string,
    input: {
      name: string;
      description?: string | null;
      capabilities?: string[];
    },
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

  private normalizeOptionalText(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
}
