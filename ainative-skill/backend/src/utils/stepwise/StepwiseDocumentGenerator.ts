/**
 * StepwiseDocumentGenerator
 * 通用的分步骤文档生成工具类（Facade）
 * 根据执行模式自动选择使用 LLM 分步骤生成或 CLI 完整文档生成
 */

import { BaseAction } from '../../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import { logger } from '../logger';
import { StepwiseGenerationConfig } from './types';
import { LLMStepwiseGenerator } from './LLMStepwiseGenerator';
import { CLIFullGenerator } from './CLIFullGenerator';

/**
 * StepwiseDocumentGenerator - Facade Pattern
 * 
 * 根据配置的 executorMode 自动选择合适的生成器：
 * - 'llm' 模式：使用 LLMStepwiseGenerator 进行分步骤生成
 * - 'cli' 模式：使用 CLIFullGenerator 进行完整文档生成
 */
export class StepwiseDocumentGenerator {
  private config: StepwiseGenerationConfig;
  private llmGenerator: LLMStepwiseGenerator;
  private cliGenerator: CLIFullGenerator;

  constructor(action: BaseAction, config: StepwiseGenerationConfig) {
    this.config = config;
    this.llmGenerator = new LLMStepwiseGenerator(action, config);
    this.cliGenerator = new CLIFullGenerator(action, config);
  }

  /**
   * 获取日志上下文信息（角色和action名称）
   */
  private getLogContext(): { role?: string; actionName?: string } {
    return {
      role: this.config.role,
    };
  }

  /**
   * 执行文档生成
   * 根据配置的执行模式自动选择使用 LLM 分步骤生成或 CLI 完整文档生成
   */
  async generate(input: string): Promise<IActionOutput> {
    const logContext = this.getLogContext();
    
    // 检查是否应该使用CLI模式的完整文档生成
    const isCLIMode = this.config.executorMode === 'cli';
    const shouldSkipStepwise = isCLIMode && (this.config.skipStepwiseInCLI !== false);
    
    logger.info('StepwiseDocumentGenerator: Starting generation', {
      ...logContext,
      documentType: this.config.documentType,
      documentTitle: this.config.documentTitle,
      workspaceDir: this.config.workspaceDir,
      applicationId: this.config.applicationId,
      projectId: this.config.projectId,
      inputLength: input.length,
      executorMode: this.config.executorMode || 'llm',
      skipStepwiseInCLI: shouldSkipStepwise,
    });

    // CLI模式下跳过分章节生成，直接生成完整文档
    if (shouldSkipStepwise) {
      logger.info('StepwiseDocumentGenerator: Using full document generation mode (CLI)', logContext);
      return await this.cliGenerator.generate(input);
    }

    logger.info('StepwiseDocumentGenerator: Using stepwise generation mode (LLM)', logContext);
    return await this.llmGenerator.generate(input);
  }

  /**
   * Reset generator state
   * Called during rollback to stop ongoing operations
   */
  async reset(abortSignal?: AbortSignal): Promise<void> {
    const logContext = this.getLogContext();
    logger.info('StepwiseDocumentGenerator: Resetting generators', {
      ...logContext,
      documentType: this.config.documentType,
      projectId: this.config.projectId,
    });

    // Reset both generators
    await Promise.all([
      this.llmGenerator.reset(abortSignal),
      this.cliGenerator.reset(abortSignal),
    ]);

    logger.info('StepwiseDocumentGenerator: Reset completed', logContext);
  }
}
