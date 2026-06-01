import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
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
import { RemoveProjectLocalMcpDto } from './dto/remove-project-local-mcp.dto';
import { TestProjectLocalMcpDto } from './dto/test-project-local-mcp.dto';
import { LocalMcpProbeResultDto } from '../business-lines/dto/local-mcp-probe-result.dto';
import {
  DisconnectProjectMcpOAuthProviderDto,
  ListProjectMcpOAuthProvidersDto,
  ProjectMcpOAuthLoginSessionDto,
  ProjectMcpOAuthProviderDto,
  ProjectMcpOAuthRelayResultDto,
  RelayProjectMcpOAuthCallbackDto,
  StartProjectMcpOAuthLoginDto,
} from './dto/project-mcp-oauth.dto';
import { ProjectMcpOAuthService } from './project-mcp-oauth.service';

@ApiTags('MCPs')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'mcps',
  version: '1',
})
export class McpsController {
  constructor(
    private readonly mcpsService: McpsService,
    private readonly projectMcpOAuthService: ProjectMcpOAuthService,
  ) {}

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

  @Post('project-local/test')
  @ApiOkResponse({ type: LocalMcpProbeResultDto })
  @HttpCode(HttpStatus.OK)
  testProjectLocalMcp(
    @Request() request,
    @Body() body: TestProjectLocalMcpDto,
  ): Promise<LocalMcpProbeResultDto> {
    return this.mcpsService.testProjectLocalMcp(body, request.user);
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

  @Delete('project-local')
  @ApiNoContentResponse()
  @HttpCode(HttpStatus.NO_CONTENT)
  removeProjectLocalMcp(
    @Request() request,
    @Query() query: RemoveProjectLocalMcpDto,
  ): Promise<void> {
    return this.mcpsService.removeProjectLocalMcp(query, request.user);
  }

  @Get('project-oauth/providers')
  @ApiOkResponse({ type: [ProjectMcpOAuthProviderDto] })
  @HttpCode(HttpStatus.OK)
  listProjectOAuthProviders(
    @Request() request,
    @Query() query: ListProjectMcpOAuthProvidersDto,
  ): Promise<ProjectMcpOAuthProviderDto[]> {
    return this.projectMcpOAuthService.listProviders(
      query.projectId,
      request.user,
    );
  }

  @Post('project-oauth/:provider/start-login')
  @ApiOkResponse({ type: ProjectMcpOAuthLoginSessionDto })
  @HttpCode(HttpStatus.OK)
  startProjectOAuthLogin(
    @Request() request,
    @Param('provider') provider: string,
    @Body() body: StartProjectMcpOAuthLoginDto,
  ): Promise<ProjectMcpOAuthLoginSessionDto> {
    return this.projectMcpOAuthService.startLogin(provider, body, request.user);
  }

  @Post('project-oauth/:provider/relay-callback')
  @ApiOkResponse({ type: ProjectMcpOAuthRelayResultDto })
  @HttpCode(HttpStatus.OK)
  relayProjectOAuthCallback(
    @Request() request,
    @Param('provider') provider: string,
    @Body() body: RelayProjectMcpOAuthCallbackDto,
  ): Promise<ProjectMcpOAuthRelayResultDto> {
    return this.projectMcpOAuthService.relayCallback(
      provider,
      body,
      request.user,
    );
  }

  @Delete('project-oauth/:provider')
  @ApiNoContentResponse()
  @HttpCode(HttpStatus.NO_CONTENT)
  disconnectProjectOAuthProvider(
    @Request() request,
    @Param('provider') provider: string,
    @Query() query: DisconnectProjectMcpOAuthProviderDto,
  ): Promise<void> {
    return this.projectMcpOAuthService.disconnect(
      provider,
      query,
      request.user,
    );
  }
}
