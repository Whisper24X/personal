/**
 * CLIModeHandler
 * CLI模式处理器
 * 
 * 封装CLI模式下的通用处理逻辑：
 * - CLI模式检测
 * - prompt增强（添加文件保存指令）
 * - 输出处理（检测总结输出并从workspace读取实际文件）
 * - 文件路径引用（CLI模式下使用文件路径而非内容）
 */

import { BaseAction } from '../../core/base/BaseAction';
import { CLIModeConfig, CLIOutputType, ProcessOutputResult } from './types';
import { logger } from '../logger';
import {
  buildCLISaveInstruction,
  isCLISummaryOutput,
  tryReadActualDocumentFromWorkspace,
  tryReadActualReviewFromWorkspace,
} from '../stepwise';
import {
  buildCLIModePrompt,
  CLIPromptConfig,
  DocumentOperationType,
  getCLIIOConfig,
  getBaseWorkspaceDir,
} from './CLIPromptBuilder';

export class CLIModeHandler {
  private action: BaseAction;
  private config: CLIModeConfig;

  constructor(action: BaseAction, config: CLIModeConfig) {
    this.action = action;
    this.config = config;
  }

  /**
   * 检查当前是否为CLI模式
   */
  isCLIMode(): boolean {
    return (this.action as any).isCLIMode();
  }

  /**
   * 获取执行模式
   */
  getExecutorMode(): 'cli' | 'llm' {
    return (this.action as any).getExecutorMode();
  }

  /**
   * 构建带有文件保存指令的prompt
   * @param prompt 原始prompt
   * @param savePath 保存路径
   * @param description 文件描述
   * @returns 增强后的prompt
   */
  buildPromptWithSaveInstruction(
    prompt: string,
    savePath: string,
    description: string
  ): string {
    if (!this.isCLIMode()) {
      return prompt;
    }
    
    const saveInstruction = buildCLISaveInstruction(savePath, description);
    
    logger.info('CLIModeHandler: Added CLI save path instruction', {
      documentType: this.config.documentType,
      savePath,
      description,
    });
    
    return prompt + saveInstruction;
  }

  /**
   * 处理CLI输出
   * 检测是否为总结输出，如果是则从workspace读取实际文件
   * 
   * @param output CLI输出内容
   * @param workspaceDir workspace目录
   * @param type 输出类型：'document' 或 'review'
   * @param fallbackContent 如果找不到实际文件时的回退内容
   * @returns 处理后的结果，包含内容和是否从workspace读取的标记
   */
  async processOutput(
    output: string,
    workspaceDir: string,
    type: CLIOutputType,
    fallbackContent?: string
  ): Promise<ProcessOutputResult> {
    // 非CLI模式直接返回
    if (!this.isCLIMode()) {
      return {
        content: output,
        isReadFromWorkspace: false,
      };
    }

    // CLI模式：记录CLI返回的内容到日志（仅用于调试）
    // CLI返回的内容不作为文档内容使用，只用于日志记录
    logger.info('CLIModeHandler: CLI output received (for logging only)', {
      documentType: this.config.documentType,
      type,
      outputLength: output.length,
      outputPreview: output.substring(0, 200),
      isSummary: isCLISummaryOutput(output),
    });

    // CLI模式下，必须从workspace读取文件，不使用CLI返回的内容
    let actualContent: string | null = null;

    if (type === 'document') {
      logger.info('CLIModeHandler: Attempting to read document from workspace', {
        documentType: this.config.documentType,
        workspaceDir,
        mainFileName: this.config.mainFileName,
      });
      
      actualContent = await tryReadActualDocumentFromWorkspace(workspaceDir, {
        mainFileName: this.config.mainFileName,
        filePattern: this.config.documentType.toLowerCase(),
      });
      
      logger.info('CLIModeHandler: Document read result', {
        documentType: this.config.documentType,
        found: !!actualContent,
        contentLength: actualContent?.length || 0,
      });
    } else if (type === 'review') {
      actualContent = await tryReadActualReviewFromWorkspace(workspaceDir, {
        reviewFileName: this.config.reviewFileName,
        filePattern: `${this.config.documentType.toLowerCase()}_review`,
      });
    }

    if (actualContent) {
      logger.info('CLIModeHandler: Successfully read actual content from workspace', {
        documentType: this.config.documentType,
        type,
        actualContentLength: actualContent.length,
      });
      // 从workspace读取意味着CLI工具已经保存了文件，不需要再次保存
      return {
        content: actualContent,
        isReadFromWorkspace: true,
      };
    }

    // CLI模式下找不到文件，抛出错误（不使用fallback或CLI输出）
    const expectedFile = type === 'document' ? this.config.mainFileName : this.config.reviewFileName;
    logger.error('CLIModeHandler: Failed to find actual content in workspace', {
      documentType: this.config.documentType,
      type,
      workspaceDir,
      expectedFile,
      hasFallback: !!fallbackContent,
    });

    throw new Error(
      `CLI模式失败: 找不到${this.config.documentType}文档文件。` +
      `预期文件: ${workspaceDir}/${expectedFile}。` +
      `CLI工具可能未能正确保存文件。`
    );
  }

