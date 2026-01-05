/**
 * WriteMRD Action
 * 编写市场研究文档（Market Research Document）
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import {
  MRD_SYSTEM_PROMPT,
  buildMRDPrompt,
  buildMRDOutlinePrompt,
  buildMRDSectionPrompt,
  buildMRDSectionReviewPrompt,
} from '../prompts/mrd';
import { logger, loadPrompt } from '../utils';
import { MRDReview } from './MRDReview';
import { ImproveDocument } from './ImproveDocument';
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
      '编写市场研究文档：分析用户原始需求，进行市场调研和业务分析，输出详细的市场研究文档（MRD）'
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
      throw new Error('未找到用户需求');
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
          `市场研究文档生成超时。当前超时设置: ${process.env.REQUEST_TIMEOUT || '300'}秒。\n` +
          `建议解决方案：\n` +
          `1. 在项目根目录的 .env 文件中设置 REQUEST_TIMEOUT=600（10分钟）或更高\n` +
          `2. 重启后端服务使配置生效\n` +
          `3. 如果问题持续，可以尝试分段生成或简化需求描述\n\n` +
          `原始错误: ${error.message}`
        );
        timeoutError.name = 'MRDGenerationTimeoutError';
        throw timeoutError;
      }

      throw error;
    }
  }

  /**
   * 读取 workspace 中的所有文件内容
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
   * 分步骤生成市场研究文档
   * 使用通用的 StepwiseDocumentGenerator
   */
  private async generateStepwise(input: string, options?: WriteMRDOptions): Promise<IActionOutput> {
    // 确保使用MRD目录
    const workspaceDir = this.getWorkspaceDir({ ...options, documentType: 'MRD' });
    const reviewAction = new MRDReview();
    const improveAction = new ImproveDocument();

    // Load system prompt from database or use default
    const userId = this.context?.get('userId');
    const systemPrompt = await loadPrompt(userId, 'mrd', 'system_prompt', MRD_SYSTEM_PROMPT);

    const generator = new StepwiseDocumentGenerator(this as unknown as BaseAction, {
      buildOutlinePrompt: buildMRDOutlinePrompt,
      buildSectionPrompt: buildMRDSectionPrompt,
      buildSectionReviewPrompt: buildMRDSectionReviewPrompt,
      systemPrompt: systemPrompt,
      reviewAction: reviewAction,
      reviewTitle: '市场研究文档审查报告',
      improveAction: improveAction,
      autoImprove: true, // 自动在审查后改进文档
      documentTitle: '市场研究文档（MRD）',
      documentType: 'MRD',
      mainFileName: 'MRD.md',
      defaultSections: [
        { number: 1, title: '需求背景与目标价值分析' },
        { number: 2, title: '需求价值分析' },
        { number: 3, title: '用户分析' },
        { number: 4, title: '业务流程分析' },
        { number: 5, title: '市场分析' },
        { number: 6, title: '可行性分析' },
        { number: 7, title: '项目范围' },
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

