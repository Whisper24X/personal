/**
 * WriteDesign Action
 * Generates System Design Document from PRD
 * 
 * 工作流程：
 * 1) CLI模式：使用 DocumentWriteHandler 直接生成（只传PRD文件夹路径）
 * 2) LLM模式：使用 StepwiseDocumentGenerator 分步生成或一次性生成
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import {
  DESIGN_SYSTEM_PROMPT,
  buildDesignPrompt,
  buildDesignOutlinePrompt,
  buildDesignSectionPrompt,
} from '../prompts/design';
import { logger, WorkspaceOptions } from '../utils';
import { StepwiseDocumentGenerator } from '../utils/stepwise';
import {
  DocumentWriteHandler,
  DOCUMENT_CONFIGS,
  WriteConfig,
} from '../utils/document';

export interface WriteDesignOptions extends WorkspaceOptions {
  // 继承WorkspaceOptions的所有选项
  useStepwiseGeneration?: boolean; // 是否使用分步骤生成
}

export class WriteDesign extends BaseAction {
  constructor() {
    super('WriteDesign', 'Generate System Design Document from PRD');
  }

  /**
   * 创建 WriteHandler
   */
  private async createWriteHandler(): Promise<DocumentWriteHandler> {
    const systemPrompt = await this.loadSystemPrompt('design', 'system_prompt', DESIGN_SYSTEM_PROMPT);

    const config: WriteConfig = {
      ...DOCUMENT_CONFIGS.DESIGN,
      buildWritePrompt: buildDesignPrompt,
      systemPrompt,
    };

    return new DocumentWriteHandler(this, config);
  }

  async run(prd: string, options?: WriteDesignOptions): Promise<IActionOutput> {
    const useStepwise = options?.useStepwiseGeneration ?? true; // 默认启用分步骤生成

    // 使用 BaseAction 提供的验证方法
    const workspaceOptions = this.validateWorkspaceOptions(options, 'DESIGN');
    const { applicationId, projectId } = workspaceOptions;

    const isCLIMode = this.isCLIMode();

    logger.info('WriteDesign: Starting design generation', {
      applicationId,
      projectId,
      useStepwise,
      isCLIMode,
      prdLength: prd.length,
    });

    try {
      // CLI模式：使用 BaseAction 封装的执行方法
      // 不使用 StepwiseDocumentGenerator
      if (isCLIMode) {
        const handler = await this.getCachedHandler('write', () => this.createWriteHandler());
        return await this.executeWriteHandler(handler, '', workspaceOptions, {
          type: 'design',
        });
      }

      // LLM模式：如果启用分步骤生成，使用分步骤生成
      if (useStepwise) {
        return await this.generateStepwise(prd, options);
      }

      // LLM模式：否则使用传统的一次性生成
      const prompt = buildDesignPrompt(prd);
      
      // Load system prompt from database or use default
      const systemPrompt = await this.loadSystemPrompt('design', 'system_prompt', DESIGN_SYSTEM_PROMPT);
      
      // Call LLM with system message and prompt
      const designContent = await this.aask(prompt, [systemPrompt]);
      
      // 保存到workspace
      await this.saveToWorkspace('DESIGN.md', designContent, workspaceOptions);
      
      logger.info('WriteDesign: Design generation completed', {
        contentLength: designContent.length,
        workspaceDir: this.getWorkspaceDir(workspaceOptions),
      });
      
      return this.createActionOutput(designContent, {
        type: 'design',
        filename: 'DESIGN.md',
        workspaceDir: this.getWorkspaceDir(workspaceOptions),
      });
    } catch (error: any) {
      logger.error('WriteDesign: Failed to generate design', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * 分步骤生成设计文档
   * 使用通用的 StepwiseDocumentGenerator（仅LLM模式）
   */
  private async generateStepwise(input: string, options?: WriteDesignOptions): Promise<IActionOutput> {
    // 使用 validateWorkspaceOptions 统一获取路径参数
    const workspaceOptions = this.validateWorkspaceOptions(options, 'DESIGN');
    const workspaceDir = this.getWorkspaceDir(workspaceOptions);

    // Load system prompt from database or use default
    const systemPrompt = await this.loadSystemPrompt('design', 'system_prompt', DESIGN_SYSTEM_PROMPT);

    // Get role from context (if available)
    const role = (this as any).role?.profile || undefined;

    // 获取当前执行模式
    const executorMode = this.getExecutorMode();

    logger.info('WriteDesign: Creating StepwiseDocumentGenerator', {
      executorMode,
      workspaceDir,
      ...workspaceOptions,
    });

    const generator = new StepwiseDocumentGenerator(this as unknown as BaseAction, {
      buildOutlinePrompt: buildDesignOutlinePrompt,
      buildSectionPrompt: buildDesignSectionPrompt,
      buildFullDocumentPrompt: buildDesignPrompt,
      systemPrompt: systemPrompt,
      documentTitle: '系统设计文档',
      documentType: 'DESIGN',
      mainFileName: 'DESIGN.md',
      defaultSections: [
        { number: 1, title: '系统概述' },
        { number: 2, title: '系统总体架构设计' },
        { number: 3, title: '技术选型总览' },
        { number: 4, title: '前端技术方案设计' },
        { number: 5, title: '后端技术方案设计' },
        { number: 6, title: '数据模型设计' },
        { number: 7, title: '安全性设计' },
        { number: 8, title: '性能与扩展性' },
        { number: 9, title: '日志、错误与监控' },
        { number: 10, title: '测试策略' },
        { number: 11, title: '部署与 DevOps' },
        { number: 12, title: '未来演进方向' },
      ],
      workspaceDir,
      ...workspaceOptions,
      role,
      executorMode: executorMode,
      skipStepwiseInCLI: true,
    });

    return await generator.generate(input);
  }
}

export default WriteDesign;
