/**
 * GeneratePrototype Action
 * Generates high-fidelity HTML prototype from PRD
 *
 * 工作流程：
 * 1) CLI模式：使用 DocumentWriteHandler 直接生成（只传PRD文件夹路径）
 *    - CLI工具从 prd 目录读取 PRD.md 作为输入
 *    - 生成 index.html 到 prototype 目录
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import { logger, WorkspaceOptions, WorkspaceManager } from '../utils';
import { DocumentWriteHandler, DOCUMENT_CONFIGS, WriteConfig } from '../utils/document';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface GeneratePrototypeOptions extends WorkspaceOptions {
  mode?: 'new' | 'update';
}

export class GeneratePrototype extends BaseAction {
  constructor() {
    super('GeneratePrototype', 'Generate high-fidelity HTML prototype from PRD');
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
      logger.info('GeneratePrototype: PRD file validation passed', {
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
   * 验证 Prototype 内容
   * @param content Prototype 内容
   * @param minLength 最小长度要求（默认 50 字符）
   * @throws Error 如果内容无效
   */
  private validatePrototypeContent(content: string, minLength = 50): void {
    if (!content || content.trim().length === 0) {
      throw new Error('Prototype content is empty');
    }
    if (content.length < minLength) {
      throw new Error(`Prototype content too short (${content.length} chars). Expected at least ${minLength} chars.`);
    }
    logger.info('GeneratePrototype: Prototype content validation passed', {
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
    logger.info('GeneratePrototype: Output directory ensured', { dirPath });
  }

  /**
   * 构建 Prototype 生成 prompt
   * @param prdRelativePath PRD 文件路径（相对于项目根目录）
   * @param outputPath Prototype 输出路径（相对于项目根目录）
   */
  private buildPrototypePrompt(prdRelativePath: string, outputPath?: string): string {
    return `使用 prototype 技能生成高保真原型，PRD 文件路径为 ${prdRelativePath}，输出文件保存到 ${outputPath}`;
  }

  /**
   * 创建 WriteHandler
   * CLI模式下使用文件路径而非内容进行生成
   */
  private async createWriteHandler(options: GeneratePrototypeOptions): Promise<DocumentWriteHandler> {
    const projectRootDir = WorkspaceManager.getProjectWorkspacePath(options);
    // 强制使用 docs 根目录，避免 documentType=PROTOTYPE 时落到 docs/prototype
    const docsDir = path.join(projectRootDir, 'docs');

    // PRD 文件在 docs/prd 目录，原型文件在 docs/prototype 目录
    const prdFilePath = path.join(docsDir, 'prd', 'PRD.md');
    const outputFilePath = path.join(docsDir, 'prototype', 'index.html');
    const prototypeDir = path.dirname(outputFilePath);

    // 校验 PRD 文件是否存在
    await this.validatePRDFile(prdFilePath);

    // 确保原型输出目录存在
    await this.ensureOutputDirectory(prototypeDir);

    // 计算相对路径用于提示词
    const prdRelativePath = path.relative(projectRootDir, prdFilePath);
    const outputRelativePath = path.relative(projectRootDir, outputFilePath);

    logger.info('GeneratePrototype: Creating WriteHandler', {
      projectRootDir,
      docsDir,
      prdFilePath,
      outputFilePath,
      prdRelativePath,
      outputRelativePath,
    });

    const config: WriteConfig = {
      ...DOCUMENT_CONFIGS.PROTOTYPE,
      systemPrompt: '',
      buildWritePrompt: (_input: string) => this.buildPrototypePrompt(prdRelativePath, outputRelativePath),
      useCustomCLIPrompt: true, // 👈 启用自定义 CLI prompt，使用 buildWritePrompt
    };

    return new DocumentWriteHandler(this, config);
  }

  async run(input: string, options?: GeneratePrototypeOptions): Promise<IActionOutput> {
    const mode = options?.mode || 'new';

    // 使用 BaseAction 提供的验证方法
    const workspaceOptions = this.validateWorkspaceOptions(options, 'PROTOTYPE');
    const { applicationId, projectId } = workspaceOptions;

    const isCLIMode = this.isCLIMode();

    logger.info('GeneratePrototype: Starting prototype generation', {
      applicationId,
      projectId,
      mode,
      isCLIMode,
      inputLength: input.length,
    });

    if (!isCLIMode) {
      throw new Error('GeneratePrototype supports CLI mode only. Please set executor mode to cli.');
    }

    try {
      const handler = await this.getCachedHandler('write', () => this.createWriteHandler(workspaceOptions));
      const handlerOptions = this.getHandlerOptions(workspaceOptions);
      const result = await handler.execute('', handlerOptions);

      // 验证生成的 Prototype 内容
      if (result.content) {
        this.validatePrototypeContent(result.content);
        logger.info('GeneratePrototype: Prototype generation completed successfully', {
          contentLength: result.content.length,
          workspaceDir: result.workspaceDir,
        });
      } else {
        logger.warn('GeneratePrototype: No content returned from handler');
      }

      // 读取 PRD 内容作为 action output（用于前端展示）
      let prdContent = '';
      try {
        prdContent = await this.loadDocumentFromWorkspace('PRD.md', workspaceOptions, 'PRD');
      } catch (error: unknown) {
        const err = error as Error;
        logger.warn('GeneratePrototype: Failed to load PRD content for output', {
          error: err.message,
        });
      }

      const projectWorkspace = WorkspaceManager.getProjectWorkspacePath(workspaceOptions);
      const prototypeDir = path.join(projectWorkspace, 'docs', 'prototype');
      const indexHtmlPath = path.join(prototypeDir, 'index.html');
      const files = [
        {
          filename: 'index.html',
          path: indexHtmlPath,
        },
      ];

      return this.createActionOutput(prdContent || result.content, {
        type: 'prototype',
        mode,
        filename: 'index.html',
        files,
        mainFile: 'index.html',
        workspaceDir: result.workspaceDir,
      });
    } catch (error: unknown) {
      const err = error as Error;
      logger.error('GeneratePrototype: Failed to generate prototype', {
        error: err.message,
        stack: err.stack,
      });
      throw error;
    }
  }
}

export default GeneratePrototype;
