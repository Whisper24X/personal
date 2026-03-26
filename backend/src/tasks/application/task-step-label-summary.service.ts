import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { JwtPayloadType } from '../../auth/strategies/types/jwt-payload.type';
import { Task } from '../domain/task';
import { TaskNode } from '../domain/task-node';
import { TaskAccessService } from './task-access.service';
import { TaskNodeRepository } from '../infrastructure/persistence/task-node.repository';
import { AgentRunnerService } from '../agent-runner.service';
import {
  StepSummariesRequestDto,
  StepSummariesResponseDto,
} from '../dto/step-summaries.dto';

const MAX_ITEMS = 40;
const MAX_RAW_CHARS = 800;
const MAX_LABEL_CHARS = 9;

@Injectable()
export class TaskStepLabelSummaryService {
  private readonly logger = new Logger(TaskStepLabelSummaryService.name);

  constructor(
    private readonly taskAccessService: TaskAccessService,
    private readonly taskNodeRepository: TaskNodeRepository,
    private readonly agentRunnerService: AgentRunnerService,
  ) {}

  async summarizeStepLabels(
    taskId: string,
    currentUser: JwtPayloadType,
    dto: StepSummariesRequestDto,
  ): Promise<StepSummariesResponseDto> {
    const { task, project } =
      await this.taskAccessService.assertCanAccessTaskProject(
        taskId,
        currentUser,
      );

    const items = (dto.items ?? []).slice(0, MAX_ITEMS).map((item) => ({
      id: item.id.trim(),
      rawText: this.clampRawText(item.rawText),
    }));

    if (!items.length) {
      return { items: [] };
    }

    const invalid = items.some((item) => !item.id);
    if (invalid) {
      throw new BadRequestException('Each item must have a non-empty id');
    }

    const node = await this.resolveNodeForSummary(task, dto.taskNodeId);
    if (!node) {
      throw new BadRequestException(
        'No task node available for step summaries',
      );
    }

    const prompt = this.buildPrompt(items);
    let result;
    try {
      result = await this.agentRunnerService.runWithCustomPrompt({
        task,
        node,
        project,
        prompt,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        this.isRunnerUnavailableError(message)
          ? `step_summary_runner_unavailable task=${taskId} ${message}`
          : `step_summary_runner_error task=${taskId} ${message}`,
      );
      return { items: this.fallbackItems(items) };
    }

    if (!result.success) {
      const diagnostic =
        `${result.errorMessage ?? ''} ${result.stderr.slice(0, 500)}`.trim();
      this.logger.warn(
        this.isRunnerUnavailableError(diagnostic)
          ? `step_summary_runner_unavailable task=${taskId} ${diagnostic}`
          : `step_summary_runner_failed task=${taskId} exit=${result.exitCode} stderr=${result.stderr.slice(0, 500)}`,
      );
      return { items: this.fallbackItems(items) };
    }

    const parsed = this.parseModelOutput(result.stdout, items);
    return { items: parsed };
  }

  private isRunnerUnavailableError(message: string): boolean {
    return (
      message.includes('requires docker exec handoff') ||
      message.includes('runnable task container')
    );
  }

  private clampRawText(raw: string): string {
    const t = raw.trim();
    if (t.length <= MAX_RAW_CHARS) {
      return t;
    }
    return `${t.slice(0, MAX_RAW_CHARS)}…`;
  }

  private async resolveNodeForSummary(
    task: Task,
    requestedNodeId?: string,
  ): Promise<TaskNode | null> {
    const nodes = await this.taskNodeRepository.findByTaskId(task.id);
    if (!nodes.length) {
      return null;
    }

    const sorted = [...nodes].sort(
      (left, right) => left.nodeOrder - right.nodeOrder,
    );

    if (requestedNodeId) {
      return sorted.find((node) => node.id === requestedNodeId) ?? null;
    }

    return sorted[0] ?? null;
  }

  private buildPrompt(items: Array<{ id: string; rawText: string }>): string {
    const lines = items.map((item) => `${item.id}\t${item.rawText}`);
    return [
      '你是步骤标题压缩助手。请将下列每条「步骤说明」压缩为不超过9个汉字的简短标题，用于界面步骤条展示。',
      '只输出一个 JSON 数组，不要 markdown、不要解释。数组元素格式：{"id":"<与下列 id 完全一致>","title":"<不超过9个汉字>"}。',
      '必须包含下列每一个 id，不得遗漏或改写 id。',
      '',
      '数据：',
      ...lines,
    ].join('\n');
  }

  private parseModelOutput(
    stdout: string,
    items: Array<{ id: string; rawText: string }>,
  ): Array<{ id: string; summary: string }> {
    const byId = new Map<string, string>();
    const parsed = this.extractStepSummaryJsonArray(stdout);
    if (Array.isArray(parsed)) {
      for (const row of parsed) {
        if (!row || typeof row !== 'object') {
          continue;
        }
        const record = row as Record<string, unknown>;
        const id = typeof record.id === 'string' ? record.id.trim() : '';
        const titleRaw =
          typeof record.title === 'string'
            ? record.title
            : typeof record.summary === 'string'
              ? record.summary
              : '';
        if (!id || !titleRaw.trim()) {
          continue;
        }
        byId.set(id, this.normalizeTitle(titleRaw));
      }
    } else if (stdout.trim()) {
      this.logger.warn(
        `step_summary_no_json_array stdoutPreview=${stdout.slice(0, 800)}`,
      );
    }

    return items.map((item) => ({
      id: item.id,
      summary: byId.get(item.id) ?? this.fallbackLabel(item.rawText),
    }));
  }

  /**
   * Cursor/Claude 等 CLI 常为 stream-json（每行一个 JSON），stdout 不是纯数组。
   * 先抽取 type=assistant 的正文再解析；并用平衡括号找合法 JSON 数组，避免误用 user 行里 content 中的 `[`。
   */
  private extractStepSummaryJsonArray(stdout: string): unknown | null {
    const assistantOnly = this.extractStreamJsonAssistantText(stdout);
    if (assistantOnly.trim()) {
      const fromAssistant = this.tryParseJsonArrayFromText(assistantOnly);
      if (fromAssistant) {
        return fromAssistant;
      }
    }
    return this.tryParseJsonArrayFromText(stdout);
  }

  /** stream-json NDJSON：拼接 type=assistant 的文本（与前端 cursor parser 一致） */
  private extractStreamJsonAssistantText(stdout: string): string {
    const parts: string[] = [];
    for (const line of stdout.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }
      let obj: unknown;
      try {
        obj = JSON.parse(trimmed) as Record<string, unknown>;
      } catch {
        continue;
      }
      if (!obj || typeof obj !== 'object') {
        continue;
      }
      const rec = obj as Record<string, unknown>;
      const type = typeof rec.type === 'string' ? rec.type.toLowerCase() : '';
      if (type === 'assistant') {
        const text = this.extractAssistantMessageText(rec);
        if (text) {
          parts.push(text);
        }
        continue;
      }
      if (type === 'result') {
        const r = rec.result;
        if (typeof r === 'string' && r.includes('[')) {
          parts.push(r);
        }
      }
    }
    return parts.join('\n');
  }

