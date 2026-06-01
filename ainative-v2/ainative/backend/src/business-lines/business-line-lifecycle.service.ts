import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { BusinessLineMemberRole } from './dto/business-line-member-role.enum';
import { CreateBusinessLineDto } from './dto/create-business-line.dto';
import { UpdateBusinessLineDto } from './dto/update-business-line.dto';
import { BusinessLine } from './domain/business-line';
import { BusinessLineMemberRepository } from './infrastructure/persistence/business-line-member.repository';
import { BusinessLineRepository } from './infrastructure/persistence/business-line.repository';
import { BusinessLineRoleCatalogService } from './business-line-role-catalog.service';
import { BusinessLineLocalAssetsService } from './business-line-local-assets.service';

@Injectable()
export class BusinessLineLifecycleService {
  private readonly logger = new Logger(BusinessLineLifecycleService.name);

  constructor(
    private readonly businessLineRepository: BusinessLineRepository,
    private readonly businessLineMemberRepository: BusinessLineMemberRepository,
    private readonly businessLineRoleCatalogService: BusinessLineRoleCatalogService,
    private readonly businessLineLocalAssetsService: BusinessLineLocalAssetsService,
  ) {}

  async create(
    createBusinessLineDto: CreateBusinessLineDto,
    currentUser: JwtPayloadType,
  ): Promise<BusinessLine> {
    if (!this.isAdmin(currentUser)) {
      throw new ForbiddenException('forbiddenCreateBusinessLine');
    }

    const existedBusinessLine = await this.businessLineRepository.findByName(
      createBusinessLineDto.name,
    );

    if (existedBusinessLine) {
      throw new ConflictException('Business line name already exists');
    }

    const businessLine = await this.businessLineRepository.create({
      name: createBusinessLineDto.name,
      description: createBusinessLineDto.description ?? null,
    });

    await this.businessLineRoleCatalogService.ensureDefaultBusinessLineCustomRoles(
      businessLine.id,
    );
    await this.businessLineRoleCatalogService.ensureDefaultProjectCustomRoles(
      businessLine.id,
    );
    const ownerRole =
      await this.businessLineRoleCatalogService.findDefaultBusinessLineCustomRole(
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

  findById(id: BusinessLine['id']): Promise<BusinessLine | null> {
    return this.businessLineRepository.findById(id);
  }

  findByIds(ids: BusinessLine['id'][]): Promise<BusinessLine[]> {
    return this.businessLineRepository.findByIds(ids);
  }

  async update(
    id: BusinessLine['id'],
    updateBusinessLineDto: UpdateBusinessLineDto,
  ): Promise<BusinessLine | null> {
    if (updateBusinessLineDto.name) {
      const existedBusinessLine = await this.businessLineRepository.findByName(
        updateBusinessLineDto.name,
      );

      if (existedBusinessLine && existedBusinessLine.id !== id) {
        throw new ConflictException('Business line name already exists');
      }
    }

    return this.businessLineRepository.update(id, {
      ...(updateBusinessLineDto.name !== undefined
        ? { name: updateBusinessLineDto.name }
        : {}),
      ...(updateBusinessLineDto.description !== undefined
        ? { description: updateBusinessLineDto.description }
        : {}),
    });
  }

  async remove(id: BusinessLine['id']): Promise<void> {
    await this.businessLineRepository.remove(id);

    try {
      await this.businessLineLocalAssetsService.removeBusinessLineLocalAssets(
        id,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown local asset error';
      this.logger.warn(
        `Failed to remove local assets for business line ${id}: ${message}`,
      );
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
}
