import {
  Delete,
  HttpCode,
  HttpStatus,
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  Query,
  ParseUUIDPipe,
  Request,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { BusinessLinesService } from './business-lines.service';
import { CreateBusinessLineDto } from './dto/create-business-line.dto';
import { UpdateBusinessLineDto } from './dto/update-business-line.dto';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiBody,
  ApiConsumes,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Express } from 'express';
import { BusinessLine } from './domain/business-line';
import { AuthGuard } from '@nestjs/passport';
import { BusinessLineMember } from './domain/business-line-member';
import { CreateBusinessLineMemberDto } from './dto/create-business-line-member.dto';
import { UpdateBusinessLineMemberDto } from './dto/update-business-line-member.dto';
import { CreateBusinessLineInviteDto } from './dto/create-business-line-invite.dto';
import { BusinessLineInviteDto } from './dto/business-line-invite.dto';
import { AcceptBusinessLineInviteDto } from './dto/accept-business-line-invite.dto';
import { AcceptBusinessLineInviteResponseDto } from './dto/accept-business-line-invite-response.dto';
import { AgentToolConfig } from './domain/agent-tool-config';
import { AgentToolConfigDto } from './dto/agent-tool-config.dto';
import { CreateAgentToolConfigDto } from './dto/create-agent-tool-config.dto';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto';
import { infinityPagination } from '../utils/infinity-pagination';
import { FindAllBusinessLinesDto } from './dto/find-all-business-lines.dto';
import { UpdateAgentToolConfigDto } from './dto/update-agent-tool-config.dto';
import { NullableType } from '../utils/types/nullable.type';
import { BusinessLineDto } from './dto/business-line.dto';
import { Skill } from '../skills/domain/skill';
import { Mcp } from '../mcps/domain/mcp';
import { UploadLocalSkillResultDto } from './dto/upload-local-skill-result.dto';
import { CreateLocalMcpDto } from './dto/create-local-mcp.dto';
import { ImportLocalMcpsDto } from './dto/import-local-mcps.dto';
import { ImportLocalMcpsResultDto } from './dto/import-local-mcps-result.dto';
import { GetLocalMcpConfigDto } from './dto/get-local-mcp-config.dto';
import { LocalMcpConfigDto } from './dto/local-mcp-config.dto';
import { LocalSkillContentDto } from './dto/local-skill-content.dto';

@ApiTags('Businesslines')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'business-lines',
  version: '1',
})
export class BusinessLinesController {
  constructor(private readonly businessLinesService: BusinessLinesService) {}

  @Post()
  @ApiCreatedResponse({
    type: BusinessLineDto,
  })
  @HttpCode(HttpStatus.CREATED)
  create(
    @Request() request,
    @Body() createBusinessLineDto: CreateBusinessLineDto,
  ) {
    return this.businessLinesService.create(
      createBusinessLineDto,
      request.user,
    );
  }

