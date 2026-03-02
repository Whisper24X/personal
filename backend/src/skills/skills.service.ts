import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Skill } from './domain/skill';
import { SkillRepository } from './infrastructure/persistence/skill.repository';
import { CreateSkillDto } from './dto/create-skill.dto';
import { UpdateSkillDto } from './dto/update-skill.dto';
import { FindAllSkillsDto } from './dto/find-all-skills.dto';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { ProjectsService } from '../projects/projects.service';
import { loadProjectLocalSkills } from '../utils/local-agent-catalog';

@Injectable()
export class SkillsService {
  constructor(
    private readonly skillRepository: SkillRepository,
    private readonly projectsService: ProjectsService,
  ) {}

  async create(
    createSkillDto: CreateSkillDto,
    currentUser: JwtPayloadType,
  ): Promise<Skill> {
    this.ensureAdmin(currentUser);

    const existedSkill = await this.skillRepository.findByNameAndVersion({
      name: createSkillDto.name,
      version: createSkillDto.version,
    });

    if (existedSkill) {
      throw new ConflictException('Skill name and version already exists');
    }

    return this.skillRepository.create({
      name: createSkillDto.name,
      version: createSkillDto.version,
      description: createSkillDto.description ?? null,
      scope: createSkillDto.scope ?? null,
      homepageUrl: createSkillDto.homepageUrl ?? null,
      metadataJson: createSkillDto.metadataJson ?? null,
      enabled: createSkillDto.enabled ?? true,
    });
  }

  async findAllWithPagination(
    query: FindAllSkillsDto,
    currentUser: JwtPayloadType,
  ): Promise<Skill[]> {
    const paginationOptions: IPaginationOptions = {
      page: query.page ?? 1,
      limit: query.limit ?? 10,
    };

    if (query.projectId) {
      const project = await this.projectsService.assertCanAccessProject(
        query.projectId,
        currentUser,
      );
      const localSkills = await loadProjectLocalSkills(project);

      return this.filterAndPaginateLocalSkills(localSkills, query);
    }

    return this.skillRepository.findAllWithPagination({
      paginationOptions,
      keyword: query.keyword,
      enabled: query.enabled,
    });
  }

  async findById(id: Skill['id']): Promise<Skill> {
    const skill = await this.skillRepository.findById(id);

    if (!skill) {
      throw new NotFoundException('Skill not found');
    }

    return skill;
  }

  async update(
    id: Skill['id'],
    updateSkillDto: UpdateSkillDto,
    currentUser: JwtPayloadType,
  ): Promise<Skill> {
    this.ensureAdmin(currentUser);

    const existedSkill = await this.skillRepository.findById(id);

    if (!existedSkill) {
      throw new NotFoundException('Skill not found');
    }

    const nextName = updateSkillDto.name ?? existedSkill.name;
    const nextVersion = updateSkillDto.version ?? existedSkill.version;

    if (
      nextName !== existedSkill.name ||
      nextVersion !== existedSkill.version
    ) {
      const duplicatedSkill = await this.skillRepository.findByNameAndVersion({
        name: nextName,
        version: nextVersion,
      });

      if (duplicatedSkill && duplicatedSkill.id !== id) {
        throw new ConflictException('Skill name and version already exists');
      }
    }

    const updatedSkill = await this.skillRepository.update(id, {
      ...(updateSkillDto.name !== undefined
        ? { name: updateSkillDto.name }
        : {}),
      ...(updateSkillDto.version !== undefined
        ? { version: updateSkillDto.version }
        : {}),
      ...(updateSkillDto.description !== undefined
        ? { description: updateSkillDto.description }
        : {}),
      ...(updateSkillDto.scope !== undefined
        ? { scope: updateSkillDto.scope }
        : {}),
      ...(updateSkillDto.homepageUrl !== undefined
        ? { homepageUrl: updateSkillDto.homepageUrl }
        : {}),
      ...(updateSkillDto.metadataJson !== undefined
        ? { metadataJson: updateSkillDto.metadataJson }
        : {}),
      ...(updateSkillDto.enabled !== undefined
        ? { enabled: updateSkillDto.enabled }
        : {}),
    });

    if (!updatedSkill) {
      throw new NotFoundException('Skill not found');
    }

    return updatedSkill;
  }

  async remove(id: Skill['id'], currentUser: JwtPayloadType): Promise<void> {
    this.ensureAdmin(currentUser);
    await this.findById(id);
    await this.skillRepository.remove(id);
  }

  private ensureAdmin(currentUser: JwtPayloadType): void {
    if (!currentUser.roles?.includes('admin')) {
      throw new ForbiddenException('forbiddenSkillManage');
    }
  }

  private filterAndPaginateLocalSkills(
    skills: Skill[],
    query: FindAllSkillsDto,
  ): Skill[] {
    const keyword = query.keyword?.trim().toLowerCase() ?? '';
    const filtered = skills.filter((skill) => {
      if (query.enabled !== undefined && skill.enabled !== query.enabled) {
        return false;
      }

      if (!keyword) {
        return true;
      }

      const targetText =
        `${skill.name} ${skill.version} ${skill.description ?? ''}`
          .toLowerCase()
          .trim();

      return targetText.includes(keyword);
    });

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (page - 1) * limit;

    return filtered.slice(offset, offset + limit);
  }
}
