import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { ProjectAccessService } from '../projects/project-access.service';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { AutomationStatus } from './domain/automation-status.enum';
import { Automation } from './domain/automation';
import { CreateAutomationDto } from './dto/create-automation.dto';
import { FindAllAutomationsDto } from './dto/find-all-automations.dto';
import { UpdateAutomationDto } from './dto/update-automation.dto';
import { AutomationRepository } from './infrastructure/persistence/automation.repository';

@Injectable()
export class AutomationsService {
  constructor(
    private readonly automationRepository: AutomationRepository,
    private readonly projectAccessService: ProjectAccessService,
  ) {}

  async create(
    createAutomationDto: CreateAutomationDto,
    currentUser: JwtPayloadType,
  ): Promise<Automation> {
    await this.projectAccessService.assertProjectCapability(
      createAutomationDto.projectId,
      currentUser,
      'project.automation.read',
    );

    const existedAutomation = await this.automationRepository.findByName(
      createAutomationDto.name,
      createAutomationDto.projectId,
    );

    if (existedAutomation) {
      throw new ConflictException('Automation name already exists');
    }

    return this.automationRepository.create({
      projectId: createAutomationDto.projectId,
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
    currentUser: JwtPayloadType,
  ): Promise<Automation[]> {
    await this.projectAccessService.assertProjectCapability(
      query.projectId,
      currentUser,
      'project.automation.read',
    );

    const paginationOptions: IPaginationOptions = {
      page: query.page ?? 1,
      limit: query.limit ?? 10,
    };

    return this.automationRepository.findAllWithPagination({
      paginationOptions,
      projectId: query.projectId,
      keyword: query.keyword,
      status: query.status,
    });
  }

  async findById(
    id: Automation['id'],
    currentUser: JwtPayloadType,
  ): Promise<Automation> {
    const automation = await this.automationRepository.findById(id);

    if (!automation) {
      throw new NotFoundException('Automation not found');
    }

    await this.projectAccessService.assertProjectCapability(
      automation.projectId,
      currentUser,
      'project.automation.read',
    );

    return automation;
  }

  async update(
    id: Automation['id'],
    updateAutomationDto: UpdateAutomationDto,
    currentUser: JwtPayloadType,
  ): Promise<Automation> {
    const existedAutomation = await this.automationRepository.findById(id);

    if (!existedAutomation) {
      throw new NotFoundException('Automation not found');
    }

    await this.projectAccessService.assertProjectCapability(
      existedAutomation.projectId,
      currentUser,
      'project.automation.read',
    );

    const nextName = updateAutomationDto.name ?? existedAutomation.name;
    if (nextName !== existedAutomation.name) {
      const duplicatedAutomation = await this.automationRepository.findByName(
        nextName,
        existedAutomation.projectId,
      );

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
    const automation = await this.findById(id, currentUser);
    await this.projectAccessService.assertProjectCapability(
      automation.projectId,
      currentUser,
      'project.automation.read',
    );
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
}
