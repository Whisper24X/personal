import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { McpsService } from './mcps.service';
import { Mcp } from './domain/mcp';
import { CreateMcpDto } from './dto/create-mcp.dto';
import { UpdateMcpDto } from './dto/update-mcp.dto';
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

  @Post()
  @ApiCreatedResponse({ type: Mcp })
  @HttpCode(HttpStatus.CREATED)
  create(@Request() request, @Body() createMcpDto: CreateMcpDto) {
    return this.mcpsService.create(createMcpDto, request.user);
  }

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

  @Get(':id')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: Mcp })
  @HttpCode(HttpStatus.OK)
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.mcpsService.findById(id);
  }

  @Patch(':id')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: Mcp })
  @HttpCode(HttpStatus.OK)
  update(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateMcpDto: UpdateMcpDto,
  ) {
    return this.mcpsService.update(id, updateMcpDto, request.user);
  }

  @Delete(':id')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiNoContentResponse()
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Request() request, @Param('id', ParseUUIDPipe) id: string) {
    return this.mcpsService.remove(id, request.user);
  }
}
