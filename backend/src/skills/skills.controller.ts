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
import { SkillsService } from './skills.service';
import { Skill } from './domain/skill';
import { CreateSkillDto } from './dto/create-skill.dto';
import { UpdateSkillDto } from './dto/update-skill.dto';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto';
import { FindAllSkillsDto } from './dto/find-all-skills.dto';
import { infinityPagination } from '../utils/infinity-pagination';

@ApiTags('Skills')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'skills',
  version: '1',
})
export class SkillsController {
  constructor(private readonly skillsService: SkillsService) {}

  @Post()
  @ApiCreatedResponse({ type: Skill })
  @HttpCode(HttpStatus.CREATED)
  create(@Request() request, @Body() createSkillDto: CreateSkillDto) {
    return this.skillsService.create(createSkillDto, request.user);
  }

  @Get()
  @ApiOkResponse({ type: InfinityPaginationResponse(Skill) })
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Query() query: FindAllSkillsDto,
  ): Promise<InfinityPaginationResponseDto<Skill>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;

    if (limit > 50) {
      limit = 50;
    }

    return infinityPagination(
      await this.skillsService.findAllWithPagination({
        ...query,
        page,
        limit,
      }),
      {
        page,
        limit,
      },
    );
  }

  @Get(':id')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: Skill })
  @HttpCode(HttpStatus.OK)
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.skillsService.findById(id);
  }

  @Patch(':id')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: Skill })
  @HttpCode(HttpStatus.OK)
  update(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateSkillDto: UpdateSkillDto,
  ) {
    return this.skillsService.update(id, updateSkillDto, request.user);
  }

  @Delete(':id')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiNoContentResponse()
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Request() request, @Param('id', ParseUUIDPipe) id: string) {
    return this.skillsService.remove(id, request.user);
  }
}
