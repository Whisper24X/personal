import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessModule } from '../access/access.module';
import { AgentExecutionModule } from '../agent-execution/agent-execution.module';
import { BusinessLinesModule } from '../business-lines/business-lines.module';
import { ContainersModule } from '../containers/containers.module';
import { LocalMcpProbeService } from '../business-lines/local-mcp-probe.service';
import { GitModule } from '../git/git.module';
import { McpsController } from './mcps.controller';
import { McpsService } from './mcps.service';
import { ProjectsModule } from '../projects/projects.module';
import { ProjectMcpOAuthConnectionEntity } from './infrastructure/persistence/relational/entities/project-mcp-oauth-connection.entity';
import { ProjectMcpOAuthSessionEntity } from './infrastructure/persistence/relational/entities/project-mcp-oauth-session.entity';
import { OAuthMcpProviderRegistry } from './oauth-providers/oauth-mcp-provider.registry';
import { ProjectMcpOAuthService } from './project-mcp-oauth.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProjectMcpOAuthConnectionEntity,
      ProjectMcpOAuthSessionEntity,
    ]),
    ProjectsModule,
    GitModule,
    AccessModule,
    AgentExecutionModule,
    ContainersModule,
    BusinessLinesModule,
  ],
  controllers: [McpsController],
  providers: [
    McpsService,
    LocalMcpProbeService,
    OAuthMcpProviderRegistry,
    ProjectMcpOAuthService,
  ],
  exports: [McpsService],
})
export class McpsModule {}
