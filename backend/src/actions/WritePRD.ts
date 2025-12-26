/**
 * WritePRD Action
 * Generates Product Requirements Document from user idea
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import {
  PRD_SYSTEM_PROMPT,
  buildPRDPrompt,
  buildPRDUpdatePrompt,
  buildPRDWithRAGPrompt,
  buildPRDOutlinePrompt,
  buildPRDSectionPrompt,
} from '../prompts/prd';
import { logger } from '../utils';
import { PRDReview } from './PRDReview';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';

export interface WritePRDOptions {
  mode?: 'new' | 'update';
  historyPRD?: string;
  relevantChunks?: string;
  useRAG?: boolean;
  useStepwiseGeneration?: boolean; // 是否使用分步骤生成
  applicationId?: string; // 应用ID，用于文件夹命名
  version?: number; // 版本号，用于文件夹命名
  workspacePath?: string; // workspace 路径，默认 ./workspace
}

export class WritePRD extends BaseAction {
  constructor() {
    super('WritePRD', 'Generate Product Requirements Document from user idea');
  }

  async run(input: string, options?: WritePRDOptions): Promise<IActionOutput> {
    const mode = options?.mode || 'new';
    const useRAG = options?.useRAG || false;
    const useStepwise = options?.useStepwiseGeneration ?? true; // 默认启用分步骤生成

    logger.info('WritePRD: Starting PRD generation', {
      mode,
      useRAG,
      useStepwise,
      hasHistoryPRD: !!options?.historyPRD,
      hasRelevantChunks: !!options?.relevantChunks,
      requestTimeout: process.env.REQUEST_TIMEOUT || '300',
      inputLength: input.length,
    });

    try {
      // 如果启用分步骤生成且是新模式，使用分步骤生成
      if (useStepwise && mode === 'new' && !options?.historyPRD) {
        return await this.generateStepwise(input, options);
      }

      // 否则使用传统的一次性生成
      let prompt: string;

      if (mode === 'update' && options?.historyPRD) {
        // Update mode: use history PRD + new requirements
        prompt = buildPRDUpdatePrompt(options.historyPRD, input);
        logger.info('WritePRD: Using update mode with history PRD');
      } else if (useRAG && options?.relevantChunks) {
        // RAG mode: use retrieved chunks + new requirements
        prompt = buildPRDWithRAGPrompt(input, options.relevantChunks, input);
        logger.info('WritePRD: Using RAG mode with relevant chunks');
      } else {
        // New mode: standard PRD generation
        prompt = buildPRDPrompt(input);
        logger.info('WritePRD: Using new mode');
      }

      // Call LLM with system message and prompt
      const prdContent = await this.aask(prompt, [PRD_SYSTEM_PROMPT]);

      // 保存到 workspace（即使是非分步骤模式）
      await this.saveToWorkspace('PRD.md', prdContent, options);

      logger.info('WritePRD: PRD generation completed', {
        mode,
        contentLength: prdContent.length,
        workspaceDir: this.getWorkspaceDir(options),
      });

      // 尝试从 workspace 读取所有内容，如果失败则返回当前内容
      let finalContent = prdContent;
      try {
        const workspaceContent = await this.readAllFromWorkspace(options);
        if (workspaceContent && workspaceContent.length > 0) {
          finalContent = workspaceContent;
        }
      } catch (error: any) {
        logger.warn('WritePRD: Failed to read from workspace, using direct content', {
          error: error.message,
        });
      }

      return {
        content: finalContent,
        data: {
          type: 'prd',
          filename: 'PRD.md',
          timestamp: new Date().toISOString(),
          mode,
          workspaceDir: this.getWorkspaceDir(options),
        },
      };
    } catch (error: any) {
      const isTimeout = error.message?.includes('timeout') || error.message?.includes('exceeded');

      logger.error('WritePRD: Failed to generate PRD', {
        mode,
        error: error.message,
        isTimeout,
        requestTimeout: process.env.REQUEST_TIMEOUT || '300',
        stack: error.stack,
      });

      // 如果是超时错误，提供更友好的错误信息
      if (isTimeout) {
        const timeoutError = new Error(
          `PRD 生成超时。当前超时设置: ${process.env.REQUEST_TIMEOUT || '300'}秒。\n` +
          `建议解决方案：\n` +
          `1. 在项目根目录的 .env 文件中设置 REQUEST_TIMEOUT=600（10分钟）或更高\n` +
          `2. 重启后端服务使配置生效\n` +
          `3. 如果问题持续，可以尝试分段生成 PRD 或简化需求描述\n\n` +
          `原始错误: ${error.message}`
        );
        timeoutError.name = 'PRDGenerationTimeoutError';
        throw timeoutError;
      }

      throw error;
    }
  }

  /**
   * 获取工作目录路径
   * 使用根目录的 workspace 目录，文件夹命名格式：应用-版本号-类型（如 default-v1-PRD）
   */
  private getWorkspaceDir(options?: WritePRDOptions): string {
    // 计算项目根目录：从 backend/src/actions 或 backend/dist/actions 到项目根目录
    // 在开发环境：backend/src/actions -> ../../../
    // 在编译后：backend/dist/actions -> ../../../
    // 为了兼容两种情况，先尝试从 __dirname 向上查找，如果找不到则使用 process.cwd()
    const possibleRoots = [
      path.resolve(__dirname, '../../../'), // backend/src/actions 或 backend/dist/actions
      path.resolve(__dirname, '../../../../'), // 如果编译后结构不同
      process.cwd(), // 当前工作目录（通常是项目根目录）
    ];

    // 查找包含 pnpm-workspace.yaml 或 package.json 的目录作为项目根目录
    let projectRoot = possibleRoots[0]; // 默认使用第一个
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
    const type = 'PRD'; // 文档类型
    return path.join(workspaceRoot, `${applicationId}-v${version}-${type}`);
  }

  /**
   * 保存文件到 workspace
   */
  private async saveToWorkspace(
    filePath: string,
    content: string,
    options?: WritePRDOptions
  ): Promise<void> {
    try {
      const workspaceDir = this.getWorkspaceDir(options);
      const fullPath = path.join(workspaceDir, filePath);
      const dir = path.dirname(fullPath);

      // 确保目录存在
      await fs.mkdir(dir, { recursive: true });

      // 写入文件
      await fs.writeFile(fullPath, content, 'utf-8');

      logger.info('WritePRD: Saved file to workspace', {
        filePath: fullPath,
        contentLength: content.length,
      });
    } catch (error: any) {
      logger.error('WritePRD: Failed to save file to workspace', {
        filePath,
        error: error.message,
      });
      // 不抛出错误，继续执行
    }
  }

  /**
   * 读取 workspace 中的所有文件内容
   */
  private async readAllFromWorkspace(options?: WritePRDOptions): Promise<string> {
    try {
      const workspaceDir = this.getWorkspaceDir(options);

      // 检查目录是否存在
      try {
        await fs.access(workspaceDir);
      } catch {
        logger.warn('WritePRD: Workspace directory does not exist', {
          workspaceDir,
        });
        return ''; // 如果目录不存在，返回空字符串
      }

      const files: string[] = [];

      // 读取目录中的所有文件
      const entries = await fs.readdir(workspaceDir, { withFileTypes: true });

      // 按文件名排序（确保顺序：outline -> sections -> PRD -> review -> final）
      const sortedEntries = entries
        .filter(entry => entry.isFile() && entry.name.endsWith('.md'))
        .sort((a, b) => {
          // 特殊排序：00-outline.md 在最前，PRD-final.md 在最后
          if (a.name === '00-outline.md') return -1;
          if (b.name === '00-outline.md') return 1;
          if (a.name === 'PRD-final.md') return 1;
          if (b.name === 'PRD-final.md') return -1;
          return a.name.localeCompare(b.name);
        });

      for (const entry of sortedEntries) {
        const filePath = path.join(workspaceDir, entry.name);
        const content = await fs.readFile(filePath, 'utf-8');
        // 如果文件已经有标题，不重复添加
        if (content.startsWith('#')) {
          files.push(content);
        } else {
          files.push(`# ${entry.name.replace('.md', '')}\n\n${content}`);
        }
      }

      const mergedContent = files.join('\n\n---\n\n');

      logger.info('WritePRD: Read all files from workspace', {
        workspaceDir,
        fileCount: sortedEntries.length,
        totalLength: mergedContent.length,
      });

      return mergedContent;
    } catch (error: any) {
      logger.error('WritePRD: Failed to read files from workspace', {
        error: error.message,
        workspaceDir: this.getWorkspaceDir(options),
      });
      // 如果读取失败，返回空字符串而不是抛出错误
      return '';
    }
  }

  /**
   * 分步骤生成 PRD
   * 1. 生成目录
   * 2. 按章节生成内容
   * 3. 合并并审查
   */
  private async generateStepwise(input: string, options?: WritePRDOptions): Promise<IActionOutput> {
    logger.info('WritePRD: Starting stepwise generation', {
      workspaceDir: this.getWorkspaceDir(options),
    });

    try {
      // Step 1: 生成 PRD 目录
      logger.info('WritePRD: Step 1 - Generating outline');
      const outlinePrompt = buildPRDOutlinePrompt(input);
      const outline = await this.aask(outlinePrompt, [PRD_SYSTEM_PROMPT]);

      // 保存目录到文件
      await this.saveToWorkspace('00-outline.md', outline, options);

      logger.info('WritePRD: Outline generated', {
        outlineLength: outline.length,
      });

      // Step 2: 解析章节列表
      const sections = this.parseSections(outline);
      logger.info('WritePRD: Parsed sections', {
        sectionCount: sections.length,
        sections: sections.map(s => `${s.number}. ${s.title}`),
      });

      // Step 3: 按章节生成内容（串行生成，每个章节独立配置）
      const sectionContents: string[] = [];

      // 保存原始配置
      const originalMaxTokens = this.llm?.config?.maxTokens;
      const maxTokensPerSection = parseInt(process.env.MAX_TOKENS_PER_SECTION || '32000'); // 默认 32k

      for (const section of sections) {
        logger.info(`WritePRD: Generating section ${section.number} - ${section.title}`, {
          maxTokens: maxTokensPerSection,
        });

        try {
          // 为每个章节设置独立的 max_tokens
          if (this.llm && this.llm.config) {
            this.llm.config.maxTokens = maxTokensPerSection;
          }

          const sectionPrompt = buildPRDSectionPrompt(
            input,
            outline,
            section.number,
            section.title
          );

          // 构建消息
          const messages: any[] = [
            {
              role: 'system',
              content: PRD_SYSTEM_PROMPT,
            },
            {
              role: 'user',
              content: sectionPrompt,
            },
          ];

          // 使用 acompletion 以便传递 max_tokens
          const response = await this.acompletion(messages);
          const sectionContent = response.content;

          sectionContents.push(sectionContent);

          // 保存每个章节到文件
          const sectionFileName = `${String(section.number).padStart(2, '0')}-section-${section.number}.md`;
          await this.saveToWorkspace(sectionFileName, sectionContent, options);

          logger.info(`WritePRD: Section ${section.number} generated`, {
            contentLength: sectionContent.length,
            tokensUsed: response.usage?.totalTokens || 0,
            fileName: sectionFileName,
          });
        } catch (error: any) {
          logger.error(`WritePRD: Failed to generate section ${section.number}`, {
            error: error.message,
            section: section.title,
          });
          // 如果某个章节生成失败，使用占位符
          sectionContents.push(`## ${section.number}. ${section.title}\n\n[生成失败: ${error.message}]`);
        }
      }

      // 恢复原始配置
      if (this.llm && this.llm.config && originalMaxTokens !== undefined) {
        this.llm.config.maxTokens = originalMaxTokens;
      }

      // Step 4: 合并所有章节
      const prdContent = this.mergeSections(outline, sectionContents);

      // 保存合并后的 PRD
      await this.saveToWorkspace('PRD.md', prdContent, options);

      logger.info('WritePRD: All sections merged', {
        totalLength: prdContent.length,
        sectionCount: sections.length,
      });

      // Step 5: PRD Review
      logger.info('WritePRD: Step 5 - Running PRD review');
      let finalContent = prdContent;

      try {
        const reviewAction = new PRDReview();
        reviewAction.setLLM(this.llm);

        const reviewResult = await reviewAction.run(prdContent, { outline });

        logger.info('WritePRD: PRD review completed', {
          reviewLength: reviewResult.content.length,
        });

        // 保存审查报告到文件
        await this.saveToWorkspace('PRD-review.md', reviewResult.content, options);

        // 将审查结果附加到 PRD 内容，使用清晰的分隔
        finalContent = [
          prdContent,
          '',
          '---',
          '',
          '# PRD 审查报告',
          '',
          reviewResult.content,
        ].join('\n');
      } catch (reviewError: any) {
        logger.warn('WritePRD: PRD review failed, continuing without review', {
          error: reviewError.message,
        });
        // 审查失败不影响 PRD 返回，只记录警告
      }

      // 保存最终合并内容
      await this.saveToWorkspace('PRD-final.md', finalContent, options);

      logger.info('WritePRD: Stepwise generation completed', {
        finalContentLength: finalContent.length,
        sectionCount: sections.length,
        workspaceDir: this.getWorkspaceDir(options),
      });

      // 从 workspace 读取所有文件内容
      let allContent: string;
      try {
        allContent = await this.readAllFromWorkspace(options);
        // 如果读取失败或为空，使用合并后的内容
        if (!allContent || allContent.trim().length === 0) {
          logger.warn('WritePRD: Workspace content is empty, using merged content');
          allContent = finalContent;
        }
      } catch (error: any) {
        logger.warn('WritePRD: Failed to read from workspace, using merged content', {
          error: error.message,
        });
        allContent = finalContent;
      }

      return {
        content: allContent,
        data: {
          type: 'prd',
          filename: 'PRD.md',
          timestamp: new Date().toISOString(),
          mode: 'new',
          stepwise: true,
          sectionCount: sections.length,
          reviewIncluded: true,
          workspaceDir: this.getWorkspaceDir(options),
        },
      };
    } catch (error: any) {
      logger.error('WritePRD: Stepwise generation failed', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * 解析章节列表
   */
  private parseSections(outline: string): Array<{ number: number; title: string }> {
    const sections: Array<{ number: number; title: string }> = [];
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
      return [
        { number: 0, title: '版本说明' },
        { number: 1, title: '产品概述' },
        { number: 2, title: '目标与成功指标' },
        { number: 3, title: '用户故事' },
        { number: 4, title: '功能需求' },
        { number: 5, title: '页面与交互设计说明' },
        { number: 6, title: '非功能需求' },
        { number: 7, title: '技术实现建议' },
        { number: 8, title: '验收与交付标准' },
        { number: 9, title: '风险与应对' },
        { number: 10, title: '附录' },
      ];
    }

    return sections;
  }

  /**
   * 合并章节内容
   */
  private mergeSections(outline: string, sectionContents: string[]): string {
    const sections = this.parseSections(outline);
    const mergedParts: string[] = [];

    // 添加 PRD 标题
    mergedParts.push('# 产品需求文档（PRD）\n');

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

    // 合并所有部分
    const merged = mergedParts.join('\n\n');

    logger.info('WritePRD: Sections merged', {
      sectionCount: sections.length,
      mergedLength: merged.length,
    });

    return merged;
  }

  /**
   * Build PRD with history context
   * Helper method for generating PRD based on historical PRD
   */
  async buildPRDWithHistory(
    newRequirements: string,
    historyPRD: string
  ): Promise<IActionOutput> {
    return this.run(newRequirements, {
      mode: 'update',
      historyPRD,
    });
  }
}

export default WritePRD;

