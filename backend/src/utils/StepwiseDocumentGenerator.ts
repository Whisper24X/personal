/**
 * StepwiseDocumentGenerator
 * 通用的分步骤文档生成工具类
 * 支持：目录生成 -> 章节生成 -> 合并 -> 审查
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import { logger } from './logger';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { StateManager } from '../orchestration/StateManager';
import { StepState } from '../orchestration/StepStateTracker';
import { WorkspaceManager } from './WorkspaceManager';

export interface Section {
  number: number;
  title: string;
}

export interface StepwiseGenerationConfig {
  // Prompt 构建函数
  buildOutlinePrompt: (input: string) => string;
  buildSectionPrompt: (input: string, outline: string, sectionNumber: number, sectionTitle: string) => string;
  buildSectionReviewPrompt?: (
    sectionContent: string,
    sectionNumber: number,
    sectionTitle: string,
    outline: string
  ) => string;
  systemPrompt: string;
  reviewSystemPrompt?: string;

  // 文档元信息
  documentTitle: string; // 如 "产品需求文档（PRD）"
  documentType: string; // 如 "PRD"
  mainFileName: string; // 如 "PRD.md"
  reviewTitle?: string;

  // 默认章节（当无法解析目录时使用）
  defaultSections: Section[];

  // 章节过滤器（可选，用于跳过可选章节等）
  sectionFilter?: (sections: Section[]) => Section[];

  // Workspace 配置
  workspaceDir: string;
  applicationId?: string;
  projectId?: string;
  /** @deprecated 版本控制已改用 git，此参数被忽略 */
  version?: number;

  // StateManager配置（可选，用于步骤状态管理）
  stateManager?: StateManager;
  role?: string; // 角色名称，用于步骤状态管理

  // 步骤控制（可选，用于跳过特定步骤）
  skipReview?: boolean; // 是否跳过章节审核步骤
  skipMerge?: boolean; // 是否跳过合并步骤
}

export class StepwiseDocumentGenerator {
  private action: BaseAction;
  private config: StepwiseGenerationConfig;
  private abortController?: AbortController;
  private isCancelled: boolean = false;

  constructor(action: BaseAction, config: StepwiseGenerationConfig) {
    this.action = action;
    this.config = config;
    this.abortController = new AbortController();
  }

  /**
   * 获取日志上下文信息（角色和action名称）
   */
  private getLogContext(): { role?: string; actionName?: string } {
    return {
      role: this.config.role,
      actionName: this.action.name,
    };
  }