  /**
   * 判断内容是否应该保存到workspace
   * CLI总结输出不应该保存
   * 
   * @param content 要判断的内容
   * @returns 是否应该保存
   */
  shouldSaveToWorkspace(content: string): boolean {
    return !isCLISummaryOutput(content);
  }

  /**
   * 检查是否应该保存内容到workspace
   * 封装CLI模式下的保存逻辑判断
   * 
   * @param content 要保存的内容
   * @param isReadFromWorkspace 内容是否从workspace读取
   * @param handlerName Handler名称（用于日志）
   * @param filename 文件名（用于日志）
   * @returns 保存检查结果
   */
  checkShouldSaveContent(
    content: string,
    isReadFromWorkspace: boolean,
    handlerName: string,
    filename: string
  ): { shouldSave: boolean; reason?: string } {
    // 如果内容是从workspace读取的，说明CLI工具已经保存了文件，不需要再次保存
    if (isReadFromWorkspace) {
      logger.info(`${handlerName}: Skipping save - CLI already saved the file`, {
        documentType: this.config.documentType,
        filename,
      });
      return { shouldSave: false, reason: 'already_saved_by_cli' };
    }

    // CLI模式下，如果内容不是从workspace读取的，不应该保存
    // CLI返回的内容只用于日志记录，不作为文档内容使用
    if (this.isCLIMode()) {
      logger.warn(`${handlerName}: CLI mode - Content not read from workspace, skipping save`, {
        documentType: this.config.documentType,
        filename,
        contentLength: content.length,
      });
      return { shouldSave: false, reason: 'cli_mode_no_workspace_content' };
    }

    // LLM模式下，检查内容是否为CLI总结
    if (!this.shouldSaveToWorkspace(content)) {
      return { shouldSave: false, reason: 'cli_summary_output' };
    }

    return { shouldSave: true };
  }

  /**
   * 构建CLI模式下使用文件路径作为输入的prompt
   * 而非直接传入完整文件内容
   * 
   * @param filePath 文件路径
   * @returns 文件路径引用的prompt片段
   */
  buildFilePathReference(filePath: string): string {
    return `【文档位置】请从以下路径读取文档内容：${filePath}

【操作要求】
1. 读取上述文件的完整内容
2. 基于文件内容执行后续操作
3. 将结果保存到指定位置`;
  }

  /**
   * 获取文档保存路径
   * @param workspaceDir workspace目录
   * @returns 文档保存路径
   */
  getDocumentSavePath(workspaceDir: string): string {
    return `${workspaceDir}/${this.config.mainFileName}`;
  }

  /**
   * 获取审核报告保存路径
   * @param workspaceDir workspace目录
   * @returns 审核报告保存路径
   */
  getReviewSavePath(workspaceDir: string): string {
    return `${workspaceDir}/${this.config.reviewFileName}`;
  }

  /**
   * 获取文档读取路径
   * @param workspaceDir workspace目录
   * @returns 文档读取路径
   */
  getDocumentReadPath(workspaceDir: string): string {
    return `${workspaceDir}/${this.config.mainFileName}`;
  }

  /**
   * 获取配置
   */
  getConfig(): CLIModeConfig {
    return this.config;
  }

  /**
   * 清理代码块标记
   * @param content 原始内容
   * @returns 清理后的内容
   */
  cleanCodeBlockMarkers(content: string): string {
    let cleaned = content.trim();
    
    // 移除开头的代码块标记
    const startPattern = /^```(?:markdown|md|text)?\s*\n?/i;
    if (startPattern.test(cleaned)) {
      cleaned = cleaned.replace(startPattern, '');
    }
    
    // 移除结尾的代码块标记
    const endPattern = /\n?```\s*$/;
    if (endPattern.test(cleaned)) {
      cleaned = cleaned.replace(endPattern, '');
    }
    
    return cleaned.trim();
  }

