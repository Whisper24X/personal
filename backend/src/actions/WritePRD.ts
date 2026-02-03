/**
 * WritePRD Action
 * Generates Product Requirements Document from MRD
 *
 * 工作流程：
 * 1) CLI模式：使用 DocumentWriteHandler 直接生成（只传MRD文件夹路径）
 *    - CLI工具从 mrd 目录读取 MRD.md 作为输入
 *    - 生成 PRD.md 到 prd 目录
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import { logger, WorkspaceOptions, WorkspaceManager } from '../utils';
import { DocumentWriteHandler, DOCUMENT_CONFIGS, WriteConfig } from '../utils/document';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface WritePRDOptions extends WorkspaceOptions {
  mode?: 'new' | 'update';
  historyPRD?: string;
  relevantChunks?: string;
  structuredKnowledge?: unknown;
  useRAG?: boolean;
  useKnowledgeIntegration?: boolean;
  useStepwiseGeneration?: boolean;
  includeOptionalSections?: boolean;
}

export class WritePRD extends BaseAction {
  constructor() {
    super('WritePRD', 'Generate Product Requirements Document from MRD');
  }

  /**
   * 验证 MRD 文件是否存在
   * @param mrdFilePath MRD 文件路径
   * @throws Error 如果 MRD 文件不存在
   */
  private async validateMRDFile(mrdFilePath: string): Promise<void> {
    try {
      await fs.access(mrdFilePath);
      const stats = await fs.stat(mrdFilePath);
      if (stats.size === 0) {
        throw new Error(`MRD file is empty at ${mrdFilePath}`);
      }
      logger.info('WritePRD: MRD file validation passed', {
        mrdFilePath,
        fileSize: stats.size,
      });
    } catch (error: unknown) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') {
        throw new Error(`MRD file not found at ${mrdFilePath}. Please generate MRD first.`);
      }
      throw error;
    }
  }

  /**
   * 验证 PRD 内容
   * @param content PRD 内容
   * @param minLength 最小长度要求（默认 50 字符）
   * @throws Error 如果内容无效
   */
  private validatePRDContent(content: string, minLength = 50): void {
    if (!content || content.trim().length === 0) {
      throw new Error('PRD content is empty');
    }
    if (content.length < minLength) {
      throw new Error(`PRD content too short (${content.length} chars). Expected at least ${minLength} chars.`);
    }
    logger.info('WritePRD: PRD content validation passed', {
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
    logger.info('WritePRD: Output directory ensured', { dirPath });
  }

  /**
   * 构建 PRD 生成 prompt
   * @param mrdRelativePath MRD 文件路径（相对于项目根目录）
   * @param outputPath PRD 输出路径（相对于项目根目录）
   */
  private buildPRDPrompt(mrdRelativePath: string, outputPath?: string): string {
    return `使用 prd 技能生成 PRD，MRD 文件路径为 ${mrdRelativePath}，输出文件保存到 ${outputPath}`;
  }

  /**
   * 创建 WriteHandler
   * CLI模式下使用文件路径而非内容进行生成
   */
  private async createWriteHandler(options: WritePRDOptions): Promise<DocumentWriteHandler> {
    const projectRootDir = WorkspaceManager.getProjectWorkspacePath(options);
    // 强制使用 docs 根目录，避免 documentType=PRD 时落到 docs/prd
    const docsDir = path.join(projectRootDir, 'docs');

    // MRD 文件在 docs/mrd 目录，PRD 文件在 docs/prd 目录
    const mrdFilePath = path.join(docsDir, 'mrd', 'MRD.md');
    const outputFilePath = path.join(docsDir, 'prd', 'PRD.md');
    const prdDir = path.dirname(outputFilePath);

    // 校验 MRD 文件是否存在
    await this.validateMRDFile(mrdFilePath);

    // 确保 PRD 输出目录存在
    await this.ensureOutputDirectory(prdDir);

    // 计算相对路径用于提示词
    const mrdRelativePath = path.relative(projectRootDir, mrdFilePath);
    const outputRelativePath = path.relative(projectRootDir, outputFilePath);

    logger.info('WritePRD: Creating WriteHandler', {
      projectRootDir,
      docsDir,
      mrdFilePath,
      outputFilePath,
      mrdRelativePath,
      outputRelativePath,
    });

    const config: WriteConfig = {
      ...DOCUMENT_CONFIGS.PRD,
      systemPrompt: '',
      buildWritePrompt: (_input: string) => this.buildPRDPrompt(mrdRelativePath, outputRelativePath),
      useCustomCLIPrompt: true, // 👈 启用自定义 CLI prompt，使用 buildWritePrompt
    };

    return new DocumentWriteHandler(this, config);
  }

  async run(input: string, options?: WritePRDOptions): Promise<IActionOutput> {
    const mode = options?.mode || 'new';

    // 使用 BaseAction 提供的验证方法
    const workspaceOptions = this.validateWorkspaceOptions(options, 'PRD');
    const { applicationId, projectId } = workspaceOptions;

    const isCLIMode = this.isCLIMode();

    logger.info('WritePRD: Starting PRD generation', {
      applicationId,
      projectId,
      mode,
      isCLIMode,
      inputLength: input.length,
    });

    if (!isCLIMode) {
      throw new Error('WritePRD supports CLI mode only. Please set executor mode to cli.');
    }

    try {
      // 检查 PRD 文件是否已存在（仅在 new 模式下）
      if (mode === 'new') {
        const projectRootDir = WorkspaceManager.getProjectWorkspacePath(workspaceOptions);
        const prdFilePath = path.join(projectRootDir, 'docs', 'prd', 'PRD.md');

        try {
          const stats = await fs.stat(prdFilePath);
          if (stats.isFile() && stats.size > 100) {
            // 文件存在且有内容，读取并返回
            const existingContent = await fs.readFile(prdFilePath, 'utf-8');
            logger.info('WritePRD: PRD file already exists, skipping generation', {
              filePath: prdFilePath,
              fileSize: stats.size,
              contentLength: existingContent.length,
            });

            return this.createActionOutput(existingContent, {
              type: 'prd',
              mode,
              filename: 'PRD.md',
              workspaceDir: projectRootDir,
              skipped: true,
              reason: 'PRD file already exists',
            });
          }
        } catch (error) {
          // 文件不存在或读取失败，继续生成
          logger.info('WritePRD: PRD file does not exist or is invalid, will generate', {
            filePath: prdFilePath,
          });
        }
      }

      const handler = await this.getCachedHandler('write', () => this.createWriteHandler(workspaceOptions));
      const result = await this.executeWriteHandler(handler, '', workspaceOptions, {
        type: 'prd',
        mode,
      });

      // 验证生成的 PRD 内容
      if (result.content) {
        this.validatePRDContent(result.content);
        logger.info('WritePRD: PRD generation completed successfully', {
          contentLength: result.content.length,
          workspaceDir: result.data?.workspaceDir,
        });
      } else {
        logger.warn('WritePRD: No content returned from handler');
      }

      return result;
    } catch (error: unknown) {
      const err = error as Error;
      logger.error('WritePRD: Failed to generate PRD', {
        error: err.message,
        stack: err.stack,
      });
      throw error;
    }
  }
}

export default WritePRD;
