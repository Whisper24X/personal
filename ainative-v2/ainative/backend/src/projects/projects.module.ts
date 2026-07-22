import { forwardRef, Module } from '@nestjs/common';
import { AgentExecutionModule } from '../agent-execution/agent-execution.module';
import { ProjectWorkspaceModule } from '../project-workspace/project-workspace.module';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { RelationalProjectPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { UsersModule } from '../users/users.module';
import { BusinessLinesModule } from '../business-lines/business-lines.module';
import { RelationalTaskPersistenceModule } from '../tasks/infrastructure/persistence/relational/relational-persistence.module';
import { AccessModule } from '../access/access.module';
import { RelationalWorkflowTemplatePersistenceModule } from '../workflow-templates/infrastructure/persistence/relational/relational-persistence.module';
import { ContainersModule } from '../containers/containers.module';
import { ProjectAccessService } from './project-access.service';
import { ProjectDeployService } from './project-deploy.service';
import { ProjectDocsService } from './project-docs.service';
import { ProjectKnowledgeService } from './project-knowledge.service';
import { ProjectRepositoryWorkspaceService } from './project-repository-workspace.service';
import { ProjectRepositoryProvisioningService } from './project-repository-provisioning.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { SnapshotSyncModule } from '../git/snapshot-sync.module';
import { WorkspaceNativeModule } from '../git/workspace-native.module';
import { WorkspaceNativeDeployService } from '../tasks/application/workspace-native-deploy.service';
import { RelationalGoalPersistenceModule } from '../goals/infrastructure/persistence/relational/relational-persistence.module';

@Module({
  imports: [
    forwardRef(() => AgentExecutionModule),
    ProjectWorkspaceModule,
    RelationalProjectPersistenceModule,
    RelationalGoalPersistenceModule,
    RelationalTaskPersistenceModule,
    RelationalWorkflowTemplatePersistenceModule,
    ContainersModule,
    UsersModule,
    forwardRef(() => BusinessLinesModule),
    AccessModule,
    NotificationsModule,
    SnapshotSyncModule,
    WorkspaceNativeModule,
  ],
  controllers: [ProjectsController],
  providers: [
    ProjectsService,
    ProjectAccessService,
    ProjectDocsService,
    ProjectKnowledgeService,
    ProjectDeployService,
    ProjectRepositoryWorkspaceService,
    ProjectRepositoryProvisioningService,
    WorkspaceNativeDeployService,
  ],
  exports: [
    ProjectsService,
    ProjectAccessService,
    ProjectDocsService,
    ProjectKnowledgeService,
    ProjectDeployService,
    ProjectRepositoryWorkspaceService,
    ProjectRepositoryProvisioningService,
    WorkspaceNativeDeployService,
    RelationalProjectPersistenceModule,
    SnapshotSyncModule,
    WorkspaceNativeModule,
  ],
})
export class ProjectsModule {}
