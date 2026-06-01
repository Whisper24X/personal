import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MemoryIngestJobEntity } from './infrastructure/persistence/memory-ingest-job.entity';
import { loadMemoryRuntimeConfigFromEnv } from './memory-runtime.config';
import { MemoryHostService } from './memory-host.service';

const POLL_MS = 3000;

@Injectable()
export class MemoryIngestWorkerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(MemoryIngestWorkerService.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    @InjectRepository(MemoryIngestJobEntity)
    private readonly jobRepo: Repository<MemoryIngestJobEntity>,
    private readonly memoryHost: MemoryHostService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.tick();
    }, POLL_MS);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  private async tick(): Promise<void> {
    const cfg = loadMemoryRuntimeConfigFromEnv();
    if (!cfg.extractionEnabled) {
      return;
    }
    const next = await this.jobRepo.findOne({
      where: { status: 'pending' },
      order: { createdAt: 'ASC' },
    });
    if (!next) {
      return;
    }
    const updated = await this.jobRepo
      .createQueryBuilder()
      .update(MemoryIngestJobEntity)
      .set({ status: 'processing' })
      .where('id = :id AND status = :st', { id: next.id, st: 'pending' })
      .execute();
    if (!updated.affected) {
      return;
    }
    try {
      const row = await this.jobRepo.findOneOrFail({ where: { id: next.id } });
      await this.memoryHost.runIngestJobRow(row);
      await this.jobRepo.update(
        { id: next.id },
        { status: 'done', error: null },
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`memory_ingest_job_failed id=${next.id} ${msg}`);
      await this.jobRepo.update(
        { id: next.id },
        { status: 'failed', error: msg },
      );
    }
  }
}
