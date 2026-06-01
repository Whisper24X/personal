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
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto';
import { infinityPagination } from '../utils/infinity-pagination';
import { AutomationsService } from './automations.service';
import { Automation } from './domain/automation';
import { CreateAutomationDto } from './dto/create-automation.dto';
import { FindAllAutomationsDto } from './dto/find-all-automations.dto';
import { UpdateAutomationDto } from './dto/update-automation.dto';

@ApiTags('Automations')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'automations',
  version: '1',
})
export class AutomationsController {
  constructor(private readonly automationsService: AutomationsService) {}

  @Post()
  @ApiCreatedResponse({ type: Automation })
  @HttpCode(HttpStatus.CREATED)
  create(
    @Request() request,
    @Body() createAutomationDto: CreateAutomationDto,
  ): Promise<Automation> {
    return this.automationsService.create(createAutomationDto, request.user);
  }

  @Get()
  @ApiOkResponse({ type: InfinityPaginationResponse(Automation) })
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Request() request,
    @Query() query: FindAllAutomationsDto,
  ): Promise<InfinityPaginationResponseDto<Automation>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;

    if (limit > 50) {
      limit = 50;
    }

    return infinityPagination(
      await this.automationsService.findAllWithPagination(
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

  @Get(':id')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: Automation })
  @HttpCode(HttpStatus.OK)
  findById(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Automation> {
    return this.automationsService.findById(id, request.user);
  }

  @Patch(':id')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: Automation })
  @HttpCode(HttpStatus.OK)
  update(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateAutomationDto: UpdateAutomationDto,
  ): Promise<Automation> {
    return this.automationsService.update(
      id,
      updateAutomationDto,
      request.user,
    );
  }

  @Delete(':id')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiNoContentResponse()
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.automationsService.remove(id, request.user);
  }
}
