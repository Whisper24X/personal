/**
 * WriteDesign Action
 * Generates System Design Document from PRD
 *
 * 工作流程：
 * 1) CLI模式：使用 DocumentWriteHandler 直接生成（只传PRD文件夹路径）
 *    - CLI工具从 prd 目录读取 PRD.md 作为输入
 *    - 生成 DESIGN.md 到 design 目录
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import { logger, WorkspaceOptions, WorkspaceManager } from '../utils';
import { DocumentWriteHandler, DOCUMENT_CONFIGS, WriteConfig } from '../utils/document';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface WriteDesignOptions extends WorkspaceOptions {
  mode?: 'new' | 'update';
  useStepwiseGeneration?: boolean; // 是否使用分步骤生成
}

export class WriteDesign extends BaseAction {
  constructor() {
    super('WriteDesign', 'Generate System Design Document from PRD');
  }

  /**
   * 验证 PRD 文件是否存在
   * @param prdFilePath PRD 文件路径
   * @throws Error 如果 PRD 文件不存在
   */
  private async validatePRDFile(prdFilePath: string): Promise<void> {
    try {
      await fs.access(prdFilePath);
      const stats = await fs.stat(prdFilePath);
      if (stats.size === 0) {
        throw new Error(`PRD file is empty at ${prdFilePath}`);
      }
      logger.info('WriteDesign: PRD file validation passed', {
        prdFilePath,
        fileSize: stats.size,
      });
    } catch (error: unknown) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') {
        throw new Error(`PRD file not found at ${prdFilePath}. Please generate PRD first.`);
      }
      throw error;
    }
  }

  /**
   * 验证 DESIGN 内容
   * @param content DESIGN 内容
   * @param minLength 最小长度要求（默认 50 字符）
   * @throws Error 如果内容无效
   */
  private validateDesignContent(content: string, minLength = 50): void {
    if (!content || content.trim().length === 0) {
      throw new Error('DESIGN content is empty');
    }
    if (content.length < minLength) {
      throw new Error(`DESIGN content too short (${content.length} chars). Expected at least ${minLength} chars.`);
    }
    logger.info('WriteDesign: DESIGN content validation passed', {
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
    logger.info('WriteDesign: Output directory ensured', { dirPath });
  }

  /**
   * 构建 Design 生成 prompt
   * @param prdRelativePath PRD 文件路径（相对于项目根目录）
   * @param outputPath Design 输出路径（相对于项目根目录）
   */
  private buildDesignPrompt(prdRelativePath: string, outputPath?: string): string {
    return `使用 design 技能生成系统设计文档，PRD 文件路径为 ${prdRelativePath}，输出文件保存到 ${outputPath}`;
  }

  /**
   * 创建 WriteHandler
   * CLI模式下使用文件路径而非内容进行生成
   */
  private async createWriteHandler(options: WriteDesignOptions): Promise<DocumentWriteHandler> {
    const projectRootDir = WorkspaceManager.getProjectWorkspacePath(options);
    // 强制使用 docs 根目录，避免 documentType=DESIGN 时落到 docs/design
    const docsDir = path.join(projectRootDir, 'docs');

    // PRD 文件在 docs/prd 目录，DESIGN 文件在 docs/design 目录
    const prdFilePath = path.join(docsDir, 'prd', 'PRD.md');
    const outputFilePath = path.join(docsDir, 'design', 'DESIGN.md');
    const designDir = path.dirname(outputFilePath);

    // 校验 PRD 文件是否存在
    await this.validatePRDFile(prdFilePath);

    // 确保 Design 输出目录存在
    await this.ensureOutputDirectory(designDir);

    // 计算相对路径用于提示词
    const prdRelativePath = path.relative(projectRootDir, prdFilePath);
    const outputRelativePath = path.relative(projectRootDir, outputFilePath);

    logger.info('WriteDesign: Creating WriteHandler', {
      projectRootDir,
      docsDir,
      prdFilePath,
      outputFilePath,
      prdRelativePath,
      outputRelativePath,
    });

    const config: WriteConfig = {
      ...DOCUMENT_CONFIGS.DESIGN,
      systemPrompt: '',
      buildWritePrompt: (_input: string) => this.buildDesignPrompt(prdRelativePath, outputRelativePath),
      useCustomCLIPrompt: true, // 👈 启用自定义 CLI prompt，使用 buildWritePrompt
    };

    return new DocumentWriteHandler(this, config);
  }

  async run(input: string, options?: WriteDesignOptions): Promise<IActionOutput> {
    const mode = options?.mode || 'new';

    // 使用 BaseAction 提供的验证方法
    const workspaceOptions = this.validateWorkspaceOptions(options, 'DESIGN');
    const { applicationId, projectId } = workspaceOptions;

    const isCLIMode = this.isCLIMode();

    logger.info('WriteDesign: Starting design generation', {
      applicationId,
      projectId,
      mode,
      isCLIMode,
      inputLength: input.length,
    });

    if (!isCLIMode) {
      throw new Error('WriteDesign supports CLI mode only. Please set executor mode to cli.');
    }

    try {
      // 检查 DESIGN 文件是否已存在（仅在 new 模式下）
      if (mode === 'new') {
        const projectRootDir = WorkspaceManager.getProjectWorkspacePath(workspaceOptions);
        const designFilePath = path.join(projectRootDir, 'docs', 'design', 'DESIGN.md');

        try {
          const stats = await fs.stat(designFilePath);
          if (stats.isFile() && stats.size > 100) {
            // 文件存在且有内容，读取并返回
            const existingContent = await fs.readFile(designFilePath, 'utf-8');
            logger.info('WriteDesign: DESIGN file already exists, skipping generation', {
              filePath: designFilePath,
              fileSize: stats.size,
              contentLength: existingContent.length,
            });

            return this.createActionOutput(existingContent, {
              type: 'design',
              mode,
              filename: 'DESIGN.md',
              workspaceDir: projectRootDir,
              skipped: true,
              reason: 'DESIGN file already exists',
            });
          }
        } catch (error) {
          // 文件不存在或读取失败，继续生成
          logger.info('WriteDesign: DESIGN file does not exist or is invalid, will generate', {
            filePath: designFilePath,
          });
        }
      }

      const handler = await this.getCachedHandler('write', () => this.createWriteHandler(workspaceOptions));
      const result = await this.executeWriteHandler(handler, '', workspaceOptions, {
        type: 'design',
        mode,
      });

      // 验证生成的 DESIGN 内容
      if (result.content) {
        this.validateDesignContent(result.content);
        logger.info('WriteDesign: Design generation completed successfully', {
          contentLength: result.content.length,
          workspaceDir: result.data?.workspaceDir,
        });
      } else {
        logger.warn('WriteDesign: No content returned from handler');
      }

      return result;
    } catch (error: unknown) {
      const err = error as Error;
      logger.error('WriteDesign: Failed to generate design', {
        error: err.message,
        stack: err.stack,
      });
      throw error;
    }
  }
}

export default WriteDesign;
