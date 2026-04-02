import { Logger } from '@nestjs/common';
import { monitorEventLoopDelay, performance } from 'node:perf_hooks';

const DEFAULT_SLOW_API_DIAGNOSTICS_THRESHOLD_MS = 500;
const DEFAULT_EVENT_LOOP_DELAY_RESOLUTION_MS = 20;
const SLOW_API_DIAGNOSTICS_ENABLED_VALUES = new Set(['1', 'true']);
const defaultLogger = new Logger('SlowApiDiagnostics');

type SlowApiDiagnosticsDetails = Record<string, unknown>;

function roundDurationMs(durationMs: number): number {
  return Math.round(durationMs * 10) / 10;
}

function durationMsFromHrtime(startedAt: bigint): number {
  return Number(process.hrtime.bigint() - startedAt) / 1_000_000;
}

function durationMsFromNanoseconds(durationNs: number): number {
  return durationNs / 1_000_000;
}

function roundRatio(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function normalizeDetails(
  details?: SlowApiDiagnosticsDetails,
): SlowApiDiagnosticsDetails {
  if (!details) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(details).filter(([, value]) => value !== undefined),
  );
}

function isSlowApiDiagnosticsEnabled(): boolean {
  const rawValue = process.env.SLOW_API_DIAGNOSTICS_ENABLED?.trim();
  if (!rawValue) {
    return false;
  }

  return SLOW_API_DIAGNOSTICS_ENABLED_VALUES.has(rawValue.toLowerCase());
}

export class SlowApiDiagnosticsSession {
  private readonly enabled = isSlowApiDiagnosticsEnabled();
  private readonly startedAt = process.hrtime.bigint();
  private readonly context: SlowApiDiagnosticsDetails;
  private readonly metrics: SlowApiDiagnosticsDetails = {};
  private readonly cpuUsageStartedAt = this.enabled
    ? process.cpuUsage()
    : undefined;
  private readonly eventLoopUtilizationStartedAt = this.enabled
    ? performance.eventLoopUtilization()
    : undefined;
  private readonly eventLoopDelayHistogram = this.enabled
    ? monitorEventLoopDelay({
        resolution: DEFAULT_EVENT_LOOP_DELAY_RESOLUTION_MS,
      })
    : undefined;
  private runtimeMetricsSnapshot?: SlowApiDiagnosticsDetails;

  constructor(
    private readonly scope: string,
    context?: SlowApiDiagnosticsDetails,
    private readonly logger: Pick<Logger, 'warn'> = defaultLogger,
  ) {
    this.context = normalizeDetails(context);
    this.eventLoopDelayHistogram?.enable();
  }

  async measure<T>(
    name: string,
    work: () => Promise<T> | T,
    details?: (result: T) => SlowApiDiagnosticsDetails,
  ): Promise<T> {
    if (!this.enabled) {
      return await work();
    }

    const startedAt = process.hrtime.bigint();

    try {
      const result = await work();
      this.record(name, durationMsFromHrtime(startedAt), details?.(result));
      return result;
    } catch (error) {
      this.record(name, durationMsFromHrtime(startedAt), {
        [`${name}Error`]:
          error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  record(
    name: string,
    durationMs: number,
    details?: SlowApiDiagnosticsDetails,
  ): void {
    if (!this.enabled) {
      return;
    }

    this.metrics[`${name}Ms`] = roundDurationMs(durationMs);
    Object.assign(this.context, normalizeDetails(details));
  }

  add(details?: SlowApiDiagnosticsDetails): void {
    if (!this.enabled) {
      return;
    }

    Object.assign(this.context, normalizeDetails(details));
  }

  flush(details?: SlowApiDiagnosticsDetails): void {
    if (!this.enabled) {
      return;
    }

    const totalMs = roundDurationMs(durationMsFromHrtime(this.startedAt));
    const runtimeMetrics = this.captureRuntimeMetrics(totalMs);

    if (totalMs < DEFAULT_SLOW_API_DIAGNOSTICS_THRESHOLD_MS) {
      return;
    }

    const payload = {
      scope: this.scope,
      totalMs,
      ...this.context,
      ...normalizeDetails(details),
      ...runtimeMetrics,
      ...this.metrics,
    };

    this.logger.warn(JSON.stringify(payload));
  }

  private captureRuntimeMetrics(totalMs: number): SlowApiDiagnosticsDetails {
    if (this.runtimeMetricsSnapshot) {
      return this.runtimeMetricsSnapshot;
    }

    const details: SlowApiDiagnosticsDetails = {};

    if (this.cpuUsageStartedAt) {
      const cpuUsage = process.cpuUsage(this.cpuUsageStartedAt);
      const cpuUserMs = roundDurationMs(cpuUsage.user / 1_000);
      const cpuSystemMs = roundDurationMs(cpuUsage.system / 1_000);
      const cpuTotalMs = roundDurationMs(cpuUserMs + cpuSystemMs);

      details.cpuUserMs = cpuUserMs;
      details.cpuSystemMs = cpuSystemMs;
      details.cpuTotalMs = cpuTotalMs;
      details.cpuPercent =
        totalMs > 0 ? roundRatio((cpuTotalMs / totalMs) * 100) : 0;
    }

    if (this.eventLoopUtilizationStartedAt) {
      const eventLoopUtilization = performance.eventLoopUtilization(
        this.eventLoopUtilizationStartedAt,
      );

      details.eventLoopActiveMs = roundDurationMs(eventLoopUtilization.active);
      details.eventLoopIdleMs = roundDurationMs(eventLoopUtilization.idle);
      details.eventLoopUtilization = roundRatio(
        eventLoopUtilization.utilization,
      );
    }

    if (this.eventLoopDelayHistogram) {
      this.eventLoopDelayHistogram.disable();
      const histogram = this.eventLoopDelayHistogram;

      details.eventLoopDelayResolutionMs =
        DEFAULT_EVENT_LOOP_DELAY_RESOLUTION_MS;

      if (histogram.max > 0) {
        details.eventLoopDelayMinMs = roundDurationMs(
          durationMsFromNanoseconds(histogram.min),
        );
        details.eventLoopDelayMeanMs = roundDurationMs(
          durationMsFromNanoseconds(histogram.mean),
        );
        details.eventLoopDelayP99Ms = roundDurationMs(
          durationMsFromNanoseconds(histogram.percentile(99)),
        );
        details.eventLoopDelayMaxMs = roundDurationMs(
          durationMsFromNanoseconds(histogram.max),
        );
        details.eventLoopDelayStddevMs = roundDurationMs(
          durationMsFromNanoseconds(histogram.stddev),
        );
      }

      details.eventLoopDelayExceeded = histogram.exceeds;
    }

    this.runtimeMetricsSnapshot = details;
    return details;
  }
}

export function createSlowApiDiagnostics(
  scope: string,
  context?: SlowApiDiagnosticsDetails,
  logger?: Pick<Logger, 'warn'>,
): SlowApiDiagnosticsSession {
  return new SlowApiDiagnosticsSession(scope, context, logger);
}
