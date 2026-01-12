/**
 * PRDReview Action
 * Reviews PRD document for completeness and quality
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import {
  PRD_REVIEW_SYSTEM_PROMPT,
  PRD_TEMPLATE,
  buildPRDReviewPrompt,
} from '../prompts/prd';
import { logger, loadPrompt, WorkspaceOptions } from '../utils';

export interface PRDReviewOptions extends WorkspaceOptions {
  outline?: string;
}

export class PRDReview extends BaseAction {
  constructor() {
    super('PRDReview', 'Review PRD document for completeness and quality');
  }

  async run(prdContent: string, options?: PRDReviewOptions): Promise<IActionOutput> {
    // 尝试从 options 或 context 中获取 workspace 参数
    const applicationId = options?.applicationId || (this.context?.get('applicationId') as string | undefined);
    const projectId = options?.projectId || (this.context?.get('projectId') as string | undefined);
    const version = options?.version || (this.context?.get('version') as number | undefined) || 1;

    // 如果输入内容为空或很短，尝试从 workspace 读取 PRD.md
    let actualPRDContent = prdContent;
    if ((!prdContent || prdContent.trim().length < 100) && applicationId && projectId) {
      try {
        const prdFromWorkspace = await this.readWorkspaceFile('PRD.md', {
          applicationId,
          projectId,
          version,
          documentType: 'PRD',
          workspacePath: options?.workspacePath,
        });

        if (prdFromWorkspace) {
          actualPRDContent = prdFromWorkspace;
          logger.info('PRDReview: Loaded PRD content from workspace', {
            applicationId,
            projectId,
            version,
            contentLength: actualPRDContent.length,
          });
        }
      } catch (error: any) {
        logger.warn('PRDReview: Failed to read PRD.md from workspace, using provided content', {
          error: error.message,
          contentLength: prdContent.length,
        });
      }
    }

    if (!actualPRDContent || actualPRDContent.trim().length === 0) {
      throw new Error('Cannot find PRD content for review. Please generate PRD first or provide PRD content.');
    }

    logger.info('PRDReview: Starting PRD review', {
      contentLength: actualPRDContent.length,
      hasOutline: !!options?.outline,
      applicationId,
      projectId,
      version,
    });

    try {
      const outline = options?.outline?.trim()
        ? options.outline
        : this.buildExpectedOutline();
      const prompt = buildPRDReviewPrompt(actualPRDContent, outline);

      // Load system prompt from database or use default
      const userId = this.context?.get('userId');
      const systemPrompt = await loadPrompt(userId, 'prd', 'review_system_prompt', PRD_REVIEW_SYSTEM_PROMPT);

      // Call LLM with system message and prompt
      const reviewResult = await this.aask(prompt, [systemPrompt]);

      logger.info('PRDReview: Review completed', {
        reviewLength: reviewResult.length,
      });

      // Save review report to workspace if workspace options are provided
      if (applicationId && projectId) {
        const workspaceOptions: WorkspaceOptions = {
          applicationId,
          projectId,
          version,
          documentType: 'PRD',
          workspacePath: options?.workspacePath,
        };

        await this.saveToWorkspace('PRD_REVIEW.md', reviewResult, workspaceOptions);
        logger.info('PRDReview: Saved review report to workspace', {
          filename: 'PRD_REVIEW.md',
          workspaceDir: this.getWorkspaceDir(workspaceOptions),
        });
      }

      return {
        content: reviewResult,
        data: {
          type: 'prd_review',
          filename: 'PRD_REVIEW.md',
          timestamp: new Date().toISOString(),
          workspaceDir: applicationId && projectId ? this.getWorkspaceDir({
            applicationId,
            projectId,
            version,
            documentType: 'PRD',
            workspacePath: options?.workspacePath,
          }) : undefined,
        },
      };
    } catch (error: any) {
      logger.error('PRDReview: Failed to review PRD', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Build expected outline from PRD template
   */
  private buildExpectedOutline(): string {
    return this.extractOutline(PRD_TEMPLATE);
  }

  /**
   * Extract outline from PRD content
   */
  private extractOutline(prdContent: string): string {
    const lines = prdContent.split('\n');
    const outline: string[] = [];
    
    for (const line of lines) {
      // Match ## X. Title format
      const match = line.match(/^##\s+(\d+)\.\s+(.+)$/);
      if (match) {
        outline.push(line);
      }
    }

    return outline.join('\n') || '## 0. 基本信息\n## 1. 背景与目标\n## 2. 范围\n## 3. 用户与场景\n## 4. 核心流程\n## 5. 功能与交互\n## 6. 业务规则与数据口径\n## 7. 权限与安全\n## 8. 异常与边界\n## 9. 埋点与观测\n## 10. 验收标准\n## 11. 角色关注块（按需展开）';
  }
}

export default PRDReview;
