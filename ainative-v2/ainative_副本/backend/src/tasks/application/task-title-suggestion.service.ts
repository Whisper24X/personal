import { Injectable, Logger } from '@nestjs/common';
import { ControlPlaneAgentExecutionService } from '../../agent-execution/control-plane-agent-execution.service';
import { JwtPayloadType } from '../../auth/strategies/types/jwt-payload.type';
import { ProjectAccessService } from '../../projects/project-access.service';
import { Project } from '../../projects/domain/project';
import { Task } from '../domain/task';
import { TaskNode } from '../domain/task-node';
import { TaskLogLevel } from '../dto/task-log-level.enum';
import { TaskRepository } from '../infrastructure/persistence/task.repository';
import { TaskNodeRepository } from '../infrastructure/persistence/task-node.repository';
import { TaskLogService } from './task-log.service';
import { TaskAccessService } from './task-access.service';
import {
  MAX_TASK_TITLE_DB,
  initialTitleFromPrompt,
} from '../utils/task-title-placeholder';

const MAX_PROMPT_IN_PROMPT = 8000;

type TitleSuggestionSkipReason =
  | 'no_prompt'
  | 'title_not_placeholder'
  | 'no_first_node'
  | 'generated_same_as_current';

type TitleSuggestionFallbackReason =
  | 'execution_error'
  | 'execution_failed'
  | 'parse_failed';

type TitleGenerationResult = {
  title: string;
  usedFallback: boolean;
  fallbackReason: TitleSuggestionFallbackReason | null;
};

@Injectable()
export class TaskTitleSuggestionService {
  private readonly logger = new Logger(TaskTitleSuggestionService.name);

  constructor(
    private readonly projectAccessService: ProjectAccessService,
    private readonly controlPlaneAgentExecutionService: ControlPlaneAgentExecutionService,
    private readonly taskRepository: TaskRepository,
    private readonly taskNodeRepository: TaskNodeRepository,
    private readonly taskLogService: TaskLogService,
    private readonly taskAccessService: TaskAccessService,
  ) {}

