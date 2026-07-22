import { Injectable } from '@nestjs/common';
import path from 'path';
import { Project } from '../projects/domain/project';
import { Task } from '../tasks/domain/task';
import { TaskNode } from '../tasks/domain/task-node';

export type PromptTemplateRuntimeContext = {
  gitBranch?: string | null;
  gitBaseBranch?: string | null;
  gitWorktree?: string | null;
  gitWorktreePath?: string | null;
  /** When set to `runner`, MCP and path translation for Docker task execution apply. */
  executionPlane?: 'host' | 'runner' | null;
  /** In-container workspace mount (e.g. `/workspace`); used with `executionPlane: 'runner'`. */
  runnerWorkspaceMount?: string | null;
  agentAdapter?: string | null;
  agentToolConfigId?: string | null;
  agentToolConfigName?: string | null;
};

const PROMPT_TEMPLATE_VARIABLE_PATTERN =
  /\{\{\s*([A-Za-z][A-Za-z0-9]*)\s*\}\}/g;

@Injectable()
export class AgentPromptTemplateService {
  renderPromptTemplate(
    template: string,
    context: {
      task: Task;
      node: TaskNode;
      project: Project;
      runtime?: PromptTemplateRuntimeContext;
    },
  ): string {
    if (!template.trim()) {
      return template;
    }

    const values = this.buildTemplateValues(context);

    return template.replace(
      PROMPT_TEMPLATE_VARIABLE_PATTERN,
      (match, variableName: string) => {
        if (!Object.prototype.hasOwnProperty.call(values, variableName)) {
          return match;
        }

        return values[variableName] ?? '';
      },
    );
  }

  private buildTemplateValues({
    task,
    node,
    project,
    runtime,
  }: {
    task: Task;
    node: TaskNode;
    project: Project;
    runtime?: PromptTemplateRuntimeContext;
  }): Record<string, string> {
    const gitWorktreeIdentifier = this.resolveGitWorktreeIdentifier(
      runtime?.gitWorktree,
      task.gitWorktree,
    );
    const gitWorktreePath = this.resolveGitWorktreePath(
      runtime?.gitWorktreePath,
      task.gitWorktree,
    );

    return {
      gitBranch: this.normalizeOptionalString(
        runtime?.gitBranch ?? task.gitBranch,
      ),
      gitBaseBranch: this.normalizeOptionalString(
        runtime?.gitBaseBranch ?? task.gitBaseBranch,
      ),
      gitWorktree: gitWorktreeIdentifier,
      gitWorktreePath,
      agentAdapter: this.normalizeOptionalString(runtime?.agentAdapter),
      agentToolConfigId: this.normalizeOptionalString(
        runtime?.agentToolConfigId,
      ),
      agentToolConfigName: this.normalizeOptionalString(
        runtime?.agentToolConfigName,
      ),
      taskId: this.normalizeOptionalString(task.id),
      taskTitle: this.normalizeOptionalString(task.title),
      taskPrompt: this.normalizeOptionalString(task.prompt),
      earlyExitMarkerFileName: this.normalizeOptionalString(
        this.readNodeInputString(node, 'earlyExitMarkerFileName'),
      ),
      projectId: this.normalizeOptionalString(project.id),
      projectName: this.normalizeOptionalString(project.name),
      projectGitUrl: this.normalizeOptionalString(project.gitUrl),
      projectDefaultBranch: this.normalizeOptionalString(project.defaultBranch),
    };
  }

  private readNodeInputString(node: TaskNode, key: string): string | null {
    const input = node.input;
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return null;
    }

    const value = (input as Record<string, unknown>)[key];
    return typeof value === 'string' ? value : null;
  }

  private resolveGitWorktreeIdentifier(
    runtimeGitWorktree?: string | null,
    taskGitWorktree?: string | null,
  ): string {
    const normalizedRuntimeGitWorktree =
      this.normalizeOptionalString(runtimeGitWorktree);
    if (normalizedRuntimeGitWorktree) {
      return normalizedRuntimeGitWorktree;
    }

    const normalizedTaskGitWorktree =
      this.normalizeOptionalString(taskGitWorktree);
    if (!normalizedTaskGitWorktree) {
      return '';
    }

    if (path.isAbsolute(normalizedTaskGitWorktree)) {
      return path.basename(normalizedTaskGitWorktree);
    }

    return normalizedTaskGitWorktree;
  }

  private resolveGitWorktreePath(
    runtimeGitWorktreePath?: string | null,
    taskGitWorktree?: string | null,
  ): string {
    const normalizedRuntimeGitWorktreePath = this.normalizeOptionalString(
      runtimeGitWorktreePath,
    );
    if (normalizedRuntimeGitWorktreePath) {
      return normalizedRuntimeGitWorktreePath;
    }

    const normalizedTaskGitWorktree =
      this.normalizeOptionalString(taskGitWorktree);
    if (
      normalizedTaskGitWorktree &&
      path.isAbsolute(normalizedTaskGitWorktree)
    ) {
      return normalizedTaskGitWorktree;
    }

    return '';
  }

  private normalizeOptionalString(value?: string | null): string {
    if (value === undefined || value === null) {
      return '';
    }

    const normalized = value.trim();
    return normalized || '';
  }
}
