/**
 * ImproveMRD Action
 * Improves Market Research Document (MRD) based on review reports
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import {
  MRD_IMPROVE_SYSTEM_PROMPT,
  buildMRDImprovePrompt,
} from '../prompts/mrd';
import { logger, loadPrompt, WorkspaceOptions } from '../utils';
import {
  buildCLISaveInstruction,
  isCLISummaryOutput,
  tryReadActualDocumentFromWorkspace,
} from '../utils/stepwise';

export interface ImproveMRDOptions extends WorkspaceOptions {
  reviewReport?: string; // Review report content, if not provided, will be read from workspace
}

export class ImproveMRD extends BaseAction {
  constructor() {
    super('ImproveMRD', 'Improve Market Research Document (MRD) based on review reports');
  }

  async run(
    input: string, // Review report content or MRD content
    options?: ImproveMRDOptions
  ): Promise<IActionOutput> {
    // Try to get applicationId from options or context
    let applicationId = options?.applicationId;
    if (!applicationId) {
      // Try to get from context
      applicationId = this.context?.get('applicationId') as string | undefined;
    }

    if (!applicationId) {
      throw new Error('applicationId is required for ImproveMRD action. Please provide it in options or context.');
    }

    const projectId = options?.projectId || (this.context?.get('projectId') as string | undefined);
    const version = options?.version || (this.context?.get('version') as number | undefined) || 1;

    logger.info('ImproveMRD: Starting MRD improvement', {
      applicationId,
      version,
      hasReviewReport: !!options?.reviewReport,
      inputLength: input.length,
    });

    try {
      // Step 1: Read current MRD document
      const currentMRD = await this.readWorkspaceFile('MRD.md', {
        applicationId,
        projectId,
        version,
        documentType: 'MRD',
        workspacePath: options?.workspacePath,
      });

      if (!currentMRD) {
        throw new Error(
          'Cannot find MRD document in workspace. Please generate it first.'
        );
      }

      // Step 2: Read review report
      // If input itself is review report content, use input first
      let reviewReport = options?.reviewReport;

      // If review report is not provided, try to read from workspace
      if (!reviewReport) {
        // Check if input looks like a review report (contains "审查报告" or "改进建议" keywords)
        if (input && (input.includes('审查报告') || input.includes('改进建议'))) {
          reviewReport = input;
          logger.info('ImproveMRD: Using input as review report', {
            inputLength: input.length,
          });
        } else {
          // Read review report from workspace
          const reportFromWorkspace = await this.readReviewReport({
            applicationId,
            projectId,
            version,
            documentType: 'MRD',
            workspacePath: options?.workspacePath,
          });
          reviewReport = reportFromWorkspace || undefined;
        }
      }

      if (!reviewReport) {
        throw new Error(
          'Cannot find review report for MRD. Please provide review report as input or run MRDReview first.'
        );
      }

      logger.info('ImproveMRD: Loaded documents', {
        mrdLength: currentMRD.length,
        reviewReportLength: reviewReport.length,
      });

      // Step 3: Remove review report section from current document (if exists), keep only original document content
      const cleanMRD = this.removeReviewReport(currentMRD);

      // Step 4: Improve document based on review report
      const workspaceOptions: WorkspaceOptions = {
        applicationId,
        projectId,
        version,
        documentType: 'MRD',
        workspacePath: options?.workspacePath,
      };
      let improvedMRD = await this.improveMRD(
        cleanMRD,
        reviewReport,
        workspaceOptions
      );

      // Step 5: Ensure improved document does not contain review report section (remove again, in case LLM added review report during improvement)
      improvedMRD = this.removeReviewReport(improvedMRD);

      // Step 6: Save improved document
      await this.saveToWorkspace('MRD.md', improvedMRD, {
        applicationId,
        projectId,
        version,
        documentType: 'MRD',
        workspacePath: options?.workspacePath,
      });

      logger.info('ImproveMRD: MRD improved and saved', {
        improvedLength: improvedMRD.length,
      });

      return {
        content: improvedMRD,
        data: {
          type: 'mrd_improved',
          documentType: 'MRD',
          timestamp: new Date().toISOString(),
          originalLength: currentMRD.length,
          improvedLength: improvedMRD.length,
        },
      };
    } catch (error: any) {
      logger.error('ImproveMRD: Failed to improve MRD', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Read review report
   */
  private async readReviewReport(
    options: any
  ): Promise<string | null> {
    // Try to read review report file
    let reviewReport = await this.readWorkspaceFile('MRD_REVIEW.md', options);

    // If review report file is not found, try to extract from the end of main document (some review reports are appended at the end of document)
    if (!reviewReport) {
      const mainDocument = await this.readWorkspaceFile('MRD.md', options);
      if (mainDocument) {
        // Try to extract review report section (usually at the end of document, separated by "---", then starts with review report title)
        const reviewPattern = /---\s*\n\s*#\s*市场研究文档\s*审查报告[\s\S]*$/;
        const simplePattern = /#\s*市场研究文档\s*审查报告[\s\S]*$/;

        const reviewMatch = mainDocument.match(reviewPattern);
        if (reviewMatch) {
          // Remove leading "---" separator
          reviewReport = reviewMatch[0].replace(/^---\s*\n\s*/, '');
        } else {
          // If separator is not found, try to match review report title directly
          const simpleMatch = mainDocument.match(simplePattern);
          if (simpleMatch) {
            reviewReport = simpleMatch[0];
          }
        }
      }
    }

    return reviewReport;
  }

  /**
   * Improve MRD document
   * - LLM模式：直接使用LLM输出
   * - CLI模式：检查是否为操作总结，如果是则从workspace读取实际文件
   */
  private async improveMRD(
    currentMRD: string,
    reviewReport: string,
    workspaceOptions?: WorkspaceOptions
  ): Promise<string> {
    // Load system prompt from database or use default
    const userId = this.context?.get('userId');
    const systemPrompt = await loadPrompt(
      userId,
      'mrd',
      'improve_system_prompt',
      MRD_IMPROVE_SYSTEM_PROMPT
    );

    // Build improvement prompt
    let prompt = buildMRDImprovePrompt(currentMRD, reviewReport);

    // CLI模式下检查输出是否为操作总结
    const isCLIMode = this.isCLIMode();
    
    // CLI 模式下，在 prompt 中指定文件保存路径和限制指令
    if (isCLIMode && workspaceOptions) {
      const savePath = `${this.getWorkspaceDir(workspaceOptions)}/MRD.md`;
      const saveInstruction = buildCLISaveInstruction(savePath, '改进后的文档');
      prompt += saveInstruction;
      
      logger.info('ImproveMRD: Added CLI save path instruction', { savePath });
    }

    // Call LLM/CLI to improve document
    const cliOutput = await this.aask(prompt, [systemPrompt]);
    
    if (isCLIMode && isCLISummaryOutput(cliOutput)) {
      logger.info('ImproveMRD: CLI output appears to be a summary, reading actual file from workspace', {
        cliOutputLength: cliOutput.length,
        cliOutputPreview: cliOutput.substring(0, 200),
      });
      
      // 尝试从workspace读取CLI实际改进的文件
      const workspaceDir = this.getWorkspaceDir(workspaceOptions);
      const actualContent = await tryReadActualDocumentFromWorkspace(workspaceDir, {
        mainFileName: 'MRD.md',
        filePattern: 'mrd',
      });
      
      if (actualContent) {
        logger.info('ImproveMRD: Successfully read actual improved document from workspace', {
          actualContentLength: actualContent.length,
        });
        return actualContent;
      } else {
        // 如果找不到实际文件，返回原MRD内容
        logger.warn('ImproveMRD: Could not find actual improved document in workspace, keeping original', {
          originalLength: currentMRD.length,
        });
        return currentMRD;
      }
    }

    logger.info('ImproveMRD: MRD improved by LLM', {
      improvedLength: cliOutput.length,
    });

    return cliOutput;
  }

  /**
   * Remove review report section from document
   * Note: Only remove review report title and content after it, preserve other --- separators in document
   */
  private removeReviewReport(document: string): string {
    // Define review report title pattern (match # 市场研究文档 审查报告 or # 市场研究文档审查报告)
    const reviewTitlePattern = /#\s*市场研究文档\s*审查报告/;

    // Find the position of review report title
    const titleMatchIndex = document.search(reviewTitlePattern);

    if (titleMatchIndex === -1) {
      // If review report title is not found, return original document
      return document;
    }

    // Get content before review report title
    let beforeTitle = document.substring(0, titleMatchIndex);

    // Only remove the "---" separator that is immediately before the review report title (if exists)
    // Do not remove other --- separators in the document, as they may be separators between sections
    // Only check if the last few lines are --- separator
    const lines = beforeTitle.split('\n');

    // Check from back to front, only remove empty lines and --- separator that are immediately before the title
    let trimEnd = lines.length;
    for (let i = lines.length - 1; i >= 0 && i >= lines.length - 5; i--) {
      const line = lines[i].trim();
      if (line === '') {
        // Empty line, continue checking
        trimEnd = i;
      } else if (line === '---') {
        // Found adjacent separator, remove it and subsequent empty lines
        trimEnd = i;
        break;
      } else {
        // Encountered non-empty, non-separator line, stop checking
        break;
      }
    }

    // Return processed content
    const result = lines.slice(0, trimEnd).join('\n').trim();

    logger.info('ImproveMRD: Removed review report from document', {
      originalLength: document.length,
      resultLength: result.length,
      removedFromIndex: titleMatchIndex,
    });

    return result;
  }

}

export default ImproveMRD;

