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
import { GitService } from './git.service';
import { GitBranchActionResultDto } from './dto/git-branch-action-result.dto';
import { GitBranchOperationDto } from './dto/git-branch-operation.dto';
import { GitBranchesDto } from './dto/git-branches.dto';
import { GitBranchesDetailDto } from './dto/git-branches-detail.dto';
import { GitLogDto } from './dto/git-log.dto';
import { GitPullMainDto } from './dto/git-pull-main.dto';
import { GitProjectDto } from './dto/git-project.dto';
import { GitStatusDto } from './dto/git-status.dto';

@ApiTags('Git')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'git',
  version: '1',
})
export class GitController {
  constructor(private readonly gitService: GitService) {}

  @Get('branches')
  @ApiOkResponse({ type: GitBranchesDto })
  @HttpCode(HttpStatus.OK)
  listBranches(
    @Request() request,
    @Query() query: GitProjectDto,
  ): Promise<GitBranchesDto> {
    return this.gitService.listBranches(query.projectId, request.user);
  }

  @Get('branches-detail')
  @ApiOkResponse({ type: GitBranchesDetailDto })
  @HttpCode(HttpStatus.OK)
  listBranchesDetail(
    @Request() request,
    @Query() query: GitProjectDto,
  ): Promise<GitBranchesDetailDto> {
    return this.gitService.listBranchesDetail(query.projectId, request.user);
  }

  @Get('status')
  @ApiOkResponse({ type: GitStatusDto })
  @HttpCode(HttpStatus.OK)
  readStatus(
    @Request() request,
    @Query() query: GitProjectDto,
  ): Promise<GitStatusDto> {
    return this.gitService.readStatus(query.projectId, request.user);
  }

  @Get('log')
  @ApiOkResponse({ type: GitLogDto })
  @HttpCode(HttpStatus.OK)
  readLog(
    @Request() request,
    @Query() query: GitProjectDto,
  ): Promise<GitLogDto> {
    return this.gitService.readLog(query.projectId, request.user);
  }

  @Post('pull-main')
  @ApiOkResponse({ type: GitPullMainDto })
  @HttpCode(HttpStatus.OK)
  pullMain(
    @Request() request,
    @Body() payload: GitProjectDto,
  ): Promise<GitPullMainDto> {
    return this.gitService.pullMain(payload.projectId, request.user);
  }

  @Post('pull-branch')
  @ApiOkResponse({ type: GitBranchActionResultDto })
  @HttpCode(HttpStatus.OK)
  pullBranch(
    @Request() request,
    @Body() payload: GitBranchOperationDto,
  ): Promise<GitBranchActionResultDto> {
    return this.gitService.pullBranch(
      payload.projectId,
      payload.branch,
      request.user,
    );
  }
}
