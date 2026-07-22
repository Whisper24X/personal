import {
  // do not remove this comment
  forwardRef,
  Module,
} from '@nestjs/common';
import { BusinessLineAgentToolConfigService } from './business-line-agent-tool-config.service';
import { BusinessLineCustomRoleService } from './business-line-custom-role.service';
import { BusinessLineInvitationService } from './business-line-invitation.service';
import { BusinessLineLifecycleService } from './business-line-lifecycle.service';
import { BusinessLineLocalAssetsService } from './business-line-local-assets.service';
import { BusinessLineMemberManagementService } from './business-line-member-management.service';
import { BusinessLineMembershipService } from './business-line-membership.service';
import { BusinessLineProjectRoleAssignmentService } from './business-line-project-role-assignment.service';
import { BusinessLineProjectRoleCatalogService } from './business-line-project-role-catalog.service';
import { BusinessLineRoleCatalogService } from './business-line-role-catalog.service';
import { BusinessLineRoleTemplateService } from './business-line-role-template.service';
import { BusinessLinesService } from './business-lines.service';
import { BusinessLinesController } from './business-lines.controller';
import { RunnerGenerationService } from './runner-generation.service';
import { AiRunnerConfigGenerator } from './ai-runner-config-generator';
import { RunnerOrchestrationSyncService } from './runner-orchestration-sync.service';
import { WorkspaceNativeMigrationService } from './workspace-native-migration.service';
import { RelationalBusinessLinePersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { UsersModule } from '../users/users.module';
import { RelationalProjectPersistenceModule } from '../projects/infrastructure/persistence/relational/relational-persistence.module';
import { AccessModule } from '../access/access.module';
import { AgentExecutionModule } from '../agent-execution/agent-execution.module';
import { ProjectWorkspaceModule } from '../project-workspace/project-workspace.module';
import { WorkspaceNativeModule } from '../git/workspace-native.module';
import { ContainersModule } from '../containers/containers.module';
import { RunnerConfigProbeService } from './runner-config-probe.service';

@Module({
  imports: [
    // do not remove this comment
    RelationalBusinessLinePersistenceModule,
    RelationalProjectPersistenceModule,
    UsersModule,
    AccessModule,
    forwardRef(() => AgentExecutionModule),
    ProjectWorkspaceModule,
    WorkspaceNativeModule,
    ContainersModule,
  ],
  controllers: [BusinessLinesController],
  providers: [
    BusinessLinesService,
    BusinessLineAgentToolConfigService,
    BusinessLineCustomRoleService,
    BusinessLineInvitationService,
    BusinessLineLifecycleService,
    BusinessLineLocalAssetsService,
    BusinessLineMemberManagementService,
    BusinessLineMembershipService,
    BusinessLineProjectRoleAssignmentService,
    BusinessLineProjectRoleCatalogService,
    BusinessLineRoleCatalogService,
    BusinessLineRoleTemplateService,
    RunnerGenerationService,
    AiRunnerConfigGenerator,
    RunnerOrchestrationSyncService,
    RunnerConfigProbeService,
    WorkspaceNativeMigrationService,
  ],
  exports: [
    BusinessLinesService,
    BusinessLineAgentToolConfigService,
    RelationalBusinessLinePersistenceModule,
    RunnerGenerationService,
  ],
})
export class BusinessLinesModule {}
