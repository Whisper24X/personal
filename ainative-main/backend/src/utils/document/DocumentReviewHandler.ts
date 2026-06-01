/**
 * DocumentReviewHandler
 * 文档审核处理器
 * 
 * 提供统一的文档审核执行流程，支持CLI模式和LLM模式：
 * - CLI模式：使用文件路径输入，单文件整体审核
 * - LLM模式：使用文件内容输入，支持分章节审核
 */

import { BaseAction } from '../../core/base/BaseAction';
import { ReviewConfig, ReviewOptions, ReviewResult } from './types';
import { CLIModeHandler } from './CLIModeHandler';
import { isReviewPassed, extractOutline } from './DocumentContentUtils';
import { logger } from '../logger';
import { WorkspaceOptions } from '../index';

export class DocumentReviewHandler {
  private action: BaseAction;
  private config: ReviewConfig;
  private cliHandler: CLIModeHandler;

  constructor(action: BaseAction, config: ReviewConfig) {
    this.action = action;
    this.config = config;
    this.cliHandler = new CLIModeHandler(action, config);
  }

  /**
   * 执行文档审核
   * 根据模式自动选择使用文件路径或内容进行审核
   * 
   * @param content 文档内容（LLM模式）或空字符串（CLI模式会从workspace读取）
   * @param options 审核选项
   * @returns 审核结果
   */
  async execute(content: string, options: ReviewOptions): Promise<ReviewResult> {
    const isCLIMode = this.cliHandler.isCLIMode();
    const workspaceDir = (this.action as any).getWorkspaceDir(options);

    logger.info('DocumentReviewHandler: Starting document review', {
      documentType: this.config.documentType,
      isCLIMode,
      contentLength: content.length,
      hasOutline: !!options.outline,
      workspaceDir,
    });

    try {
      let reviewResult: string;

      if (isCLIMode || options.useFilePath) {
        // CLI模式：使用文件路径进行审核
        reviewResult = await this.reviewWithFilePath(workspaceDir, options);
      } else {
        // LLM模式：使用文件内容进行审核
        reviewResult = await this.reviewWithContent(content, workspaceDir, options);
      }

      // 判断审核是否通过
      const passed = isReviewPassed(reviewResult);

      logger.info('DocumentReviewHandler: Review completed', {
        documentType: this.config.documentType,
        reviewLength: reviewResult.length,
        passed,
      });

      return {
        reviewResult,
        passed,
      };
    } catch (error: any) {
      logger.error('DocumentReviewHandler: Review failed', {
        documentType: this.config.documentType,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * CLI模式：使用文件路径进行审核（只传路径，不传内容）
   * 
   * @param workspaceDir workspace目录
   * @param options 审核选项
   * @returns 审核结果
   */
  private async reviewWithFilePath(
    workspaceDir: string,
    options: ReviewOptions
  ): Promise<string> {
    logger.info('DocumentReviewHandler: Reviewing with file path only (CLI mode)', {
      documentType: this.config.documentType,
      workspaceDir,
    });

    // 获取审核要点（如果配置中有的话）
    const taskPoints = this.getReviewTaskPoints();

    // 使用新的路径模式构建Prompt - 只传递文件夹路径，不传递文件内容
    const prompt = this.cliHandler.buildCLIReviewPrompt(workspaceDir, taskPoints);

    // 调用LLM/CLI执行审核
    const output = await (this.action as any).aask(prompt, [this.config.systemPrompt]);

    // 处理CLI输出 - 返回 ProcessOutputResult
    const processResult = await this.cliHandler.processOutput(
      output,
      workspaceDir,
      'review'
    );

    // 保存审核报告（如果需要）
    // 如果内容是从workspace读取的（isReadFromWorkspace=true），
    // 说明CLI工具已经保存了文件，不需要再次保存
    await this.saveReviewIfNeeded(processResult.content, options, processResult.isReadFromWorkspace);

    return processResult.content;
  }

  /**
   * 获取审核任务要点
   * 可以被子类重写以提供特定文档类型的审核要点
   * 
   * @returns 审核要点列表
   */
  protected getReviewTaskPoints(): string[] {
    const documentType = this.config.documentType;
    
    // 根据文档类型返回不同的审核要点
    const taskPointsMap: Record<string, string[]> = {
      MRD: [
        '检查MRD是否包含所有必需章节（1-7章 + Sources）',
        '检查内容是否充实、具体、无占位符',
        '检查"明确不做的范围"是否至少有3项',
        '检查是否有至少1个可量化的成功标准',
        '检查是否有至少2个典型使用场景',
      ],
      PRD: [
        '检查PRD是否包含所有必需章节（0-10章）',
        '检查内容是否具体、可执行、无占位符',
        '检查是否明确区分"本期做"和"不做"',
        '检查功能定义是否包含触发条件、前置条件、主流程、异常处理',
      ],
      DESIGN: [
        '检查设计文档是否包含所有必需章节',
        '检查技术选型是否合理且有依据',
        '检查架构设计是否清晰完整',
        '检查是否考虑了安全性、性能和扩展性',
      ],
      TEST: [
        '检查测试用例是否覆盖所有功能点',
        '检查测试用例是否包含正常场景和异常场景',
        '检查测试用例是否可执行、可验证',
        '检查是否有边界条件和负面测试',
      ],
      TESTABILITY: [
        '检查PRD的可测试性',
        '识别难以测试的功能点',
        '提供提升可测试性的建议',
      ],
    };

    return taskPointsMap[documentType.toUpperCase()] || [
      `检查${documentType}是否包含所有必需内容`,
      '检查内容是否具体、完整、无占位符',
      '提供具体、可执行的改进建议',
    ];
  }

  /**
   * LLM模式：使用文件内容进行审核
   * 
   * @param content 文档内容
   * @param workspaceDir workspace目录
   * @param options 审核选项
   * @returns 审核结果
   */
  private async reviewWithContent(
    content: string,
    workspaceDir: string,
    options: ReviewOptions
  ): Promise<string> {
    // 如果内容为空，尝试从workspace读取
    let actualContent = content;
    if (!content || content.trim().length < 100) {
      const contentFromWorkspace = await (this.action as any).readWorkspaceFile(
        this.config.mainFileName,
        options
      );
      if (contentFromWorkspace) {
        actualContent = contentFromWorkspace;
        logger.info('DocumentReviewHandler: Loaded content from workspace', {
          documentType: this.config.documentType,
          contentLength: actualContent.length,
        });
      }
    }

    if (!actualContent || actualContent.trim().length === 0) {
      throw new Error(
        `Cannot find ${this.config.documentType} content for review. Please generate it first.`
      );
    }

    logger.info('DocumentReviewHandler: Reviewing with content (LLM mode)', {
      documentType: this.config.documentType,
      contentLength: actualContent.length,
    });

    // 获取或提取目录（确保始终有值）
    const outline = options.outline || this.extractOutlineFromContent(actualContent) || '';

    // 构建审核提示词
    let prompt = this.config.buildReviewPrompt(actualContent, outline);

    // CLI模式下添加保存指令
    if (this.cliHandler.isCLIMode()) {
      const savePath = this.cliHandler.getReviewSavePath(workspaceDir);
      prompt = this.cliHandler.buildPromptWithSaveInstruction(
        prompt,
        savePath,
        this.config.reviewDescription
      );
    }

    // 调用LLM执行审核
    const output = await (this.action as any).aask(prompt, [this.config.systemPrompt]);

    // 处理输出 - 返回 ProcessOutputResult
    const processResult = await this.cliHandler.processOutput(
      output,
      workspaceDir,
      'review'
    );

    // 保存审核报告（如果需要）
    // 如果内容是从workspace读取的（isReadFromWorkspace=true），
    // 说明CLI工具已经保存了文件，不需要再次保存
    await this.saveReviewIfNeeded(processResult.content, options, processResult.isReadFromWorkspace);

    return processResult.content;
  }


  /**
   * 从文档内容中提取目录
   * 
   * @param content 文档内容
   * @returns 目录内容
   */
  private extractOutlineFromContent(content: string): string {
    if (this.config.extractOutline) {
      return this.config.extractOutline(content);
    }
    return extractOutline(content);
  }

  /**
   * 如果需要，保存审核报告到workspace
   * 
   * @param reviewResult 审核结果
   * @param options workspace选项
   * @param isReadFromWorkspace 内容是否从workspace读取（CLI已保存）
   */
  private async saveReviewIfNeeded(
    reviewResult: string,
    options: WorkspaceOptions,
    isReadFromWorkspace: boolean = false
  ): Promise<void> {
    // 检查是否应该保存
    const saveCheck = this.cliHandler.checkShouldSaveContent(
      reviewResult,
      isReadFromWorkspace,
      'DocumentReviewHandler',
      this.config.reviewFileName
    );

    if (!saveCheck.shouldSave) {
      return;
    }

    // 保存审核报告
    if (options.applicationId) {
      await (this.action as any).saveToWorkspace(
        this.config.reviewFileName,
        reviewResult,
        options
      );
      logger.info('DocumentReviewHandler: Saved review report to workspace', {
        documentType: this.config.documentType,
        filename: this.config.reviewFileName,
      });
    }
  }

  /**
   * 获取CLIModeHandler
   */
  getCLIModeHandler(): CLIModeHandler {
    return this.cliHandler;
  }

  /**
   * 获取配置
   */
  getConfig(): ReviewConfig {
    return this.config;
  }
}
