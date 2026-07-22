import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminProjectGitService } from './admin-project-git.service';
import { GitPhaseRecoveryRequest } from '../git/snapshot-sync.types';

@ApiTags('Admin - Project Git')
@UseGuards(AuthGuard('jwt'))
@Controller('admin/projects/:projectId/git-phase-recovery')
export class AdminProjectGitController {
  constructor(
    private readonly adminProjectGitService: AdminProjectGitService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Execute git phase recovery action' })
  async recover(
    @Request() request,
    @Param('projectId') projectId: string,
    @Body() body: GitPhaseRecoveryRequest,
  ) {
    this.ensureAdmin(request.user);
    return this.adminProjectGitService.executeRecovery(projectId, body);
  }

  @Get('diagnose')
  @ApiOperation({ summary: 'Diagnose current git phase state' })
  async diagnose(@Request() request, @Param('projectId') projectId: string) {
    this.ensureAdmin(request.user);
    return this.adminProjectGitService.diagnose(projectId);
  }

  private ensureAdmin(user: { roles?: string[] }): void {
    if (!user?.roles?.includes('admin')) {
      throw new ForbiddenException('Admin access required');
    }
  }
}
