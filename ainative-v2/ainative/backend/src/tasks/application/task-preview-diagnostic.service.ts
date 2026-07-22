import { Injectable } from '@nestjs/common';
import { JwtPayloadType } from '../../auth/strategies/types/jwt-payload.type';
import { TaskLogLevel } from '../dto/task-log-level.enum';
import { ReportPreviewDiagnosticDto } from '../dto/report-preview-diagnostic.dto';
import { TaskLogRepository } from '../infrastructure/persistence/task-log.repository';
import { TaskAccessService } from './task-access.service';
import { TaskLogService } from './task-log.service';

const MESSAGE_MAX_LENGTH = 512;
const SUMMARY_MAX_LENGTH = 1024;
const STACK_MAX_LENGTH = 4000;
const DEDUPE_WINDOW_MS = 60_000;
const DEDUPE_LOOKBACK_LIMIT = 50;

@Injectable()
export class TaskPreviewDiagnosticService {
  constructor(
    private readonly taskAccessService: TaskAccessService,
    private readonly taskLogService: TaskLogService,
    private readonly taskLogRepository: TaskLogRepository,
  ) {}

  async reportDiagnostic(
    taskId: string,
    dto: ReportPreviewDiagnosticDto,
    currentUser: JwtPayloadType,
  ): Promise<void> {
    await this.taskAccessService.assertCanAccessTask(
      taskId,
      currentUser,
      'project.task.read',
    );

    const detail = this.sanitizeDetail(dto.detail ?? null);
    const message = this.clamp(
      dto.message?.trim() || this.defaultMessage(dto.kind),
      MESSAGE_MAX_LENGTH,
    );
    const summary = this.clamp(
      dto.summary?.trim() || this.defaultSummary(message, detail),
      SUMMARY_MAX_LENGTH,
    );
    const dedupeKey = this.clamp(
      dto.dedupeKey?.trim() || this.buildDedupeKey(dto.kind, summary, detail),
      128,
    );

    if (await this.wasRecentlyReported(taskId, dedupeKey)) {
      return;
    }

    await this.taskLogService.appendLog({
      taskId,
      level: TaskLogLevel.warn,
      message,
      payload: {
        category: 'preview-diagnostic',
        diagnosticKind: dto.kind,
        summary,
        dedupeKey,
        detail,
      },
    });
  }

  private defaultMessage(
    kind: ReportPreviewDiagnosticDto['kind'],
  ): string {
    return kind === 'platform-hmr-relay-failed'
      ? 'Preview HMR relay failure'
      : 'Preview runtime error';
  }

  private defaultSummary(
    fallbackMessage: string,
    detail: Record<string, unknown> | null,
  ): string {
    const directSummary =
      typeof detail?.summary === 'string' && detail.summary.trim()
        ? detail.summary.trim()
        : typeof detail?.message === 'string' && detail.message.trim()
          ? detail.message.trim()
          : fallbackMessage;
    return this.clamp(directSummary, SUMMARY_MAX_LENGTH);
  }

  private buildDedupeKey(
    kind: ReportPreviewDiagnosticDto['kind'],
    summary: string,
    detail: Record<string, unknown> | null,
  ): string {
    const source =
      typeof detail?.source === 'string' ? detail.source.trim() : '';
    const filename =
      typeof detail?.filename === 'string' ? detail.filename.trim() : '';
    const topFrame =
      typeof detail?.stack === 'string' && detail.stack.trim()
        ? detail.stack.trim().split('\n')[0]!.trim()
        : '';
    return this.clamp(
      [kind, summary, source, filename, topFrame].filter(Boolean).join('|'),
      128,
    );
  }

  private async wasRecentlyReported(
    taskId: string,
    dedupeKey: string,
  ): Promise<boolean> {
    const logs = await this.taskLogRepository.findLatestByTaskId({
      taskId,
      limit: DEDUPE_LOOKBACK_LIMIT,
    });
    const threshold = Date.now() - DEDUPE_WINDOW_MS;
    return logs.some((log) => {
      if (log.createdAt.getTime() < threshold) {
        return false;
      }
      const payload =
        log.payload && typeof log.payload === 'object' ? log.payload : null;
      return (
        payload?.category === 'preview-diagnostic' &&
        payload?.dedupeKey === dedupeKey
      );
    });
  }

  private sanitizeDetail(
    raw: Record<string, unknown> | null,
  ): Record<string, unknown> | null {
    if (!raw) {
      return null;
    }

    const result: Record<string, unknown> = {};
    const allowedKeys = [
      'source',
      'message',
      'summary',
      'rawKind',
      'filename',
      'name',
      'code',
      'status',
      'errMsg',
      'from',
      'url',
      'path',
    ] as const;

    for (const key of allowedKeys) {
      const value = raw[key];
      if (value === undefined || value === null) {
        continue;
      }
      if (typeof value === 'number' || typeof value === 'boolean') {
        result[key] = value;
        continue;
      }
      if (typeof value === 'string') {
        result[key] = this.clamp(
          key === 'url' || key === 'filename' || key === 'from'
            ? this.stripQuery(value)
            : value,
          key === 'summary' ? SUMMARY_MAX_LENGTH : MESSAGE_MAX_LENGTH,
        );
      }
    }

    if (typeof raw.stack === 'string' && raw.stack.trim()) {
      result.stack = this.clamp(raw.stack.trim(), STACK_MAX_LENGTH);
    }

    return Object.keys(result).length > 0 ? result : null;
  }

  private stripQuery(value: string): string {
    try {
      const parsed = new URL(value);
      return `${parsed.origin}${parsed.pathname}`;
    } catch {
      return value;
    }
  }

  private clamp(value: string, maxLength: number): string {
    const trimmed = value.trim();
    if (trimmed.length <= maxLength) {
      return trimmed;
    }
    return `${trimmed.slice(0, maxLength - 1)}…`;
  }
}
