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
  systemPrompt: string;

  // 审查（可选）
  reviewAction?: BaseAction;
  reviewTitle?: string; // 审查报告标题，如 "PRD 审查报告"

  // 文档元信息
  documentTitle: string; // 如 "产品需求文档（PRD）"
  documentType: string; // 如 "PRD", "REQUIREMENT"
  mainFileName: string; // 如 "PRD.md", "REQUIREMENT_SPEC.md"

  // 默认章节（当无法解析目录时使用）
  defaultSections: Section[];

  // Workspace 配置
  workspaceDir: string;
  applicationId?: string;
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
    logger.info('StepwiseDocumentGenerator: Starting stepwise generation', {
      documentType: this.config.documentType,
      workspaceDir: this.config.workspaceDir,
    });

    try {
      // Step 1: 生成目录
      const outline = await this.generateOutline(input);
      await this.saveToWorkspace('00-outline.md', outline);

      // Step 2: 解析章节列表
      const sections = this.parseSections(outline);
      logger.info('StepwiseDocumentGenerator: Parsed sections', {
        sectionCount: sections.length,
        sections: sections.map(s => `${s.number}. ${s.title}`),
      });

      // Step 3: 按章节生成内容
      const sectionContents = await this.generateSections(input, outline, sections);

      // Step 4: 合并所有章节
      const mergedContent = this.mergeSections(outline, sectionContents, sections);
      await this.saveToWorkspace(this.config.mainFileName, mergedContent);

      logger.info('StepwiseDocumentGenerator: All sections merged', {
        totalLength: mergedContent.length,
        sectionCount: sections.length,
      });

      // Step 5: 审查（如果配置了）
      let finalContent = mergedContent;
      if (this.config.reviewAction) {
        finalContent = await this.runReview(mergedContent, outline);
      }

      // 保存最终内容
      const finalFileName = this.config.mainFileName.replace('.md', '-final.md');
      await this.saveToWorkspace(finalFileName, finalContent);

      logger.info('StepwiseDocumentGenerator: Stepwise generation completed', {
        finalContentLength: finalContent.length,
        sectionCount: sections.length,
        workspaceDir: this.config.workspaceDir,
      });

      // 从 workspace 读取所有文件内容
      let allContent: string;
      try {
        allContent = await this.readAllFromWorkspace();
        if (!allContent || allContent.trim().length === 0) {
          logger.warn('StepwiseDocumentGenerator: Workspace content is empty, using merged content');
          allContent = finalContent;
        }
      } catch (error: any) {
        logger.warn('StepwiseDocumentGenerator: Failed to read from workspace, using merged content', {
          error: error.message,
        });
        allContent = finalContent;
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
          reviewIncluded: !!this.config.reviewAction,
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

    // 保存原始配置
    const llm = (this.action as any).llm;
    const originalMaxTokens = llm?.config?.maxTokens;
    const maxTokensPerSection = parseInt(process.env.MAX_TOKENS_PER_SECTION || '32000');

    for (const section of sections) {
      logger.info(`StepwiseDocumentGenerator: Generating section ${section.number} - ${section.title}`, {
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

        logger.info(`StepwiseDocumentGenerator: Section ${section.number} generated`, {
          contentLength: sectionContent.length,
          tokensUsed: response.usage?.totalTokens || 0,
          fileName: sectionFileName,
        });
      } catch (error: any) {
        logger.error(`StepwiseDocumentGenerator: Failed to generate section ${section.number}`, {
          error: error.message,
          section: section.title,
        });
        // 如果某个章节生成失败，使用占位符
        sectionContents.push(`## ${section.number}. ${section.title}\n\n[生成失败: ${error.message}]`);
      }
    }

    // 恢复原始配置
    if (llm && llm.config && originalMaxTokens !== undefined) {
      llm.config.maxTokens = originalMaxTokens;
    }

    return sectionContents;
  }

  /**
   * Step 4: 合并章节内容
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
   * Step 5: 运行审查
   */
  private async runReview(content: string, outline: string): Promise<string> {
    if (!this.config.reviewAction) {
      return content;
    }

    logger.info('StepwiseDocumentGenerator: Running review');

    try {
      this.config.reviewAction.setLLM((this.action as any).llm);

      // 假设 reviewAction.run 接受 (content, { outline }) 参数
      const reviewResult = await (this.config.reviewAction as any).run(content, { outline });

      logger.info('StepwiseDocumentGenerator: Review completed', {
        reviewLength: reviewResult.content.length,
      });

      // 保存审查报告到文件
      const reviewFileName = this.config.mainFileName.replace('.md', '-review.md');
      await this.saveToWorkspace(reviewFileName, reviewResult.content);

      // 将审查结果附加到内容
      const reviewTitle = this.config.reviewTitle || `${this.config.documentTitle}审查报告`;
      return [
        content,
        '',
        '---',
        '',
        `# ${reviewTitle}`,
        '',
        reviewResult.content,
      ].join('\n');
    } catch (reviewError: any) {
      logger.warn('StepwiseDocumentGenerator: Review failed, continuing without review', {
        error: reviewError.message,
      });
      return content;
    }
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
   * 读取 workspace 中的所有文件内容
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

      // 按文件名排序（确保顺序：outline -> sections -> main -> review，排除 final 文件）
      const finalFileName = this.config.mainFileName.replace('.md', '-final.md');
      const sortedEntries = entries
        .filter(entry => entry.isFile() && entry.name.endsWith('.md') && entry.name !== finalFileName)
        .sort((a, b) => {
          if (a.name === '00-outline.md') return -1;
          if (b.name === '00-outline.md') return 1;
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
 * 新的目录结构：workspace/{applicationId}/v{version}/{documentType}/
 * 例如：workspace/default/v1/PRD/
 */
export function getWorkspaceDir(
  documentType: string,
  options?: {
    applicationId?: string;
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
  const applicationId = options?.applicationId || 'default';
  const version = options?.version || 1;
  // 新的目录结构：workspace/{applicationId}/v{version}/{documentType}/
  return path.join(workspaceRoot, applicationId, `v${version}`, documentType);
}

