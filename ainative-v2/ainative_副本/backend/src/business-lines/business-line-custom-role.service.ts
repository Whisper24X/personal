import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ALL_BUSINESS_LINE_CAPABILITIES,
  isBusinessLineOwnerCapabilities,
  normalizeBusinessLineCapabilities,
} from '../access/access.constants';
import { CreateBusinessLineCustomRoleDto } from './dto/create-business-line-custom-role.dto';
import { BusinessLineCustomRole } from './domain/business-line-custom-role';
import { BusinessLineMember } from './domain/business-line-member';
import { BusinessLineCustomRoleRepository } from './infrastructure/persistence/business-line-custom-role.repository';
import { BusinessLineInvitationRepository } from './infrastructure/persistence/business-line-invitation.repository';
import { BusinessLineMemberRepository } from './infrastructure/persistence/business-line-member.repository';

@Injectable()
export class BusinessLineCustomRoleService {
  constructor(
    private readonly businessLineCustomRoleRepository: BusinessLineCustomRoleRepository,
    private readonly businessLineMemberRepository: BusinessLineMemberRepository,
    private readonly businessLineInvitationRepository: BusinessLineInvitationRepository,
  ) {}

  findCustomRoles(businessLineId: string): Promise<BusinessLineCustomRole[]> {
    return this.businessLineCustomRoleRepository.findAllByBusinessLineId(
      businessLineId,
    );
  }

  async createCustomRole(
    businessLineId: string,
    createBusinessLineCustomRoleDto: CreateBusinessLineCustomRoleDto,
  ): Promise<BusinessLineCustomRole> {
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
    businessLineId: string,
    roleId: string,
    input: {
      name: string;
      description?: string | null;
      capabilities?: string[];
    },
  ): Promise<BusinessLineCustomRole> {
    const currentRole = await this.getBusinessLineCustomRoleOrThrow(
      businessLineId,
      roleId,
    );
    const payload = await this.buildBusinessLineCustomRolePayload(
      businessLineId,
      input,
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
    businessLineId: string,
    roleId: string,
  ): Promise<void> {
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

  async resolveBusinessLineMemberAssignment(
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

  async isBusinessLineOwnerRole(
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

  async getBusinessLineCustomRoleOrThrow(
    businessLineId: string,
    roleId: string,
  ): Promise<BusinessLineCustomRole> {
    const customRole =
      await this.businessLineCustomRoleRepository.findById(roleId);

    if (!customRole || customRole.businessLineId !== businessLineId) {
      throw new NotFoundException('Business line role not found');
    }

    return customRole;
  }

  async attachCustomRoleNamesToBusinessLineMembers(
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

  async attachCustomRoleNameToBusinessLineMember(
    member: BusinessLineMember,
  ): Promise<BusinessLineMember> {
    const [nextMember] = await this.attachCustomRoleNamesToBusinessLineMembers([
      member,
    ]);
    return nextMember ?? member;
  }

  async findBusinessLineCustomRoleName(roleId: string): Promise<string | null> {
    const role = await this.businessLineCustomRoleRepository.findById(roleId);
    return role?.name ?? null;
  }

  private async buildBusinessLineCustomRolePayload(
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

  private normalizeOptionalText(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
}
