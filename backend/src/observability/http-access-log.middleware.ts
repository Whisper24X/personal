import { Logger } from '@nestjs/common';
import { type NextFunction, type Request, type Response } from 'express';

type HttpAccessLogPayload = {
  method: string;
  url: string;
  durationMs: number;
  statusCode?: number;
  aborted?: boolean;
};

type HttpAccessLogLevel = 'log' | 'warn';
type HttpAccessLogLevelPayload = Pick<
  HttpAccessLogPayload,
  'durationMs' | 'statusCode' | 'aborted'
>;
const SLOW_HTTP_REQUEST_THRESHOLD_MS = 500;
const DEFAULT_HTTP_ACCESS_LOG_IGNORED_PATHS = new Set(['/']);

export function formatHttpAccessLogMessage({
  method,
  url,
  durationMs,
  statusCode,
  aborted = false,
}: HttpAccessLogPayload): string {
  const normalizedMethod = method.toUpperCase();
  const normalizedDurationMs = durationMs.toFixed(1);

  if (aborted) {
    return `${normalizedMethod} ${url} aborted ${normalizedDurationMs}ms`;
  }

  return `${normalizedMethod} ${url} ${statusCode ?? '-'} ${normalizedDurationMs}ms`;
}

export function resolveHttpAccessLogLevel({
  durationMs,
  statusCode,
  aborted = false,
}: HttpAccessLogLevelPayload): HttpAccessLogLevel {
  if (
    aborted ||
    durationMs >= SLOW_HTTP_REQUEST_THRESHOLD_MS ||
    (statusCode ?? 0) >= 500
  ) {
    return 'warn';
  }

  return 'log';
}

export function shouldIgnoreHttpAccessLog(url: string): boolean {
  const pathname = url.split('?', 1)[0] || '/';

  return DEFAULT_HTTP_ACCESS_LOG_IGNORED_PATHS.has(pathname);
}

type CreateHttpAccessLogMiddlewareOptions = {
  enabled: boolean;
  logger?: Pick<Logger, 'log' | 'warn'>;
};

export function createHttpAccessLogMiddleware({
  enabled,
  logger = new Logger('HttpAccessLogMiddleware'),
}: CreateHttpAccessLogMiddlewareOptions) {
  return (req: Request, res: Response, next: NextFunction) => {
    const url = req.originalUrl || req.url;

    if (!enabled || shouldIgnoreHttpAccessLog(url)) {
      next();
      return;
    }

    const startedAt = process.hrtime.bigint();
    const method = req.method;
    let logged = false;

    const emitLog = (aborted: boolean) => {
      if (logged) {
        return;
      }
      logged = true;

      const durationMs =
        Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      const statusCode = aborted ? undefined : res.statusCode;
      const message = formatHttpAccessLogMessage({
        method,
        url,
        durationMs,
        statusCode,
        aborted,
      });
      const level = resolveHttpAccessLogLevel({
        durationMs,
        statusCode,
        aborted,
      });

      if (level === 'warn') {
        logger.warn(message);
        return;
      }

      logger.log(message);
    };

    res.once('finish', () => {
      emitLog(false);
    });

    res.once('close', () => {
      if (!res.writableEnded) {
        emitLog(true);
      }
    });

    next();
  };
}
