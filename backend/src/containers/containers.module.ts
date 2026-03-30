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
import { RunnerOrchestrationService } from './runner-orchestration.service';
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
    AgentProcessLauncherService,
    ProjectExecutionSlotRepository,
    ContainerOrchestrationService,
  ],
  exports: [
    ContainerExecutionConfigService,
    RunnerOrchestrationService,
    ProjectRunnerImageService,
    ContainerOrchestrationService,
    AgentProcessLauncherService,
    ProjectExecutionSlotRepository,
    IsolatedRunnerContainerService,
  ],
})
export class ContainersModule {}