  /**
   * 创建任务成功后异步生成标题并写库；失败仅打日志，不抛错。
   */
  async regenerateTitleAfterCreate(
    taskId: string,
    currentUser: JwtPayloadType,
  ): Promise<void> {
    try {
      const task = await this.taskAccessService.getTaskOrThrow(
        taskId,
        currentUser,
        'project.task.read',
      );
      const promptText = task.prompt?.trim() ?? '';
      if (!promptText) {
        this.logTitleSuggestionSkip({
          taskId: task.id,
          currentTitle: task.title,
          skipReason: 'no_prompt',
        });
        return;
      }
      const placeholderTitle = initialTitleFromPrompt(promptText);
      if (task.title !== placeholderTitle) {
        this.logTitleSuggestionSkip({
          taskId: task.id,
          currentTitle: task.title,
          skipReason: 'title_not_placeholder',
          placeholderTitle,
        });
        return;
      }
      const project = await this.projectAccessService.assertProjectCapability(
        task.projectId,
        currentUser,
        'project.task.read',
      );
      const nodes = await this.taskNodeRepository.findByTaskId(taskId);
      const sorted = [...nodes].sort(
        (left, right) => left.nodeOrder - right.nodeOrder,
      );
      const firstNode = sorted[0];
      if (!firstNode) {
        this.logTitleSuggestionSkip({
          taskId: task.id,
          currentTitle: task.title,
          skipReason: 'no_first_node',
        });
        return;
      }
      const clampedPrompt =
        promptText.length > MAX_PROMPT_IN_PROMPT
          ? `${promptText.slice(0, MAX_PROMPT_IN_PROMPT)}…`
          : promptText;
      const generation = await this.generateTitleFromClampedPrompt(
        project,
        task,
        firstNode,
        clampedPrompt,
      );
      if (generation.usedFallback) {
        this.logTitleSuggestionEvent('task_title_suggest_fallback', {
          taskId: task.id,
          currentTitle: task.title,
          generatedTitle: generation.title,
          fallbackReason: generation.fallbackReason,
          updated: false,
        });
      }
      if (generation.title === task.title) {
        this.logTitleSuggestionSkip({
          taskId: task.id,
          currentTitle: task.title,
          generatedTitle: generation.title,
          skipReason: 'generated_same_as_current',
          usedFallback: generation.usedFallback,
        });
        return;
      }
      this.logTitleSuggestionEvent('task_title_suggest_update_started', {
        taskId: task.id,
        currentTitle: task.title,
        generatedTitle: generation.title,
        usedFallback: generation.usedFallback,
        updated: false,
      });
      await this.taskRepository.update(task.id, { title: generation.title });
      await this.taskLogService.appendLog({
        taskId: task.id,
        taskNodeId: null,
        level: TaskLogLevel.info,
        message: 'Task title generated',
        payload: null,
      });
      this.logTitleSuggestionEvent('task_title_suggest_update_completed', {
        taskId: task.id,
        previousTitle: task.title,
        generatedTitle: generation.title,
        usedFallback: generation.usedFallback,
        updated: true,
      });
    } catch (error) {
      this.logger.warn(
        `task_title_regenerate_after_create_error taskId=${taskId} ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async generateTitleFromClampedPrompt(
    project: Project,
    task: Task,
    node: TaskNode,
    clampedPrompt: string,
  ): Promise<TitleGenerationResult> {
    const llmPrompt = [
      '你是任务标题生成助手。根据用户的任务说明，生成一个简短、清晰的中文任务标题。',
      `标题长度不超过 ${Math.min(30, MAX_TASK_TITLE_DB)} 个字符。`,
      '只输出一行 JSON，不要 markdown、不要解释。格式：{"title":"你的标题"}',
      '',
      '用户说明：',
      clampedPrompt,
    ].join('\n');

    let result;
    try {
      result = await this.controlPlaneAgentExecutionService.executeCustomPrompt(
        {
          task,
          node,
          project,
          prompt: llmPrompt,
        },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        this.isExecutionUnavailableError(message)
          ? `task_title_suggest_execution_unavailable ${message}`
          : `task_title_suggest_execution_error ${message}`,
      );
      return this.buildFallbackGeneration(clampedPrompt, 'execution_error');
    }

    if (!result.success) {
      const diagnostic =
        `${result.errorMessage ?? ''} ${result.stderr.slice(0, 400)}`.trim();
      this.logger.warn(
        this.isExecutionUnavailableError(diagnostic)
          ? `task_title_suggest_execution_unavailable ${diagnostic}`
          : `task_title_suggest_execution_failed exit=${result.exitCode} stderr=${result.stderr.slice(0, 400)}`,
      );
      return this.buildFallbackGeneration(clampedPrompt, 'execution_failed');
    }

    const parsed = this.parseTitleFromStdout(result.stdout);
    if (parsed) {
      return {
        title: this.clipTitle(parsed),
        usedFallback: false,
        fallbackReason: null,
      };
    }

    return this.buildFallbackGeneration(clampedPrompt, 'parse_failed');
  }

  private isExecutionUnavailableError(message: string): boolean {
    return (
      message.includes('requires docker exec handoff') ||
      message.includes('runnable task container') ||
      message.includes('not found') ||
      message.includes('ENOENT')
    );
  }

  private parseTitleFromStdout(stdout: string): string | null {
    const assistantBlob = this.extractNdjsonAssistantText(stdout);
    const candidates = [assistantBlob, stdout].filter(Boolean);

    for (const text of candidates) {
      const fromJson = this.tryParseTitleJson(text);
      if (fromJson) {
        return fromJson;
      }
    }

    return null;
  }

  /** 兼容 Cursor/Codex 等 NDJSON 输出，提取 assistant/agent_message 正文 */
  private extractNdjsonAssistantText(stdout: string): string {
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
      const text = this.extractAssistantTextFromRecord(rec);
      if (text) {
        parts.push(text);
      }
    }
    return parts.join('\n');
  }

  private extractAssistantTextFromRecord(
    record: Record<string, unknown>,
  ): string | null {
    const queue: Array<Record<string, unknown>> = [record];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) {
        continue;
      }

      if (this.isAssistantLikeRecord(current)) {
        const text = this.extractAssistantMessageText(current);
        if (text) {
          return text;
        }
      }

      ['item', 'message', 'params', 'result', 'event'].forEach((key) => {
        const nested = current[key];
        if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
          queue.push(nested as Record<string, unknown>);
        }
      });
    }

    return null;
  }

  private isAssistantLikeRecord(record: Record<string, unknown>): boolean {
    return ['type', 'event', 'method', 'kind', 'role', 'subtype'].some(
      (key) => {
        const value = record[key];
        if (typeof value !== 'string') {
          return false;
        }
        const normalized = value.trim().toLowerCase().replace(/\./g, '_');
        return (
          normalized === 'assistant' ||
          normalized === 'assistant_message' ||
          normalized === 'agent_message' ||
          normalized === 'agent_message_delta' ||
          normalized === 'model'
        );
      },
    );
  }

  private extractAssistantMessageText(
    msg: Record<string, unknown>,
  ): string | null {
    const candidates = [
      msg.text,
      msg.content,
      msg.message,
      msg.output,
      msg.result,
    ];

    for (const candidate of candidates) {
      const text = this.extractTextContent(candidate);
      if (text) {
        return text;
      }
    }

    return null;
  }

  private extractTextContent(value: unknown): string | null {
    if (typeof value === 'string') {
      return value.trim() || null;
    }

    if (Array.isArray(value)) {
      const textParts = value
        .map((item) => this.extractTextContent(item))
        .filter((item): item is string => Boolean(item));
      const joined = textParts.join('').trim();
      return joined || null;
    }

    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      for (const key of ['text', 'content', 'message', 'output', 'result']) {
        const text = this.extractTextContent(record[key]);
        if (text) {
          return text;
        }
      }
    }

    return null;
  }

  private tryParseTitleJson(text: string): string | null {
    const trimmed = text.trim();
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const body = (fenced?.[1] ?? trimmed).trim();

    for (let i = 0; i < body.length; i++) {
      if (body[i] !== '{') {
        continue;
      }
      const end = this.findMatchingJsonObjectEnd(body, i);
      if (end < 0) {
        continue;
      }
      const slice = body.slice(i, end + 1);
      try {
        const parsed = JSON.parse(slice) as unknown;
        if (
          parsed &&
          typeof parsed === 'object' &&
          !Array.isArray(parsed) &&
          typeof (parsed as Record<string, unknown>).title === 'string'
        ) {
          return String((parsed as Record<string, unknown>).title).trim();
        }
      } catch {
        continue;
      }
    }
    return null;
  }

  private findMatchingJsonObjectEnd(s: string, start: number): number {
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
      if (c === '{') {
        depth++;
      } else if (c === '}') {
        depth--;
        if (depth === 0) {
          return i;
        }
      }
    }
    return -1;
  }

  private clipTitle(title: string): string {
    const t = title.replace(/\s+/g, ' ').trim();
    if (!t) {
      return '新建任务';
    }
    if (t.length <= MAX_TASK_TITLE_DB) {
      return t;
    }
    return `${t.slice(0, MAX_TASK_TITLE_DB - 1)}…`;
  }

  private fallbackTitle(prompt: string): string {
    const line = prompt.split('\n')[0]?.trim() || prompt;
    const base = line.slice(0, 40).trim() || '新建任务';
    return this.clipTitle(base);
  }

  private buildFallbackGeneration(
    prompt: string,
    reason: TitleSuggestionFallbackReason,
  ): TitleGenerationResult {
    return {
      title: this.fallbackTitle(prompt),
      usedFallback: true,
      fallbackReason: reason,
    };
  }

  private logTitleSuggestionSkip({
    taskId,
    currentTitle,
    skipReason,
    generatedTitle,
    placeholderTitle,
    usedFallback,
  }: {
    taskId: string;
    currentTitle: string;
    skipReason: TitleSuggestionSkipReason;
    generatedTitle?: string;
    placeholderTitle?: string;
    usedFallback?: boolean;
  }): void {
    this.logTitleSuggestionEvent('task_title_suggest_skipped', {
      taskId,
      currentTitle,
      generatedTitle: generatedTitle ?? null,
      placeholderTitle: placeholderTitle ?? null,
      skipReason,
      usedFallback: usedFallback ?? false,
      updated: false,
    });
  }

  private logTitleSuggestionEvent(
    event: string,
    payload: Record<string, unknown>,
  ): void {
    this.logger.log(`${event} ${JSON.stringify(payload)}`);
  }
}
