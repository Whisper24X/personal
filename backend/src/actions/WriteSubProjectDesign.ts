/**
 * WriteSubProjectDesign Action
 * Generates sub-project design documents based on task breakdown
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import {
  SUB_PROJECT_DESIGN_SYSTEM_PROMPT,
  buildSubProjectDesignPrompt,
} from '../prompts/task';
import { logger, WorkspaceOptions, loadPrompt } from '../utils';
// Review和ImproveDocument已移除，由角色通过消息机制管理

export interface WriteSubProjectDesignOptions extends WorkspaceOptions {
  // 继承WorkspaceOptions的所有选项
  autoReview?: boolean; // 是否自动审查，默认为 true
  autoImprove?: boolean; // 是否自动改进，默认为 true
}

export class WriteSubProjectDesign extends BaseAction {
  constructor() {
    super('WriteSubProjectDesign', 'Generate sub-project design documents');
  }

  async run(
    taskBreakdown: string,
    design: string,
    options?: WriteSubProjectDesignOptions
  ): Promise<IActionOutput> {
    const autoReview = options?.autoReview !== false; // 默认启用审查
    const autoImprove = options?.autoImprove !== false; // 默认启用改进

    logger.info('WriteSubProjectDesign: Starting sub-project design generation', {
      autoReview,
      autoImprove,
      taskBreakdownLength: taskBreakdown.length,
      designLength: design.length,
    });
    
    try {
      // Build the prompt
      const prompt = buildSubProjectDesignPrompt(taskBreakdown, design);
      
      // Load system prompt from database or use default
      const userId = this.context?.get('userId');
      const systemPrompt = await loadPrompt(userId, 'design', 'system_prompt', SUB_PROJECT_DESIGN_SYSTEM_PROMPT);
      
      // Call LLM with system message and prompt
      let subProjectDesignContent = await this.aask(prompt, [systemPrompt]);
      
      // 保存到workspace
      const workspaceOptions: WorkspaceOptions = {
        ...options,
        documentType: 'DESIGN',
      };
      await this.saveToWorkspace('SUB_PROJECT_DESIGN.md', subProjectDesignContent, workspaceOptions);
      
      logger.info('WriteSubProjectDesign: Sub-project design generated', {
        contentLength: subProjectDesignContent.length,
        workspaceDir: this.getWorkspaceDir(workspaceOptions),
      });

      // Step 2: 审查（已移除直接调用，改为通过角色管理）
      // 审查由角色通过消息机制管理，不再在这里直接调用
      let reviewReport: string | undefined;
      if (autoReview) {
        logger.info('WriteSubProjectDesign: Review skipped (managed by role)', {
          note: 'Review will be handled by role through message mechanism',
        });
      }

      // Step 3: 改进（已移除直接调用，改为通过角色管理）
      // 改进由角色通过消息机制管理，不再在这里直接调用
      if (autoImprove && reviewReport) {
        logger.info('WriteSubProjectDesign: Improvement skipped (managed by role)', {
          note: 'Improvement will be handled by role through message mechanism',
        });
      }
      
      logger.info('WriteSubProjectDesign: Sub-project design generation completed', {
        contentLength: subProjectDesignContent.length,
        workspaceDir: this.getWorkspaceDir(workspaceOptions),
        reviewIncluded: false, // Review由角色管理
        improvementIncluded: false, // Improvement由角色管理
      });
      
      return {
        content: subProjectDesignContent,
        data: {
          type: 'sub_project_design',
          filename: 'SUB_PROJECT_DESIGN.md',
          timestamp: new Date().toISOString(),
          workspaceDir: this.getWorkspaceDir(workspaceOptions),
          reviewIncluded: false, // Review由角色管理
          improvementIncluded: false, // Improvement由角色管理
        },
      };
    } catch (error: any) {
      logger.error('WriteSubProjectDesign: Failed to generate sub-project design', error);
      throw error;
    }
  }
}

export default WriteSubProjectDesign;

