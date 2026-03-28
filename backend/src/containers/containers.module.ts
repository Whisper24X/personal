import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RelationalProjectPersistenceModule } from '../projects/infrastructure/persistence/relational/relational-persistence.module';
import { RelationalTaskPersistenceModule } from '../tasks/infrastructure/persistence/relational/relational-persistence.module';
import { AgentProcessLauncherService } from './agent-process-launcher.service';
import { ContainerExecutionConfigService } from './container-execution-config.service';
import { ContainerOrchestrationService } from './container-orchestration.service';
import { ProjectExecutionSlotEntity } from './infrastructure/persistence/relational/entities/project-execution-slot.entity';
import { ProjectExecutionSlotRepository } from './infrastructure/persistence/relational/repositories/project-execution-slot.repository';
import { IsolatedRunnerContainerService } from './isolated-runner-container.service';
import { ProjectRunnerImageRebuildService } from './project-runner-image-rebuild.service';
import { ProjectRunnerImageService } from './project-runner-image.service';
import { ProjectRunnerTemplateDefaultsService } from './project-runner-template-defaults.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProjectExecutionSlotEntity]),
    RelationalProjectPersistenceModule,
    RelationalTaskPersistenceModule,
  ],
  providers: [
    ContainerExecutionConfigService,
    ProjectRunnerTemplateDefaultsService,
    ProjectRunnerImageService,
    ProjectRunnerImageRebuildService,
    IsolatedRunnerContainerService,
    AgentProcessLauncherService,
    ProjectExecutionSlotRepository,
    ContainerOrchestrationService,
  ],
  exports: [
    ContainerExecutionConfigService,
    ProjectRunnerTemplateDefaultsService,
    ProjectRunnerImageService,
    ProjectRunnerImageRebuildService,
    ContainerOrchestrationService,
    AgentProcessLauncherService,
    ProjectExecutionSlotRepository,
    IsolatedRunnerContainerService,
  ],
})
export class ContainersModule {}
