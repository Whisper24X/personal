import { promises as fs } from 'fs';
import { Injectable } from '@nestjs/common';
import path from 'path';
import { ControlPlaneAgentExecutionService } from '../agent-execution/control-plane-agent-execution.service';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import {
  QueryProjectDocsDto,
  QueryProjectDocsResponseDto,
} from './dto/project-doc.dto';
import { Project } from './domain/project';
import { ProjectDocsService } from './project-docs.service';
import { ProjectRepositoryWorkspaceService } from './project-repository-workspace.service';

@Injectable()
export class ProjectKnowledgeService {
  private readonly maxQueryContextChars = 24_000;
  private readonly maxQueryDocSnippetChars = 1_600;

  constructor(
    private readonly projectRepositoryWorkspaceService: ProjectRepositoryWorkspaceService,
    private readonly projectDocsService: ProjectDocsService,
    private readonly controlPlaneAgentExecutionService: ControlPlaneAgentExecutionService,
  ) {}

  async queryDocs(
    projectId: Project['id'],
    payload: QueryProjectDocsDto,
    currentUser: JwtPayloadType,
  ): Promise<QueryProjectDocsResponseDto> {
    const startAt = Date.now();
    const { project, repositoryRoot } =
      await this.projectRepositoryWorkspaceService.ensureProjectRepositoryReady(
        projectId,
        currentUser,
        { syncRemote: false },
      );
    const docsRoot = path.join(repositoryRoot, 'docs');
    const docsRootExists = await this.pathExists(docsRoot);

    if (!docsRootExists) {
      return {
        answer:
          '当前项目还没有 docs 文档，无法执行知识问答。请先上传或创建文档。',
        citations: [],
        durationMs: Date.now() - startAt,
      };
    }

    const normalizedQuestion = payload.question.trim();
    const maxContextDocs = Math.max(
      1,
      Math.min(payload.maxContextDocs ?? 6, 20),
    );
    const candidateDocs = await this.selectCandidateDocs({
      projectId,
      docsRoot,
      question: normalizedQuestion,
      maxContextDocs,
      scope: payload.scope ?? 'project',
      currentPath: payload.currentPath,
      currentUser,
    });

    if (!candidateDocs.length) {
      return {
        answer: '没有检索到相关文档内容。建议换个问法，或补充更明确的关键词。',
        citations: [],
        durationMs: Date.now() - startAt,
      };
    }

    const citations = candidateDocs.map((doc) => ({
      path: doc.path,
      snippet: this.buildCitationSnippet(doc.content),
    }));
    const prompt = this.buildKnowledgeQueryPrompt({
      question: normalizedQuestion,
      docs: candidateDocs,
    });
    const agentResult = await this.executeKnowledgeAgent({
      project,
      repositoryRoot,
      prompt,
      onChunk: undefined,
    });

    const answer =
      agentResult.success && agentResult.stdout.trim()
        ? agentResult.stdout.trim()
        : this.buildFallbackAnswer(citations, agentResult.stderr);

    return {
      answer,
      citations,
      durationMs: Date.now() - startAt,
      traceId: `docs-query-${projectId}-${Date.now()}`,
    };
  }

