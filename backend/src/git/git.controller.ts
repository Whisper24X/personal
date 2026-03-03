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
import { GitBranchesDto } from './dto/git-branches.dto';
import { GitPullMainDto } from './dto/git-pull-main.dto';
import { GitProjectDto } from './dto/git-project.dto';

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

  @Post('pull-main')
  @ApiOkResponse({ type: GitPullMainDto })
  @HttpCode(HttpStatus.OK)
  pullMain(
    @Request() request,
    @Body() payload: GitProjectDto,
  ): Promise<GitPullMainDto> {
    return this.gitService.pullMain(payload.projectId, request.user);
  }
}
