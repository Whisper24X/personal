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
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { GoalsService } from './goals.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';
import { FindGoalsDto } from './dto/find-goals.dto';
import { AddSourceDocDto } from './dto/add-source-doc.dto';
import { UnpackGoalInputZipDto } from './dto/unpack-goal-input-zip.dto';
import { GeneratePrdDto } from './dto/generate-prd.dto';
import { GeneratePlanDto } from './dto/generate-plan.dto';
import { PatchPlanItemDto } from './dto/patch-plan-item.dto';
import { PatchPlanSubTaskDto } from './dto/patch-plan-sub-task.dto';
import { MaterializeTasksDto } from './dto/materialize-tasks.dto';
import { ReplaceTaskDependenciesDto } from './dto/replace-task-dependencies.dto';
import { GoalPlanItemPrLinkDto } from './dto/goal-plan-item-pr-link.dto';
import { GitBranchMergeResultDto } from '../git/dto/git-branch-merge-result.dto';
import { Goal } from './domain/goal';
import { GoalPlanSubTask } from './domain/goal-plan-sub-task';
import { GoalDetailDto } from './dto/goal-detail.dto';
import { InfinityPaginationResponse } from '../utils/dto/infinity-pagination-response.dto';
import { Task } from '../tasks/domain/task';
import { GoalsFeatureGuard } from './goals-feature.guard';

@ApiTags('Goals')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), GoalsFeatureGuard)
@Controller({
  path: 'goals',
  version: '1',
})
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  @Post()
  @ApiCreatedResponse({ type: Goal })
  @HttpCode(HttpStatus.CREATED)
  create(@Request() request, @Body() dto: CreateGoalDto) {
    return this.goalsService.create(dto, request.user);
  }

  @Get()
  @ApiOkResponse({ type: InfinityPaginationResponse(Goal) })
  findAll(@Request() request, @Query() query: FindGoalsDto) {
    return this.goalsService.findAll(query, request.user);
  }

  /** 软删除（POST 与 DELETE 等价；部分环境对 DELETE 支持不佳） */
  @Post(':id/remove')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: '软删除需求' })
  removeByPost(@Request() request, @Param('id', ParseUUIDPipe) id: string) {
    return this.goalsService.remove(id, request.user);
  }

  @Get(':id')
  @ApiOkResponse({ type: GoalDetailDto })
  findOne(@Request() request, @Param('id', ParseUUIDPipe) id: string) {
    return this.goalsService.findOne(id, request.user);
  }

  @Patch(':id')
  @ApiOkResponse({ type: Goal })
  update(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGoalDto,
  ) {
    return this.goalsService.update(id, dto, request.user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: '软删除需求' })
  remove(@Request() request, @Param('id', ParseUUIDPipe) id: string) {
    return this.goalsService.remove(id, request.user);
  }

  @Post(':id/source-docs')
  @ApiCreatedResponse({ description: '关联输入资料' })
  addSourceDoc(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddSourceDocDto,
  ) {
    return this.goalsService.addSourceDoc(id, dto, request.user);
  }

  @Post(':id/unpack-input-zip')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: '解压 input 目录下的 zip 并登记资料' })
  unpackInputZip(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UnpackGoalInputZipDto,
  ) {
    return this.goalsService.unpackInputZip(id, dto, request.user);
  }

  @Post(':id/generate-prd')
  @ApiOkResponse({ description: '生成 PRD' })
  generatePrd(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GeneratePrdDto,
  ) {
    return this.goalsService.generatePrd(id, dto, request.user);
  }

  @Post(':id/generate-plan')
  @ApiOkResponse({ description: '生成任务计划' })
  generatePlan(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GeneratePlanDto,
  ) {
    return this.goalsService.generatePlan(id, dto, request.user);
  }

  @Post(':id/plan-items/:itemId/pr-link')
  @ApiOkResponse({ type: GoalPlanItemPrLinkDto })
  @HttpCode(HttpStatus.OK)
  getPlanItemPrLink(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.goalsService.getPlanItemPrLink(id, itemId, request.user);
  }

  @Post(':id/plan-items/:itemId/merge-into-goal')
  @ApiOkResponse({ type: GitBranchMergeResultDto })
  @HttpCode(HttpStatus.OK)
  mergePlanItemIntoGoal(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ): Promise<GitBranchMergeResultDto> {
    return this.goalsService.mergePlanItemBranchIntoGoal(
      id,
      itemId,
      request.user,
    );
  }

  @Patch(':id/plan-items/:itemId')
  patchPlanItem(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: PatchPlanItemDto,
  ) {
    return this.goalsService.patchPlanItem(id, itemId, dto, request.user);
  }

  @Patch(':id/plan-sub-tasks/:subTaskId')
  @ApiOkResponse({ type: GoalPlanSubTask })
  patchPlanSubTask(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('subTaskId', ParseUUIDPipe) subTaskId: string,
    @Body() dto: PatchPlanSubTaskDto,
  ) {
    return this.goalsService.patchPlanSubTask(id, subTaskId, dto, request.user);
  }

  @Post(':id/materialize-tasks')
  materializeTasks(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MaterializeTasksDto,
  ) {
    return this.goalsService.materializeTasks(id, dto, request.user);
  }

  @Get(':id/tasks')
  @ApiOkResponse({ type: Task, isArray: true })
  listGoalTasks(@Request() request, @Param('id', ParseUUIDPipe) id: string) {
    return this.goalsService.listGoalTasks(id, request.user);
  }

  @Patch(':id/task-dependencies')
  replaceTaskDependencies(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplaceTaskDependenciesDto,
  ) {
    return this.goalsService.replaceTaskDependencies(id, dto, request.user);
  }
}