  @Get()
  @ApiOkResponse({
    type: InfinityPaginationResponse(BusinessLineDto),
  })
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Request() request,
    @Query() query: FindAllBusinessLinesDto,
  ): Promise<InfinityPaginationResponseDto<BusinessLine>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) {
      limit = 50;
    }

    return infinityPagination(
      await this.businessLinesService.findAllWithPagination({
        currentUser: request.user,
        paginationOptions: {
          page,
          limit,
        },
      }),
      { page, limit },
    );
  }

  @Post('invitations/accept')
  @ApiOkResponse({
    type: AcceptBusinessLineInviteResponseDto,
  })
  @HttpCode(HttpStatus.OK)
  acceptInvite(
    @Request() request,
    @Body() acceptBusinessLineInviteDto: AcceptBusinessLineInviteDto,
  ) {
    return this.businessLinesService.acceptInvite(
      acceptBusinessLineInviteDto,
      request.user,
    );
  }

  @Get(':id')
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  @ApiOkResponse({
    type: BusinessLineDto,
  })
  @HttpCode(HttpStatus.OK)
  findById(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<NullableType<BusinessLine>> {
    return this.businessLinesService.findById(id, request.user);
  }

  @Patch(':id')
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  @ApiOkResponse({
    type: BusinessLineDto,
  })
  @HttpCode(HttpStatus.OK)
  update(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateBusinessLineDto: UpdateBusinessLineDto,
  ) {
    return this.businessLinesService.update(
      id,
      updateBusinessLineDto,
      request.user,
    );
  }

  @Delete(':id')
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  @ApiNoContentResponse()
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.businessLinesService.remove(id, request.user);
  }

  @Get(':businessLineId/members')
  @ApiParam({
    name: 'businessLineId',
    type: String,
    required: true,
  })
  @ApiOkResponse({
    type: BusinessLineMember,
    isArray: true,
  })
  @HttpCode(HttpStatus.OK)
  findMembers(
    @Request() request,
    @Param('businessLineId', ParseUUIDPipe) businessLineId: string,
  ) {
    return this.businessLinesService.findMembers(businessLineId, request.user);
  }

  @Post(':businessLineId/members')
  @ApiParam({
    name: 'businessLineId',
    type: String,
    required: true,
  })
  @ApiCreatedResponse({
    type: BusinessLineMember,
  })
  @HttpCode(HttpStatus.CREATED)
  addMember(
    @Request() request,
    @Param('businessLineId', ParseUUIDPipe) businessLineId: string,
    @Body() createBusinessLineMemberDto: CreateBusinessLineMemberDto,
  ) {
    return this.businessLinesService.addMember(
      businessLineId,
      createBusinessLineMemberDto,
      request.user,
    );
  }

  @Post(':businessLineId/invitations')
  @ApiParam({
    name: 'businessLineId',
    type: String,
    required: true,
  })
  @ApiCreatedResponse({
    type: BusinessLineInviteDto,
  })
  @HttpCode(HttpStatus.CREATED)
  createInvite(
    @Request() request,
    @Param('businessLineId', ParseUUIDPipe) businessLineId: string,
    @Body() createBusinessLineInviteDto: CreateBusinessLineInviteDto,
  ) {
    return this.businessLinesService.createInvite(
      businessLineId,
      createBusinessLineInviteDto,
      request.user,
    );
  }

  @Get(':businessLineId/invitations/latest')
  @ApiParam({
    name: 'businessLineId',
    type: String,
    required: true,
  })
  @ApiOkResponse({
    type: BusinessLineInviteDto,
  })
  @HttpCode(HttpStatus.OK)
  findLatestInvite(
    @Request() request,
    @Param('businessLineId', ParseUUIDPipe) businessLineId: string,
  ): Promise<NullableType<BusinessLineInviteDto>> {
    return this.businessLinesService.findLatestInvite(
      businessLineId,
      request.user,
    );
  }

  @Patch(':businessLineId/members/:userId')
  @ApiParam({
    name: 'businessLineId',
    type: String,
    required: true,
  })
  @ApiParam({
    name: 'userId',
    type: String,
    required: true,
  })
  @ApiOkResponse({
    type: BusinessLineMember,
  })
  @HttpCode(HttpStatus.OK)
  updateMemberRole(
    @Request() request,
    @Param('businessLineId', ParseUUIDPipe) businessLineId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() updateBusinessLineMemberDto: UpdateBusinessLineMemberDto,
  ) {
    return this.businessLinesService.updateMemberRole(
      businessLineId,
      userId,
      updateBusinessLineMemberDto,
      request.user,
    );
  }

  @Delete(':businessLineId/members/:userId')
  @ApiParam({
    name: 'businessLineId',
    type: String,
    required: true,
  })
  @ApiParam({
    name: 'userId',
    type: String,
    required: true,
  })
  @ApiNoContentResponse()
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMember(
    @Request() request,
    @Param('businessLineId', ParseUUIDPipe) businessLineId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<void> {
    return this.businessLinesService.removeMember(
      businessLineId,
      userId,
      request.user,
    );
  }

  @Get(':businessLineId/agent-tool-configs')
  @ApiParam({
    name: 'businessLineId',
    type: String,
    required: true,
  })
  @ApiOkResponse({
    type: AgentToolConfigDto,
    isArray: true,
  })
  @HttpCode(HttpStatus.OK)
  async findAgentToolConfigs(
    @Request() request,
    @Param('businessLineId', ParseUUIDPipe) businessLineId: string,
    @Query('toolId') toolId?: string,
  ): Promise<AgentToolConfigDto[]> {
    const configs = await this.businessLinesService.findAgentToolConfigs(
      businessLineId,
      request.user,
      toolId,
    );

    return configs.map((item) => this.toAgentToolConfigDto(item));
  }

  @Get(':businessLineId/local-skills')
  @ApiParam({
    name: 'businessLineId',
    type: String,
    required: true,
  })
  @ApiQuery({
    name: 'keyword',
    type: String,
    required: false,
  })
  @ApiOkResponse({
    type: Skill,
    isArray: true,
  })
  @HttpCode(HttpStatus.OK)
  findLocalSkills(
    @Request() request,
    @Param('businessLineId', ParseUUIDPipe) businessLineId: string,
    @Query('keyword') keyword?: string,
  ): Promise<Skill[]> {
    return this.businessLinesService.findLocalSkills(
      businessLineId,
      request.user,
      keyword,
    );
  }

  @Get(':businessLineId/local-skills/:skillId/content')
  @ApiParam({
    name: 'businessLineId',
    type: String,
    required: true,
  })
  @ApiParam({
    name: 'skillId',
    type: String,
    required: true,
  })
  @ApiOkResponse({
    type: LocalSkillContentDto,
  })
  @HttpCode(HttpStatus.OK)
  findLocalSkillContent(
    @Request() request,
    @Param('businessLineId', ParseUUIDPipe) businessLineId: string,
    @Param('skillId') skillId: string,
  ): Promise<LocalSkillContentDto> {
    return this.businessLinesService.findLocalSkillContent(
      businessLineId,
      skillId,
      request.user,
    );
  }

  @Get(':businessLineId/local-skills/:skillId/tree')
  @ApiParam({
    name: 'businessLineId',
    type: String,
    required: true,
  })
  @ApiParam({
    name: 'skillId',
    type: String,
    required: true,
  })
  @HttpCode(HttpStatus.OK)
  findLocalSkillTree(
    @Request() request,
    @Param('businessLineId', ParseUUIDPipe) businessLineId: string,
    @Param('skillId') skillId: string,
  ) {
    return this.businessLinesService.findLocalSkillTree(
      businessLineId,
      skillId,
      request.user,
    );
  }

  @Get(':businessLineId/local-skills/:skillId/file')
  @ApiParam({
    name: 'businessLineId',
    type: String,
    required: true,
  })
  @ApiParam({
    name: 'skillId',
    type: String,
    required: true,
  })
  @ApiQuery({
    name: 'path',
    type: String,
    required: true,
  })
  @HttpCode(HttpStatus.OK)
  findLocalSkillFile(
    @Request() request,
    @Param('businessLineId', ParseUUIDPipe) businessLineId: string,
    @Param('skillId') skillId: string,
    @Query('path') filePath: string,
  ) {
    return this.businessLinesService.findLocalSkillFile(
      businessLineId,
      skillId,
      filePath,
      request.user,
    );
  }

  @Get(':businessLineId/local-skills/:skillId/download')
  @ApiParam({
    name: 'businessLineId',
    type: String,
    required: true,
  })
  @ApiParam({
    name: 'skillId',
    type: String,
    required: true,
  })
  @HttpCode(HttpStatus.OK)
  async downloadLocalSkill(
    @Request() request,
    @Param('businessLineId', ParseUUIDPipe) businessLineId: string,
    @Param('skillId') skillId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { buffer, fileName } =
      await this.businessLinesService.downloadLocalSkill(
        businessLineId,
        skillId,
        request.user,
      );

    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
    });

    return new StreamableFile(buffer);
  }

  @Delete(':businessLineId/local-skills/:skillId')
  @ApiParam({
    name: 'businessLineId',
    type: String,
    required: true,
  })
  @ApiParam({
    name: 'skillId',
    type: String,
    required: true,
  })
  @ApiNoContentResponse()
  @HttpCode(HttpStatus.NO_CONTENT)
  removeLocalSkill(
    @Request() request,
    @Param('businessLineId', ParseUUIDPipe) businessLineId: string,
    @Param('skillId') skillId: string,
  ): Promise<void> {
    return this.businessLinesService.removeLocalSkill(
      businessLineId,
      skillId,
      request.user,
    );
  }

  @Delete(':businessLineId/local-mcps')
  @ApiParam({
    name: 'businessLineId',
    type: String,
    required: true,
  })
  @ApiNoContentResponse()
  @HttpCode(HttpStatus.NO_CONTENT)
  removeLocalMcp(
    @Request() request,
    @Param('businessLineId', ParseUUIDPipe) businessLineId: string,
    @Query() query: GetLocalMcpConfigDto,
  ): Promise<void> {
    return this.businessLinesService.removeLocalMcp(
      businessLineId,
      query,
      request.user,
    );
  }

  @Get(':businessLineId/local-mcps')
  @ApiParam({
    name: 'businessLineId',
    type: String,
    required: true,
  })
  @ApiOkResponse({
    type: Mcp,
    isArray: true,
  })
  @HttpCode(HttpStatus.OK)
  findLocalMcps(
    @Request() request,
    @Param('businessLineId', ParseUUIDPipe) businessLineId: string,
  ): Promise<Mcp[]> {
    return this.businessLinesService.findLocalMcps(
      businessLineId,
      request.user,
    );
  }

  @Get(':businessLineId/local-mcps/config')
  @ApiParam({
    name: 'businessLineId',
    type: String,
    required: true,
  })
  @ApiOkResponse({
    type: LocalMcpConfigDto,
  })
  @HttpCode(HttpStatus.OK)
  getLocalMcpConfig(
    @Request() request,
    @Param('businessLineId', ParseUUIDPipe) businessLineId: string,
    @Query() query: GetLocalMcpConfigDto,
  ): Promise<LocalMcpConfigDto> {
    return this.businessLinesService.getLocalMcpConfig(
      businessLineId,
      query,
      request.user,
    );
  }

  @Post(':businessLineId/local-mcps')
  @ApiParam({
    name: 'businessLineId',
    type: String,
    required: true,
  })
  @ApiCreatedResponse({
    type: Mcp,
  })
  @HttpCode(HttpStatus.CREATED)
  createLocalMcp(
    @Request() request,
    @Param('businessLineId', ParseUUIDPipe) businessLineId: string,
    @Body() createLocalMcpDto: CreateLocalMcpDto,
  ): Promise<Mcp> {
    return this.businessLinesService.createLocalMcp(
      businessLineId,
      createLocalMcpDto,
      request.user,
    );
  }

  @Post(':businessLineId/local-mcps/import-json')
  @ApiParam({
    name: 'businessLineId',
    type: String,
    required: true,
  })
  @ApiOkResponse({
    type: ImportLocalMcpsResultDto,
  })
  @HttpCode(HttpStatus.OK)
  importLocalMcps(
    @Request() request,
    @Param('businessLineId', ParseUUIDPipe) businessLineId: string,
    @Body() importLocalMcpsDto: ImportLocalMcpsDto,
  ): Promise<ImportLocalMcpsResultDto> {
    return this.businessLinesService.importLocalMcps(
      businessLineId,
      importLocalMcpsDto,
      request.user,
    );
  }

  @Post(':businessLineId/local-skills/upload')
  @ApiParam({
    name: 'businessLineId',
    type: String,
    required: true,
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiCreatedResponse({
    type: UploadLocalSkillResultDto,
  })
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 20 * 1024 * 1024,
      },
    }),
  )
  uploadLocalSkill(
    @Request() request,
    @Param('businessLineId', ParseUUIDPipe) businessLineId: string,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<UploadLocalSkillResultDto> {
    return this.businessLinesService.uploadLocalSkill(
      businessLineId,
      file,
      request.user,
    );
  }

  @Post(':businessLineId/agent-tool-configs')
  @ApiParam({
    name: 'businessLineId',
    type: String,
    required: true,
  })
  @ApiCreatedResponse({
    type: AgentToolConfigDto,
  })
  @HttpCode(HttpStatus.CREATED)
  async createAgentToolConfig(
    @Request() request,
    @Param('businessLineId', ParseUUIDPipe) businessLineId: string,
    @Body() createAgentToolConfigDto: CreateAgentToolConfigDto,
  ): Promise<AgentToolConfigDto> {
    const config = await this.businessLinesService.createAgentToolConfig(
      businessLineId,
      createAgentToolConfigDto,
      request.user,
    );

    return this.toAgentToolConfigDto(config);
  }

  @Patch(':businessLineId/agent-tool-configs/:configId')
  @ApiParam({
    name: 'businessLineId',
    type: String,
    required: true,
  })
  @ApiParam({
    name: 'configId',
    type: String,
    required: true,
  })
  @ApiOkResponse({
    type: AgentToolConfigDto,
  })
  @HttpCode(HttpStatus.OK)
  async updateAgentToolConfig(
    @Request() request,
    @Param('businessLineId', ParseUUIDPipe) businessLineId: string,
    @Param('configId', ParseUUIDPipe) configId: string,
    @Body() updateAgentToolConfigDto: UpdateAgentToolConfigDto,
  ): Promise<AgentToolConfigDto> {
    const config = await this.businessLinesService.updateAgentToolConfig(
      businessLineId,
      configId,
      updateAgentToolConfigDto,
      request.user,
    );

    return this.toAgentToolConfigDto(config);
  }

  @Delete(':businessLineId/agent-tool-configs/:configId')
  @ApiParam({
    name: 'businessLineId',
    type: String,
    required: true,
  })
  @ApiParam({
    name: 'configId',
    type: String,
    required: true,
  })
  @ApiNoContentResponse()
  @HttpCode(HttpStatus.NO_CONTENT)
  removeAgentToolConfig(
    @Request() request,
    @Param('businessLineId', ParseUUIDPipe) businessLineId: string,
    @Param('configId', ParseUUIDPipe) configId: string,
  ): Promise<void> {
    return this.businessLinesService.removeAgentToolConfig(
      businessLineId,
      configId,
      request.user,
    );
  }

  private toAgentToolConfigDto(config: AgentToolConfig): AgentToolConfigDto {
    return {
      id: config.id,
      businessLineId: config.businessLineId,
      toolId: config.toolId,
      name: config.name,
      description: config.description ?? null,
      configJson: this.parseConfigJson(config.configJson),
      isDefault: config.isDefault,
      createdAt: config.createdAt.toISOString(),
      updatedAt: config.updatedAt.toISOString(),
    };
  }

  private parseConfigJson(value: string): Record<string, unknown> {
    if (!value.trim()) {
      return {};
    }

    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }

    return {};
  }
}
