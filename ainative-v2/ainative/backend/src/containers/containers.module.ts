import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RelationalProjectPersistenceModule } from '../projects/infrastructure/persistence/relational/relational-persistence.module';
import { RelationalTaskPersistenceModule } from '../tasks/infrastructure/persistence/relational/relational-persistence.module';
import { ContainerExecutionConfigService } from './container-execution-config.service';
import { ContainerOrchestrationService } from './container-orchestration.service';
import { DockerExecProcessLauncherService } from './docker-exec-process-launcher.service';
import { ProjectExecutionSlotEntity } from './infrastructure/persistence/relational/entities/project-execution-slot.entity';
import { ProjectExecutionSlotRepository } from './infrastructure/persistence/relational/repositories/project-execution-slot.repository';
import { IsolatedRunnerContainerService } from './isolated-runner-container.service';
import { RunnerOrchestrationService } from './runner-orchestration.service';
import { DatabaseIsolationService } from './database-isolation.service';
import { ProjectRunnerImageService } from './project-runner-image.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProjectExecutionSlotEntity]),
    RelationalProjectPersistenceModule,
    RelationalTaskPersistenceModule,
  ],
  providers: [
    ContainerExecutionConfigService,
    RunnerOrchestrationService,
    ProjectRunnerImageService,
    IsolatedRunnerContainerService,
    DockerExecProcessLauncherService,
    ProjectExecutionSlotRepository,
    ContainerOrchestrationService,
    DatabaseIsolationService,
  ],
  exports: [
    ContainerExecutionConfigService,
    RunnerOrchestrationService,
    ProjectRunnerImageService,
    ContainerOrchestrationService,
    DockerExecProcessLauncherService,
    ProjectExecutionSlotRepository,
    IsolatedRunnerContainerService,
    DatabaseIsolationService,
  ],
})
export class ContainersModule {}