  /**
   * 执行分步骤生成
   */
  async generate(input: string): Promise<IActionOutput> {
    // Reset cancellation flag when starting new generation
    this.isCancelled = false;
    
    const startTime = Date.now();
    const logContext = this.getLogContext();
    logger.info('StepwiseDocumentGenerator: Starting stepwise generation', {
      ...logContext,
      documentType: this.config.documentType,
      documentTitle: this.config.documentTitle,
      workspaceDir: this.config.workspaceDir,
      applicationId: this.config.applicationId,
      projectId: this.config.projectId,
      inputLength: input.length,
    });

    try {
      // Step 0: 初始化工作空间（克隆或拉取最新模板）
      // 这一步确保在写入任何文件之前，ainative-workspace 模板项目是最新的
      if (this.config.applicationId && this.config.projectId) {
        logger.info('StepwiseDocumentGenerator: Step 0 - Initializing workspace (clone or pull template)', logContext);
        await WorkspaceManager.initWorkspace({
          applicationId: this.config.applicationId,
          projectId: this.config.projectId,
          documentType: this.config.documentType,
        });
        logger.info('StepwiseDocumentGenerator: Workspace initialized successfully', logContext);
      }
      // Step 1: 生成目录
      const step1Start = Date.now();
      logger.info('StepwiseDocumentGenerator: Step 1/7 - Generating outline', logContext);
      await this.checkCancellation();
      await this.setStepState('outline', StepState.RUNNING);
      const outline = await this.generateOutline(input);
      await this.saveToWorkspace('00-outline.md', outline);
      await this.setStepState('outline', StepState.COMPLETED);
      logger.info('StepwiseDocumentGenerator: Step 1/5 completed - Outline generated', {
        ...logContext,
        outlineLength: outline.length,
        duration: `${Date.now() - step1Start}ms`,
      });
      
      // Check cancellation after Step 1
      await this.checkCancellation();

      // Step 2: 解析章节列表
      const step2Start = Date.now();
      logger.info('StepwiseDocumentGenerator: Step 2/5 - Parsing sections', logContext);
      await this.checkCancellation();
      await this.setStepState('parse-sections', StepState.RUNNING);
      const parsedSections = this.parseSections(outline);
      await this.setStepState('parse-sections', StepState.COMPLETED);
      let sections = parsedSections;
      if (this.config.sectionFilter) {
        const filteredSections = this.config.sectionFilter(parsedSections);
        if (filteredSections.length === 0) {
          // 如果过滤后为空，使用默认章节而不是原始解析的章节
          logger.warn('StepwiseDocumentGenerator: Section filter removed all sections, using default sections', {
            ...logContext,
            parsedCount: parsedSections.length,
            defaultCount: this.config.defaultSections.length,
          });
          sections = this.config.defaultSections;
        } else {
          sections = filteredSections;
        }
      }
      logger.info('StepwiseDocumentGenerator: Step 2/5 completed - Sections parsed', {
        ...logContext,
        sectionCount: sections.length,
        sections: sections.map(s => `${s.number}. ${s.title}`),
        duration: `${Date.now() - step2Start}ms`,
      });
      
      // Check cancellation after Step 2
      await this.checkCancellation();

      // Step 3: 按章节生成内容
      const step3Start = Date.now();
      logger.info('StepwiseDocumentGenerator: Step 3/5 - Generating section contents', {
        ...logContext,
        sectionCount: sections.length,
      });
      await this.checkCancellation();
      await this.setStepState('generate-sections', StepState.RUNNING);
      const sectionContents = await this.generateSections(input, outline, sections);
      await this.setStepState('generate-sections', StepState.COMPLETED);
      logger.info('StepwiseDocumentGenerator: Step 3/5 completed - All sections generated', {
        ...logContext,
        sectionCount: sectionContents.length,
        totalSectionsLength: sectionContents.reduce((sum, content) => sum + content.length, 0),
        duration: `${Date.now() - step3Start}ms`,
      });
      
      // Check cancellation after Step 3
      await this.checkCancellation();

      // Step 4: 审核各个章节（如配置，且未设置 skipReview）
      let sectionReviews: string[] = [];
      let reviewDocument: string | undefined;
      if (!this.config.skipReview) {
        const step4Start = Date.now();
        logger.info('StepwiseDocumentGenerator: Step 4/5 - Reviewing sections', logContext);
        await this.checkCancellation();
        await this.setStepState('review-sections', StepState.RUNNING);
        sectionReviews = await this.reviewSections(sectionContents, sections, outline);
        reviewDocument = await this.generateReviewDocument(sectionReviews, sections);
        await this.setStepState('review-sections', StepState.COMPLETED);
        logger.info('StepwiseDocumentGenerator: Step 4/5 completed - Section reviews generated', {
          ...logContext,
          sectionCount: sectionContents.length,
          reviewSectionCount: sectionReviews.length,
          reviewDocumentLength: reviewDocument?.length || 0,
          duration: `${Date.now() - step4Start}ms`,
        });
        
        // Check cancellation after Step 4
        await this.checkCancellation();
      } else {
        logger.info('StepwiseDocumentGenerator: Step 4/5 - Skipping section reviews (skipReview=true)', logContext);
        await this.setStepState('review-sections', StepState.COMPLETED);
      }

      // Step 5: 合并所有章节（如未设置 skipMerge）
      let mergedContent = '';
      if (!this.config.skipMerge) {
        const step5Start = Date.now();
        logger.info('StepwiseDocumentGenerator: Step 5/5 - Merging sections', logContext);
        await this.checkCancellation();
        await this.setStepState('merge', StepState.RUNNING);
        mergedContent = this.mergeSections(outline, sectionContents, sections);
        await this.saveToWorkspace(this.config.mainFileName, mergedContent);
        await this.setStepState('merge', StepState.COMPLETED);
        logger.info('StepwiseDocumentGenerator: Step 5/5 completed - Sections merged', {
          ...logContext,
          totalLength: mergedContent.length,
          sectionCount: sections.length,
          duration: `${Date.now() - step5Start}ms`,
        });
      } else {
        logger.info('StepwiseDocumentGenerator: Step 5/5 - Skipping merge (skipMerge=true)', logContext);
        await this.setStepState('merge', StepState.COMPLETED);
      }

      const totalDuration = Date.now() - startTime;
      
      // 如果跳过合并，返回章节文件列表信息
      if (this.config.skipMerge) {
        const sectionFiles = sections.map((section, index) => ({
          number: section.number,
          title: section.title,
          filename: `${String(section.number).padStart(2, '0')}-section-${section.number}.md`,
          content: sectionContents[index] || '',
        }));
        
        logger.info('StepwiseDocumentGenerator: Stepwise generation completed (skipMerge mode)', {
          ...logContext,
          sectionCount: sections.length,
          workspaceDir: this.config.workspaceDir,
          skipReview: this.config.skipReview,
          skipMerge: this.config.skipMerge,
          totalDuration: `${totalDuration}ms`,
        });

        return {
          content: outline, // 返回目录作为 content
          data: {
            type: this.config.documentType.toLowerCase(),
            filename: '00-outline.md',
            timestamp: new Date().toISOString(),
            mode: 'new',
            stepwise: true,
            sectionCount: sections.length,
            sections: sectionFiles,
            outline,
            reviewIncluded: false,
            skipMerge: true,
            workspaceDir: this.config.workspaceDir,
          },
        };
      }

      logger.info('StepwiseDocumentGenerator: Stepwise generation completed', {
        ...logContext,
        finalContentLength: mergedContent.length,
        sectionCount: sections.length,
        workspaceDir: this.config.workspaceDir,
        mainFileName: this.config.mainFileName,
        reviewIncluded: sectionReviews.length > 0,
        improvementIncluded: false, // 改进由角色管理，不在这里执行
        totalDuration: `${totalDuration}ms`,
      });

      // 从 workspace 读取主文件内容
      // 确保返回的是完整的PRD内容，而不是监控检测信息
      let allContent: string;
      try {
        allContent = await this.readMainFileFromWorkspace();
        if (!allContent || allContent.trim().length === 0) {
          logger.warn('StepwiseDocumentGenerator: Workspace content is empty, using merged content', logContext);
          allContent = mergedContent;
        }
        // 确保读取的是完整的PRD内容，而不是其他文件（如review文件）
        logger.info('StepwiseDocumentGenerator: Returning complete PRD content', {
          ...logContext,
          contentLength: allContent.length,
          isCompletePRD: true,
        });
      } catch (error: any) {
        logger.warn('StepwiseDocumentGenerator: Failed to read from workspace, using merged content', {
          ...logContext,
          error: error.message,
        });
        allContent = mergedContent;
      }

      // 确保返回的是完整的PRD内容，而不是监控检测信息
      return {
        content: allContent,
        data: {
          type: this.config.documentType.toLowerCase(),
          filename: this.config.mainFileName,
          timestamp: new Date().toISOString(),
          mode: 'new',
          stepwise: true,
          sectionCount: sections.length,
          reviewIncluded: sectionReviews.length > 0,
          workspaceDir: this.config.workspaceDir,
        },
      };
    } catch (error: any) {
      logger.error('StepwiseDocumentGenerator: Stepwise generation failed', {
        ...logContext,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Step 1: 生成目录
   */
  private async generateOutline(input: string): Promise<string> {
    const logContext = this.getLogContext();
    logger.info('StepwiseDocumentGenerator: Step 1 - Generating outline', logContext);
    
    // Check cancellation before LLM call
    await this.checkCancellation();
    
    const outlinePrompt = this.config.buildOutlinePrompt(input);
    // 注意：BaseAction 的 aask 是 protected，需要通过类型断言访问
    const outline = await (this.action as any).aask(outlinePrompt, [this.config.systemPrompt]);

    // Check cancellation after LLM call
    await this.checkCancellation();

    logger.info('StepwiseDocumentGenerator: Outline generated', {
      ...logContext,
      outlineLength: outline.length,
    });

    return outline;
  }

  /**
   * Step 2: 解析章节列表
   */
  private parseSections(outline: string): Section[] {
    const sections: Section[] = [];
    
    // 先清理 outline 中的代码块标记
    // LLM 有时会将目录包裹在 ```markdown ... ``` 代码块中
    let cleanedOutline = outline.trim();
    // 移除开头的代码块标记
    cleanedOutline = cleanedOutline.replace(/^```(?:markdown|md|text)?\s*\n?/i, '');
    // 移除结尾的代码块标记
    cleanedOutline = cleanedOutline.replace(/\n?```\s*$/, '');
    
    const lines = cleanedOutline.split('\n');

    for (const line of lines) {
      // 使用更宽松的正则表达式，支持多种格式变体
      // 匹配格式：## 数字. 标题 或 ## 数字.标题（点后无空格）
      const match = line.match(/^##\s*(\d+)\.\s*(.+?)$/);
      if (match) {
        const sectionNumber = parseInt(match[1]);
        const sectionTitle = match[2].trim();
        // 避免重复添加相同编号的章节
        if (!sections.some(s => s.number === sectionNumber)) {
          sections.push({
            number: sectionNumber,
            title: sectionTitle,
          });
        }
      }
    }

    const logContext = this.getLogContext();
    const defaultSectionCount = this.config.defaultSections.length;
    const minSectionThreshold = Math.floor(defaultSectionCount * 0.7); // 至少需要 70% 的章节数量

    // 如果解析出的章节数量不足（少于默认章节的 70%），使用默认章节
    if (sections.length === 0) {
      logger.warn('StepwiseDocumentGenerator: No sections parsed, using default sections', logContext);
      return this.config.defaultSections;
    }

    if (sections.length < minSectionThreshold) {
      logger.warn('StepwiseDocumentGenerator: Parsed sections count is too low, using default sections', {
        ...logContext,
        parsedCount: sections.length,
        defaultCount: defaultSectionCount,
        threshold: minSectionThreshold,
        parsedSections: sections.map(s => `${s.number}. ${s.title}`),
      });
      return this.config.defaultSections;
    }

    // 按章节编号排序，确保顺序正确
    sections.sort((a, b) => a.number - b.number);

    logger.info('StepwiseDocumentGenerator: Sections parsed successfully', {
      ...logContext,
      parsedCount: sections.length,
      defaultCount: defaultSectionCount,
      sections: sections.map(s => `${s.number}. ${s.title}`),
    });

    return sections;
  }

  /**
   * Step 3: 按章节生成内容
   */
  private async generateSections(
    input: string,
    outline: string,
    sections: Section[]
  ): Promise<string[]> {
    const sectionContents: string[] = [];
    const sectionsStartTime = Date.now();
    const logContext = this.getLogContext();

    // 保存原始配置
    const llm = (this.action as any).llm;
    const originalMaxTokens = llm?.config?.maxTokens;
    const maxTokensPerSection = parseInt(process.env.MAX_TOKENS_PER_SECTION || '32000');

    logger.info('StepwiseDocumentGenerator: Starting section generation', {
      ...logContext,
      totalSections: sections.length,
      sections: sections.map(s => `${s.number}. ${s.title}`),
      maxTokensPerSection,
    });

    for (let i = 0; i < sections.length; i++) {
      await this.checkCancellation();
      
      const section = sections[i];
      const sectionStartTime = Date.now();
      const stepId = `section-${section.number}`;

      logger.info(`StepwiseDocumentGenerator: Generating section ${i + 1}/${sections.length} - ${section.number}. ${section.title}`, {
        ...logContext,
        sectionNumber: section.number,
        sectionTitle: section.title,
        totalSections: sections.length,
        currentProgress: `${i + 1}/${sections.length}`,
        maxTokens: maxTokensPerSection,
      });

      try {
        await this.setStepState(stepId, StepState.RUNNING);
        // 为每个章节设置独立的 max_tokens
        // 注意：需要确保 action 有 llm 属性
        if (llm && llm.config) {
          llm.config.maxTokens = maxTokensPerSection;
        }

        const sectionPrompt = this.config.buildSectionPrompt(
          input,
          outline,
          section.number,
          section.title
        );

        const messages: any[] = [
          {
            role: 'system',
            content: this.config.systemPrompt,
          },
          {
            role: 'user',
            content: sectionPrompt,
          },
        ];

        // Check cancellation before LLM call
        await this.checkCancellation();
        
        // 使用 acompletion 以便传递 max_tokens
        // 注意：BaseAction 的 acompletion 是 protected，需要通过类型断言访问
        const response = await (this.action as any).acompletion(messages);
        
        // Check cancellation immediately after LLM call
        await this.checkCancellation();
        
        const sectionContent = response.content;

        sectionContents.push(sectionContent);
        await this.setStepState(stepId, StepState.COMPLETED);
        
        // Check cancellation after setting step state
        await this.checkCancellation();

        // 保存每个章节到文件
        const sectionFileName = `${String(section.number).padStart(2, '0')}-section-${section.number}.md`;
        await this.saveToWorkspace(sectionFileName, sectionContent);
        
        // Check cancellation after saving file
        await this.checkCancellation();

        const sectionDuration = Date.now() - sectionStartTime;
        logger.info(`StepwiseDocumentGenerator: Section ${section.number} generated successfully`, {
          ...logContext,
          sectionNumber: section.number,
          sectionTitle: section.title,
          contentLength: sectionContent.length,
          tokensUsed: response.usage?.totalTokens || 0,
          fileName: sectionFileName,
          duration: `${sectionDuration}ms`,
          progress: `${i + 1}/${sections.length}`,
        });
        
        // Check cancellation before next iteration
        await this.checkCancellation();
      } catch (error: any) {
        // If this is a cancellation error, re-throw it to stop the generation
        if (error.message?.includes('cancelled') || error.message?.includes('Operation cancelled')) {
          logger.info(`StepwiseDocumentGenerator: Section generation cancelled at section ${section.number}`, {
            ...logContext,
            sectionNumber: section.number,
            sectionTitle: section.title,
          });
          throw error; // Re-throw to stop the entire generation
        }
        
        await this.setStepState(stepId, StepState.FAILED);
        const sectionDuration = Date.now() - sectionStartTime;
        logger.error(`StepwiseDocumentGenerator: Failed to generate section ${section.number}`, {
          ...logContext,
          sectionNumber: section.number,
          sectionTitle: section.title,
          error: error.message,
          stack: error.stack,
          duration: `${sectionDuration}ms`,
          progress: `${i + 1}/${sections.length}`,
        });
        // 如果某个章节生成失败，使用占位符
        const errorContent = `## ${section.number}. ${section.title}\n\n[生成失败: ${error.message}]`;
        sectionContents.push(errorContent);
        logger.warn(`StepwiseDocumentGenerator: Using error placeholder for section ${section.number}`, {
          ...logContext,
          placeholderLength: errorContent.length,
        });
      }
    }

    // 恢复原始配置
    if (llm && llm.config && originalMaxTokens !== undefined) {
      llm.config.maxTokens = originalMaxTokens;
    }

    const totalSectionsDuration = Date.now() - sectionsStartTime;
    logger.info('StepwiseDocumentGenerator: All sections generation completed', {
      ...logContext,
      totalSections: sections.length,
      successfulSections: sectionContents.filter(c => !c.includes('[生成失败]')).length,
      failedSections: sectionContents.filter(c => c.includes('[生成失败]')).length,
      totalContentLength: sectionContents.reduce((sum, content) => sum + content.length, 0),
      averageSectionLength: sectionContents.length > 0
        ? Math.round(sectionContents.reduce((sum, content) => sum + content.length, 0) / sectionContents.length)
        : 0,
      duration: `${totalSectionsDuration}ms`,
      averageDuration: sections.length > 0 ? `${Math.round(totalSectionsDuration / sections.length)}ms` : '0ms',
    });

    return sectionContents;
  }

  /**
   * Step 4: 审核各个章节
   */
  private async reviewSections(
    sectionContents: string[],
    sections: Section[],
    outline: string
  ): Promise<string[]> {
    const sectionReviews: string[] = [];
    const logContext = this.getLogContext();

    // 如果没有配置章节审核提示词，跳过审核
    if (!this.config.buildSectionReviewPrompt) {
      logger.warn('StepwiseDocumentGenerator: buildSectionReviewPrompt not configured, skipping section reviews', logContext);
      return sectionReviews;
    }

    const reviewSystemPrompt = this.config.reviewSystemPrompt || this.config.systemPrompt;

    for (let i = 0; i < sections.length; i++) {
      // Check cancellation before each review iteration
      await this.checkCancellation();
      
      const section = sections[i];
      const sectionContent = sectionContents[i] || '';

      // Log review start
      logger.info(`StepwiseDocumentGenerator: Starting review for section ${section.number}`, {
        ...logContext,
        sectionNumber: section.number,
        sectionTitle: section.title,
        sectionContentLength: sectionContent.length,
        progress: `${i + 1}/${sections.length}`,
      });

      try {
        const reviewPrompt = this.config.buildSectionReviewPrompt(
          sectionContent,
          section.number,
          section.title,
          outline
        );

        const messages: any[] = [
          {
            role: 'system',
            content: reviewSystemPrompt,
          },
          {
            role: 'user',
            content: reviewPrompt,
          },
        ];

        // Check cancellation before LLM call
        await this.checkCancellation();
        
        const reviewStartTime = Date.now();
        const response = await (this.action as any).acompletion(messages);
        
        // Check cancellation immediately after LLM call
        await this.checkCancellation();
        
        const reviewResult = response.content;
        const reviewTime = Date.now() - reviewStartTime;

        sectionReviews.push(reviewResult);

        // 保存每个章节的审核结果
        const reviewFileName = `${String(section.number).padStart(2, '0')}-section-${section.number}-review.md`;
        await this.saveToWorkspace(reviewFileName, reviewResult);
        
        // Check cancellation after saving review file
        await this.checkCancellation();

        logger.info(`StepwiseDocumentGenerator: Section ${section.number} reviewed successfully`, {
          ...logContext,
          sectionNumber: section.number,
          sectionTitle: section.title,
          reviewLength: reviewResult.length,
          reviewTimeMs: reviewTime,
          progress: `${i + 1}/${sections.length}`,
        });
        
        // Check cancellation before next iteration
        await this.checkCancellation();
      } catch (error: any) {
        // If this is a cancellation error, re-throw it to stop the generation
        if (error.message?.includes('cancelled') || error.message?.includes('Operation cancelled')) {
          logger.info(`StepwiseDocumentGenerator: Section review cancelled at section ${section.number}`, {
            ...logContext,
            sectionNumber: section.number,
            sectionTitle: section.title,
          });
          throw error; // Re-throw to stop the entire generation
        }
        
        logger.error(`StepwiseDocumentGenerator: Failed to review section ${section.number}`, {
          ...logContext,
          sectionNumber: section.number,
          sectionTitle: section.title,
          error: error.message,
          errorStack: error.stack,
          progress: `${i + 1}/${sections.length}`,
        });
        // 如果审核失败，添加空审核结果
        sectionReviews.push('');
      }
    }

    return sectionReviews;
  }

  /**
   * Step 5: 生成审核文档
   * 注意：不再调用reviewAction，只生成审核报告内容
   */
  private async generateReviewDocument(
    sectionReviews: string[],
    sections: Section[]
  ): Promise<string | undefined> {
    if (sectionReviews.length === 0) {
      return undefined;
    }

    // 合并所有章节的审核结果
    const reviewParts: string[] = [];
    const reviewTitle = this.config.reviewTitle || `${this.config.documentTitle}审查报告`;
    reviewParts.push(`# ${reviewTitle}\n`);

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const review = sectionReviews[i] || '';

      if (review.trim()) {
        reviewParts.push(`## 章节 ${section.number}. ${section.title} 审查结果\n\n${review}`);
        if (i < sections.length - 1) {
          reviewParts.push('\n---\n');
        }
      }
    }

    const reviewReportContent = reviewParts.join('\n\n');

    // 保存审核报告到单独文件
    const reviewFileName = this.config.documentType === 'PRD'
      ? 'PRD-review.md'
      : this.config.documentType === 'MRD'
        ? 'MRD-review.md'
        : 'DESIGN-review.md';

    await this.saveToWorkspace(reviewFileName, reviewReportContent);

    const logContext = this.getLogContext();
    logger.info('StepwiseDocumentGenerator: Review document generated', {
      ...logContext,
      reviewFileName,
      reviewReportLength: reviewReportContent.length,
      sectionCount: sections.length,
    });

    return reviewReportContent;
  }

  /**
   * Step 7: 合并章节内容
   * 简化版：直接追加每个章节的内容，不进行复杂的格式处理
   */
  private mergeSections(_outline: string, sectionContents: string[], sections: Section[]): string {
    const mergedParts: string[] = [];
    const logContext = this.getLogContext();

    // 添加文档标题
    mergedParts.push(`# ${this.config.documentTitle}`);

    logger.info('StepwiseDocumentGenerator: Starting merge sections (simple append mode)', {
      ...logContext,
      sectionsCount: sections.length,
      sectionContentsCount: sectionContents.length,
      sections: sections.map(s => `${s.number}. ${s.title}`),
    });

    // 直接追加所有章节内容
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      let content = sectionContents[i] || '';

      // 如果没有内容，使用占位符
      if (!content || content.trim() === '') {
        content = `## ${section.number}. ${section.title}\n\n[待补充]`;
        logger.warn('StepwiseDocumentGenerator: Section content is empty, using placeholder', {
          ...logContext,
          sectionNumber: section.number,
          sectionTitle: section.title,
        });
      } else {
        // 只进行简单的清理：移除首尾空白
        content = content.trim();
      }

      // 直接追加章节内容
      mergedParts.push(content);

      logger.debug?.('StepwiseDocumentGenerator: Appended section', {
        ...logContext,
        sectionNumber: section.number,
        sectionTitle: section.title,
        contentLength: content.length,
      });
    }

    // 使用双换行符连接所有部分
    const result = mergedParts.join('\n\n');
    logger.info('StepwiseDocumentGenerator: Merge sections completed', {
      ...logContext,
      totalLength: result.length,
      partsCount: mergedParts.length,
    });

    return result;
  }

  /**
   * 保存文件到 workspace
   */
  private async saveToWorkspace(filePath: string, content: string): Promise<void> {
    try {
      const fullPath = path.join(this.config.workspaceDir, filePath);
      const dir = path.dirname(fullPath);
      const logContext = this.getLogContext();

      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(fullPath, content, 'utf-8');

      logger.info('StepwiseDocumentGenerator: Saved file to workspace', {
        ...logContext,
        filePath: fullPath,
        contentLength: content.length,
      });
    } catch (error: any) {
      const logContext = this.getLogContext();
      logger.error('StepwiseDocumentGenerator: Failed to save file to workspace', {
        ...logContext,
        filePath,
        error: error.message,
      });
    }
  }

  /**
   * 读取 workspace 中的主文件内容（PRD.md）
   */
  private async readMainFileFromWorkspace(): Promise<string> {
    try {
      const logContext = this.getLogContext();
      // 检查目录是否存在
      try {
        await fs.access(this.config.workspaceDir);
      } catch {
        logger.warn('StepwiseDocumentGenerator: Workspace directory does not exist', {
          ...logContext,
          workspaceDir: this.config.workspaceDir,
        });
        return '';
      }

      // 直接读取主文件（PRD.md）
      // 确保返回的是完整的PRD内容，而不是监控检测信息或其他文件
      const mainFilePath = path.join(this.config.workspaceDir, this.config.mainFileName);
      try {
        const content = await fs.readFile(mainFilePath, 'utf-8');
        logger.info('StepwiseDocumentGenerator: Read main file from workspace', {
          ...logContext,
          mainFileName: this.config.mainFileName,
          contentLength: content.length,
          isCompletePRD: true,
        });
        // 确保返回的是完整的PRD内容
        return content;
      } catch (error: any) {
        logger.warn('StepwiseDocumentGenerator: Main file not found, trying to read all files', {
          ...logContext,
          mainFileName: this.config.mainFileName,
          error: error.message,
        });
        // 如果主文件不存在，尝试读取所有文件（向后兼容）
        // 注意：readAllFromWorkspace会排除review文件，只返回PRD相关文件
        return await this.readAllFromWorkspace();
      }
    } catch (error: any) {
      const logContext = this.getLogContext();
      logger.error('StepwiseDocumentGenerator: Failed to read main file from workspace', {
        ...logContext,
        error: error.message,
        workspaceDir: this.config.workspaceDir,
        mainFileName: this.config.mainFileName,
      });
      return '';
    }
  }

  /**
   * 读取 workspace 中的所有文件内容（向后兼容方法）
   */
  private async readAllFromWorkspace(): Promise<string> {
    try {
      const logContext = this.getLogContext();
      // 检查目录是否存在
      try {
        await fs.access(this.config.workspaceDir);
      } catch {
        logger.warn('StepwiseDocumentGenerator: Workspace directory does not exist', {
          ...logContext,
          workspaceDir: this.config.workspaceDir,
        });
        return '';
      }

      const files: string[] = [];
      const entries = await fs.readdir(this.config.workspaceDir, { withFileTypes: true });

      // 按文件名排序（确保顺序：outline -> sections -> main）
      // 排除review文件和其他非PRD文件，确保只返回完整的PRD内容，而不是监控检测信息
      const sortedEntries = entries
        .filter(entry => {
          // 只包含PRD相关文件，排除review文件和其他非PRD文件
          if (!entry.isFile() || !entry.name.endsWith('.md')) return false;
          // 排除review文件
          if (entry.name.includes('review') || entry.name.includes('Review')) return false;
          // 排除final文件
          if (entry.name.endsWith('-final.md')) return false;
          return true;
        })
        .sort((a, b) => {
          if (a.name === '00-outline.md') return -1;
          if (b.name === '00-outline.md') return 1;
          // 主文件优先
          if (a.name === this.config.mainFileName) return -1;
          if (b.name === this.config.mainFileName) return 1;
          return a.name.localeCompare(b.name);
        });

      for (const entry of sortedEntries) {
        const filePath = path.join(this.config.workspaceDir, entry.name);
        const content = await fs.readFile(filePath, 'utf-8');
        if (content.startsWith('#')) {
          files.push(content);
        } else {
          files.push(`# ${entry.name.replace('.md', '')}\n\n${content}`);
        }
      }

      return files.join('\n\n---\n\n');
    } catch (error: any) {
      const logContext = this.getLogContext();
      logger.error('StepwiseDocumentGenerator: Failed to read files from workspace', {
        ...logContext,
        error: error.message,
        workspaceDir: this.config.workspaceDir,
      });
      return '';
    }
  }

  /**
   * Reset generator state
   * Called during rollback to stop ongoing operations
   */
  async reset(abortSignal?: AbortSignal): Promise<void> {
    const logContext = this.getLogContext();
    logger.info('StepwiseDocumentGenerator: Resetting generator', {
      ...logContext,
      documentType: this.config.documentType,
      projectId: this.config.projectId,
    });

    // Set cancellation flag
    this.isCancelled = true;

    // Abort ongoing operations
    if (this.abortController) {
      this.abortController.abort();
    }

    if (abortSignal?.aborted) {
      logger.info('StepwiseDocumentGenerator: Already aborted via signal', logContext);
      return;
    }

    // Reset step states via StateManager
    if (this.config.stateManager && this.config.projectId && this.config.role && this.action.name) {
      try {
        await this.config.stateManager.resetStepStates(
          this.config.role,
          this.action.name
        );
        logger.info('StepwiseDocumentGenerator: Step states reset via StateManager', logContext);
      } catch (error: any) {
        logger.error('StepwiseDocumentGenerator: Failed to reset step states', {
          ...logContext,
          error: error.message,
        });
      }
    }

    // Create new AbortController for future operations
    this.abortController = new AbortController();
    // Keep isCancelled = true until generate() is called again
    // This ensures checkCancellation() will throw if called after reset

    logger.info('StepwiseDocumentGenerator: Reset completed', logContext);
  }

  /**
   * Check if operation should be cancelled
   */
  private async checkCancellation(): Promise<void> {
    const logContext = this.getLogContext();
    
    // Check local cancellation flag
    if (this.isCancelled) {
      logger.info('StepwiseDocumentGenerator: Operation cancelled (local flag)', logContext);
      throw new Error('StepwiseDocumentGenerator: Operation cancelled');
    }
    
    // Check local abortController
    if (this.abortController?.signal.aborted) {
      logger.info('StepwiseDocumentGenerator: Operation cancelled (local abortController)', logContext);
      throw new Error('StepwiseDocumentGenerator: Operation cancelled');
    }
    
    // Check Action's abortSignal (from StateManager)
    // This is the critical check - when reset-workflow is called, StateManager aborts its controller
    // and the Action's abortSignal is set from that controller
    const actionAbortSignal = (this.action as any).abortSignal;
    if (actionAbortSignal?.aborted) {
      logger.info('StepwiseDocumentGenerator: Operation cancelled via Action abortSignal', {
        ...logContext,
        actionAbortSignalAborted: true,
      });
      throw new Error('StepwiseDocumentGenerator: Operation cancelled via Action abortSignal');
    }
    
    // Check StateManager's abortSignal directly (most reliable)
    // This ensures we always get the latest cancellation state even if Action's signal reference is stale
    if (this.config.stateManager) {
      try {
        const stateManagerAbortSignal = this.config.stateManager.getAbortSignal();
        if (stateManagerAbortSignal?.aborted) {
          logger.info('StepwiseDocumentGenerator: Operation cancelled via StateManager abortSignal', {
            ...logContext,
            stateManagerAbortSignalAborted: true,
          });
          throw new Error('StepwiseDocumentGenerator: Operation cancelled via StateManager abortSignal');
        }
      } catch (error: any) {
        // If getAbortSignal throws an error, log it but don't fail the check
        // This might happen if StateManager is not properly initialized
        logger.warn('StepwiseDocumentGenerator: Failed to get abortSignal from StateManager', {
          ...logContext,
          error: error.message,
        });
      }
    }
  }

  /**
   * Set step state via StateManager
   */
  private async setStepState(stepId: string, status: StepState): Promise<void> {
    if (this.config.stateManager && this.config.projectId && this.config.role && this.action.name) {
      try {
        await this.config.stateManager.setStepState(
          this.config.role,
          this.action.name,
          stepId,
          status
        );
      } catch (error: any) {
        const logContext = this.getLogContext();
        logger.warn('StepwiseDocumentGenerator: Failed to set step state', {
          ...logContext,
          stepId,
          status,
          error: error.message,
        });
        // Don't throw - step state management is optional
      }
    }
  }
}

/**
 * 获取工作目录路径的通用函数
 * 新的目录结构：workspace/{applicationId}/{projectId}/ainative-workspace/docs/{documentType}/
 * applicationId 和 projectId 必须提供，不能使用 'default'，以防止不同应用/项目互相覆盖文件
 */
export function getWorkspaceDir(
  documentType: string,
  options?: {
    applicationId?: string;
    projectId?: string;
    /** @deprecated 版本控制已改用 git，此参数被忽略 */
    version?: number;
    /** @deprecated 使用环境变量 WORKSPACE_PATH 代替 */
    workspacePath?: string;
  }
): string {
  const possibleRoots = [
    path.resolve(__dirname, '../../'),
    path.resolve(__dirname, '../../../'),
    process.cwd(),
  ];

  let projectRoot = possibleRoots[0];
  for (const root of possibleRoots) {
    if (fsSync.existsSync(path.join(root, 'pnpm-workspace.yaml')) ||
      fsSync.existsSync(path.join(root, 'package.json'))) {
      projectRoot = root;
      break;
    }
  }

  const workspaceRoot = process.env.WORKSPACE_PATH || path.join(projectRoot, 'workspace');
  
  // applicationId 必须提供，不能使用 'default'
  if (!options?.applicationId) {
    throw new Error('applicationId is required for workspace directory. Cannot use "default" to prevent file conflicts between different applications.');
  }
  // projectId 必须提供，不能使用 'default'
  if (!options?.projectId) {
    throw new Error('projectId is required for workspace directory. Cannot use "default" to prevent file conflicts between different projects.');
  }
  const applicationId = options.applicationId;
  const projectId = options.projectId;
  // 新的目录结构：workspace/{applicationId}/{projectId}/ainative-workspace/docs/{documentType}/
  return path.join(workspaceRoot, applicationId, projectId, 'ainative-workspace', 'docs', documentType.toLowerCase());
}
