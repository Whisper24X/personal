/**
 * DocumentWriteHandler
 * 文档生成处理器
 * 
 * 提供统一的文档生成执行流程，支持CLI模式和LLM模式：
 * - CLI模式：使用文件路径输入，直接生成完整文档（不使用StepwiseDocumentGenerator）
 * - LLM模式：使用文件内容输入，可选择分步生成或一次性生成
 */

import { BaseAction } from '../../core/base/BaseAction';
import { WriteConfig, WriteOptions, WriteResult } from './types';
import { CLIModeHandler } from './CLIModeHandler';
import { cleanCodeBlockMarkers } from './DocumentContentUtils';
import { logger } from '../logger';
import { WorkspaceOptions } from '../index';

export class DocumentWriteHandler {
  private action: BaseAction;
  private config: WriteConfig;
  private cliHandler: CLIModeHandler;

  constructor(action: BaseAction, config: WriteConfig) {
    this.action = action;
    this.config = config;
    this.cliHandler = new CLIModeHandler(action, config);
  }

  /**
   * 执行文档生成
   * 根据模式自动选择使用文件路径或内容进行生成
   * 
   * @param input 输入内容（LLM模式）或空字符串（CLI模式会读取输入文件夹）
   * @param options 生成选项
   * @returns 生成结果
   */
  async execute(input: string, options: WriteOptions): Promise<WriteResult> {
    const isCLIMode = this.cliHandler.isCLIMode();
    const workspaceDir = (this.action as any).getWorkspaceDir(options);

    logger.info('DocumentWriteHandler: Starting document generation', {
      documentType: this.config.documentType,
      isCLIMode,
      inputLength: input.length,
      workspaceDir,
    });

    try {
      let content: string;

      if (isCLIMode || options.useFilePath) {
        // CLI模式：使用文件路径进行生成（不使用StepwiseDocumentGenerator）
        content = await this.writeWithFilePath(workspaceDir, options);
      } else {
        // LLM模式：使用文件内容进行生成
        content = await this.writeWithContent(input, workspaceDir, options);
      }

      logger.info('DocumentWriteHandler: Generation completed', {
        documentType: this.config.documentType,
        contentLength: content.length,
      });

      return {
        content,
        filename: this.config.mainFileName,
        workspaceDir,
      };
    } catch (error: any) {
      logger.error('DocumentWriteHandler: Generation failed', {
        documentType: this.config.documentType,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * CLI模式：使用文件路径进行生成（只传路径，不传内容）
   * 不使用 StepwiseDocumentGenerator，直接调用 aask
   * 
   * @param workspaceDir workspace目录
   * @param options 生成选项
   * @returns 生成的文档内容
   */
  private async writeWithFilePath(
    workspaceDir: string,
    _options: WriteOptions
  ): Promise<string> {
    logger.info('DocumentWriteHandler: Writing with file path only (CLI mode)', {
      documentType: this.config.documentType,
      workspaceDir,
    });

    // 获取生成要点
    const taskPoints = this.getWriteTaskPoints();

    // 使用路径模式构建Prompt - 只传递文件夹路径，不传递文件内容
    const prompt = this.cliHandler.buildCLIWritePrompt(workspaceDir, taskPoints);

    // 调用LLM/CLI执行生成
    const output = await (this.action as any).aask(prompt, [this.config.systemPrompt]);

    // 处理CLI输出 - 返回 ProcessOutputResult
    const processResult = await this.cliHandler.processOutput(
      output,
      workspaceDir,
      'document'
    );

    // 清理代码块标记
    const content = cleanCodeBlockMarkers(processResult.content);

    // 保存文档（如果需要）
    // 关键逻辑：如果内容是从workspace读取的（isReadFromWorkspace=true），
    // 说明CLI工具已经保存了文件，不需要再次保存，避免冗余操作
    if (!processResult.isReadFromWorkspace && this.cliHandler.shouldSaveToWorkspace(content)) {
      await (this.action as any).saveToWorkspace(
        this.config.mainFileName,
        content,
        { documentType: this.config.documentType }
      );
      logger.info('DocumentWriteHandler: Saved document to workspace', {
        documentType: this.config.documentType,
        filename: this.config.mainFileName,
      });
    } else if (processResult.isReadFromWorkspace) {
      logger.info('DocumentWriteHandler: Skipping save - CLI already saved the file', {
        documentType: this.config.documentType,
        filename: this.config.mainFileName,
      });
    }

    return content;
  }

  /**
   * LLM模式：使用文件内容进行生成
   * 
   * @param input 输入内容
   * @param workspaceDir workspace目录
   * @param options 生成选项
   * @returns 生成的文档内容
   */
  private async writeWithContent(
    input: string,
    _workspaceDir: string,
    options: WriteOptions
  ): Promise<string> {
    logger.info('DocumentWriteHandler: Writing with content (LLM mode)', {
      documentType: this.config.documentType,
      inputLength: input.length,
    });

    // 构建生成提示词
    const prompt = this.config.buildWritePrompt(input);

    // 调用LLM执行生成
    const output = await (this.action as any).aask(prompt, [this.config.systemPrompt]);

    // 清理代码块标记
    let content = cleanCodeBlockMarkers(output);

    // 保存文档
    await this.saveDocumentIfNeeded(content, options);

    return content;
  }

  /**
   * 获取生成任务要点
   * 
   * @returns 生成要点列表
   */
  protected getWriteTaskPoints(): string[] {
    const documentType = this.config.documentType;
    
    // 根据文档类型返回不同的生成要点
    const taskPointsMap: Record<string, string[]> = {
      MRD: [
        '严格按照MRD模板格式输出',
        '不保留任何占位符',
        '内容要详细、具体、充实',
        '确保"明确不做的范围"至少3项',
        '确保至少1个可量化的成功标准',
      ],
      PRD: [
        '严格按照PRD模板格式输出',
        '不保留任何占位符',
        '内容要详细、具体、充实',
        '功能定义包含触发条件、前置条件、主流程、异常处理',
        '明确区分"本期做"和"不做"',
      ],
      DESIGN: [
        '严格按照设计文档模板格式输出',
        '技术选型要有依据',
        '架构设计要清晰完整',
        '考虑安全性、性能和扩展性',
      ],
      TEST: [
        '按功能模块组织测试用例',
        '每个测试用例包含前置条件、执行步骤、预期结果',
        '覆盖正常场景、边界条件、异常情况',
        '测试用例可执行、可验证',
      ],
    };

    return taskPointsMap[documentType.toUpperCase()] || [
      '严格按照模板格式输出',
      '不保留任何占位符',
      '内容要详细、具体、充实',
    ];
  }

  /**
   * 如果需要，保存文档到workspace
   * 
   * @param content 文档内容
   * @param options workspace选项
   */
  private async saveDocumentIfNeeded(
    content: string,
    options: WorkspaceOptions
  ): Promise<void> {
    // 只有当内容不是CLI总结时才保存
    if (options.applicationId && this.cliHandler.shouldSaveToWorkspace(content)) {
      await (this.action as any).saveToWorkspace(
        this.config.mainFileName,
        content,
        options
      );
      logger.info('DocumentWriteHandler: Saved document to workspace', {
        documentType: this.config.documentType,
        filename: this.config.mainFileName,
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
  getConfig(): WriteConfig {
    return this.config;
  }
}
