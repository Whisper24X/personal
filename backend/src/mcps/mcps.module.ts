import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { AgentExecutionModule } from '../agent-execution/agent-execution.module';
import { BusinessLinesModule } from '../business-lines/business-lines.module';
import { LocalMcpProbeService } from '../business-lines/local-mcp-probe.service';
import { GitModule } from '../git/git.module';
import { McpsController } from './mcps.controller';
import { McpsService } from './mcps.service';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [
    ProjectsModule,
    GitModule,
    AccessModule,
    AgentExecutionModule,
    BusinessLinesModule,
  ],
  controllers: [McpsController],
  providers: [McpsService, LocalMcpProbeService],
  exports: [McpsService],
})
export class McpsModule {}
