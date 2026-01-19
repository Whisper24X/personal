/**
 * ImprovePRD Action
 * Improves Product Requirements Document (PRD) based on review reports
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import {
  PRD_IMPROVE_SYSTEM_PROMPT,
  buildPRDImprovePrompt,
  buildPRDSectionImprovePrompt,
} from '../prompts/prd';
import { logger, loadPrompt, WorkspaceOptions } from '../utils';
import { parseSectionsFromContent, Section } from '../utils/sectionParser';

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
    if (!projectId) {
      throw new Error('projectId is required for ImprovePRD action. Please provide it in options or context.');
    }

    const workspaceOptions: WorkspaceOptions = {
      applicationId,
      projectId,
      version,
      documentType: 'PRD',
      workspacePath: options?.workspacePath,
    };

    logger.info('ImprovePRD: Starting PRD improvement', {
      applicationId,
      projectId,
      version,
      hasReviewReport: !!options?.reviewReport,
      inputLength: input.length,
    });

    try {
      const inputIsReviewReport = this.looksLikeReviewReport(input);

      // Step 1: 读取当前PRD文档（优先workspace，缺失时可回退到输入）
      let currentPRD = await this.readWorkspaceFile('PRD.md', workspaceOptions);
      if (!currentPRD && !inputIsReviewReport && input.trim().length > 0) {
        currentPRD = input;
        logger.info('ImprovePRD: Using input as PRD content', {
          inputLength: input.length,
        });
      }

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
        if (inputIsReviewReport) {
          reviewReport = input;
          logger.info('ImprovePRD: Using input as review report', {
            inputLength: input.length,
          });
        } else {
          // 从workspace读取审查报告
          reviewReport = await this.readReviewReport(workspaceOptions, currentPRD);
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
      await this.saveToWorkspace('PRD.md', improvedPRD, workspaceOptions);

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
    options: WorkspaceOptions,
    currentPRD?: string
  ): Promise<string | null> {
    // 尝试读取审查报告文件
    let reviewReport = await this.readWorkspaceFile('PRD_REVIEW.md', options);
    if (!reviewReport) {
      reviewReport = await this.readWorkspaceFile('PRD-review.md', options);
    }
    
    // 如果找不到审查报告文件，尝试从主文档末尾提取（有些审查报告会附加在文档末尾）
    if (!reviewReport) {
      const mainDocument = currentPRD || await this.readWorkspaceFile('PRD.md', options);
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
   * 检查输入是否更像审查报告
   */
  private looksLikeReviewReport(input: string): boolean {
    if (!input) return false;
    return input.includes('审查报告') || input.includes('改进建议');
  }

  /**
   * 改进PRD文档 - 采用分章节改进方式避免 LLM 输出被截断
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

    // 解析 PRD 中的各个章节
    const sections = parseSectionsFromContent(currentPRD);
    
    if (sections.length === 0) {
      // 如果无法解析章节，回退到整体改进（但可能会被截断）
      logger.warn('ImprovePRD: Cannot parse sections, falling back to full document improvement');
      const prompt = buildPRDImprovePrompt(currentPRD, reviewReport);
      return await this.aask(prompt, [systemPrompt]);
    }

    logger.info('ImprovePRD: Starting section-by-section improvement', {
      sectionCount: sections.length,
      sections: sections.map(s => `${s.number}. ${s.title}`),
    });

    // 提取文档标题（# 开头的行）
    const titleMatch = currentPRD.match(/^#\s+.+$/m);
    const documentTitle = titleMatch ? titleMatch[0] : '# 产品需求文档（PRD）';

    // 分章节改进
    const improvedSections: string[] = [];
    
    for (const section of sections) {
      const sectionContent = this.extractFullSectionContent(currentPRD, section);
      const sectionReview = this.extractSectionReview(reviewReport, section.number);
      
      if (!sectionReview || sectionReview.trim().length < 10) {
        // 如果没有该章节的审查建议，保持原内容不变
        logger.info(`ImprovePRD: No review found for section ${section.number}, keeping original`, {
          sectionNumber: section.number,
          sectionTitle: section.title,
        });
        improvedSections.push(sectionContent);
        continue;
      }

      logger.info(`ImprovePRD: Improving section ${section.number}`, {
        sectionNumber: section.number,
        sectionTitle: section.title,
        contentLength: sectionContent.length,
        reviewLength: sectionReview.length,
      });

      try {
        // 为每个章节单独调用 LLM 改进
        const prompt = buildPRDSectionImprovePrompt(
          sectionContent,
          section.number,
          section.title,
          sectionReview
        );
        
        const improvedSection = await this.aask(prompt, [systemPrompt]);
        
        // 清理可能的代码块标记
        const cleanedSection = this.cleanCodeBlockMarkers(improvedSection);
        improvedSections.push(cleanedSection);

        logger.info(`ImprovePRD: Section ${section.number} improved`, {
          sectionNumber: section.number,
          originalLength: sectionContent.length,
          improvedLength: cleanedSection.length,
        });
      } catch (error: any) {
        logger.error(`ImprovePRD: Failed to improve section ${section.number}`, {
          sectionNumber: section.number,
          error: error.message,
        });
        // 如果改进失败，保持原内容
        improvedSections.push(sectionContent);
      }
    }

    // 合并所有改进后的章节
    const improvedPRD = [documentTitle, '', ...improvedSections].join('\n\n');

    logger.info('ImprovePRD: PRD improved by LLM (section-by-section)', {
      originalLength: currentPRD.length,
      improvedLength: improvedPRD.length,
      sectionCount: sections.length,
    });

    return improvedPRD;
  }

  /**
   * 从完整 PRD 中提取章节的完整内容（包括标题）
   */
  private extractFullSectionContent(prd: string, section: Section): string {
    const lines = prd.split('\n');
    if (section.startLine === undefined) {
      return `## ${section.number}. ${section.title}\n\n${section.content || ''}`;
    }
    
    const endLine = section.endLine ?? lines.length - 1;
    return lines.slice(section.startLine, endLine + 1).join('\n');
  }

  /**
   * 从审查报告中提取特定章节的审查建议
   */
  private extractSectionReview(reviewReport: string, sectionNumber: number): string {
    // 匹配审查报告中对应章节的内容
    // 格式可能是：## 章节 N 或 ### N. 标题 审查结果 或 **章节 N**
    const patterns = [
      new RegExp(`##\\s*章节\\s*${sectionNumber}[.\\s].*?(?=##\\s*章节|$)`, 's'),
      new RegExp(`###\\s*${sectionNumber}\\..*?审查.*?(?=###|$)`, 's'),
      new RegExp(`\\*\\*章节\\s*${sectionNumber}[.:].*?\\*\\*.*?(?=\\*\\*章节|$)`, 's'),
      new RegExp(`${sectionNumber}\\.\\s+\\S+.*?(?=\\d+\\.\\s+\\S|$)`, 's'),
    ];

    for (const pattern of patterns) {
      const match = reviewReport.match(pattern);
      if (match) {
        return match[0].trim();
      }
    }

    // 如果找不到特定章节的审查，返回空
    return '';
  }

  /**
   * 清理代码块标记
   */
  private cleanCodeBlockMarkers(content: string): string {
    let cleaned = content.trim();
    
    // 移除开头的代码块标记
    const startPattern = /^```(?:markdown|md|text)?\s*\n?/i;
    if (startPattern.test(cleaned)) {
      cleaned = cleaned.replace(startPattern, '');
    }
    
    // 移除结尾的代码块标记
    const endPattern = /\n?```\s*$/;
    if (endPattern.test(cleaned)) {
      cleaned = cleaned.replace(endPattern, '');
    }
    
    return cleaned.trim();
  }

  /**
   * 从文档中移除审查报告部分
   * 注意：只移除审查报告标题及其之后的内容，保留文档中其他的 --- 分隔符
   */
  private removeReviewReport(document: string): string {
    // 定义审查报告的标题模式（匹配 # PRD 审查报告 或 # PRD审查报告）
    const reviewTitlePattern = /#\s*PRD\s*审查报告/;
    
    // 查找审查报告标题的位置
    const titleMatchIndex = document.search(reviewTitlePattern);
    
    if (titleMatchIndex === -1) {
      // 如果没有找到审查报告标题，返回原文档
      return document;
    }
    
    // 获取审查报告标题之前的内容
    let beforeTitle = document.substring(0, titleMatchIndex);
    
    // 只移除紧邻审查报告标题之前的 "---" 分隔符（如果存在）
    // 不要移除文档中其他位置的 --- 分隔符，因为它们可能是章节之间的分隔
    // 只检查最后几行是否是 --- 分隔符
    const lines = beforeTitle.split('\n');
    
    // 从后往前检查，只移除紧邻标题的空行和 --- 分隔符
    let trimEnd = lines.length;
    for (let i = lines.length - 1; i >= 0 && i >= lines.length - 5; i--) {
      const line = lines[i].trim();
      if (line === '') {
        // 空行，继续检查
        trimEnd = i;
      } else if (line === '---') {
        // 找到紧邻的分隔符，移除它和之后的空行
        trimEnd = i;
        break;
      } else {
        // 遇到非空、非分隔符的行，停止检查
        break;
      }
    }
    
    // 返回处理后的内容
    const result = lines.slice(0, trimEnd).join('\n').trim();
    
    logger.info('ImprovePRD: Removed review report from document', {
      originalLength: document.length,
      resultLength: result.length,
      removedFromIndex: titleMatchIndex,
    });
    
    return result;
  }
}

export default ImprovePRD;
