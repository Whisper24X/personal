import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MemoryIngestJobEntity } from './infrastructure/persistence/memory-ingest-job.entity';
import { loadMemoryRuntimeConfigFromEnv } from './memory-runtime.config';
import { MemoryIngestionJob } from './memory.types';
import type {
  MemoryIngestEnqueueInput,
  MemoryIngestEnqueuePort,
} from '../tasks/contracts/memory-ingest-enqueue.port';

@Injectable()
export class MemoryIngestEnqueueService implements MemoryIngestEnqueuePort {
  private readonly logger = new Logger(MemoryIngestEnqueueService.name);

  constructor(
    @InjectRepository(MemoryIngestJobEntity)
    private readonly jobRepo: Repository<MemoryIngestJobEntity>,
  ) {}

  async enqueueAfterTaskDone(input: MemoryIngestEnqueueInput): Promise<void> {
    const cfg = loadMemoryRuntimeConfigFromEnv();
    if (!cfg.extractionEnabled) {
      return;
    }
    const exists = await this.jobRepo.findOne({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (exists) {
      this.logger.debug(
        `memory_ingest_enqueue_skip duplicate key=${input.idempotencyKey}`,
      );
      return;
    }
    const job: MemoryIngestionJob = {
      kind: 'task_done',
      projectId: input.projectId,
      taskId: input.taskId,
      idempotencyKey: input.idempotencyKey,
    };
    const entity = this.jobRepo.create({
      idempotencyKey: input.idempotencyKey,
      projectId: input.projectId,
      taskId: input.taskId,
      kind: 'task_done',
      status: 'pending',
      payload: { job } as object as Record<string, unknown>,
    });
    try {
      await this.jobRepo.save(entity);
    } catch (e) {
      this.logger.warn(
        `memory_ingest_enqueue_conflict ${e instanceof Error ? e.message : e}`,
      );
    }
  }
}
