/**
 * MRDReview Action
 * Reviews Market Research Document (MRD) for completeness and quality
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import {
  MRD_REVIEW_SYSTEM_PROMPT,
  buildMRDReviewPrompt,
} from '../prompts/mrd';
import { logger, loadPrompt, WorkspaceOptions } from '../utils';
import {
  buildCLISaveInstruction,
  isCLISummaryOutput,
  tryReadActualReviewFromWorkspace,
} from '../utils/stepwise';

export interface MRDReviewOptions extends WorkspaceOptions {
  outline?: string;
}

export class MRDReview extends BaseAction {
  constructor() {
    super('MRDReview', 'Review Market Research Document (MRD) for completeness and quality');
  }

  async run(mrdContent: string, options?: MRDReviewOptions): Promise<IActionOutput> {
    // 如果输入内容为空或很短，尝试从 workspace 读取 MRD.md
    let actualMRDContent = mrdContent;
    if ((!mrdContent || mrdContent.trim().length < 100) && options?.applicationId) {
      try {
        const mrdFromWorkspace = await this.readWorkspaceFile('MRD.md', {
          applicationId: options.applicationId,
          projectId: options.projectId,
          version: options.version || 1,
          documentType: 'MRD',
          workspacePath: options.workspacePath,
        });

        if (mrdFromWorkspace) {
          actualMRDContent = mrdFromWorkspace;
          logger.info('MRDReview: Loaded MRD content from workspace', {
            applicationId: options.applicationId,
            version: options.version || 1,
            contentLength: actualMRDContent.length,
          });
        }
      } catch (error: any) {
        logger.warn('MRDReview: Failed to read MRD.md from workspace, using provided content', {
          error: error.message,
          contentLength: mrdContent.length,
        });
      }
    }

    logger.info('MRDReview: Starting MRD review', {
      contentLength: actualMRDContent.length,
      hasOutline: !!options?.outline,
      applicationId: options?.applicationId,
      version: options?.version,
    });

    try {
      const outline = options?.outline || this.extractOutline(actualMRDContent);
      let prompt = buildMRDReviewPrompt(actualMRDContent, outline);

      // Load system prompt from database or use default
      const userId = this.context?.get('userId');
      const systemPrompt = await loadPrompt(userId, 'mrd', 'review_system_prompt', MRD_REVIEW_SYSTEM_PROMPT);

      // CLI模式下检查输出是否为操作总结
      const isCLIMode = this.isCLIMode();
      
      const workspaceOptions: WorkspaceOptions = {
        applicationId: options?.applicationId || '',
        projectId: options?.projectId,
        version: options?.version || 1,
        documentType: 'MRD',
        workspacePath: options?.workspacePath,
      };
      
      // CLI 模式下，在 prompt 中指定文件保存路径和限制指令
      if (isCLIMode && options?.applicationId) {
        const savePath = `${this.getWorkspaceDir(workspaceOptions)}/MRD_REVIEW.md`;
        const saveInstruction = buildCLISaveInstruction(savePath, '审核报告');
        prompt += saveInstruction;
        
        logger.info('MRDReview: Added CLI save path instruction', { savePath });
      }

      // Call LLM/CLI with system message and prompt
      const cliOutput = await this.aask(prompt, [systemPrompt]);
      
      let reviewResult: string;
      
      if (isCLIMode && isCLISummaryOutput(cliOutput)) {
        logger.info('MRDReview: CLI output appears to be a summary, reading actual review from workspace', {
          cliOutputLength: cliOutput.length,
          cliOutputPreview: cliOutput.substring(0, 200),
        });
        
        // 尝试从workspace读取CLI实际生成的审核报告
        const workspaceDir = this.getWorkspaceDir(workspaceOptions);
        const actualReview = await tryReadActualReviewFromWorkspace(workspaceDir, {
          reviewFileName: 'MRD_REVIEW.md',
          filePattern: 'mrd_review',
        });
        
        if (actualReview) {
          reviewResult = actualReview;
          logger.info('MRDReview: Successfully read actual review report from workspace', {
            actualReviewLength: actualReview.length,
          });
        } else {
          // 如果找不到实际审核报告，使用CLI输出
          logger.warn('MRDReview: Could not find actual review in workspace, using CLI output', {
            cliOutputLength: cliOutput.length,
          });
          reviewResult = cliOutput;
        }
      } else {
        reviewResult = cliOutput;
      }

      logger.info('MRDReview: Review completed', {
        reviewLength: reviewResult.length,
      });

      // Save review report to workspace if workspace options are provided
      // 只有当内容不是CLI总结时才保存
      if (options?.applicationId && !isCLISummaryOutput(reviewResult)) {
        await this.saveToWorkspace('MRD_REVIEW.md', reviewResult, workspaceOptions);
        logger.info('MRDReview: Saved review report to workspace', {
          filename: 'MRD_REVIEW.md',
          workspaceDir: this.getWorkspaceDir(workspaceOptions),
        });
      }

      return {
        content: reviewResult,
        data: {
          type: 'mrd_review',
          filename: 'MRD_REVIEW.md',
          timestamp: new Date().toISOString(),
          workspaceDir: options?.applicationId ? this.getWorkspaceDir({
            applicationId: options.applicationId,
            projectId: options.projectId,
            version: options.version || 1,
            documentType: 'MRD',
            workspacePath: options.workspacePath,
          }) : undefined,
        },
      };
    } catch (error: any) {
      logger.error('MRDReview: Failed to review MRD', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Extract outline from MRD content
   */
  private extractOutline(content: string): string {
    const lines = content.split('\n');
    const outline: string[] = [];

    for (const line of lines) {
      // Match ## X. Title format
      const match = line.match(/^##\s+(\d+)\.\s+(.+)$/);
      if (match) {
        outline.push(line);
      }
    }

    return outline.join('\n') || '## 1. Requirement Background and Target Value Analysis\n## 2. Requirement Value Analysis\n## 3. User Analysis\n## 4. Business Process Analysis\n## 5. Market Analysis\n## 6. Feasibility Analysis\n## 7. Project Scope';
  }

}

export default MRDReview;

