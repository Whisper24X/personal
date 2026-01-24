/**
 * DesignReview Action
 * Reviews Design Document for completeness and quality
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import {
  DESIGN_REVIEW_SYSTEM_PROMPT,
  buildDesignReviewPrompt,
} from '../prompts/design';
import { logger, loadPrompt, WorkspaceOptions } from '../utils';
import {
  buildCLISaveInstruction,
  isCLISummaryOutput,
  tryReadActualReviewFromWorkspace,
} from '../utils/stepwise';

export interface DesignReviewOptions extends WorkspaceOptions {
  outline?: string;
}

export class DesignReview extends BaseAction {
  constructor() {
    super('DesignReview', 'Review Design Document for completeness and quality');
  }

  async run(designContent: string, options?: DesignReviewOptions): Promise<IActionOutput> {
    // 如果输入内容为空或很短，尝试从 workspace 读取 DESIGN.md
    let actualDesignContent = designContent;
    if ((!designContent || designContent.trim().length < 100) && options?.applicationId) {
      try {
        const designFromWorkspace = await this.readWorkspaceFile('DESIGN.md', {
          applicationId: options.applicationId,
          projectId: options.projectId,
          version: options.version || 1,
          documentType: 'DESIGN',
          workspacePath: options.workspacePath,
        });

        if (designFromWorkspace) {
          actualDesignContent = designFromWorkspace;
          logger.info('DesignReview: Loaded design content from workspace', {
            applicationId: options.applicationId,
            version: options.version || 1,
            contentLength: actualDesignContent.length,
          });
        }
      } catch (error: any) {
        logger.warn('DesignReview: Failed to read DESIGN.md from workspace, using provided content', {
          error: error.message,
          contentLength: designContent.length,
        });
      }
    }

    logger.info('DesignReview: Starting design review', {
      designLength: actualDesignContent.length,
      hasOutline: !!options?.outline,
      applicationId: options?.applicationId,
      version: options?.version,
    });

    try {
      const outline = options?.outline || this.extractOutline(actualDesignContent);
      let prompt = buildDesignReviewPrompt(actualDesignContent, outline);

      // Load system prompt from database or use default
      const userId = this.context?.get('userId');
      const systemPrompt = await loadPrompt(userId, 'design', 'review_system_prompt', DESIGN_REVIEW_SYSTEM_PROMPT);

      // CLI 模式处理
      const isCLIMode = this.isCLIMode();
      const workspaceOptions: WorkspaceOptions = {
        applicationId: options?.applicationId || '',
        projectId: options?.projectId,
        version: options?.version || 1,
        documentType: 'DESIGN',
        workspacePath: options?.workspacePath,
      };

      // CLI 模式下，在 prompt 中指定文件保存路径和限制指令
      if (isCLIMode && options?.applicationId) {
        const savePath = `${this.getWorkspaceDir(workspaceOptions)}/DESIGN_REVIEW.md`;
        const saveInstruction = buildCLISaveInstruction(savePath, '审核报告');
        prompt += saveInstruction;
        
        logger.info('DesignReview: Added CLI save path instruction', { savePath });
      }

      // Call LLM/CLI with system message and prompt
      const cliOutput = await this.aask(prompt, [systemPrompt]);
      
      let reviewResult: string;
      
      if (isCLIMode && isCLISummaryOutput(cliOutput)) {
        logger.info('DesignReview: CLI output appears to be a summary, reading actual review from workspace', {
          cliOutputLength: cliOutput.length,
          cliOutputPreview: cliOutput.substring(0, 200),
        });
        
        // 尝试从workspace读取CLI实际生成的审核报告
        const workspaceDir = this.getWorkspaceDir(workspaceOptions);
        const actualReview = await tryReadActualReviewFromWorkspace(workspaceDir, {
          reviewFileName: 'DESIGN_REVIEW.md',
          filePattern: 'design_review',
        });
        
        if (actualReview) {
          reviewResult = actualReview;
          logger.info('DesignReview: Successfully read actual review report from workspace', {
            actualReviewLength: actualReview.length,
          });
        } else {
          logger.warn('DesignReview: Could not find actual review in workspace, using CLI output', {
            cliOutputLength: cliOutput.length,
          });
          reviewResult = cliOutput;
        }
      } else {
        reviewResult = cliOutput;
      }

      logger.info('DesignReview: Review completed', {
        reviewLength: reviewResult.length,
      });

      // Save review report to workspace if workspace options are provided
      // 只有当内容不是CLI总结时才保存
      if (options?.applicationId && !isCLISummaryOutput(reviewResult)) {
        await this.saveToWorkspace('DESIGN_REVIEW.md', reviewResult, workspaceOptions);
        logger.info('DesignReview: Saved review report to workspace', {
          filename: 'DESIGN_REVIEW.md',
          workspaceDir: this.getWorkspaceDir(workspaceOptions),
        });
      }

      return {
        content: reviewResult,
        data: {
          type: 'design_review',
          filename: 'DESIGN_REVIEW.md',
          timestamp: new Date().toISOString(),
          workspaceDir: options?.applicationId ? this.getWorkspaceDir({
            applicationId: options.applicationId,
            projectId: options.projectId,
            version: options.version || 1,
            documentType: 'DESIGN',
            workspacePath: options.workspacePath,
          }) : undefined,
        },
      };
    } catch (error: any) {
      logger.error('DesignReview: Failed to review design', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Extract outline from Design content
   */
  private extractOutline(designContent: string): string {
    const lines = designContent.split('\n');
    const outline: string[] = [];
    
    for (const line of lines) {
      // Match ## X. Title or ## X Title format
      const match = line.match(/^##\s+(\d+)\.?\s+(.+)$/);
      if (match) {
        outline.push(line);
      }
    }

    return outline.join('\n') || '## 1. 系统概述\n## 2. 系统总体架构设计\n## 3. 技术选型总览\n## 4. 前端技术方案设计\n## 5. 后端技术方案设计\n## 6. 数据模型设计\n## 7. 安全性设计\n## 8. 性能与扩展性\n## 9. 日志、错误与监控\n## 10. 测试策略\n## 11. 部署与 DevOps\n## 12. 未来演进方向';
  }
}

export default DesignReview;