  private extractAssistantMessageText(
    msg: Record<string, unknown>,
  ): string | null {
    const message = msg.message;
    if (message && typeof message === 'object' && !Array.isArray(message)) {
      const m = message as Record<string, unknown>;
      const content = m.content;
      if (typeof content === 'string') {
        return content.trim() || null;
      }
      if (Array.isArray(content)) {
        const textParts: string[] = [];
        for (const item of content) {
          if (typeof item === 'string') {
            textParts.push(item);
            continue;
          }
          if (item && typeof item === 'object') {
            const r = item as Record<string, unknown>;
            const t =
              typeof r.text === 'string'
                ? r.text
                : typeof r.content === 'string'
                  ? r.content
                  : '';
            if (t) {
              textParts.push(t);
            }
          }
        }
        const joined = textParts.join('').trim();
        return joined || null;
      }
    }
    return null;
  }

  private tryParseJsonArrayFromText(raw: string): unknown | null {
    const trimmed = raw.trim();
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const body = (fenced?.[1] ?? trimmed).trim();
    return this.parseBalancedJsonArrays(body);
  }

  /** 在文本中扫描每个 `[`，用括号平衡 + 引号内忽略，找到第一个能 JSON.parse 成数组的片段 */
  private parseBalancedJsonArrays(body: string): unknown | null {
    for (let i = 0; i < body.length; i++) {
      if (body[i] !== '[') {
        continue;
      }
      const end = this.findMatchingJsonArrayEnd(body, i);
      if (end < 0) {
        continue;
      }
      const slice = body.slice(i, end + 1);
      try {
        const parsed = JSON.parse(slice) as unknown;
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch {
        continue;
      }
    }
    return null;
  }

  private findMatchingJsonArrayEnd(s: string, start: number): number {
    let depth = 0;
    let inString = false;
    let escape = false;

    for (let i = start; i < s.length; i++) {
      const c = s[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (inString) {
        if (c === '\\') {
          escape = true;
          continue;
        }
        if (c === '"') {
          inString = false;
        }
        continue;
      }
      if (c === '"') {
        inString = true;
        continue;
      }
      if (c === '[') {
        depth++;
      } else if (c === ']') {
        depth--;
        if (depth === 0) {
          return i;
        }
      }
    }
    return -1;
  }

  private normalizeTitle(title: string): string {
    const collapsed = title.replace(/\s+/g, '').trim();
    return this.clipLabel(collapsed || '…');
  }

  private fallbackItems(
    items: Array<{ id: string; rawText: string }>,
  ): Array<{ id: string; summary: string }> {
    return items.map((item) => ({
      id: item.id,
      summary: this.fallbackLabel(item.rawText),
    }));
  }

  private fallbackLabel(rawText: string): string {
    return this.clipLabel(rawText.trim() || '…');
  }

  private clipLabel(text: string): string {
    if (text.length <= MAX_LABEL_CHARS) {
      return text;
    }
    return `${text.slice(0, MAX_LABEL_CHARS - 1)}…`;
  }
}
