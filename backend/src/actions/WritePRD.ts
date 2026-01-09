/**
 * WritePRD Action
 * Generates Product Requirements Document from user idea
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import {
  PRD_SYSTEM_PROMPT,
  buildPRDPrompt,
  buildPRDUpdatePrompt,
  buildPRDWithRAGPrompt,
  buildPRDOutlinePrompt,
  buildPRDSectionPrompt,
  buildPRDSectionReviewPrompt,
} from '../prompts/prd';
import { logger, loadPrompt } from '../utils';
// Review和ImproveDocument已移除，由角色通过消息机制管理
import { StepwiseDocumentGenerator } from '../utils/StepwiseDocumentGenerator';
import { WorkspaceManager } from '../utils/WorkspaceManager';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface WritePRDOptions {
  mode?: 'new' | 'update';
  historyPRD?: string;
  relevantChunks?: string;
  useRAG?: boolean;
  useStepwiseGeneration?: boolean; // 是否使用分步骤生成
  applicationId?: string; // 应用ID，用于文件夹命名
  projectId?: string; // 项目ID，用于文件夹命名
  version?: number; // 版本号，用于文件夹命名
  workspacePath?: string; // workspace 路径，默认 ./workspace
}

export class WritePRD extends BaseAction {
  constructor() {
    super('WritePRD', 'Generate Product Requirements Document from user idea');
  }

  async run(input: string, options?: WritePRDOptions): Promise<IActionOutput> {
    const mode = options?.mode || 'new';
    const useRAG = options?.useRAG || false;
    const useStepwise = options?.useStepwiseGeneration ?? true; // 默认启用分步骤生成

    // 优先从 workspace 读取 MRD.md 文件作为输入
    let mrdContent = input;
    try {
      // applicationId 必须提供，不能使用 'default'
      if (!options?.applicationId) {
        throw new Error('applicationId is required for WritePRD action. Cannot use "default" to prevent file conflicts between different applications.');
      }
      const applicationId = options.applicationId;
      const version = options?.version || 1;

      const mrdFromWorkspace = await WorkspaceManager.readFile('MRD.md', {
        applicationId,
        version,
        documentType: 'MRD',
        workspacePath: options?.workspacePath,
      });

      if (mrdFromWorkspace) {
        mrdContent = mrdFromWorkspace;
        logger.info('WritePRD: Loaded MRD content from workspace', {
          applicationId,
          version,
          contentLength: mrdContent.length,
        });
      } else {
        logger.info('WritePRD: MRD.md not found in workspace, using input from message', {
          inputLength: input.length,
        });
      }
    } catch (error: any) {
      logger.warn('WritePRD: Failed to read MRD.md from workspace, using input from message', {
        error: error.message,
        inputLength: input.length,
      });
      // 如果读取失败，使用传入的 input
    }

    logger.info('WritePRD: Starting PRD generation', {
      mode,
      useRAG,
      useStepwise,
      hasHistoryPRD: !!options?.historyPRD,
      hasRelevantChunks: !!options?.relevantChunks,
      requestTimeout: process.env.REQUEST_TIMEOUT || '300',
      inputLength: input.length,
      mrdContentLength: mrdContent.length,
      usingWorkspaceMRD: mrdContent !== input,
    });

    try {
      // 如果启用分步骤生成且是新模式，使用分步骤生成
      if (useStepwise && mode === 'new' && !options?.historyPRD) {
        return await this.generateStepwise(mrdContent, options);
      }

      // 否则使用传统的一次性生成
      let prompt: string;

      if (mode === 'update' && options?.historyPRD) {
        // Update mode: use history PRD + new requirements
        prompt = buildPRDUpdatePrompt(options.historyPRD, mrdContent);
        logger.info('WritePRD: Using update mode with history PRD');
      } else if (useRAG && options?.relevantChunks) {
        // RAG mode: use retrieved chunks + new requirements
        prompt = buildPRDWithRAGPrompt(mrdContent, options.relevantChunks, mrdContent);
        logger.info('WritePRD: Using RAG mode with relevant chunks');
      } else {
        // New mode: standard PRD generation (使用从 workspace 读取的 MRD 内容)
        prompt = buildPRDPrompt(mrdContent);
        logger.info('WritePRD: Using new mode with MRD from workspace');
      }

      // Load system prompt from database or use default
      const userId = this.context?.get('userId');
      const systemPrompt = await loadPrompt(userId, 'prd', 'system_prompt', PRD_SYSTEM_PROMPT);

      // Call LLM with system message and prompt
      const prdContent = await this.aask(prompt, [systemPrompt]);

      // 保存到 workspace，确保使用PRD目录
      await this.saveToWorkspace('PRD.md', prdContent, { ...options, documentType: 'PRD' });

      logger.info('WritePRD: PRD generation completed', {
        mode,
        contentLength: prdContent.length,
        workspaceDir: this.getWorkspaceDir({ ...options, documentType: 'PRD' }),
      });

      // 尝试从 workspace 读取 PRD.md 主文件内容，如果失败则返回当前内容
      let finalContent = prdContent;
      try {
        const workspaceDir = this.getWorkspaceDir({ ...options, documentType: 'PRD' });
        const mainFilePath = path.join(workspaceDir, 'PRD.md');
        const mainFileContent = await fs.readFile(mainFilePath, 'utf-8');
        if (mainFileContent && mainFileContent.length > 0) {
          finalContent = mainFileContent;
          logger.info('WritePRD: Loaded PRD.md from workspace', {
            contentLength: finalContent.length,
          });
        }
      } catch (error: any) {
        logger.debug('WritePRD: PRD.md not found in workspace, using direct content', {
          error: error.message,
        });
        // 如果主文件不存在，使用当前生成的内容
      }

      return {
        content: finalContent,
        data: {
          type: 'prd',
          filename: 'PRD.md',
          timestamp: new Date().toISOString(),
          mode,
          workspaceDir: this.getWorkspaceDir({ ...options, documentType: 'PRD' }),
        },
      };
    } catch (error: any) {
      const isTimeout = error.message?.includes('timeout') || error.message?.includes('exceeded');

      logger.error('WritePRD: Failed to generate PRD', {
        mode,
        error: error.message,
        isTimeout,
        requestTimeout: process.env.REQUEST_TIMEOUT || '300',
        stack: error.stack,
      });

      // 如果是超时错误，提供更友好的错误信息
      if (isTimeout) {
        const timeoutError = new Error(
          `PRD 生成超时。当前超时设置: ${process.env.REQUEST_TIMEOUT || '300'}秒。\n` +
          `建议解决方案：\n` +
          `1. 在项目根目录的 .env 文件中设置 REQUEST_TIMEOUT=600（10分钟）或更高\n` +
          `2. 重启后端服务使配置生效\n` +
          `3. 如果问题持续，可以尝试分段生成 PRD 或简化需求描述\n\n` +
          `原始错误: ${error.message}`
        );
        timeoutError.name = 'PRDGenerationTimeoutError';
        throw timeoutError;
      }

      throw error;
    }
  }



  /**
   * 读取 workspace 中的所有文件内容
   */
  protected async readAllFromWorkspace(options?: WritePRDOptions): Promise<string> {
    try {
      const workspaceDir = this.getWorkspaceDir({ ...options, documentType: 'PRD' });

      // 检查目录是否存在
      try {
        await fs.access(workspaceDir);
      } catch {
        logger.warn('WritePRD: Workspace directory does not exist', {
          workspaceDir,
        });
        return ''; // 如果目录不存在，返回空字符串
      }

      const files: string[] = [];

      // 读取目录中的所有文件
      const entries = await fs.readdir(workspaceDir, { withFileTypes: true });

      // 按文件名排序（确保顺序：outline -> sections -> PRD -> review，排除 final 文件）
      const sortedEntries = entries
        .filter(entry => entry.isFile() && entry.name.endsWith('.md') && !entry.name.endsWith('-final.md'))
        .sort((a, b) => {
          // 特殊排序：00-outline.md 在最前
          if (a.name === '00-outline.md') return -1;
          if (b.name === '00-outline.md') return 1;
          return a.name.localeCompare(b.name);
        });

      for (const entry of sortedEntries) {
        const filePath = path.join(workspaceDir, entry.name);
        const content = await fs.readFile(filePath, 'utf-8');
        // 如果文件已经有标题，不重复添加
        if (content.startsWith('#')) {
          files.push(content);
        } else {
          files.push(`# ${entry.name.replace('.md', '')}\n\n${content}`);
        }
      }

      const mergedContent = files.join('\n\n---\n\n');

      logger.info('WritePRD: Read all files from workspace', {
        workspaceDir,
        fileCount: sortedEntries.length,
        totalLength: mergedContent.length,
      });

      return mergedContent;
    } catch (error: any) {
      logger.error('WritePRD: Failed to read files from workspace', {
        error: error.message,
        workspaceDir: this.getWorkspaceDir({ ...options, documentType: 'PRD' }),
      });
      // 如果读取失败，返回空字符串而不是抛出错误
      return '';
    }
  }

  /**
   * 分步骤生成 PRD
   * 使用通用的 StepwiseDocumentGenerator
   */
  private async generateStepwise(input: string, options?: WritePRDOptions): Promise<IActionOutput> {
    // 确保使用PRD目录
    const workspaceDir = this.getWorkspaceDir({ ...options, documentType: 'PRD' });
    // 移除对Review和ImproveDocument的直接调用，改为通过角色管理

    // Load system prompt from database or use default
    const userId = this.context?.get('userId');
    const systemPrompt = await loadPrompt(userId, 'prd', 'system_prompt', PRD_SYSTEM_PROMPT);

    const generator = new StepwiseDocumentGenerator(this as unknown as BaseAction, {
      buildOutlinePrompt: buildPRDOutlinePrompt,
      buildSectionPrompt: buildPRDSectionPrompt,
      systemPrompt: systemPrompt,
      // Review 由角色通过 PRDReview action 统一处理
      documentTitle: '产品需求文档（PRD）',
      documentType: 'PRD',
      mainFileName: 'PRD.md',
      defaultSections: [
        { number: 0, title: '版本说明' },
        { number: 1, title: '产品概述' },
        { number: 2, title: '目标与成功指标' },
        { number: 3, title: '用户故事' },
        { number: 4, title: '功能需求' },
        { number: 5, title: '页面与交互设计说明' },
        { number: 6, title: '非功能需求' },
        { number: 7, title: '技术实现建议' },
        { number: 8, title: '验收与交付标准' },
        { number: 9, title: '风险与应对' },
        { number: 10, title: '附录' },
      ],
      workspaceDir,
      applicationId: options?.applicationId,
      projectId: options?.projectId,
      version: options?.version,
    });

    return await generator.generate(input);
  }


  /**
   * Build PRD with history context
   * Helper method for generating PRD based on historical PRD
   */
  async buildPRDWithHistory(
    newRequirements: string,
    historyPRD: string
  ): Promise<IActionOutput> {
    return this.run(newRequirements, {
      mode: 'update',
      historyPRD,
    });
  }
}

export default WritePRD;

