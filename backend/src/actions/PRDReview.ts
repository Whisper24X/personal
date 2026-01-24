/**
 * PRDReview Action
 * Reviews PRD document for completeness and quality
 *
 * 工作流程：
 * 1) 从 workspace 读取各章节文件
 * 2) 分章节审核，生成各章节的审核结果
 * 3) 合并所有章节为 PRD.md
 * 4) 对合并后的完整 PRD 进行整体审核
 * 5) 生成综合审核报告并保存
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import {
  PRD_REVIEW_SYSTEM_PROMPT,
  PRD_TEMPLATE,
  buildPRDSectionReviewPrompt,
  buildPRDFullReviewPrompt,
} from '../prompts/prd';
import { logger, loadPrompt, WorkspaceOptions } from '../utils';
import { buildCLISaveInstruction } from '../utils/stepwise';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface PRDReviewOptions extends WorkspaceOptions {
  outline?: string;
  skipSectionReview?: boolean; // 是否跳过分章节审核，直接审核完整文档
}

export interface SectionFile {
  number: number;
  title: string;
  filename: string;
  content: string;
}

export interface SectionReview {
  number: number;
  title: string;
  review: string;
  passed: boolean;
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

    if (!applicationId) {
      throw new Error('applicationId is required for PRDReview action.');
    }
    if (!projectId) {
      throw new Error('projectId is required for PRDReview action.');
    }

    const workspaceOptions: WorkspaceOptions = {
      applicationId,
      projectId,
      version,
      documentType: 'PRD',
      workspacePath: options?.workspacePath,
    };

    // 检查是否为CLI模式
    const isCLIMode = this.isCLIMode();

    logger.info('PRDReview: Starting PRD review workflow', {
      applicationId,
      projectId,
      version,
      hasOutline: !!options?.outline,
      skipSectionReview: options?.skipSectionReview,
      executorMode: isCLIMode ? 'cli' : 'llm',
    });

    try {
      // CLI模式下直接审核完整文档，不分章节
      if (isCLIMode) {
        logger.info('PRDReview: CLI mode detected, using full document review', {
          applicationId,
          projectId,
        });

        // 读取完整的 PRD.md
        let actualPRDContent = prdContent;
        if (!prdContent || prdContent.trim().length < 100) {
          const prdFromWorkspace = await this.readWorkspaceFile('PRD.md', workspaceOptions);
          if (prdFromWorkspace) {
            actualPRDContent = prdFromWorkspace;
          }
        }

        if (!actualPRDContent || actualPRDContent.trim().length === 0) {
          throw new Error('Cannot find PRD content for review. Please generate PRD first.');
        }

        // CLI模式：直接审核完整文档
        return await this.reviewFullDocumentOnly(actualPRDContent, options, workspaceOptions);
      }

      // LLM模式：尝试读取章节文件进行分章节审核
      // Step 1: 读取章节文件
      const sectionFiles = await this.readSectionFiles(workspaceOptions);
      
      if (sectionFiles.length === 0) {
        // 如果没有章节文件，尝试读取完整的 PRD.md（向后兼容）
        let actualPRDContent = prdContent;
        if (!prdContent || prdContent.trim().length < 100) {
          const prdFromWorkspace = await this.readWorkspaceFile('PRD.md', workspaceOptions);
          if (prdFromWorkspace) {
            actualPRDContent = prdFromWorkspace;
          }
        }

        if (!actualPRDContent || actualPRDContent.trim().length === 0) {
          throw new Error('Cannot find PRD content for review. Please generate PRD first.');
        }

        // 使用旧的单次审核流程
        return await this.reviewFullDocumentOnly(actualPRDContent, options, workspaceOptions);
      }

      // Step 2: 读取或生成目录
      const outline = options?.outline?.trim()
        ? options.outline
        : await this.readOutlineFromWorkspace(workspaceOptions) || this.buildExpectedOutline();

      logger.info('PRDReview: Found section files', {
        sectionCount: sectionFiles.length,
        sections: sectionFiles.map(s => `${s.number}. ${s.title}`),
        outlineLength: outline.length,
      });

      // Step 3: 分章节审核
      let sectionReviews: SectionReview[] = [];
      if (!options?.skipSectionReview) {
        sectionReviews = await this.reviewSections(sectionFiles, outline, workspaceOptions);
        logger.info('PRDReview: Section reviews completed', {
          reviewedCount: sectionReviews.length,
          passedCount: sectionReviews.filter(r => r.passed).length,
        });
      }

      // Step 4: 合并章节
      const mergedContent = this.mergeSections(outline, sectionFiles);
      await this.saveToWorkspace('PRD.md', mergedContent, workspaceOptions);
      logger.info('PRDReview: Sections merged into PRD.md', {
        mergedLength: mergedContent.length,
      });

      // Step 5: 整体审核
      const fullReview = await this.reviewFullDocument(mergedContent, outline, workspaceOptions);

      // Step 6: 生成综合审核报告
      const finalReport = this.generateFinalReport(sectionReviews, fullReview);
      await this.saveToWorkspace('PRD_REVIEW.md', finalReport, workspaceOptions);

      // 判断是否通过
      const passed = this.isReviewPassed(finalReport);

      logger.info('PRDReview: Review workflow completed', {
        finalReportLength: finalReport.length,
        passed,
      });

      return {
        content: finalReport,
        data: {
          type: 'prd_review',
          filename: 'PRD_REVIEW.md',
          timestamp: new Date().toISOString(),
          passed,
          sectionReviewCount: sectionReviews.length,
          sectionPassedCount: sectionReviews.filter(r => r.passed).length,
          workspaceDir: this.getWorkspaceDir(workspaceOptions),
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
   * 从 workspace 读取所有章节文件
   */
  private async readSectionFiles(options: WorkspaceOptions): Promise<SectionFile[]> {
    const workspaceDir = this.getWorkspaceDir(options);
    const sectionFiles: SectionFile[] = [];

    try {
      await fs.access(workspaceDir);
    } catch {
      logger.warn('PRDReview: Workspace directory does not exist', { workspaceDir });
      return sectionFiles;
    }

    try {
      const entries = await fs.readdir(workspaceDir, { withFileTypes: true });
      
      // 筛选章节文件（格式：XX-section-Y.md）
      const sectionEntries = entries
        .filter(entry => entry.isFile() && /^\d+-section-\d+\.md$/.test(entry.name))
        .sort((a, b) => a.name.localeCompare(b.name));

      for (const entry of sectionEntries) {
        const filePath = path.join(workspaceDir, entry.name);
        const content = await fs.readFile(filePath, 'utf-8');
        
        // 解析文件名获取章节编号
        const match = entry.name.match(/^\d+-section-(\d+)\.md$/);
        if (match) {
          const sectionNumber = parseInt(match[1]);
          // 从内容中提取标题
          const titleMatch = content.match(/^##\s*\d+\.\s*(.+?)$/m);
          const title = titleMatch ? titleMatch[1].trim() : `章节 ${sectionNumber}`;

          sectionFiles.push({
            number: sectionNumber,
            title,
            filename: entry.name,
            content,
          });
        }
      }

      logger.info('PRDReview: Read section files', {
        workspaceDir,
        fileCount: sectionFiles.length,
      });
    } catch (error: any) {
      logger.error('PRDReview: Failed to read section files', {
        error: error.message,
        workspaceDir,
      });
    }

    return sectionFiles;
  }

  /**
   * 从 workspace 读取目录文件
   */
  private async readOutlineFromWorkspace(options: WorkspaceOptions): Promise<string | null> {
    try {
      const outline = await this.readWorkspaceFile('00-outline.md', options);
      if (outline && outline.trim().length > 0) {
        return outline;
      }
    } catch (error: any) {
      logger.warn('PRDReview: Failed to read outline from workspace', {
        error: error.message,
      });
    }
    return null;
  }

  /**
   * 分章节审核
   */
  private async reviewSections(
    sections: SectionFile[],
    outline: string,
    options: WorkspaceOptions
  ): Promise<SectionReview[]> {
    const reviews: SectionReview[] = [];
    const userId = this.context?.get('userId');
    const systemPrompt = await loadPrompt(userId, 'prd', 'review_system_prompt', PRD_REVIEW_SYSTEM_PROMPT);

    for (const section of sections) {
      // 检查是否已存在审核文件，如果存在则跳过审核
      const reviewFilename = `${String(section.number).padStart(2, '0')}-section-${section.number}-review.md`;
      const existingReview = await this.readWorkspaceFile(reviewFilename, options);
      
      if (existingReview && existingReview.trim().length > 0) {
        // 已存在审核文件，直接使用已有的审核结果
        const passed = this.isSectionPassed(existingReview);
        reviews.push({
          number: section.number,
          title: section.title,
          review: existingReview,
          passed,
        });

        logger.info(`PRDReview: Section ${section.number} review already exists, skipping`, {
          sectionNumber: section.number,
          sectionTitle: section.title,
          passed,
          reviewLength: existingReview.length,
        });
        continue;
      }

      logger.info(`PRDReview: Reviewing section ${section.number}`, {
        sectionNumber: section.number,
        sectionTitle: section.title,
        contentLength: section.content.length,
      });

      try {
        const prompt = buildPRDSectionReviewPrompt(
          section.content,
          section.number,
          section.title,
          outline
        );

        const reviewResult = await this.aask(prompt, [systemPrompt]);
        const passed = this.isSectionPassed(reviewResult);

        reviews.push({
          number: section.number,
          title: section.title,
          review: reviewResult,
          passed,
        });

        // 保存章节审核结果
        await this.saveToWorkspace(reviewFilename, reviewResult, options);

        logger.info(`PRDReview: Section ${section.number} review completed`, {
          sectionNumber: section.number,
          passed,
          reviewLength: reviewResult.length,
        });
      } catch (error: any) {
        logger.error(`PRDReview: Failed to review section ${section.number}`, {
          sectionNumber: section.number,
          error: error.message,
        });
        
        reviews.push({
          number: section.number,
          title: section.title,
          review: `审核失败: ${error.message}`,
          passed: false,
        });
      }
    }

    return reviews;
  }

  /**
   * 合并章节为完整文档
   */
  private mergeSections(_outline: string, sections: SectionFile[]): string {
    const parts: string[] = [];

    // 添加文档标题
    parts.push('# 产品需求文档（PRD）');

    // 按章节编号排序
    const sortedSections = [...sections].sort((a, b) => a.number - b.number);

    // 添加各章节内容
    for (const section of sortedSections) {
      let content = section.content.trim();
      
      // 清理可能的代码块标记
      content = content.replace(/^```(?:markdown|md|text)?\s*\n?/i, '');
      content = content.replace(/\n?```\s*$/, '');
      
      parts.push(content);
    }

    return parts.join('\n\n');
  }

  /**
   * 审核完整文档（使用专门的整体审核提示词，侧重跨章节一致性）
   */
  private async reviewFullDocument(
    prdContent: string,
    outline: string,
    workspaceOptions: WorkspaceOptions
  ): Promise<string> {
    const userId = this.context?.get('userId');
    const systemPrompt = await loadPrompt(userId, 'prd', 'review_system_prompt', PRD_REVIEW_SYSTEM_PROMPT);

    logger.info('PRDReview: Reviewing full document (cross-section consistency check)', {
      contentLength: prdContent.length,
    });

    // 使用专门的整体审核提示词，侧重于跨章节一致性和整体连贯性
    let prompt = buildPRDFullReviewPrompt(prdContent, outline);
    
    // CLI 模式下，在 prompt 中指定文件保存路径和限制指令
    const isCLIMode = this.isCLIMode();
    if (isCLIMode && workspaceOptions.applicationId) {
      const savePath = `${this.getWorkspaceDir(workspaceOptions)}/PRD_REVIEW.md`;
      const saveInstruction = buildCLISaveInstruction(savePath, '审核报告');
      prompt += saveInstruction;
      
      logger.info('PRDReview: Added CLI save path instruction', { savePath });
    }
    
    const reviewResult = await this.aask(prompt, [systemPrompt]);

    logger.info('PRDReview: Full document review completed', {
      reviewLength: reviewResult.length,
    });

    return reviewResult;
  }

  /**
   * 生成综合审核报告
   */
  private generateFinalReport(sectionReviews: SectionReview[], fullReview: string): string {
    const parts: string[] = [];

    parts.push('# PRD 综合审查报告\n');
    parts.push(`> 生成时间: ${new Date().toISOString()}\n`);

    // 分章节审核结果摘要
    if (sectionReviews.length > 0) {
      parts.push('## 一、分章节审核摘要\n');
      
      const passedCount = sectionReviews.filter(r => r.passed).length;
      const totalCount = sectionReviews.length;
      
      parts.push(`| 章节 | 标题 | 审核结果 |`);
      parts.push(`|------|------|----------|`);
      
      for (const review of sectionReviews) {
        const status = review.passed ? '✅ 通过' : '❌ 需改进';
        parts.push(`| ${review.number} | ${review.title} | ${status} |`);
      }
      
      parts.push(`\n**章节审核通过率**: ${passedCount}/${totalCount} (${Math.round(passedCount / totalCount * 100)}%)\n`);

      // 添加各章节的详细审核结果
      parts.push('## 二、分章节详细审核结果\n');
      
      for (const review of sectionReviews) {
        parts.push(`### 章节 ${review.number}. ${review.title}\n`);
        parts.push(review.review);
        parts.push('\n---\n');
      }
    }

    // 整体审核结果
    parts.push('## 三、整体审核结果\n');
    parts.push(fullReview);

    // 总结
    parts.push('\n## 四、审核总结\n');
    const overallPassed = this.isReviewPassed(fullReview);
    if (overallPassed) {
      parts.push('**审核结论**: ✅ 通过\n');
      parts.push('PRD 文档整体质量良好，可以进入下一阶段。');
    } else {
      parts.push('**审核结论**: ❌ 需要改进\n');
      parts.push('PRD 文档存在问题需要改进，请根据上述审核意见进行修改后重新审核。');
    }

    return parts.join('\n');
  }

  /**
   * 判断章节审核是否通过
   */
  private isSectionPassed(reviewContent: string): boolean {
    // 检查审核结论中的关键词
    const lowerContent = reviewContent.toLowerCase();
    if (lowerContent.includes('通过') && !lowerContent.includes('需要改进') && !lowerContent.includes('不通过')) {
      return true;
    }
    if (lowerContent.includes('需要改进') || lowerContent.includes('不通过')) {
      return false;
    }
    // 默认需要改进
    return false;
  }

  /**
   * 判断整体审核是否通过
   */
  private isReviewPassed(reviewContent: string): boolean {
    // 检查审核结论部分
    const conclusionMatch = reviewContent.match(/##\s*\d*\.?\s*审查?结论[\s\S]*?(通过|需要改进|不通过)/i);
    if (conclusionMatch) {
      const conclusion = conclusionMatch[1];
      return conclusion === '通过';
    }
    
    // 检查是否有明确的通过标识
    if (reviewContent.includes('✅ 通过') && !reviewContent.includes('❌')) {
      return true;
    }
    
    // 默认需要改进
    return false;
  }

  /**
   * 向后兼容：只审核完整文档（当没有章节文件时）
   */
  private async reviewFullDocumentOnly(
    prdContent: string,
    options: PRDReviewOptions | undefined,
    workspaceOptions: WorkspaceOptions
  ): Promise<IActionOutput> {
    logger.info('PRDReview: Using legacy full document review mode', {
      contentLength: prdContent.length,
    });

    const outline = options?.outline?.trim()
      ? options.outline
      : this.buildExpectedOutline();

    const fullReview = await this.reviewFullDocument(prdContent, outline, workspaceOptions);
    
    // 保存审核报告
    await this.saveToWorkspace('PRD_REVIEW.md', fullReview, workspaceOptions);

    const passed = this.isReviewPassed(fullReview);

    return {
      content: fullReview,
      data: {
        type: 'prd_review',
        filename: 'PRD_REVIEW.md',
        timestamp: new Date().toISOString(),
        passed,
        legacyMode: true,
        workspaceDir: this.getWorkspaceDir(workspaceOptions),
      },
    };
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