  /**
   * 构建CLI模式下只使用路径的Prompt（不传递文件内容）
   * 这是CLI模式的核心方法，只告诉CLI工具输入/输出路径
   * 
   * @param workspaceDir workspace目录（包含documentType）
   * @param operationType 操作类型：write/review/improve
   * @param taskPoints 任务要点（可选）
   * @param systemContext 系统上下文（可选）
   * @returns CLI模式Prompt
   */
  buildCLIPathOnlyPrompt(
    workspaceDir: string,
    operationType: DocumentOperationType,
    taskPoints?: string[],
    systemContext?: string
  ): string {
    const documentType = this.config.documentType;
    const ioConfig = getCLIIOConfig(operationType, documentType);
    
    if (!ioConfig) {
      // 回退到旧的方式
      logger.warn('CLIModeHandler: No IO config found for operation, falling back to legacy mode', {
        documentType,
        operationType,
      });
      return this.buildFilePathReference(this.getDocumentReadPath(workspaceDir));
    }

    // 获取基础workspace目录（不包含documentType）
    const baseWorkspaceDir = getBaseWorkspaceDir(workspaceDir);
    
    // 构建输入输出路径
    const inputDir = ioConfig.inputDirRelative
      ? `${baseWorkspaceDir}/${ioConfig.inputDirRelative}`
      : baseWorkspaceDir;
    const outputDir = `${baseWorkspaceDir}/${ioConfig.outputDirRelative}`;

    // 获取任务描述
    const taskDescription = this.getTaskDescription(operationType);

    // 使用通用的CLI Prompt构建器
    const config: CLIPromptConfig = {
      inputDir,
      outputDir,
      inputFileNames: ioConfig.inputFileNames,
      outputFileName: ioConfig.outputFileName,
      taskDescription,
      taskPoints,
      systemContext,
    };

    const prompt = buildCLIModePrompt(config);

    logger.info('CLIModeHandler: Built CLI path-only prompt', {
      documentType,
      operationType,
      inputDir,
      outputDir,
      inputFileNames: ioConfig.inputFileNames,
      outputFileName: ioConfig.outputFileName,
    });

    return prompt;
  }

  /**
   * 构建CLI模式Review Prompt（只使用路径）
   * 
   * @param workspaceDir workspace目录
   * @param taskPoints 审核要点（可选）
   * @returns CLI模式Review Prompt
   */
  buildCLIReviewPrompt(workspaceDir: string, taskPoints?: string[]): string {
    return this.buildCLIPathOnlyPrompt(workspaceDir, 'review', taskPoints);
  }

  /**
   * 构建CLI模式Improve Prompt（只使用路径）
   * 
   * @param workspaceDir workspace目录
   * @param taskPoints 改进要点（可选）
   * @returns CLI模式Improve Prompt
   */
  buildCLIImprovePrompt(workspaceDir: string, taskPoints?: string[]): string {
    return this.buildCLIPathOnlyPrompt(workspaceDir, 'improve', taskPoints);
  }

  /**
   * 构建CLI模式Write Prompt（只使用路径）
   * 
   * @param workspaceDir workspace目录
   * @param taskPoints 生成要点（可选）
   * @returns CLI模式Write Prompt
   */
  buildCLIWritePrompt(workspaceDir: string, taskPoints?: string[]): string {
    return this.buildCLIPathOnlyPrompt(workspaceDir, 'write', taskPoints);
  }

  /**
   * 获取任务描述
   * @param operationType 操作类型
   * @returns 任务描述
   */
  private getTaskDescription(operationType: DocumentOperationType): string {
    const documentTypeDesc = this.getDocumentTypeDescription();
    
    switch (operationType) {
      case 'write':
        return `生成${documentTypeDesc}`;
      case 'review':
        return `审核${documentTypeDesc}`;
      case 'improve':
        return `根据审核报告改进${documentTypeDesc}`;
      default:
        return `处理${documentTypeDesc}`;
    }
  }

  /**
   * 获取文档类型的中文描述
   * @returns 中文描述
   */
  private getDocumentTypeDescription(): string {
    const descriptions: Record<string, string> = {
      MRD: '市场需求文档（MRD）',
      PRD: '产品需求文档（PRD）',
      DESIGN: '系统设计文档',
      TEST: '测试文档',
      TESTABILITY: '可测试性文档',
      CODE: '代码',
    };
    return descriptions[this.config.documentType.toUpperCase()] || this.config.documentType;
  }

  /**
   * 获取审核报告读取路径
   * @param workspaceDir workspace目录
   * @returns 审核报告读取路径
   */
  getReviewReadPath(workspaceDir: string): string {
    return `${workspaceDir}/${this.config.reviewFileName}`;
  }
}