  async streamDocsQuery(
    projectId: Project['id'],
    payload: QueryProjectDocsDto,
    currentUser: JwtPayloadType,
    emit: (event: string, data: unknown) => void,
  ): Promise<void> {
    const startAt = Date.now();
    const { project, repositoryRoot } =
      await this.projectRepositoryWorkspaceService.ensureProjectRepositoryReady(
        projectId,
        currentUser,
        { syncRemote: false },
      );
    const docsRoot = path.join(repositoryRoot, 'docs');
    const docsRootExists = await this.pathExists(docsRoot);

    if (!docsRootExists) {
      emit('error', {
        message: '当前项目还没有 docs 文档，无法执行知识问答。',
      });
      emit('done', {
        durationMs: Date.now() - startAt,
      });
      return;
    }

    const normalizedQuestion = payload.question.trim();
    const maxContextDocs = Math.max(
      1,
      Math.min(payload.maxContextDocs ?? 6, 20),
    );
    const candidateDocs = await this.selectCandidateDocs({
      projectId,
      docsRoot,
      question: normalizedQuestion,
      maxContextDocs,
      scope: payload.scope ?? 'project',
      currentPath: payload.currentPath,
      currentUser,
    });

    if (!candidateDocs.length) {
      emit('error', {
        message: '没有检索到相关文档内容。建议换个问法，或补充更明确的关键词。',
      });
      emit('done', {
        durationMs: Date.now() - startAt,
      });
      return;
    }

    const citations = candidateDocs.map((doc) => ({
      path: doc.path,
      snippet: this.buildCitationSnippet(doc.content),
    }));
    const prompt = this.buildKnowledgeQueryPrompt({
      question: normalizedQuestion,
      docs: candidateDocs,
    });
    const agentResult = await this.executeKnowledgeAgent({
      project,
      repositoryRoot,
      prompt,
      onChunk: (chunk) => {
        if (!chunk.trim()) {
          return;
        }
        emit('chunk', { delta: chunk });
      },
    });

    if (!agentResult.success && !agentResult.stdout.trim()) {
      emit('chunk', {
        delta: this.buildFallbackAnswer(citations, agentResult.stderr),
      });
    }

    emit('citations', { citations });
    emit('done', {
      durationMs: Date.now() - startAt,
      traceId: `docs-query-${projectId}-${Date.now()}`,
    });
  }

  async executeProjectAgentPrompt(
    projectId: Project['id'],
    prompt: string,
    currentUser: JwtPayloadType,
    options?: {
      agentCliId?: string;
      agentCliConfigId?: string;
    },
  ): Promise<{ success: boolean; stdout: string; stderr: string }> {
    const { project, repositoryRoot } =
      await this.projectRepositoryWorkspaceService.ensureProjectRepositoryReady(
        projectId,
        currentUser,
        { syncRemote: false },
      );

    const cliId = options?.agentCliId?.trim();
    const cliConfigId = options?.agentCliConfigId?.trim();

    if (cliId && cliConfigId) {
      const agentResult =
        await this.controlPlaneAgentExecutionService.executeProjectPrompt({
          project,
          repositoryRoot,
          prompt,
          agentCliId: cliId,
          agentCliConfigId: cliConfigId,
        });
      const stderr =
        [agentResult.stderr, agentResult.errorMessage]
          .filter(Boolean)
          .join('\n') || '';

      return {
        success: agentResult.success,
        stdout: agentResult.stdout.trim(),
        stderr: stderr.trim(),
      };
    }

    return this.executeKnowledgeAgent({
      project,
      repositoryRoot,
      prompt,
    });
  }

