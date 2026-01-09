/**
 * ImprovePRD Action
 * Improves Product Requirements Document (PRD) based on review reports
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import {
  PRD_IMPROVE_SYSTEM_PROMPT,
  buildPRDImprovePrompt,
} from '../prompts/prd';
import { logger, loadPrompt, WorkspaceOptions } from '../utils';

export interface ImprovePRDOptions extends WorkspaceOptions {
  reviewReport?: string; // 审查报告内容，如果不提供则从workspace读取
}

export class ImprovePRD extends BaseAction {
  constructor() {
    super('ImprovePRD', 'Improve Product Requirements Document (PRD) based on review reports');
  }

  async run(
    input: string, // 审查报告内容或PRD内容
    options?: ImprovePRDOptions
  ): Promise<IActionOutput> {
    // 尝试从 options 或 context 中获取 applicationId
    let applicationId = options?.applicationId;
    if (!applicationId) {
      // 尝试从 context 中获取
      applicationId = this.context?.get('applicationId') as string | undefined;
    }
    
    if (!applicationId) {
      throw new Error('applicationId is required for ImprovePRD action. Please provide it in options or context.');
    }
    
    // 尝试从 options 或 context 中获取 projectId
    const projectId = options?.projectId || (this.context?.get('projectId') as string | undefined);
    const version = options?.version || (this.context?.get('version') as number | undefined) || 1;

    logger.info('ImprovePRD: Starting PRD improvement', {
      applicationId,
      projectId,
      version,
      hasReviewReport: !!options?.reviewReport,
      inputLength: input.length,
    });

    try {
      // Step 1: 读取当前PRD文档
      const currentPRD = await this.readWorkspaceFile('PRD.md', {
        applicationId,
        projectId,
        version,
        documentType: 'PRD',
        workspacePath: options?.workspacePath,
      });

      if (!currentPRD) {
        throw new Error(
          'Cannot find PRD document in workspace. Please generate it first.'
        );
      }

      // Step 2: 读取审查报告
      // 如果输入本身就是审查报告内容，优先使用输入
      let reviewReport = options?.reviewReport;
      
      // 如果没有提供审查报告，尝试从workspace读取
      if (!reviewReport) {
        // 检查输入是否看起来像审查报告（包含"审查报告"关键字）
        if (input && (input.includes('审查报告') || input.includes('改进建议'))) {
          reviewReport = input;
          logger.info('ImprovePRD: Using input as review report', {
            inputLength: input.length,
          });
        } else {
          // 从workspace读取审查报告
          reviewReport = await this.readReviewReport({
            applicationId,
            projectId,
            version,
            documentType: 'PRD',
            workspacePath: options?.workspacePath,
          });
        }
      }

      if (!reviewReport) {
        throw new Error(
          'Cannot find review report for PRD. Please provide review report as input or run PRDReview first.'
        );
      }

      logger.info('ImprovePRD: Loaded documents', {
        prdLength: currentPRD.length,
        reviewReportLength: reviewReport.length,
      });

      // Step 3: 从当前文档中移除审查报告部分（如果存在），只保留原始文档内容
      const cleanPRD = this.removeReviewReport(currentPRD);
      
      // Step 4: 根据审查报告改进文档
      let improvedPRD = await this.improvePRD(
        cleanPRD,
        reviewReport
      );

      // Step 5: 确保改进后的文档不包含审查报告部分（再次移除，以防LLM在改进时添加了审查报告）
      improvedPRD = this.removeReviewReport(improvedPRD);

      // Step 6: 保存改进后的文档
      await this.saveToWorkspace('PRD.md', improvedPRD, {
        applicationId,
        projectId,
        version,
        documentType: 'PRD',
        workspacePath: options?.workspacePath,
      });

      logger.info('ImprovePRD: PRD improved and saved', {
        improvedLength: improvedPRD.length,
      });

      return {
        content: improvedPRD,
        data: {
          type: 'prd_improved',
          documentType: 'PRD',
          timestamp: new Date().toISOString(),
          originalLength: currentPRD.length,
          improvedLength: improvedPRD.length,
        },
      };
    } catch (error: any) {
      logger.error('ImprovePRD: Failed to improve PRD', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * 读取审查报告
   */
  private async readReviewReport(
    options: any
  ): Promise<string | null> {
    // 尝试读取审查报告文件
    let reviewReport = await this.readWorkspaceFile('PRD_REVIEW.md', options);
    
    // 如果找不到审查报告文件，尝试从主文档末尾提取（有些审查报告会附加在文档末尾）
    if (!reviewReport) {
      const mainDocument = await this.readWorkspaceFile('PRD.md', options);
      if (mainDocument) {
        // 尝试提取审查报告部分（通常在文档末尾，以"---"分隔，然后以审查报告标题开头）
        const reviewPattern = /---\s*\n\s*#\s*PRD\s*审查报告[\s\S]*$/;
        const simplePattern = /#\s*PRD\s*审查报告[\s\S]*$/;
        
        const reviewMatch = mainDocument.match(reviewPattern);
        if (reviewMatch) {
          // 移除开头的 "---" 分隔符
          reviewReport = reviewMatch[0].replace(/^---\s*\n\s*/, '');
        } else {
          // 如果没有找到分隔符，尝试直接匹配审查报告标题
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
   * 改进PRD文档
   */
  private async improvePRD(
    currentPRD: string,
    reviewReport: string
  ): Promise<string> {
    // Load system prompt from database or use default
    const userId = this.context?.get('userId');
    const systemPrompt = await loadPrompt(
      userId,
      'prd',
      'improve_system_prompt',
      PRD_IMPROVE_SYSTEM_PROMPT
    );

    // 构建改进提示词
    const prompt = buildPRDImprovePrompt(currentPRD, reviewReport);

    // 调用LLM改进文档
    const improvedPRD = await this.aask(prompt, [systemPrompt]);

    logger.info('ImprovePRD: PRD improved by LLM', {
      improvedLength: improvedPRD.length,
    });

    return improvedPRD;
  }

  /**
   * 从文档中移除审查报告部分
   */
  private removeReviewReport(document: string): string {
    // 定义审查报告的标题模式
    const reviewTitlePattern = /#\s*PRD\s*审查报告/;
    
    // 查找审查报告标题的位置
    const titleMatchIndex = document.search(reviewTitlePattern);
    
    if (titleMatchIndex === -1) {
      // 如果没有找到审查报告标题，返回原文档
      return document;
    }
    
    // 获取审查报告标题之前的内容
    const beforeTitle = document.substring(0, titleMatchIndex);
    
    // 查找最后一个 "---" 分隔符（审查报告通常用 "---" 分隔）
    // 从后往前查找，找到最后一个独立的 "---" 行
    const lines = beforeTitle.split('\n');
    let lastSeparatorIndex = -1;
    
    // 从后往前查找最后一个 "---" 分隔符
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line === '---') {
        lastSeparatorIndex = i;
        break;
      }
    }
    
    if (lastSeparatorIndex >= 0) {
      // 如果找到了分隔符，返回分隔符之前的内容（移除分隔符本身）
      const result = lines.slice(0, lastSeparatorIndex).join('\n').trim();
      return result;
    } else {
      // 如果没有找到分隔符，返回审查报告标题之前的内容
      return beforeTitle.trim();
    }
  }
}

export default ImprovePRD;

