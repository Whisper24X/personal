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
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiBody,
  ApiBearerAuth,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Express } from 'express';
import { SkillsService } from './skills.service';
import { Skill } from './domain/skill';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto';
import { FindAllSkillsDto } from './dto/find-all-skills.dto';
import { infinityPagination } from '../utils/infinity-pagination';
import { GetSkillContentDto } from './dto/get-skill-content.dto';
import { SkillContentDto } from './dto/skill-content.dto';
import { CopyBusinessLineSkillDto } from './dto/copy-business-line-skill.dto';
import { UploadProjectLocalSkillDto } from './dto/upload-project-local-skill.dto';
import { ProjectLocalSkillResultDto } from './dto/project-local-skill-result.dto';

@ApiTags('Skills')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'skills',
  version: '1',
})
export class SkillsController {
  constructor(private readonly skillsService: SkillsService) {}

  @Post('project/copy-from-business-line')
  @ApiCreatedResponse({ type: ProjectLocalSkillResultDto })
  @HttpCode(HttpStatus.CREATED)
  copyBusinessLineSkillToProject(
    @Request() request,
    @Body() copyBusinessLineSkillDto: CopyBusinessLineSkillDto,
  ) {
    return this.skillsService.copyBusinessLineSkillToProject(
      copyBusinessLineSkillDto,
      request.user,
    );
  }

  @Post('project/upload')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'projectId'],
      properties: {
        projectId: {
          type: 'string',
          format: 'uuid',
        },
        provider: {
          type: 'string',
          enum: ['codex', 'cursor', 'curso'],
        },
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiCreatedResponse({ type: ProjectLocalSkillResultDto })
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 20 * 1024 * 1024,
      },
    }),
  )
  uploadProjectLocalSkill(
    @Request() request,
    @Body() body: UploadProjectLocalSkillDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.skillsService.uploadProjectLocalSkill(body, file, request.user);
  }

  @Get()
  @ApiOkResponse({ type: InfinityPaginationResponse(Skill) })
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Request() request,
    @Query() query: FindAllSkillsDto,
  ): Promise<InfinityPaginationResponseDto<Skill>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;

    if (limit > 50) {
      limit = 50;
    }

    return infinityPagination(
      await this.skillsService.findAllWithPagination(
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

  @Get(':id/content')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: SkillContentDto })
  @HttpCode(HttpStatus.OK)
  findProjectSkillContent(
    @Request() request,
    @Param('id') id: string,
    @Query() query: GetSkillContentDto,
  ) {
    return this.skillsService.findProjectSkillContent(id, query, request.user);
  }

  @Get(':id/tree')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiQuery({ name: 'projectId', type: String, required: true })
  @HttpCode(HttpStatus.OK)
  findProjectSkillTree(
    @Request() request,
    @Param('id') id: string,
    @Query('projectId') projectId: string,
  ) {
    return this.skillsService.findProjectSkillTree(id, projectId, request.user);
  }

  @Get(':id/file')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiQuery({ name: 'projectId', type: String, required: true })
  @ApiQuery({ name: 'path', type: String, required: true })
  @HttpCode(HttpStatus.OK)
  findProjectSkillFile(
    @Request() request,
    @Param('id') id: string,
    @Query('projectId') projectId: string,
    @Query('path') filePath: string,
  ) {
    return this.skillsService.findProjectSkillFile(
      id,
      projectId,
      filePath,
      request.user,
    );
  }

  @Get(':id/download')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiQuery({ name: 'projectId', type: String, required: true })
  @HttpCode(HttpStatus.OK)
  async downloadProjectSkill(
    @Request() request,
    @Param('id') id: string,
    @Query('projectId') projectId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { buffer, fileName } = await this.skillsService.downloadProjectSkill(
      id,
      projectId,
      request.user,
    );

    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
    });

    return new StreamableFile(buffer);
  }

  @Delete('project/:skillId')
  @ApiParam({ name: 'skillId', type: String, required: true })
  @ApiQuery({ name: 'projectId', type: String, required: true })
  @ApiNoContentResponse()
  @HttpCode(HttpStatus.NO_CONTENT)
  removeProjectLocalSkill(
    @Request() request,
    @Param('skillId') skillId: string,
    @Query('projectId') projectId: string,
  ) {
    return this.skillsService.removeProjectLocalSkill(
      projectId,
      skillId,
      request.user,
    );
  }
}