  private async selectCandidateDocs({
    projectId,
    docsRoot,
    question,
    maxContextDocs,
    scope,
    currentPath,
    currentUser,
  }: {
    projectId: string;
    docsRoot: string;
    question: string;
    maxContextDocs: number;
    scope: 'project' | 'current_doc';
    currentPath?: string;
    currentUser: JwtPayloadType;
  }): Promise<Array<{ path: string; content: string }>> {
    const docs = await this.projectDocsService.listDocs(projectId, currentUser);
    if (!docs.length) {
      return [];
    }

    const normalizedCurrentPath = currentPath
      ? this.projectDocsService.normalizeProjectDocPath(currentPath)
      : null;
    const tokens = this.extractQueryTokens(question);

    const scored = docs.map((doc) => {
      let score = 0;
      const lowerPath = doc.path.toLowerCase();

      for (const token of tokens) {
        if (lowerPath.includes(token)) {
          score += 3;
        }
      }

      if (normalizedCurrentPath && doc.path === normalizedCurrentPath) {
        score += 100;
      }

      return { doc, score };
    });

    scored.sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.doc.path.localeCompare(right.doc.path);
    });

    const picked = scored
      .filter((item, index) => {
        if (scope === 'current_doc' && normalizedCurrentPath) {
          if (item.doc.path === normalizedCurrentPath) {
            return true;
          }

          return index < Math.max(2, Math.floor(maxContextDocs / 2));
        }

        return true;
      })
      .slice(0, maxContextDocs)
      .map((item) => item.doc);

    const contexts: Array<{ path: string; content: string }> = [];
    let totalChars = 0;

    for (const doc of picked) {
      const absolutePath =
        this.projectDocsService.resolveProjectDocAbsolutePath(
          docsRoot,
          doc.path,
        );
      const rawContent = await fs
        .readFile(absolutePath, 'utf-8')
        .catch(() => '');
      if (!rawContent.trim()) {
        continue;
      }

      const clipped = rawContent.slice(0, this.maxQueryDocSnippetChars);
      if (totalChars + clipped.length > this.maxQueryContextChars) {
        break;
      }

      contexts.push({
        path: doc.path,
        content: clipped,
      });
      totalChars += clipped.length;
    }

    return contexts;
  }

  private extractQueryTokens(question: string): string[] {
    const rawTokens = question
      .toLowerCase()
      .split(/[\s,，。！？!?:：;；、/\\|()[\]{}"'`]+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 2);

    return Array.from(new Set(rawTokens)).slice(0, 12);
  }

  private buildCitationSnippet(content: string): string {
    const normalized = content.replace(/\s+/g, ' ').trim();
    if (!normalized) {
      return '';
    }

    if (normalized.length <= 220) {
      return normalized;
    }

    return `${normalized.slice(0, 220)}...`;
  }

  private buildKnowledgeQueryPrompt({
    question,
    docs,
  }: {
    question: string;
    docs: Array<{ path: string; content: string }>;
  }): string {
    const contextBlocks = docs.map((doc, index) =>
      [
        `## Document ${index + 1}`,
        `Path: ${doc.path}`,
        'Content:',
        doc.content,
      ].join('\n'),
    );

    return [
      'You are an assistant for project docs Q&A.',
      'Use ONLY the provided document content to answer.',
      'If the answer is not in the docs, explicitly say you do not know.',
      'Keep the answer concise and in Chinese.',
      'At the end, include a short "References" section listing used paths.',
      '',
      `Question: ${question}`,
      '',
      'Context documents:',
      ...contextBlocks,
    ].join('\n');
  }

  private async executeKnowledgeAgent({
    project,
    repositoryRoot,
    prompt,
    onChunk,
  }: {
    project: Project;
    repositoryRoot: string;
    prompt: string;
    onChunk?: (chunk: string) => void;
  }): Promise<{ success: boolean; stdout: string; stderr: string }> {
    const result =
      await this.controlPlaneAgentExecutionService.executeProjectPrompt({
        project,
        repositoryRoot,
        prompt,
        callbacks: onChunk
          ? {
              onStdoutChunk: onChunk,
            }
          : undefined,
      });

    return {
      success: result.success,
      stdout: result.stdout.trim(),
      stderr:
        [result.stderr, result.errorMessage]
          .filter(Boolean)
          .join('\n')
          .trim() || '',
    };
  }

  private buildFallbackAnswer(
    citations: Array<{ path: string; snippet: string }>,
    errorMessage: string,
  ): string {
    const lines = [
      '当前未能成功调用 Agent 生成答案，已返回候选文档摘要供参考。',
      `原因：${errorMessage || '未知错误'}`,
      '',
      '你可以根据以下内容手动判断，或重试提问：',
      ...citations.slice(0, 4).map((item) => `- ${item.path}: ${item.snippet}`),
    ];

    return lines.join('\n');
  }

  private async pathExists(targetPath: string): Promise<boolean> {
    try {
      await fs.access(targetPath);
      return true;
    } catch {
      return false;
    }
  }
}
