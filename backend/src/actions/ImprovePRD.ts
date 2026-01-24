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
import {
  buildCLISaveInstruction,
  isCLISummaryOutput,
  tryReadActualDocumentFromWorkspace,
} from '../utils/stepwise';

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
          const reportFromWorkspace = await this.readReviewReport(workspaceOptions, currentPRD);
          if (reportFromWorkspace) {
            reviewReport = reportFromWorkspace;
          }
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
      const improvementResult = await this.improvePRD(
        cleanPRD,
        reviewReport,
        workspaceOptions
      );

      // Step 5: 确保改进后的文档不包含审查报告部分（再次移除，以防LLM在改进时添加了审查报告）
      const improvedPRD = this.removeReviewReport(improvementResult.content);

      // Step 6: 保存改进后的文档
      await this.saveToWorkspace('PRD.md', improvedPRD, workspaceOptions);

      // Step 7: 判断改进后是否需要重新审核
      // 基于是否有实际改进行为来判断是否需要重新审核
      const hasImprovement = improvementResult.improvedSectionCount > 0;
      const needsReReview = hasImprovement; // 有改进才需要重新审核

      logger.info('ImprovePRD: PRD improved and saved', {
        improvedLength: improvedPRD.length,
        improvedSectionCount: improvementResult.improvedSectionCount,
        totalSectionCount: improvementResult.totalSectionCount,
        hasImprovement,
        needsReReview,
      });

      return {
        content: improvedPRD,
        data: {
          type: 'prd_improved',
          documentType: 'PRD',
          timestamp: new Date().toISOString(),
          originalLength: currentPRD.length,
          improvedLength: improvedPRD.length,
          improvedSectionCount: improvementResult.improvedSectionCount,
          totalSectionCount: improvementResult.totalSectionCount,
          hasImprovement,
          needsReReview, // 有改进才需要重新审核，由外部（Role 或 Controller）决定是否再次调用审核
          workspaceDir: this.getWorkspaceDir(workspaceOptions),
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
   * 改进PRD文档
   * - LLM模式：采用分章节改进方式避免 LLM 输出被截断
   * - CLI模式：直接整体改进，不分章节
   * 返回改进后的内容和改进统计信息
   */
  private async improvePRD(
    currentPRD: string,
    reviewReport: string,
    workspaceOptions: WorkspaceOptions
  ): Promise<{ content: string; improvedSectionCount: number; totalSectionCount: number }> {
    // Load system prompt from database or use default
    const userId = this.context?.get('userId');
    const systemPrompt = await loadPrompt(
      userId,
      'prd',
      'improve_system_prompt',
      PRD_IMPROVE_SYSTEM_PROMPT
    );

    // CLI模式下直接整体改进，不分章节
    const isCLIMode = this.isCLIMode();
    
    if (isCLIMode) {
      logger.info('ImprovePRD: CLI mode detected, using full document improvement', {
        prdLength: currentPRD.length,
        reviewLength: reviewReport.length,
      });
      
      let prompt = buildPRDImprovePrompt(currentPRD, reviewReport);
      
      // CLI 模式下，在 prompt 中指定文件保存路径和限制指令
      const savePath = `${this.getWorkspaceDir(workspaceOptions)}/PRD.md`;
      const saveInstruction = buildCLISaveInstruction(savePath, '改进后的文档');
      prompt += saveInstruction;
      
      logger.info('ImprovePRD: Added CLI save path instruction', { savePath });
      
      let cliOutput = await this.aask(prompt, [systemPrompt]);
      
      // 检查CLI输出是否为操作总结（而非实际改进后的文档）
      let content: string;
      if (isCLISummaryOutput(cliOutput)) {
        logger.info('ImprovePRD: CLI output appears to be a summary, reading actual file from workspace', {
          cliOutputLength: cliOutput.length,
          cliOutputPreview: cliOutput.substring(0, 200),
        });
        
        // 尝试从workspace读取CLI实际改进的文件
        const workspaceDir = this.getWorkspaceDir(workspaceOptions);
        const actualContent = await tryReadActualDocumentFromWorkspace(workspaceDir, {
          mainFileName: 'PRD.md',
          filePattern: 'prd',
        });
        
        if (actualContent) {
          content = actualContent;
          logger.info('ImprovePRD: Successfully read actual improved document from workspace', {
            actualContentLength: actualContent.length,
          });
        } else {
          // 如果找不到实际文件，返回原PRD内容
          logger.warn('ImprovePRD: Could not find actual improved document in workspace, keeping original', {
            originalLength: currentPRD.length,
          });
          content = currentPRD;
        }
      } else {
        content = cliOutput;
      }
      
      // 清理可能的代码块标记
      content = this.cleanCodeBlockMarkers(content);
      
      logger.info('ImprovePRD: Full document improvement completed (CLI mode)', {
        originalLength: currentPRD.length,
        improvedLength: content.length,
      });
      
      return {
        content,
        improvedSectionCount: 1, // 整体改进视为改进了一个
        totalSectionCount: 1,
      };
    }

    // LLM模式：解析 PRD 中的各个章节，分章节改进
    const sections = parseSectionsFromContent(currentPRD);
    
    if (sections.length === 0) {
      // 如果无法解析章节，回退到整体改进（但可能会被截断）
      logger.warn('ImprovePRD: Cannot parse sections, falling back to full document improvement');
      const prompt = buildPRDImprovePrompt(currentPRD, reviewReport);
      const content = await this.aask(prompt, [systemPrompt]);
      return {
        content,
        improvedSectionCount: 1, // 整体改进视为改进了一个
        totalSectionCount: 1,
      };
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
    let improvedCount = 0; // 追踪实际改进的章节数量
    
    for (const section of sections) {
      const sectionContent = this.extractFullSectionContent(currentPRD, section);
      
      // 读取分章节 review 文件
      const sectionReviewContent = await this.readSectionReviewFile(section.number, workspaceOptions);
      
      // 如果没有 review 文件，尝试从合并的 reviewReport 中提取
      const sectionReview = sectionReviewContent || this.extractSectionReview(reviewReport, section.number);
      
      if (!sectionReview || sectionReview.trim().length < 10) {
        // 如果没有该章节的审查建议，保持原内容不变
        logger.info(`ImprovePRD: No review found for section ${section.number}, keeping original`, {
          sectionNumber: section.number,
          sectionTitle: section.title,
        });
        improvedSections.push(sectionContent);
        continue;
      }

      // 检查审查结论是否需要改进
      const needsImprovement = this.sectionNeedsImprovement(sectionReview);
      
      if (!needsImprovement) {
        // 审核通过，不需要改进，保持原内容不变，保留 review 文件
        logger.info(`ImprovePRD: Section ${section.number} passed review, no improvement needed`, {
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

        // 将改进后的内容写回对应章节文件，确保后续审查使用最新章节
        const sectionFileName = this.getSectionFileName(section.number);
        await this.saveToWorkspace(sectionFileName, cleanedSection, workspaceOptions);

        // 改进成功，增加计数
        improvedCount++;

        logger.info(`ImprovePRD: Section ${section.number} improved`, {
          sectionNumber: section.number,
          originalLength: sectionContent.length,
          improvedLength: cleanedSection.length,
        });

        // 改进成功后，删除该章节的 review 文件，等待下一次 review
        await this.deleteSectionReviewFile(section.number, workspaceOptions);
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
      improvedSectionCount: improvedCount,
    });

    return {
      content: improvedPRD,
      improvedSectionCount: improvedCount,
      totalSectionCount: sections.length,
    };
  }

  /**
   * 读取指定章节的 review 文件
   * 文件命名格式：XX-section-X-review.md（例如 00-section-0-review.md）
   */
  private async readSectionReviewFile(
    sectionNumber: number,
    workspaceOptions: WorkspaceOptions
  ): Promise<string | null> {
    // 构建 review 文件名，格式：XX-section-X-review.md
    const paddedNumber = sectionNumber.toString().padStart(2, '0');
    const reviewFileName = `${paddedNumber}-section-${sectionNumber}-review.md`;

    const content = await this.readWorkspaceFile(reviewFileName, workspaceOptions);
    
    if (content) {
      logger.info(`ImprovePRD: Read section review file`, {
        sectionNumber,
        reviewFileName,
        contentLength: content.length,
      });
    }
    
    return content;
  }

  /**
   * 判断章节审查是否需要改进
   * 通过解析审查结论来判断
   */
  private sectionNeedsImprovement(reviewContent: string): boolean {
    if (!reviewContent) return false;

    // 查找审查结论部分
    // 格式：### 4. 审查结论\n- 通过 / 需要改进
    const conclusionMatch = reviewContent.match(/###\s*\d*\.?\s*审查结论[\s\S]*?(?=###|$)/i);
    
    if (!conclusionMatch) {
      // 如果找不到审查结论，检查是否有"需要改进"关键字
      return reviewContent.includes('需要改进') || 
             reviewContent.includes('❌') ||
             reviewContent.includes('不通过');
    }

    const conclusion = conclusionMatch[0];
    
    // 如果结论中包含"需要改进"或"不通过"，则需要改进
    if (conclusion.includes('需要改进') || 
        conclusion.includes('不通过') ||
        conclusion.includes('❌')) {
      return true;
    }
    
    // 如果结论明确标注"通过"且不包含"需要改进"，则不需要改进
    if (conclusion.includes('通过') && !conclusion.includes('需要改进')) {
      return false;
    }

    // 默认情况下，如果有发现问题或改进建议，也认为需要改进
    if (reviewContent.includes('发现的问题') || reviewContent.includes('改进建议')) {
      // 检查是否有实际的问题内容
      const hasActualProblems = reviewContent.match(/问题描述[：:]\s*\S/);
      const hasActualSuggestions = reviewContent.match(/建议\s*\d+[：:]\s*\S/);
      return !!(hasActualProblems || hasActualSuggestions);
    }

    return false;
  }

  /**
   * 删除指定章节的 review 文件
   * 文件命名格式：XX-section-X-review.md（例如 00-section-0-review.md）
   */
  private async deleteSectionReviewFile(
    sectionNumber: number,
    workspaceOptions: WorkspaceOptions
  ): Promise<void> {
    // 构建 review 文件名，格式：XX-section-X-review.md
    const paddedNumber = sectionNumber.toString().padStart(2, '0');
    const reviewFileName = `${paddedNumber}-section-${sectionNumber}-review.md`;

    const deleted = await this.deleteWorkspaceFile(reviewFileName, workspaceOptions);
    
    if (deleted) {
      logger.info(`ImprovePRD: Deleted section review file`, {
        sectionNumber,
        reviewFileName,
      });
    }
  }

  /**
   * 构建章节文件名
   * 文件命名格式：XX-section-X.md（例如 00-section-0.md）
   */
  private getSectionFileName(sectionNumber: number): string {
    const paddedNumber = sectionNumber.toString().padStart(2, '0');
    return `${paddedNumber}-section-${sectionNumber}.md`;
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
