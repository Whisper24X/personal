/**
 * WriteMRD Action
 * Generates Market Research Document (MRD)
 *
 * 工作流程：
 * 1) CLI模式：使用 DocumentWriteHandler 直接生成（只传MRD文件夹路径）
 *    - CLI工具无需读取输入文件
 *    - 生成 MRD.md 到 mrd 目录
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import { MRD_SYSTEM_PROMPT } from '../prompts/mrd';
import { logger, WorkspaceOptions, WorkspaceManager } from '../utils';
import { DocumentWriteHandler, DOCUMENT_CONFIGS, WriteConfig } from '../utils/document';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface WriteMRDOptions extends WorkspaceOptions {
  mode?: 'new' | 'update';
  historyMRD?: string;
  relevantChunks?: string;
  structuredKnowledge?: unknown;
  useRAG?: boolean;
  useKnowledgeIntegration?: boolean;
  useStepwiseGeneration?: boolean;
  includeOptionalSections?: boolean;
}

export class WriteMRD extends BaseAction {
  constructor() {
    super('WriteMRD', 'Generate Market Research Document (MRD) from user requirements');
  }

  /**
   * 验证 MRD 内容
   * @param content MRD 内容
   * @param minLength 最小长度要求（默认 50 字符）
   * @throws Error 如果内容无效
   */
  private validateMRDContent(content: string, minLength = 50): void {
    if (!content || content.trim().length === 0) {
      throw new Error('MRD content is empty');
    }
    if (content.length < minLength) {
      throw new Error(`MRD content too short (${content.length} chars). Expected at least ${minLength} chars.`);
    }
    logger.info('WriteMRD: MRD content validation passed', {
      contentLength: content.length,
      minLength,
    });
  }

  /**
   * 确保输出目录存在
   * @param dirPath 目录路径
   */
  private async ensureOutputDirectory(dirPath: string): Promise<void> {
    await fs.mkdir(dirPath, { recursive: true });
    logger.info('WriteMRD: Output directory ensured', { dirPath });
  }

  /**
   * 构建 MRD 生成 prompt
   * @param outputPath MRD 输出路径（相对于项目根目录）
   */
  private buildMRDPrompt(outputPath?: string): string {
    return `使用 mrd 技能生成 MRD，输出文件保存到 ${outputPath}`;
  }

  /**
   * 创建 WriteHandler
   * CLI模式下使用文件路径而非内容进行生成
   */
  private async createWriteHandler(options: WriteMRDOptions): Promise<DocumentWriteHandler> {
    const projectRootDir = WorkspaceManager.getProjectWorkspacePath(options);
    // 强制使用 docs 根目录，避免 documentType=MRD 时落到 docs/mrd
    const docsDir = path.join(projectRootDir, 'docs');

    // MRD 文件在 docs/mrd 目录
    const outputFilePath = path.join(docsDir, 'mrd', 'MRD.md');
    const mrdDir = path.dirname(outputFilePath);

    // 确保 MRD 输出目录存在
    await this.ensureOutputDirectory(mrdDir);

    // 计算相对路径用于提示词
    const outputRelativePath = path.relative(projectRootDir, outputFilePath);

    logger.info('WriteMRD: Creating WriteHandler', {
      projectRootDir,
      docsDir,
      outputFilePath,
      outputRelativePath,
    });

    const config: WriteConfig = {
      ...DOCUMENT_CONFIGS.MRD,
      systemPrompt: MRD_SYSTEM_PROMPT,
      buildWritePrompt: (_input: string) => this.buildMRDPrompt(outputRelativePath),
    };

    return new DocumentWriteHandler(this, config);
  }

  async run(input: string, options?: WriteMRDOptions): Promise<IActionOutput> {
    const mode = options?.mode || 'new';

    // 使用 BaseAction 提供的验证方法
    const workspaceOptions = this.validateWorkspaceOptions(options, 'MRD');
    const { applicationId, projectId } = workspaceOptions;

    const isCLIMode = this.isCLIMode();

    logger.info('WriteMRD: Starting MRD generation', {
      applicationId,
      projectId,
      mode,
      isCLIMode,
      inputLength: input.length,
    });

    if (!isCLIMode) {
      throw new Error('WriteMRD supports CLI mode only. Please set executor mode to cli.');
    }

    try {
      const handler = await this.getCachedHandler('write', () => this.createWriteHandler(workspaceOptions));
      const result = await this.executeWriteHandler(handler, '', workspaceOptions, {
        type: 'mrd',
        mode,
      });

      // 验证生成的 MRD 内容
      if (result.content) {
        this.validateMRDContent(result.content);
        logger.info('WriteMRD: MRD generation completed successfully', {
          contentLength: result.content.length,
          workspaceDir: result.data?.workspaceDir,
        });
      } else {
        logger.warn('WriteMRD: No content returned from handler');
      }

      return result;
    } catch (error: unknown) {
      const err = error as Error;
      logger.error('WriteMRD: Failed to generate MRD', {
        error: err.message,
        stack: err.stack,
      });
      throw error;
    }
  }
}

export default WriteMRD;
