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
      let improvedMRD = await this.improveMRD(
        cleanMRD,
        reviewReport
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
   */
  private async improveMRD(
    currentMRD: string,
    reviewReport: string
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
    const prompt = buildMRDImprovePrompt(currentMRD, reviewReport);

    // Call LLM to improve document
    const improvedMRD = await this.aask(prompt, [systemPrompt]);

    logger.info('ImproveMRD: MRD improved by LLM', {
      improvedLength: improvedMRD.length,
    });

    return improvedMRD;
  }

  /**
   * Remove review report section from document
   */
  private removeReviewReport(document: string): string {
    // Define review report title pattern
    const reviewTitlePattern = /#\s*市场研究文档\s*审查报告/;

    // Find the position of review report title
    const titleMatchIndex = document.search(reviewTitlePattern);

    if (titleMatchIndex === -1) {
      // If review report title is not found, return original document
      return document;
    }

    // Get content before review report title
    const beforeTitle = document.substring(0, titleMatchIndex);

    // Find the last "---" separator (review reports are usually separated by "---")
    // Search from back to front, find the last independent "---" line
    const lines = beforeTitle.split('\n');
    let lastSeparatorIndex = -1;

    // Search from back to front for the last "---" separator
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line === '---') {
        lastSeparatorIndex = i;
        break;
      }
    }

    if (lastSeparatorIndex >= 0) {
      // If separator is found, return content before separator (remove separator itself)
      const result = lines.slice(0, lastSeparatorIndex).join('\n').trim();
      return result;
    } else {
      // If separator is not found, return content before review report title
      return beforeTitle.trim();
    }
  }
}

export default ImproveMRD;

