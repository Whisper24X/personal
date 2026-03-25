import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { JwtPayloadType } from '../../auth/strategies/types/jwt-payload.type';
import { ProjectsService } from '../../projects/projects.service';
import { WorkflowTemplatesService } from '../../workflow-templates/workflow-templates.service';
import { Project } from '../../projects/domain/project';
import { Task } from '../domain/task';
import { TaskNode } from '../domain/task-node';
import { TaskMode } from '../dto/task-mode.enum';
import { TaskStatus } from '../dto/task-status.enum';
import { TaskLogLevel } from '../dto/task-log-level.enum';
import { AgentRunnerService } from '../agent-runner.service';
import { TaskRepository } from '../infrastructure/persistence/task.repository';
import { TaskNodeRepository } from '../infrastructure/persistence/task-node.repository';
import { TaskConfigResolverService } from './task-config-resolver.service';
import { TaskLogService } from './task-log.service';
import { TaskAccessService } from './task-access.service';
import { SuggestTaskTitleResponseDto } from '../dto/suggest-task-title.dto';
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
    private readonly workflowTemplatesService: WorkflowTemplatesService,
    private readonly taskConfigResolver: TaskConfigResolverService,
    private readonly agentRunnerService: AgentRunnerService,
    private readonly taskRepository: TaskRepository,
    private readonly taskNodeRepository: TaskNodeRepository,
    private readonly taskLogService: TaskLogService,
    private readonly taskAccessService: TaskAccessService,
  ) {}

  async suggestTitle(
    currentUser: JwtPayloadType,
    input: {
      projectId: string;
      mode: TaskMode;
      prompt: string;
      agentCliId?: string;
      agentCliConfigId?: string;
      workflowTemplateId?: string;
    },
  ): Promise<SuggestTaskTitleResponseDto> {
    const project = await this.projectsService.assertProjectCapability(
      input.projectId,
      currentUser,
      'project.task.read',
    );

    const prompt = input.prompt.trim();
    if (!prompt) {
      throw new BadRequestException('prompt is required');
    }

    const clampedPrompt =
      prompt.length > MAX_PROMPT_IN_PROMPT
        ? `${prompt.slice(0, MAX_PROMPT_IN_PROMPT)}…`
        : prompt;

    const { agentCliId, agentCliConfigId } = await this.resolveTargetAgents(
      project,
      input,
    );

    const now = new Date();
    const taskId = randomUUID();
    const nodeId = randomUUID();

    const syntheticTask: Task = {
      id: taskId,
      projectId: project.id,
      businessLineId: project.businessLineId,
      mode: input.mode,
      title: '—',
      prompt: clampedPrompt,
      status: TaskStatus.todo,
      gitBranch: null,
      gitBaseBranch: null,
      gitWorktree: null,
      configJson:
        input.mode === TaskMode.workflow
          ? {
              workflowTemplateId: input.workflowTemplateId ?? undefined,
            }
          : {
              agentCliId,
              agentCliConfigId,
            },
      createdBy: currentUser.sub,
      startedAt: null,
      finishedAt: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    const syntheticNode: TaskNode = {
      id: nodeId,
      taskId,
      nodeOrder: 1,
      name: 'title-suggestion',
      input: {},
      agentClioutput: null,
      agentCliSessionId: null,
      agentCliId,
      agentCliConfigId,
      configJson: null,
      loopJson: null,
      runtimeJson: null,
      status: TaskStatus.todo,
      startedAt: null,
      finishedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    const title = await this.generateTitleFromClampedPrompt(
      project,
      syntheticTask,
      syntheticNode,
      clampedPrompt,
    );

    return { title };
  }

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
      const sorted = [...nodes].sort((left, right) => left.nodeOrder - right.nodeOrder);
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
      result = await this.agentRunnerService.runWithCustomPrompt({
        task,
        node,
        project,
        prompt: llmPrompt,
      });
    } catch (error) {
      this.logger.warn(
        `task_title_suggest_runner_error ${error instanceof Error ? error.message : String(error)}`,
      );
      return this.fallbackTitle(clampedPrompt);
    }

    if (!result.success) {
      this.logger.warn(
        `task_title_suggest_runner_failed exit=${result.exitCode} stderr=${result.stderr.slice(0, 400)}`,
      );
      return this.fallbackTitle(clampedPrompt);
    }

    const parsed = this.parseTitleFromStdout(result.stdout);
    return parsed
      ? this.clipTitle(parsed)
      : this.fallbackTitle(clampedPrompt);
  }

  private async resolveTargetAgents(
    project: Project,
    input: {
      mode: TaskMode;
      agentCliId?: string;
      agentCliConfigId?: string;
      workflowTemplateId?: string;
    },
  ): Promise<{ agentCliId: string; agentCliConfigId: string }> {
    if (input.mode === TaskMode.conversation) {
      const agentCliId = input.agentCliId?.trim();
      const agentCliConfigId = input.agentCliConfigId?.trim();
      if (!agentCliId || !agentCliConfigId) {
        throw new BadRequestException(
          'Conversation mode requires agentCliId and agentCliConfigId',
        );
      }
      return { agentCliId, agentCliConfigId };
    }

    const workflowTemplateId = input.workflowTemplateId?.trim();
    if (!workflowTemplateId) {
      throw new BadRequestException(
        'Workflow mode requires workflowTemplateId',
      );
    }

    const template = await this.workflowTemplatesService.getTemplateForTask({
      templateId: workflowTemplateId,
      projectId: project.id,
      projectBusinessLineId: project.businessLineId,
    });

    this.taskConfigResolver.ensureTemplateNodesSupported(template.nodesJson);

    const sorted = [...template.nodesJson].sort(
      (left, right) => left.nodeOrder - right.nodeOrder,
    );
    const first = sorted[0];
    if (!first) {
      throw new BadRequestException('Workflow template has no nodes');
    }

    const taskConfig = this.taskConfigResolver.mergeTaskConfig(
      null,
      this.taskConfigResolver.toObjectRecord({
        workflowTemplateId,
      }),
    );
    const defaultNodeExecution =
      this.taskConfigResolver.readNodeExecutionConfig(taskConfig);
    const nodeExecution =
      this.taskConfigResolver.resolveRequiredNodeExecutionConfig(
        first.input,
        defaultNodeExecution,
      );

    return {
      agentCliId: nodeExecution.agentCliId,
      agentCliConfigId: nodeExecution.agentCliConfigId,
    };
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
