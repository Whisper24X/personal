import { Injectable, Logger } from '@nestjs/common';
import { JwtPayloadType } from '../../auth/strategies/types/jwt-payload.type';
import { ProjectsService } from '../../projects/projects.service';
import { Project } from '../../projects/domain/project';
import { Task } from '../domain/task';
import { TaskNode } from '../domain/task-node';
import { TaskLogLevel } from '../dto/task-log-level.enum';
import { TaskRepository } from '../infrastructure/persistence/task.repository';
import { TaskNodeRepository } from '../infrastructure/persistence/task-node.repository';
import { ControlPlaneAgentExecutionService } from '../control-plane-agent-execution.service';
import { TaskLogService } from './task-log.service';
import { TaskAccessService } from './task-access.service';
import {
  MAX_TASK_TITLE_DB,
  initialTitleFromPrompt,
} from '../utils/task-title-placeholder';

const MAX_PROMPT_IN_PROMPT = 8000;

@Injectable()
export class TaskTitleSuggestionService {
  private readonly logger = new Logger(TaskTitleSuggestionService.name);

  constructor(
    private readonly projectsService: ProjectsService,
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
        return;
      }
      if (task.title !== initialTitleFromPrompt(promptText)) {
        return;
      }
      const project = await this.projectsService.assertProjectCapability(
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
        return;
      }
      const clampedPrompt =
        promptText.length > MAX_PROMPT_IN_PROMPT
          ? `${promptText.slice(0, MAX_PROMPT_IN_PROMPT)}…`
          : promptText;
      const generatedTitle = await this.generateTitleFromClampedPrompt(
        project,
        task,
        firstNode,
        clampedPrompt,
      );
      if (generatedTitle === task.title) {
        return;
      }
      await this.taskRepository.update(task.id, { title: generatedTitle });
      await this.taskLogService.appendLog({
        taskId: task.id,
        taskNodeId: null,
        level: TaskLogLevel.info,
        message: 'Task title generated',
        payload: null,
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
  ): Promise<string> {
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
      return this.fallbackTitle(clampedPrompt);
    }

    if (!result.success) {
      const diagnostic =
        `${result.errorMessage ?? ''} ${result.stderr.slice(0, 400)}`.trim();
      this.logger.warn(
        this.isExecutionUnavailableError(diagnostic)
          ? `task_title_suggest_execution_unavailable ${diagnostic}`
          : `task_title_suggest_execution_failed exit=${result.exitCode} stderr=${result.stderr.slice(0, 400)}`,
      );
      return this.fallbackTitle(clampedPrompt);
    }

    const parsed = this.parseTitleFromStdout(result.stdout);
    return parsed ? this.clipTitle(parsed) : this.fallbackTitle(clampedPrompt);
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

  /** 与步骤摘要类似：拼接 Cursor stream-json 中 type=assistant 的正文 */
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
      const type = typeof rec.type === 'string' ? rec.type.toLowerCase() : '';
      if (type === 'assistant') {
        const text = this.extractAssistantMessageText(rec);
        if (text) {
          parts.push(text);
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
}
