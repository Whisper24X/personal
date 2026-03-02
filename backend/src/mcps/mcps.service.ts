import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Mcp } from './domain/mcp';
import { McpRepository } from './infrastructure/persistence/mcp.repository';
import { CreateMcpDto } from './dto/create-mcp.dto';
import { UpdateMcpDto } from './dto/update-mcp.dto';
import { FindAllMcpsDto } from './dto/find-all-mcps.dto';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { ProjectsService } from '../projects/projects.service';
import { loadProjectLocalMcps } from '../utils/local-agent-catalog';

@Injectable()
export class McpsService {
  constructor(
    private readonly mcpRepository: McpRepository,
    private readonly projectsService: ProjectsService,
  ) {}

  async create(
    createMcpDto: CreateMcpDto,
    currentUser: JwtPayloadType,
  ): Promise<Mcp> {
    this.ensureAdmin(currentUser);

    const existedMcp = await this.mcpRepository.findByNameAndVersion({
      name: createMcpDto.name,
      version: createMcpDto.version,
    });

    if (existedMcp) {
      throw new ConflictException('MCP name and version already exists');
    }

    return this.mcpRepository.create({
      name: createMcpDto.name,
      version: createMcpDto.version,
      description: createMcpDto.description ?? null,
      provider: createMcpDto.provider ?? null,
      toolsCount: createMcpDto.toolsCount ?? 0,
      configSchema: createMcpDto.configSchema ?? null,
      metadataJson: createMcpDto.metadataJson ?? null,
      enabled: createMcpDto.enabled ?? true,
    });
  }

  async findAllWithPagination(
    query: FindAllMcpsDto,
    currentUser: JwtPayloadType,
  ): Promise<Mcp[]> {
    const paginationOptions: IPaginationOptions = {
      page: query.page ?? 1,
      limit: query.limit ?? 10,
    };

    if (query.projectId) {
      const project = await this.projectsService.assertCanAccessProject(
        query.projectId,
        currentUser,
      );
      const localMcps = await loadProjectLocalMcps(project);

      return this.filterAndPaginateLocalMcps(localMcps, query);
    }

    return this.mcpRepository.findAllWithPagination({
      paginationOptions,
      keyword: query.keyword,
      enabled: query.enabled,
    });
  }

  async findById(id: Mcp['id']): Promise<Mcp> {
    const mcp = await this.mcpRepository.findById(id);

    if (!mcp) {
      throw new NotFoundException('MCP not found');
    }

    return mcp;
  }

  async update(
    id: Mcp['id'],
    updateMcpDto: UpdateMcpDto,
    currentUser: JwtPayloadType,
  ): Promise<Mcp> {
    this.ensureAdmin(currentUser);

    const existedMcp = await this.mcpRepository.findById(id);

    if (!existedMcp) {
      throw new NotFoundException('MCP not found');
    }

    const nextName = updateMcpDto.name ?? existedMcp.name;
    const nextVersion = updateMcpDto.version ?? existedMcp.version;

    if (nextName !== existedMcp.name || nextVersion !== existedMcp.version) {
      const duplicatedMcp = await this.mcpRepository.findByNameAndVersion({
        name: nextName,
        version: nextVersion,
      });

      if (duplicatedMcp && duplicatedMcp.id !== id) {
        throw new ConflictException('MCP name and version already exists');
      }
    }

    const updatedMcp = await this.mcpRepository.update(id, {
      ...(updateMcpDto.name !== undefined ? { name: updateMcpDto.name } : {}),
      ...(updateMcpDto.version !== undefined
        ? { version: updateMcpDto.version }
        : {}),
      ...(updateMcpDto.description !== undefined
        ? { description: updateMcpDto.description }
        : {}),
      ...(updateMcpDto.provider !== undefined
        ? { provider: updateMcpDto.provider }
        : {}),
      ...(updateMcpDto.toolsCount !== undefined
        ? { toolsCount: updateMcpDto.toolsCount }
        : {}),
      ...(updateMcpDto.configSchema !== undefined
        ? { configSchema: updateMcpDto.configSchema }
        : {}),
      ...(updateMcpDto.metadataJson !== undefined
        ? { metadataJson: updateMcpDto.metadataJson }
        : {}),
      ...(updateMcpDto.enabled !== undefined
        ? { enabled: updateMcpDto.enabled }
        : {}),
    });

    if (!updatedMcp) {
      throw new NotFoundException('MCP not found');
    }

    return updatedMcp;
  }

  async remove(id: Mcp['id'], currentUser: JwtPayloadType): Promise<void> {
    this.ensureAdmin(currentUser);
    await this.findById(id);
    await this.mcpRepository.remove(id);
  }

  private ensureAdmin(currentUser: JwtPayloadType): void {
    if (!currentUser.roles?.includes('admin')) {
      throw new ForbiddenException('forbiddenMcpManage');
    }
  }

  private filterAndPaginateLocalMcps(
    mcps: Mcp[],
    query: FindAllMcpsDto,
  ): Mcp[] {
    const keyword = query.keyword?.trim().toLowerCase() ?? '';
    const filtered = mcps.filter((mcp) => {
      if (query.enabled !== undefined && mcp.enabled !== query.enabled) {
        return false;
      }

      if (!keyword) {
        return true;
      }

      const targetText =
        `${mcp.name} ${mcp.version} ${mcp.provider ?? ''} ${mcp.description ?? ''}`
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
