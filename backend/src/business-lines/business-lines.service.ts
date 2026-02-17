import {
  // common
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
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { BusinessLineMemberRole } from './dto/business-line-member-role.enum';
import { UsersService } from '../users/users.service';

@Injectable()
export class BusinessLinesService {
  constructor(
    // Dependencies here
    private readonly businessLineRepository: BusinessLineRepository,
    private readonly businessLineMemberRepository: BusinessLineMemberRepository,
    private readonly usersService: UsersService,
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
}
