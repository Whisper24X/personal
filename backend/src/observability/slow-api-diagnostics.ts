import { Logger } from '@nestjs/common';

const DEFAULT_SLOW_API_DIAGNOSTICS_THRESHOLD_MS = 500;
const SLOW_API_DIAGNOSTICS_ENABLED_VALUES = new Set(['1', 'true']);
const defaultLogger = new Logger('SlowApiDiagnostics');

type SlowApiDiagnosticsDetails = Record<string, unknown>;

function roundDurationMs(durationMs: number): number {
  return Math.round(durationMs * 10) / 10;
}

function durationMsFromHrtime(startedAt: bigint): number {
  return Number(process.hrtime.bigint() - startedAt) / 1_000_000;
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

  constructor(
    private readonly scope: string,
    context?: SlowApiDiagnosticsDetails,
    private readonly logger: Pick<Logger, 'warn'> = defaultLogger,
  ) {
    this.context = normalizeDetails(context);
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
    if (totalMs < DEFAULT_SLOW_API_DIAGNOSTICS_THRESHOLD_MS) {
      return;
    }

    const payload = {
      scope: this.scope,
      totalMs,
      ...this.context,
      ...normalizeDetails(details),
      ...this.metrics,
    };

    this.logger.warn(JSON.stringify(payload));
  }
}

export function createSlowApiDiagnostics(
  scope: string,
  context?: SlowApiDiagnosticsDetails,
  logger?: Pick<Logger, 'warn'>,
): SlowApiDiagnosticsSession {
  return new SlowApiDiagnosticsSession(scope, context, logger);
}
