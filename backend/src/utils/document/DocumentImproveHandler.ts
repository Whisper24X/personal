/**
 * DocumentImproveHandler
 * 文档改进处理器
 * 
 * 提供统一的文档改进执行流程，支持CLI模式和LLM模式：
 * - CLI模式：使用文件路径输入，整体改进，直接返回改进方案
 * - LLM模式：使用文件内容输入，支持分章节改进
 */

import { BaseAction } from '../../core/base/BaseAction';
import { ImproveConfig, ImproveOptions, ImproveResult } from './types';
import { CLIModeHandler } from './CLIModeHandler';
import {
  removeReviewReport,
  looksLikeReviewReport,
  sectionNeedsImprovement,
  cleanCodeBlockMarkers,
} from './DocumentContentUtils';
import { logger } from '../logger';
import { parseSectionsFromContent, Section } from '../sectionParser';

export class DocumentImproveHandler {
  private action: BaseAction;
  private config: ImproveConfig;
  private cliHandler: CLIModeHandler;

  constructor(action: BaseAction, config: ImproveConfig) {
    this.action = action;
    this.config = config;
    this.cliHandler = new CLIModeHandler(action, config);
  }

  /**
   * 执行文档改进
   * 根据模式自动选择使用整体改进或分章节改进
   * 
   * @param input 输入内容（审查报告或文档内容）
   * @param options 改进选项
   * @returns 改进结果
   */
  async execute(input: string, options: ImproveOptions): Promise<ImproveResult> {
    const isCLIMode = this.cliHandler.isCLIMode();
    const workspaceDir = (this.action as any).getWorkspaceDir(options);

    logger.info('DocumentImproveHandler: Starting document improvement', {
      documentType: this.config.documentType,
      isCLIMode,
      inputLength: input.length,
      hasReviewReport: !!options.reviewReport,
      workspaceDir,
    });

    try {
      // 判断输入是否为审查报告
      const inputIsReviewReport = looksLikeReviewReport(input);

      // 读取当前文档
      let currentDocument = await (this.action as any).readWorkspaceFile(
        this.config.mainFileName,
        options
      );

      // 回退1：使用 options 中传递的文档内容（从消息队列获取）
      if (!currentDocument && options.documentContent) {
        currentDocument = options.documentContent;
        logger.info('DocumentImproveHandler: Using document content from options (fallback from messages)', {
          documentType: this.config.documentType,
          contentLength: options.documentContent.length,
        });
      }

      // 回退2：如果输入不是审查报告，使用输入作为文档
      if (!currentDocument && !inputIsReviewReport && input.trim().length > 0) {
        currentDocument = input;
        logger.info('DocumentImproveHandler: Using input as document content', {
          documentType: this.config.documentType,
          inputLength: input.length,
        });
      }

      if (!currentDocument) {
        throw new Error(
          `Cannot find ${this.config.documentType} document in workspace (${workspaceDir}/${this.config.mainFileName}). ` +
          `This usually means the Write action failed to save the document or returned empty content. ` +
          `Please check if CLI properly generated and saved the file, or try regenerating the document.`
        );
      }

      // 获取审查报告
      const reviewReport = await this.getReviewReport(input, inputIsReviewReport, options);

      if (!reviewReport) {
        throw new Error(
          `Cannot find review report for ${this.config.documentType}. Please provide review report as input or run review first.`
        );
      }

      logger.info('DocumentImproveHandler: Loaded documents', {
        documentType: this.config.documentType,
        documentLength: currentDocument.length,
        reviewReportLength: reviewReport.length,
      });

      // 从当前文档中移除审查报告部分
      const cleanDocument = this.removeReviewReport(currentDocument);

      // 执行改进
      let result: ImproveResult;
      if (isCLIMode || options.useFilePath) {
        // CLI模式：整体改进
        result = await this.improveFullDocument(cleanDocument, reviewReport, workspaceDir, options);
      } else {
        // LLM模式：分章节改进
        result = await this.improveBySections(cleanDocument, reviewReport, workspaceDir, options);
      }

      // 确保改进后的文档不包含审查报告部分
      result.content = this.removeReviewReport(result.content);

      // 保存改进后的文档（如果需要）
      // 如果内容是从workspace读取的（isReadFromWorkspace=true），
      // 说明CLI工具已经保存了文件，不需要再次保存
      const isReadFromWorkspace = (result as any)._isReadFromWorkspace ?? false;
      await this.saveDocumentIfNeeded(result.content, options, isReadFromWorkspace);

      logger.info('DocumentImproveHandler: Improvement completed', {
        documentType: this.config.documentType,
        originalLength: currentDocument.length,
        improvedLength: result.content.length,
        improvedSectionCount: result.improvedSectionCount,
        totalSectionCount: result.totalSectionCount,
        needsReReview: result.needsReReview,
      });

      return result;
    } catch (error: any) {
      logger.error('DocumentImproveHandler: Improvement failed', {
        documentType: this.config.documentType,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * CLI模式：整体改进（只传路径，不传内容）
   * 
   * @param document 文档内容（用于LLM模式或回退）
   * @param reviewReport 审查报告（用于LLM模式或回退）
   * @param workspaceDir workspace目录
   * @param _options 选项
   * @returns 改进结果
   */
  private async improveFullDocument(
    document: string,
    reviewReport: string,
    workspaceDir: string,
    _options: ImproveOptions
  ): Promise<ImproveResult> {
    const isCLIMode = this.cliHandler.isCLIMode();
    
    logger.info('DocumentImproveHandler: Using full document improvement', {
      documentType: this.config.documentType,
      isCLIMode,
      documentLength: document.length,
      reviewLength: reviewReport.length,
    });

    let prompt: string;
    
    if (isCLIMode) {
      // CLI模式：使用路径模式构建Prompt - 只传递文件夹路径，不传递文件内容
      const taskPoints = this.getImproveTaskPoints();
      prompt = this.cliHandler.buildCLIImprovePrompt(workspaceDir, taskPoints);
    } else {
      // LLM模式：使用内容模式构建Prompt
      prompt = this.config.buildImprovePrompt(document, reviewReport);
    }

    // 调用LLM/CLI执行改进
    const output = await (this.action as any).aask(prompt, [this.config.systemPrompt]);

    // 处理输出 - 返回 ProcessOutputResult
    const processResult = await this.cliHandler.processOutput(
      output,
      workspaceDir,
      'document',
      document // 如果找不到实际文件，使用原文档作为回退
    );

    // 清理代码块标记
    const content = cleanCodeBlockMarkers(processResult.content);

    // 标记是否从workspace读取，用于后续跳过冗余保存
    return {
      content,
      improvedSectionCount: 1, // 整体改进视为改进了一个
      totalSectionCount: 1,
      needsReReview: true,
      _isReadFromWorkspace: processResult.isReadFromWorkspace, // 内部标记
    } as ImproveResult & { _isReadFromWorkspace?: boolean };
  }

  /**
   * 获取改进任务要点
   * 可以被子类重写以提供特定文档类型的改进要点
   * 
   * @returns 改进要点列表
   */
  protected getImproveTaskPoints(): string[] {
    const documentType = this.config.documentType;
    
    // 根据文档类型返回不同的改进要点
    const taskPointsMap: Record<string, string[]> = {
      MRD: [
        '分析审核报告中的P0和P1问题',
        '针对性改进文档内容',
        '确保"明确不做的范围"至少3项',
        '确保至少1个可量化的成功标准',
        '确保至少2个典型使用场景',
      ],
      PRD: [
        '分析审核报告中的P0和P1问题',
        '针对性改进文档内容',
        '保持文档结构不变',
        '确保改进后无占位符和模糊描述',
        '确保功能定义包含触发条件、前置条件、主流程、异常处理',
      ],
      DESIGN: [
        '分析审核报告中的设计问题',
        '完善技术选型和架构设计',
        '补充安全性、性能和扩展性考虑',
        '保持文档结构不变',
      ],
      TEST: [
        '分析审核报告中的测试覆盖问题',
        '补充缺失的测试用例',
        '完善边界条件和异常场景测试',
        '确保测试用例可执行、可验证',
      ],
    };

    return taskPointsMap[documentType.toUpperCase()] || [
      '分析审核报告中的问题',
      '针对性改进文档内容',
      '保持文档结构不变',
      '确保改进后无占位符和模糊描述',
    ];
  }

  /**
   * LLM模式：分章节改进
   * 
   * @param document 文档内容
   * @param reviewReport 审查报告
   * @param workspaceDir workspace目录
   * @param options 选项
   * @returns 改进结果
   */
  private async improveBySections(
    document: string,
    reviewReport: string,
    workspaceDir: string,
    options: ImproveOptions
  ): Promise<ImproveResult> {
    // 解析文档中的章节
    const sections = parseSectionsFromContent(document);

    if (sections.length === 0) {
      // 如果无法解析章节，回退到整体改进
      logger.warn('DocumentImproveHandler: Cannot parse sections, falling back to full document improvement', {
        documentType: this.config.documentType,
      });
      return this.improveFullDocument(document, reviewReport, workspaceDir, options);
    }

    logger.info('DocumentImproveHandler: Using section-by-section improvement (LLM mode)', {
      documentType: this.config.documentType,
      sectionCount: sections.length,
      sections: sections.map(s => `${s.number}. ${s.title}`),
    });

    // 提取文档标题
    const titleMatch = document.match(/^#\s+.+$/m);
    const documentTitle = titleMatch ? titleMatch[0] : `# ${this.config.fileDescription}`;

    // 分章节改进
    const improvedSections: string[] = [];
    let improvedCount = 0;

    for (const section of sections) {
      const sectionContent = this.extractFullSectionContent(document, section);

      // 读取分章节review文件
      const sectionReviewContent = await this.readSectionReviewFile(section.number, options);

      // 如果没有review文件，尝试从合并的reviewReport中提取
      const sectionReview = sectionReviewContent || this.extractSectionReview(reviewReport, section.number);

      if (!sectionReview || sectionReview.trim().length < 10) {
        // 如果没有该章节的审查建议，保持原内容不变
        logger.info(`DocumentImproveHandler: No review found for section ${section.number}, keeping original`, {
          documentType: this.config.documentType,
          sectionNumber: section.number,
          sectionTitle: section.title,
        });
        improvedSections.push(sectionContent);
        continue;
      }

      // 检查审查结论是否需要改进
      const needsImprovement = sectionNeedsImprovement(sectionReview);

      if (!needsImprovement) {
        // 审核通过，不需要改进
        logger.info(`DocumentImproveHandler: Section ${section.number} passed review, no improvement needed`, {
          documentType: this.config.documentType,
          sectionNumber: section.number,
          sectionTitle: section.title,
        });
        improvedSections.push(sectionContent);
        continue;
      }

      logger.info(`DocumentImproveHandler: Improving section ${section.number}`, {
        documentType: this.config.documentType,
        sectionNumber: section.number,
        sectionTitle: section.title,
        contentLength: sectionContent.length,
        reviewLength: sectionReview.length,
      });

      try {
        // 为每个章节单独调用LLM改进
        let prompt: string;
        if (this.config.buildSectionImprovePrompt) {
          prompt = this.config.buildSectionImprovePrompt(
            sectionContent,
            section.number,
            section.title,
            sectionReview
          );
        } else {
          // 回退到整体改进提示词
          prompt = this.config.buildImprovePrompt(sectionContent, sectionReview);
        }

        const improvedSection = await (this.action as any).aask(prompt, [this.config.systemPrompt]);

        // 清理代码块标记
        const cleanedSection = cleanCodeBlockMarkers(improvedSection);
        improvedSections.push(cleanedSection);

        // 将改进后的内容写回对应章节文件
        const sectionFileName = this.getSectionFileName(section.number);
        await (this.action as any).saveToWorkspace(sectionFileName, cleanedSection, options);

        // 改进成功，增加计数
        improvedCount++;

        logger.info(`DocumentImproveHandler: Section ${section.number} improved`, {
          documentType: this.config.documentType,
          sectionNumber: section.number,
          originalLength: sectionContent.length,
          improvedLength: cleanedSection.length,
        });

        // 改进成功后，删除该章节的review文件
        await this.deleteSectionReviewFile(section.number, options);
      } catch (error: any) {
        logger.error(`DocumentImproveHandler: Failed to improve section ${section.number}`, {
          documentType: this.config.documentType,
          sectionNumber: section.number,
          error: error.message,
        });
        // 如果改进失败，保持原内容
        improvedSections.push(sectionContent);
      }
    }

    // 合并所有改进后的章节
    const improvedDocument = [documentTitle, '', ...improvedSections].join('\n\n');

    return {
      content: improvedDocument,
      improvedSectionCount: improvedCount,
      totalSectionCount: sections.length,
      needsReReview: improvedCount > 0,
    };
  }

  /**
   * 获取审查报告
   * 
   * @param input 输入内容
   * @param inputIsReviewReport 输入是否为审查报告
   * @param options 选项
   * @returns 审查报告内容
   */
  private async getReviewReport(
    input: string,
    inputIsReviewReport: boolean,
    options: ImproveOptions
  ): Promise<string | null> {
    // 如果options中有审查报告，直接使用
    if (options.reviewReport) {
      return options.reviewReport;
    }

    // 如果输入看起来像审查报告，使用输入
    if (inputIsReviewReport) {
      logger.info('DocumentImproveHandler: Using input as review report', {
        documentType: this.config.documentType,
        inputLength: input.length,
      });
      return input;
    }

    // 从workspace读取审查报告
    let reviewReport = await (this.action as any).readWorkspaceFile(
      this.config.reviewFileName,
      options
    );

    // 如果找不到，尝试从主文档末尾提取
    if (!reviewReport) {
      const mainDocument = await (this.action as any).readWorkspaceFile(
        this.config.mainFileName,
        options
      );
      if (mainDocument) {
        const reviewMatch = mainDocument.match(
          new RegExp(`---\\s*\\n\\s*${this.config.reviewReportPattern.source}[\\s\\S]*$`)
        );
        if (reviewMatch) {
          reviewReport = reviewMatch[0].replace(/^---\s*\n\s*/, '');
        } else {
          const simpleMatch = mainDocument.match(
            new RegExp(`${this.config.reviewReportPattern.source}[\\s\\S]*$`)
          );
          if (simpleMatch) {
            reviewReport = simpleMatch[0];
          }
        }
      }
    }

    return reviewReport;
  }

  /**
   * 从文档中移除审查报告部分
   * 
   * @param document 文档内容
   * @returns 移除审查报告后的文档
   */
  removeReviewReport(document: string): string {
    return removeReviewReport(document, this.config.reviewReportPattern);
  }

  /**
   * 从完整文档中提取章节的完整内容
   * 
   * @param document 文档内容
   * @param section 章节信息
   * @returns 章节内容
   */
  private extractFullSectionContent(document: string, section: Section): string {
    const lines = document.split('\n');
    if (section.startLine === undefined) {
      return `## ${section.number}. ${section.title}\n\n${section.content || ''}`;
    }

    const endLine = section.endLine ?? lines.length - 1;
    return lines.slice(section.startLine, endLine + 1).join('\n');
  }

  /**
   * 从审查报告中提取特定章节的审查建议
   * 
   * @param reviewReport 审查报告
   * @param sectionNumber 章节编号
   * @returns 章节审查建议
   */
  private extractSectionReview(reviewReport: string, sectionNumber: number): string {
    // 匹配审查报告中对应章节的内容
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
   * 读取指定章节的review文件
   * 
   * @param sectionNumber 章节编号
   * @param options workspace选项
   * @returns review内容
   */
  private async readSectionReviewFile(
    sectionNumber: number,
    options: ImproveOptions
  ): Promise<string | null> {
    const paddedNumber = sectionNumber.toString().padStart(2, '0');
    const reviewFileName = `${paddedNumber}-section-${sectionNumber}-review.md`;

    const content = await (this.action as any).readWorkspaceFile(reviewFileName, options);

    if (content) {
      logger.info(`DocumentImproveHandler: Read section review file`, {
        documentType: this.config.documentType,
        sectionNumber,
        reviewFileName,
        contentLength: content.length,
      });
    }

    return content;
  }

  /**
   * 删除指定章节的review文件
   * 
   * @param sectionNumber 章节编号
   * @param options workspace选项
   */
  private async deleteSectionReviewFile(
    sectionNumber: number,
    options: ImproveOptions
  ): Promise<void> {
    const paddedNumber = sectionNumber.toString().padStart(2, '0');
    const reviewFileName = `${paddedNumber}-section-${sectionNumber}-review.md`;

    const deleted = await (this.action as any).deleteWorkspaceFile(reviewFileName, options);

    if (deleted) {
      logger.info(`DocumentImproveHandler: Deleted section review file`, {
        documentType: this.config.documentType,
        sectionNumber,
        reviewFileName,
      });
    }
  }

  /**
   * 构建章节文件名
   * 
   * @param sectionNumber 章节编号
   * @returns 章节文件名
   */
  private getSectionFileName(sectionNumber: number): string {
    const paddedNumber = sectionNumber.toString().padStart(2, '0');
    return `${paddedNumber}-section-${sectionNumber}.md`;
  }

  /**
   * 如果需要，保存改进后的文档到workspace
   * 
   * @param content 改进后的内容
   * @param options workspace选项
   * @param isReadFromWorkspace 内容是否从workspace读取（CLI已保存）
   */
  private async saveDocumentIfNeeded(
    content: string,
    options: ImproveOptions,
    isReadFromWorkspace: boolean = false
  ): Promise<void> {
    // 如果内容是从workspace读取的，说明CLI工具已经保存了文件，不需要再次保存
    if (isReadFromWorkspace) {
      logger.info('DocumentImproveHandler: Skipping save - CLI already saved the file', {
        documentType: this.config.documentType,
        filename: this.config.mainFileName,
      });
      return;
    }

    // 只有当内容不是CLI总结时才保存
    if (options.applicationId && this.cliHandler.shouldSaveToWorkspace(content)) {
      await (this.action as any).saveToWorkspace(
        this.config.mainFileName,
        content,
        options
      );
      logger.info('DocumentImproveHandler: Saved improved document to workspace', {
        documentType: this.config.documentType,
        filename: this.config.mainFileName,
      });
    }
  }

  /**
   * 获取CLIModeHandler
   */
  getCLIModeHandler(): CLIModeHandler {
    return this.cliHandler;
  }

  /**
   * 获取配置
   */
  getConfig(): ImproveConfig {
    return this.config;
  }
}
