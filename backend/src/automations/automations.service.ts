import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { AutomationStatus } from './domain/automation-status.enum';
import { Automation } from './domain/automation';
import { CreateAutomationDto } from './dto/create-automation.dto';
import { FindAllAutomationsDto } from './dto/find-all-automations.dto';
import { UpdateAutomationDto } from './dto/update-automation.dto';
import { AutomationRepository } from './infrastructure/persistence/automation.repository';

@Injectable()
export class AutomationsService {
  constructor(private readonly automationRepository: AutomationRepository) {}

  async create(
    createAutomationDto: CreateAutomationDto,
    currentUser: JwtPayloadType,
  ): Promise<Automation> {
    this.ensureAdmin(currentUser);

    const existedAutomation = await this.automationRepository.findByName(
      createAutomationDto.name,
    );

    if (existedAutomation) {
      throw new ConflictException('Automation name already exists');
    }

    return this.automationRepository.create({
      name: createAutomationDto.name,
      prompt: createAutomationDto.prompt,
      rrule: createAutomationDto.rrule,
      cwds: this.normalizeCwds(createAutomationDto.cwds),
      status: createAutomationDto.status ?? AutomationStatus.ACTIVE,
      lastRunAt: null,
      nextRunAt: null,
      createdBy: currentUser.sub,
    });
  }

  async findAllWithPagination(
    query: FindAllAutomationsDto,
  ): Promise<Automation[]> {
    const paginationOptions: IPaginationOptions = {
      page: query.page ?? 1,
      limit: query.limit ?? 10,
    };

    return this.automationRepository.findAllWithPagination({
      paginationOptions,
      keyword: query.keyword,
      status: query.status,
    });
  }

  async findById(id: Automation['id']): Promise<Automation> {
    const automation = await this.automationRepository.findById(id);

    if (!automation) {
      throw new NotFoundException('Automation not found');
    }

    return automation;
  }

  async update(
    id: Automation['id'],
    updateAutomationDto: UpdateAutomationDto,
    currentUser: JwtPayloadType,
  ): Promise<Automation> {
    this.ensureAdmin(currentUser);

    const existedAutomation = await this.automationRepository.findById(id);

    if (!existedAutomation) {
      throw new NotFoundException('Automation not found');
    }

    const nextName = updateAutomationDto.name ?? existedAutomation.name;
    if (nextName !== existedAutomation.name) {
      const duplicatedAutomation =
        await this.automationRepository.findByName(nextName);

      if (duplicatedAutomation && duplicatedAutomation.id !== id) {
        throw new ConflictException('Automation name already exists');
      }
    }

    const updatedAutomation = await this.automationRepository.update(id, {
      ...(updateAutomationDto.name !== undefined
        ? { name: updateAutomationDto.name }
        : {}),
      ...(updateAutomationDto.prompt !== undefined
        ? { prompt: updateAutomationDto.prompt }
        : {}),
      ...(updateAutomationDto.rrule !== undefined
        ? { rrule: updateAutomationDto.rrule }
        : {}),
      ...(updateAutomationDto.cwds !== undefined
        ? { cwds: this.normalizeCwds(updateAutomationDto.cwds) }
        : {}),
      ...(updateAutomationDto.status !== undefined
        ? { status: updateAutomationDto.status }
        : {}),
    });

    if (!updatedAutomation) {
      throw new NotFoundException('Automation not found');
    }

    return updatedAutomation;
  }

  async remove(
    id: Automation['id'],
    currentUser: JwtPayloadType,
  ): Promise<void> {
    this.ensureAdmin(currentUser);
    await this.findById(id);
    await this.automationRepository.remove(id);
  }

  private normalizeCwds(cwds: string[] | undefined): string[] | null {
    if (!cwds) {
      return null;
    }

    const normalizedCwds = cwds
      .map((cwd) => cwd.trim())
      .filter((cwd) => cwd.length > 0);

    return normalizedCwds.length > 0
      ? Array.from(new Set(normalizedCwds))
      : null;
  }

  private ensureAdmin(currentUser: JwtPayloadType): void {
    if (!currentUser.roles?.includes('admin')) {
      throw new ForbiddenException('forbiddenAutomationManage');
    }
  }
}
