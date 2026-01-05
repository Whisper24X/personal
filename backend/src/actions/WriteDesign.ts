/**
 * WriteDesign Action
 * Generates System Design Document from PRD
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import {
  DESIGN_SYSTEM_PROMPT,
  buildDesignPrompt,
  buildDesignOutlinePrompt,
  buildDesignSectionPrompt,
} from '../prompts/design';
import { logger, WorkspaceOptions, loadPrompt } from '../utils';
import { DesignReview } from './DesignReview';
import { ImproveDocument } from './ImproveDocument';
import { StepwiseDocumentGenerator } from '../utils/StepwiseDocumentGenerator';

export interface WriteDesignOptions extends WorkspaceOptions {
  // 继承WorkspaceOptions的所有选项
  useStepwiseGeneration?: boolean; // 是否使用分步骤生成
}

export class WriteDesign extends BaseAction {
  constructor() {
    super('WriteDesign', 'Generate System Design Document from PRD');
  }

  async run(prd: string, options?: WriteDesignOptions): Promise<IActionOutput> {
    const useStepwise = options?.useStepwiseGeneration ?? true; // 默认启用分步骤生成

    logger.info('WriteDesign: Starting design generation', {
      useStepwise,
      prdLength: prd.length,
    });

    try {
      // 如果启用分步骤生成，使用分步骤生成
      if (useStepwise) {
        return await this.generateStepwise(prd, options);
      }

      // 否则使用传统的一次性生成
      const prompt = buildDesignPrompt(prd);
      
      // Load system prompt from database or use default
      const userId = this.context?.get('userId');
      const systemPrompt = await loadPrompt(userId, 'design', 'system_prompt', DESIGN_SYSTEM_PROMPT);
      
      // Call LLM with system message and prompt
      const designContent = await this.aask(prompt, [systemPrompt]);
      
      // 保存到workspace
      const workspaceOptions: WorkspaceOptions = {
        ...options,
        documentType: 'DESIGN',
      };
      await this.saveToWorkspace('DESIGN.md', designContent, workspaceOptions);
      
      logger.info('WriteDesign: Design generation completed', {
        contentLength: designContent.length,
        workspaceDir: this.getWorkspaceDir(workspaceOptions),
      });
      
      return {
        content: designContent,
        data: {
          type: 'design',
          filename: 'DESIGN.md',
          timestamp: new Date().toISOString(),
          workspaceDir: this.getWorkspaceDir(workspaceOptions),
        },
      };
    } catch (error: any) {
      logger.error('WriteDesign: Failed to generate design', error);
      throw error;
    }
  }

  /**
   * 分步骤生成设计文档
   * 使用通用的 StepwiseDocumentGenerator
   */
  private async generateStepwise(input: string, options?: WriteDesignOptions): Promise<IActionOutput> {
    // 确保使用DESIGN目录
    const workspaceDir = this.getWorkspaceDir({ ...options, documentType: 'DESIGN' });
    const reviewAction = new DesignReview();
    const improveAction = new ImproveDocument();

    // Load system prompt from database or use default
    const userId = this.context?.get('userId');
    const systemPrompt = await loadPrompt(userId, 'design', 'system_prompt', DESIGN_SYSTEM_PROMPT);

    const generator = new StepwiseDocumentGenerator(this as unknown as BaseAction, {
      buildOutlinePrompt: buildDesignOutlinePrompt,
      buildSectionPrompt: buildDesignSectionPrompt,
      systemPrompt: systemPrompt,
      reviewAction: reviewAction,
      reviewTitle: '系统设计文档审查报告',
      improveAction: improveAction,
      autoImprove: true, // 自动在审查后改进文档
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
      applicationId: options?.applicationId,
      version: options?.version,
    });

    return await generator.generate(input);
  }
}

export default WriteDesign;

