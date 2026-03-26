import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RelationalTaskPersistenceModule } from '../tasks/infrastructure/persistence/relational/relational-persistence.module';
import { AgentProcessLauncherService } from './agent-process-launcher.service';
import { ContainerExecutionConfigService } from './container-execution-config.service';
import { ContainerOrchestrationService } from './container-orchestration.service';
import { ProjectExecutionSlotEntity } from './infrastructure/persistence/relational/entities/project-execution-slot.entity';
import { ProjectExecutionSlotRepository } from './infrastructure/persistence/relational/repositories/project-execution-slot.repository';
import { IsolatedRunnerContainerService } from './isolated-runner-container.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProjectExecutionSlotEntity]),
    RelationalTaskPersistenceModule,
  ],
  providers: [
    ContainerExecutionConfigService,
    IsolatedRunnerContainerService,
    AgentProcessLauncherService,
    ProjectExecutionSlotRepository,
    ContainerOrchestrationService,
  ],
  exports: [
    ContainerExecutionConfigService,
    ContainerOrchestrationService,
    AgentProcessLauncherService,
    ProjectExecutionSlotRepository,
    IsolatedRunnerContainerService,
  ],
})
export class ContainersModule {}
