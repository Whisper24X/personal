import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { McpsService } from './mcps.service';
import { Mcp } from './domain/mcp';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto';
import { FindAllMcpsDto } from './dto/find-all-mcps.dto';
import { infinityPagination } from '../utils/infinity-pagination';
import { GetProjectLocalMcpConfigDto } from './dto/get-project-local-mcp-config.dto';
import { ProjectLocalMcpConfigDto } from './dto/project-local-mcp-config.dto';
import { ImportProjectLocalMcpsDto } from './dto/import-project-local-mcps.dto';
import { ImportProjectLocalMcpsResultDto } from './dto/import-project-local-mcps-result.dto';

@ApiTags('MCPs')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'mcps',
  version: '1',
})
export class McpsController {
  constructor(private readonly mcpsService: McpsService) {}

  @Get()
  @ApiOkResponse({ type: InfinityPaginationResponse(Mcp) })
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Request() request,
    @Query() query: FindAllMcpsDto,
  ): Promise<InfinityPaginationResponseDto<Mcp>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;

    if (limit > 50) {
      limit = 50;
    }

    return infinityPagination(
      await this.mcpsService.findAllWithPagination(
        {
          ...query,
          page,
          limit,
        },
        request.user,
      ),
      {
        page,
        limit,
      },
    );
  }

  @Get('project-local/config')
  @ApiOkResponse({ type: ProjectLocalMcpConfigDto })
  @HttpCode(HttpStatus.OK)
  getProjectLocalMcpConfig(
    @Request() request,
    @Query() query: GetProjectLocalMcpConfigDto,
  ): Promise<ProjectLocalMcpConfigDto> {
    return this.mcpsService.getProjectLocalMcpConfig(query, request.user);
  }

  @Post('project-local/import-json')
  @ApiOkResponse({ type: ImportProjectLocalMcpsResultDto })
  @HttpCode(HttpStatus.OK)
  importProjectLocalMcps(
    @Request() request,
    @Body() importProjectLocalMcpsDto: ImportProjectLocalMcpsDto,
  ): Promise<ImportProjectLocalMcpsResultDto> {
    return this.mcpsService.importProjectLocalMcps(
      importProjectLocalMcpsDto,
      request.user,
    );
  }
}
