/**
 * WriteMRD Action
 * Write Market Research Document (MRD)
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import {
  MRD_SYSTEM_PROMPT,
  buildMRDPrompt,
  buildMRDOutlinePrompt,
  buildMRDSectionPrompt,
} from '../prompts/mrd';
import { logger, loadPrompt } from '../utils';
// Review和ImproveDocument已移除，由角色通过消息机制管理
import { StepwiseDocumentGenerator } from '../utils/StepwiseDocumentGenerator';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface WriteMRDOptions {
  mode?: 'new' | 'update';
  historyMRD?: string;
  useRAG?: boolean; // 是否使用 RAG 检索
  relevantChunks?: string; // RAG 检索到的相关文档片段
  useStepwiseGeneration?: boolean; // 是否使用分步骤生成
  applicationId?: string; // 应用ID，用于文件夹命名
  projectId?: string; // 项目ID，用于文件夹命名
  version?: number; // 版本号，用于文件夹命名
  workspacePath?: string; // workspace 路径，默认 ./workspace
}

export class WriteMRD extends BaseAction {
  constructor() {
    super(
      'WriteMRD',
      'Write Market Research Document: Analyze user requirements, conduct market research and business analysis, and output detailed Market Research Document (MRD)'
    );
  }

  async run(userIdea: string, options?: WriteMRDOptions): Promise<IActionOutput> {
    const mode = options?.mode || 'new';
    const useRAG = options?.useRAG || false;
    const useStepwise = options?.useStepwiseGeneration ?? true; // 默认启用分步骤生成

    logger.info('WriteMRD: Starting MRD generation', {
      mode,
      useRAG,
      useStepwise,
      hasHistoryMRD: !!options?.historyMRD,
      hasRelevantChunks: !!options?.relevantChunks,
      requestTimeout: process.env.REQUEST_TIMEOUT || '300',
      inputLength: userIdea.length,
    });

    if (!userIdea || userIdea.trim() === '') {
      throw new Error('User requirements not found');
    }

    try {
      // 如果启用分步骤生成且是新模式，使用分步骤生成
      if (useStepwise && mode === 'new' && !options?.historyMRD) {
        return await this.generateStepwise(userIdea, options);
      }

      // 否则使用传统的一次性生成
      let prompt: string;

      if (mode === 'update' && options?.historyMRD) {
        // Update mode: use history MRD + new requirements
        // TODO: 实现 buildMRDUpdatePrompt
        prompt = buildMRDPrompt(userIdea, options.relevantChunks);
        logger.info('WriteMRD: Using update mode with history MRD');
      } else if (useRAG && options?.relevantChunks) {
        // RAG mode: use retrieved chunks + new requirements
        prompt = buildMRDPrompt(userIdea, options.relevantChunks);
        logger.info('WriteMRD: Using RAG mode with relevant chunks');
      } else {
        // New mode: standard MRD generation
        prompt = buildMRDPrompt(userIdea);
        logger.info('WriteMRD: Using new mode');
      }

      // Load system prompt from database or use default
      const userId = this.context?.get('userId');
      const systemPrompt = await loadPrompt(userId, 'mrd', 'system_prompt', MRD_SYSTEM_PROMPT);

      const content = await this.aask(prompt, [systemPrompt]);

      // 保存到 workspace，确保使用MRD目录
      await this.saveToWorkspace('MRD.md', content, { ...options, documentType: 'MRD' });

      logger.info('WriteMRD: MRD generation completed', {
        mode,
        contentLength: content.length,
        workspaceDir: this.getWorkspaceDir({ ...options, documentType: 'MRD' }),
      });

      // 尝试从 workspace 读取 MRD.md 主文件内容，如果失败则返回当前内容
      let finalContent = content;
      try {
        const workspaceDir = this.getWorkspaceDir({ ...options, documentType: 'MRD' });
        const mainFilePath = path.join(workspaceDir, 'MRD.md');
        const mainFileContent = await fs.readFile(mainFilePath, 'utf-8');
        if (mainFileContent && mainFileContent.length > 0) {
          finalContent = mainFileContent;
          logger.info('WriteMRD: Loaded MRD.md from workspace', {
            contentLength: finalContent.length,
          });
        }
      } catch (error: any) {
        logger.debug('WriteMRD: MRD.md not found in workspace, using direct content', {
          error: error.message,
        });
        // 如果主文件不存在，使用当前生成的内容
      }

      return {
        content: finalContent,
        data: {
          type: 'mrd',
          filename: 'MRD.md',
          timestamp: new Date().toISOString(),
          mode,
          workspaceDir: this.getWorkspaceDir({ ...options, documentType: 'MRD' }),
        },
      };
    } catch (error: any) {
      const isTimeout = error.message?.includes('timeout') || error.message?.includes('exceeded');

      logger.error('WriteMRD: Failed to generate MRD', {
        mode,
        error: error.message,
        isTimeout,
        requestTimeout: process.env.REQUEST_TIMEOUT || '300',
        stack: error.stack,
      });

      if (isTimeout) {
        const timeoutError = new Error(
          `MRD generation timeout. Current timeout setting: ${process.env.REQUEST_TIMEOUT || '300'} seconds.\n` +
          `Suggested solutions:\n` +
          `1. Set REQUEST_TIMEOUT=600 (10 minutes) or higher in the .env file in the project root directory\n` +
          `2. Restart the backend service to apply the configuration\n` +
          `3. If the problem persists, try generating in segments or simplifying the requirement description\n\n` +
          `Original error: ${error.message}`
        );
        timeoutError.name = 'MRDGenerationTimeoutError';
        throw timeoutError;
      }

      throw error;
    }
  }

  /**
   * Read all file contents from workspace
   */
  protected async readAllFromWorkspace(options?: WriteMRDOptions): Promise<string> {
    try {
      const workspaceDir = this.getWorkspaceDir({ ...options, documentType: 'MRD' });

      try {
        await fs.access(workspaceDir);
      } catch {
        logger.warn('WriteMRD: Workspace directory does not exist', {
          workspaceDir,
        });
        return '';
      }

      const files: string[] = [];
      const entries = await fs.readdir(workspaceDir, { withFileTypes: true });

      const sortedEntries = entries
        .filter(entry => entry.isFile() && entry.name.endsWith('.md') && !entry.name.endsWith('-final.md'))
        .sort((a, b) => {
          if (a.name === '00-outline.md') return -1;
          if (b.name === '00-outline.md') return 1;
          return a.name.localeCompare(b.name);
        });

      for (const entry of sortedEntries) {
        const filePath = path.join(workspaceDir, entry.name);
        const content = await fs.readFile(filePath, 'utf-8');
        if (content.startsWith('#')) {
          files.push(content);
        } else {
          files.push(`# ${entry.name.replace('.md', '')}\n\n${content}`);
        }
      }

      return files.join('\n\n---\n\n');
    } catch (error: any) {
      logger.error('WriteMRD: Failed to read files from workspace', {
        error: error.message,
        workspaceDir: this.getWorkspaceDir({ ...options, documentType: 'MRD' }),
      });
      return '';
    }
  }

  /**
   * Generate Market Research Document step by step
   * Uses the generic StepwiseDocumentGenerator
   */
  private async generateStepwise(input: string, options?: WriteMRDOptions): Promise<IActionOutput> {
    // 确保使用MRD目录
    const workspaceDir = this.getWorkspaceDir({ ...options, documentType: 'MRD' });
    // 移除对Review和ImproveDocument的直接调用，改为通过角色管理

    // Load system prompt from database or use default
    const userId = this.context?.get('userId');
    const systemPrompt = await loadPrompt(userId, 'mrd', 'system_prompt', MRD_SYSTEM_PROMPT);

    const generator = new StepwiseDocumentGenerator(this as unknown as BaseAction, {
      buildOutlinePrompt: buildMRDOutlinePrompt,
      buildSectionPrompt: buildMRDSectionPrompt,
      systemPrompt: systemPrompt,
      // Review 由角色通过 MRDReview action 统一处理
      documentTitle: 'Market Research Document (MRD)',
      documentType: 'MRD',
      mainFileName: 'MRD.md',
      defaultSections: [
        { number: 1, title: 'Requirement Background and Target Value Analysis' },
        { number: 2, title: 'Requirement Value Analysis' },
        { number: 3, title: 'User Analysis' },
        { number: 4, title: 'Business Process Analysis' },
        { number: 5, title: 'Market Analysis' },
        { number: 6, title: 'Feasibility Analysis' },
        { number: 7, title: 'Project Scope' },
      ],
      workspaceDir,
      applicationId: options?.applicationId,
      projectId: options?.projectId,
      version: options?.version,
    });

    return await generator.generate(input);
  }
}

export default WriteMRD;

