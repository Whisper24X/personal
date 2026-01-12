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
  version?: number;
}

export class StepwiseDocumentGenerator {
  private action: BaseAction;
  private config: StepwiseGenerationConfig;

  constructor(action: BaseAction, config: StepwiseGenerationConfig) {
    this.action = action;
    this.config = config;
  }

  /**
   * 执行分步骤生成
   */
  async generate(input: string): Promise<IActionOutput> {
    const startTime = Date.now();
    logger.info('StepwiseDocumentGenerator: Starting stepwise generation', {
      documentType: this.config.documentType,
      documentTitle: this.config.documentTitle,
      workspaceDir: this.config.workspaceDir,
      applicationId: this.config.applicationId,
      version: this.config.version,
      inputLength: input.length,
    });

    try {
      // Step 1: 生成目录
      const step1Start = Date.now();
      logger.info('StepwiseDocumentGenerator: Step 1/7 - Generating outline');
      const outline = await this.generateOutline(input);
      await this.saveToWorkspace('00-outline.md', outline);
      logger.info('StepwiseDocumentGenerator: Step 1/5 completed - Outline generated', {
        outlineLength: outline.length,
        duration: `${Date.now() - step1Start}ms`,
      });

      // Step 2: 解析章节列表
      const step2Start = Date.now();
      logger.info('StepwiseDocumentGenerator: Step 2/5 - Parsing sections');
      const parsedSections = this.parseSections(outline);
      let sections = parsedSections;
      if (this.config.sectionFilter) {
        const filteredSections = this.config.sectionFilter(parsedSections);
        if (filteredSections.length === 0) {
          logger.warn('StepwiseDocumentGenerator: Section filter removed all sections, using parsed sections', {
            parsedCount: parsedSections.length,
          });
        } else {
          sections = filteredSections;
        }
      }
      logger.info('StepwiseDocumentGenerator: Step 2/5 completed - Sections parsed', {
        sectionCount: sections.length,
        sections: sections.map(s => `${s.number}. ${s.title}`),
        duration: `${Date.now() - step2Start}ms`,
      });

      // Step 3: 按章节生成内容
      const step3Start = Date.now();
      logger.info('StepwiseDocumentGenerator: Step 3/5 - Generating section contents', {
        sectionCount: sections.length,
      });
      const sectionContents = await this.generateSections(input, outline, sections);
      logger.info('StepwiseDocumentGenerator: Step 3/5 completed - All sections generated', {
        sectionCount: sectionContents.length,
        totalSectionsLength: sectionContents.reduce((sum, content) => sum + content.length, 0),
        duration: `${Date.now() - step3Start}ms`,
      });

      // Step 4: 审核各个章节（如配置）
      const step4Start = Date.now();
      logger.info('StepwiseDocumentGenerator: Step 4/5 - Reviewing sections');
      const sectionReviews = await this.reviewSections(sectionContents, sections, outline);
      const reviewDocument = await this.generateReviewDocument(sectionReviews, sections);
      logger.info('StepwiseDocumentGenerator: Step 4/5 completed - Section reviews generated', {
        sectionCount: sectionContents.length,
        reviewSectionCount: sectionReviews.length,
        reviewDocumentLength: reviewDocument?.length || 0,
        duration: `${Date.now() - step4Start}ms`,
      });

      // Step 5: 合并所有章节
      const step5Start = Date.now();
      logger.info('StepwiseDocumentGenerator: Step 5/5 - Merging sections');
      const mergedContent = this.mergeSections(outline, sectionContents, sections);
      await this.saveToWorkspace(this.config.mainFileName, mergedContent);
      logger.info('StepwiseDocumentGenerator: Step 5/5 completed - Sections merged', {
        totalLength: mergedContent.length,
        sectionCount: sections.length,
        duration: `${Date.now() - step5Start}ms`,
      });

      const totalDuration = Date.now() - startTime;
      logger.info('StepwiseDocumentGenerator: Stepwise generation completed', {
        finalContentLength: mergedContent.length,
        sectionCount: sections.length,
        workspaceDir: this.config.workspaceDir,
        mainFileName: this.config.mainFileName,
        reviewIncluded: sectionReviews.length > 0,
        improvementIncluded: false, // 改进由角色管理，不在这里执行
        totalDuration: `${totalDuration}ms`,
      });

      // 从 workspace 读取主文件内容
      let allContent: string;
      try {
        allContent = await this.readMainFileFromWorkspace();
        if (!allContent || allContent.trim().length === 0) {
          logger.warn('StepwiseDocumentGenerator: Workspace content is empty, using merged content');
          allContent = mergedContent;
        }
      } catch (error: any) {
        logger.warn('StepwiseDocumentGenerator: Failed to read from workspace, using merged content', {
          error: error.message,
        });
        allContent = mergedContent;
      }

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
    logger.info('StepwiseDocumentGenerator: Step 1 - Generating outline');
    const outlinePrompt = this.config.buildOutlinePrompt(input);
    // 注意：BaseAction 的 aask 是 protected，需要通过类型断言访问
    const outline = await (this.action as any).aask(outlinePrompt, [this.config.systemPrompt]);

    logger.info('StepwiseDocumentGenerator: Outline generated', {
      outlineLength: outline.length,
    });

    return outline;
  }

  /**
   * Step 2: 解析章节列表
   */
  private parseSections(outline: string): Section[] {
    const sections: Section[] = [];
    const lines = outline.split('\n');

    for (const line of lines) {
      const match = line.match(/^##\s+(\d+)\.\s+(.+)$/);
      if (match) {
        sections.push({
          number: parseInt(match[1]),
          title: match[2].trim(),
        });
      }
    }

    // 如果没有解析到章节，使用默认章节
    if (sections.length === 0) {
      logger.warn('StepwiseDocumentGenerator: No sections parsed, using default sections');
      return this.config.defaultSections;
    }

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

    // 保存原始配置
    const llm = (this.action as any).llm;
    const originalMaxTokens = llm?.config?.maxTokens;
    const maxTokensPerSection = parseInt(process.env.MAX_TOKENS_PER_SECTION || '32000');

    logger.info('StepwiseDocumentGenerator: Starting section generation', {
      totalSections: sections.length,
      sections: sections.map(s => `${s.number}. ${s.title}`),
      maxTokensPerSection,
    });

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const sectionStartTime = Date.now();

      logger.info(`StepwiseDocumentGenerator: Generating section ${i + 1}/${sections.length} - ${section.number}. ${section.title}`, {
        sectionNumber: section.number,
        sectionTitle: section.title,
        totalSections: sections.length,
        currentProgress: `${i + 1}/${sections.length}`,
        maxTokens: maxTokensPerSection,
      });

      try {
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

        // 使用 acompletion 以便传递 max_tokens
        // 注意：BaseAction 的 acompletion 是 protected，需要通过类型断言访问
        const response = await (this.action as any).acompletion(messages);
        const sectionContent = response.content;

        sectionContents.push(sectionContent);

        // 保存每个章节到文件
        const sectionFileName = `${String(section.number).padStart(2, '0')}-section-${section.number}.md`;
        await this.saveToWorkspace(sectionFileName, sectionContent);

        const sectionDuration = Date.now() - sectionStartTime;
        logger.info(`StepwiseDocumentGenerator: Section ${section.number} generated successfully`, {
          sectionNumber: section.number,
          sectionTitle: section.title,
          contentLength: sectionContent.length,
          tokensUsed: response.usage?.totalTokens || 0,
          fileName: sectionFileName,
          duration: `${sectionDuration}ms`,
          progress: `${i + 1}/${sections.length}`,
        });
      } catch (error: any) {
        const sectionDuration = Date.now() - sectionStartTime;
        logger.error(`StepwiseDocumentGenerator: Failed to generate section ${section.number}`, {
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

    // 如果没有配置章节审核提示词，跳过审核
    if (!this.config.buildSectionReviewPrompt) {
      logger.warn('StepwiseDocumentGenerator: buildSectionReviewPrompt not configured, skipping section reviews');
      return sectionReviews;
    }

    const reviewSystemPrompt = this.config.reviewSystemPrompt || this.config.systemPrompt;

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const sectionContent = sectionContents[i] || '';

      // Log review start
      logger.info(`StepwiseDocumentGenerator: Starting review for section ${section.number}`, {
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

        const reviewStartTime = Date.now();
        const response = await (this.action as any).acompletion(messages);
        const reviewResult = response.content;
        const reviewTime = Date.now() - reviewStartTime;

        sectionReviews.push(reviewResult);

        // 保存每个章节的审核结果
        const reviewFileName = `${String(section.number).padStart(2, '0')}-section-${section.number}-review.md`;
        await this.saveToWorkspace(reviewFileName, reviewResult);

        logger.info(`StepwiseDocumentGenerator: Section ${section.number} reviewed successfully`, {
          sectionNumber: section.number,
          sectionTitle: section.title,
          reviewLength: reviewResult.length,
          reviewTimeMs: reviewTime,
          progress: `${i + 1}/${sections.length}`,
        });
      } catch (error: any) {
        logger.error(`StepwiseDocumentGenerator: Failed to review section ${section.number}`, {
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

    logger.info('StepwiseDocumentGenerator: Review document generated', {
      reviewFileName,
      reviewReportLength: reviewReportContent.length,
      sectionCount: sections.length,
    });

    return reviewReportContent;
  }

  /**
   * Step 6: 改进各个章节（根据审核文档）
   * 注意：此方法已移除，改进由角色通过消息机制管理
   */

  /**
   * 从文档中提取各个章节内容
   */
  private extractSections(document: string, sections: Section[]): string[] {
    const extracted: string[] = [];
    const lines = document.split('\n');

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const sectionTitle = `## ${section.number}. ${section.title}`;
      const nextSectionTitle = i < sections.length - 1
        ? `## ${sections[i + 1].number}. ${sections[i + 1].title}`
        : null;

      // 查找当前章节的开始位置
      let startIndex = -1;
      for (let j = 0; j < lines.length; j++) {
        if (lines[j].trim() === sectionTitle) {
          startIndex = j;
          break;
        }
      }

      if (startIndex === -1) {
        // 如果找不到章节，使用空内容
        extracted.push('');
        continue;
      }

      // 查找下一个章节的开始位置（或文档结束）
      let endIndex = lines.length;
      if (nextSectionTitle) {
        for (let j = startIndex + 1; j < lines.length; j++) {
          if (lines[j].trim() === nextSectionTitle) {
            endIndex = j;
            break;
          }
        }
      }

      // 提取章节内容
      const sectionLines = lines.slice(startIndex, endIndex);
      const sectionContent = sectionLines.join('\n').trim();
      extracted.push(sectionContent);
    }

    return extracted;
  }

  /**
   * Step 7: 合并章节内容
   */
  private mergeSections(_outline: string, sectionContents: string[], sections: Section[]): string {
    const mergedParts: string[] = [];

    // 添加文档标题
    mergedParts.push(`# ${this.config.documentTitle}\n`);

    // 合并所有章节
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      let content = sectionContents[i] || '';

      // 如果没有内容，使用占位符
      if (!content || content.trim() === '') {
        content = `## ${section.number}. ${section.title}\n\n[待补充]`;
      } else {
        // 清理内容：移除开头的空白行
        content = content.trim();

        // 确保章节标题格式正确
        const expectedTitle = `## ${section.number}. ${section.title}`;
        if (content.startsWith('##')) {
          // 如果已有章节标题，检查是否正确
          const firstLine = content.split('\n')[0];
          if (firstLine !== expectedTitle) {
            // 替换为正确的标题
            content = content.replace(/^##\s+\d+\.\s+.+/, expectedTitle);
          }
        } else {
          // 如果没有章节标题，添加
          content = `${expectedTitle}\n\n${content}`;
        }
      }

      mergedParts.push(content);

      // 章节之间添加分隔（除了最后一个）
      if (i < sections.length - 1) {
        mergedParts.push('\n---\n');
      }
    }

    return mergedParts.join('\n\n');
  }


  /**
   * 保存文件到 workspace
   */
  private async saveToWorkspace(filePath: string, content: string): Promise<void> {
    try {
      const fullPath = path.join(this.config.workspaceDir, filePath);
      const dir = path.dirname(fullPath);

      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(fullPath, content, 'utf-8');

      logger.info('StepwiseDocumentGenerator: Saved file to workspace', {
        filePath: fullPath,
        contentLength: content.length,
      });
    } catch (error: any) {
      logger.error('StepwiseDocumentGenerator: Failed to save file to workspace', {
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
      // 检查目录是否存在
      try {
        await fs.access(this.config.workspaceDir);
      } catch {
        logger.warn('StepwiseDocumentGenerator: Workspace directory does not exist', {
          workspaceDir: this.config.workspaceDir,
        });
        return '';
      }

      // 直接读取主文件（PRD.md）
      const mainFilePath = path.join(this.config.workspaceDir, this.config.mainFileName);
      try {
        const content = await fs.readFile(mainFilePath, 'utf-8');
        logger.info('StepwiseDocumentGenerator: Read main file from workspace', {
          mainFileName: this.config.mainFileName,
          contentLength: content.length,
        });
        return content;
      } catch (error: any) {
        logger.warn('StepwiseDocumentGenerator: Main file not found, trying to read all files', {
          mainFileName: this.config.mainFileName,
          error: error.message,
        });
        // 如果主文件不存在，尝试读取所有文件（向后兼容）
        return await this.readAllFromWorkspace();
      }
    } catch (error: any) {
      logger.error('StepwiseDocumentGenerator: Failed to read main file from workspace', {
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
      // 检查目录是否存在
      try {
        await fs.access(this.config.workspaceDir);
      } catch {
        logger.warn('StepwiseDocumentGenerator: Workspace directory does not exist', {
          workspaceDir: this.config.workspaceDir,
        });
        return '';
      }

      const files: string[] = [];
      const entries = await fs.readdir(this.config.workspaceDir, { withFileTypes: true });

      // 按文件名排序（确保顺序：outline -> sections -> main -> review）
      // 不再排除 final 文件，因为不再生成
      const sortedEntries = entries
        .filter(entry => entry.isFile() && entry.name.endsWith('.md'))
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
      logger.error('StepwiseDocumentGenerator: Failed to read files from workspace', {
        error: error.message,
        workspaceDir: this.config.workspaceDir,
      });
      return '';
    }
  }
}

/**
 * 获取工作目录路径的通用函数
 * 新的目录结构：workspace/{applicationId}/{projectId}/v{version}/{documentType}/
 * applicationId 和 projectId 必须提供，不能使用 'default'，以防止不同应用/项目互相覆盖文件
 */
export function getWorkspaceDir(
  documentType: string,
  options?: {
    applicationId?: string;
    projectId?: string;
    version?: number;
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

  const workspaceRoot = options?.workspacePath || process.env.WORKSPACE_PATH || path.join(projectRoot, 'workspace');
  
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
  const version = options?.version || 1;
  // 新的目录结构：workspace/{applicationId}/{projectId}/v{version}/{documentType}/
  return path.join(workspaceRoot, applicationId, projectId, `v${version}`, documentType);
}
