import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MemoryMetricsService {
  private readonly logger = new Logger(MemoryMetricsService.name);
  private readonly counters = new Map<string, number>();

  increment(name: string, tags?: Record<string, string>): void {
    const n = (this.counters.get(name) ?? 0) + 1;
    this.counters.set(name, n);
    this.logger.debug(
      `metric ${name}=${n}${tags ? ` ${JSON.stringify(tags)}` : ''}`,
    );
  }

  recordValue(
    name: string,
    value: number,
    tags?: Record<string, string>,
  ): void {
    this.logger.debug(
      `metric ${name}=${value}${tags ? ` ${JSON.stringify(tags)}` : ''}`,
    );
  }
}
