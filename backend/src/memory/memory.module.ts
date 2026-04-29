import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectsModule } from '../projects/projects.module';
import { RelationalProjectPersistenceModule } from '../projects/infrastructure/persistence/relational/relational-persistence.module';
import { ProjectWorkspaceModule } from '../project-workspace/project-workspace.module';
import { RelationalTaskPersistenceModule } from '../tasks/infrastructure/persistence/relational/relational-persistence.module';
import { TasksModule } from '../tasks/tasks.module';
import { MEMORY_INGEST_ENQUEUE } from '../tasks/contracts/memory-ingest-enqueue.port';
import { AgentExecutionModule } from '../agent-execution/agent-execution.module';
import { MemoryFactSignalEntity } from './infrastructure/persistence/memory-fact-signal.entity';
import { MemoryIngestJobEntity } from './infrastructure/persistence/memory-ingest-job.entity';
import { DefaultMemoryIngestPlugin } from './plugins/default-memory-ingest.plugin';
import { DefaultMemoryInjectPlugin } from './plugins/default-memory-inject.plugin';
import { MemoryIngestEnqueueService } from './memory-ingest-enqueue.service';
import { MemoryIngestRegistry } from './memory-ingest.registry';
import { MemoryIngestWorkerService } from './memory-ingest-worker.service';
import { MemoryPluginRegistrationService } from './memory-plugin-registration.service';
import { MemoryInjectRegistry } from './memory-inject.registry';
import { MemoryLlmService } from './memory-llm.service';
import { MemoryHostService } from './memory-host.service';
import { MemoryMetricsService } from './memory-metrics.service';
import { MemoryPatchApplyService } from './memory-patch-apply.service';
import { MemoryPreprocessService } from './memory-preprocess.service';
import { MemoryPromotionService } from './memory-promotion.service';
import { MemoryTranscriptService } from './memory-transcript.service';
import { ProjectMemoryInternalDocsService } from './project-memory-internal-docs.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([MemoryIngestJobEntity, MemoryFactSignalEntity]),
    RelationalTaskPersistenceModule,
    RelationalProjectPersistenceModule,
    ProjectWorkspaceModule,
    forwardRef(() => ProjectsModule),
    forwardRef(() => TasksModule),
    forwardRef(() => AgentExecutionModule),
  ],
  providers: [
    MemoryMetricsService,
    MemoryLlmService,
    MemoryIngestRegistry,
    MemoryInjectRegistry,
    ProjectMemoryInternalDocsService,
    MemoryTranscriptService,
    MemoryPreprocessService,
    MemoryPatchApplyService,
    MemoryPromotionService,
    DefaultMemoryIngestPlugin,
    DefaultMemoryInjectPlugin,
    MemoryHostService,
    MemoryIngestEnqueueService,
    MemoryIngestWorkerService,
    MemoryPluginRegistrationService,
    {
      provide: MEMORY_INGEST_ENQUEUE,
      useExisting: MemoryIngestEnqueueService,
    },
  ],
  exports: [
    MemoryHostService,
    MEMORY_INGEST_ENQUEUE,
    MemoryIngestEnqueueService,
  ],
})
export class MemoryModule {}
