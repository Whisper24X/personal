/**
 * WriteRequirementSpec Action
 * 编写需求说明文档
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import {
  REQUIREMENT_SPEC_SYSTEM_PROMPT,
  buildRequirementSpecPrompt,
  buildRequirementSpecOutlinePrompt,
  buildRequirementSpecSectionPrompt,
} from '../prompts/requirement';
import { logger } from '../utils';
import { RequirementSpecReview } from './RequirementSpecReview';
import { StepwiseDocumentGenerator } from '../utils/StepwiseDocumentGenerator';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';

export interface WriteRequirementSpecOptions {
  mode?: 'new' | 'update';
  historyRequirementSpec?: string;
  useStepwiseGeneration?: boolean; // 是否使用分步骤生成
  applicationId?: string; // 应用ID，用于文件夹命名
  version?: number; // 版本号，用于文件夹命名
  workspacePath?: string; // workspace 路径，默认 ./workspace
}

export class WriteRequirementSpec extends BaseAction {
  constructor() {
    super(
      'WriteRequirementSpec',
      '编写需求说明文档：分析用户原始需求，进行市场调研，输出详细的需求说明文档'
    );
  }

  async run(userIdea: string, options?: WriteRequirementSpecOptions): Promise<IActionOutput> {
    const mode = options?.mode || 'new';
    const useStepwise = options?.useStepwiseGeneration ?? true; // 默认启用分步骤生成

    logger.info('WriteRequirementSpec: Starting requirement spec generation', {
      mode,
      useStepwise,
      hasHistoryRequirementSpec: !!options?.historyRequirementSpec,
      requestTimeout: process.env.REQUEST_TIMEOUT || '300',
      inputLength: userIdea.length,
    });

    if (!userIdea || userIdea.trim() === '') {
      throw new Error('未找到用户需求');
    }

    try {
      // 如果启用分步骤生成且是新模式，使用分步骤生成
      if (useStepwise && mode === 'new' && !options?.historyRequirementSpec) {
        return await this.generateStepwise(userIdea, options);
      }

      // 否则使用传统的一次性生成
      const prompt = buildRequirementSpecPrompt(userIdea);
      const content = await this.aask(prompt, [REQUIREMENT_SPEC_SYSTEM_PROMPT]);

      // 保存到 workspace
      await this.saveToWorkspace('REQUIREMENT_SPEC.md', content, options);

      logger.info('WriteRequirementSpec: Requirement spec generation completed', {
        mode,
        contentLength: content.length,
        workspaceDir: this.getWorkspaceDir(options),
      });

      // 尝试从 workspace 读取所有内容，如果失败则返回当前内容
      let finalContent = content;
      try {
        const workspaceContent = await this.readAllFromWorkspace(options);
        if (workspaceContent && workspaceContent.length > 0) {
          finalContent = workspaceContent;
        }
      } catch (error: any) {
        logger.warn('WriteRequirementSpec: Failed to read from workspace, using direct content', {
          error: error.message,
        });
      }

      return {
        content: finalContent,
        data: {
          type: 'requirement',
          filename: 'REQUIREMENT_SPEC.md',
          timestamp: new Date().toISOString(),
          mode,
          workspaceDir: this.getWorkspaceDir(options),
        },
      };
    } catch (error: any) {
      const isTimeout = error.message?.includes('timeout') || error.message?.includes('exceeded');

      logger.error('WriteRequirementSpec: Failed to generate requirement spec', {
        mode,
        error: error.message,
        isTimeout,
        requestTimeout: process.env.REQUEST_TIMEOUT || '300',
        stack: error.stack,
      });

      if (isTimeout) {
        const timeoutError = new Error(
          `需求说明文档生成超时。当前超时设置: ${process.env.REQUEST_TIMEOUT || '300'}秒。\n` +
          `建议解决方案：\n` +
          `1. 在项目根目录的 .env 文件中设置 REQUEST_TIMEOUT=600（10分钟）或更高\n` +
          `2. 重启后端服务使配置生效\n` +
          `3. 如果问题持续，可以尝试分段生成或简化需求描述\n\n` +
          `原始错误: ${error.message}`
        );
        timeoutError.name = 'RequirementSpecGenerationTimeoutError';
        throw timeoutError;
      }

      throw error;
    }
  }

  /**
   * 获取工作目录路径
   * 使用根目录的 workspace 目录，文件夹命名格式：应用-版本号-类型（如 default-v1-REQUIREMENT）
   */
  private getWorkspaceDir(options?: WriteRequirementSpecOptions): string {
    const possibleRoots = [
      path.resolve(__dirname, '../../../'),
      path.resolve(__dirname, '../../../../'),
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
    const type = 'REQUIREMENT';
    return path.join(workspaceRoot, `${applicationId}-v${version}-${type}`);
  }

  /**
   * 保存文件到 workspace
   */
  private async saveToWorkspace(
    filePath: string,
    content: string,
    options?: WriteRequirementSpecOptions
  ): Promise<void> {
    try {
      const workspaceDir = this.getWorkspaceDir(options);
      const fullPath = path.join(workspaceDir, filePath);
      const dir = path.dirname(fullPath);

      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(fullPath, content, 'utf-8');

      logger.info('WriteRequirementSpec: Saved file to workspace', {
        filePath: fullPath,
        contentLength: content.length,
      });
    } catch (error: any) {
      logger.error('WriteRequirementSpec: Failed to save file to workspace', {
        filePath,
        error: error.message,
      });
    }
  }

  /**
   * 读取 workspace 中的所有文件内容
   */
  private async readAllFromWorkspace(options?: WriteRequirementSpecOptions): Promise<string> {
    try {
      const workspaceDir = this.getWorkspaceDir(options);

      try {
        await fs.access(workspaceDir);
      } catch {
        logger.warn('WriteRequirementSpec: Workspace directory does not exist', {
          workspaceDir,
        });
        return '';
      }

      const files: string[] = [];
      const entries = await fs.readdir(workspaceDir, { withFileTypes: true });

      const sortedEntries = entries
        .filter(entry => entry.isFile() && entry.name.endsWith('.md') && !entry.name.endsWith('-final.md'))
        .sort((a, b) => {
          if (a.name === '00-outline.md') return -1;
          if (b.name === '00-outline.md') return 1;
          return a.name.localeCompare(b.name);
        });

      for (const entry of sortedEntries) {
        const filePath = path.join(workspaceDir, entry.name);
        const content = await fs.readFile(filePath, 'utf-8');
        if (content.startsWith('#')) {
          files.push(content);
        } else {
          files.push(`# ${entry.name.replace('.md', '')}\n\n${content}`);
        }
      }

      return files.join('\n\n---\n\n');
    } catch (error: any) {
      logger.error('WriteRequirementSpec: Failed to read files from workspace', {
        error: error.message,
        workspaceDir: this.getWorkspaceDir(options),
      });
      return '';
    }
  }

  /**
   * 分步骤生成需求说明文档
   * 使用通用的 StepwiseDocumentGenerator
   */
  private async generateStepwise(input: string, options?: WriteRequirementSpecOptions): Promise<IActionOutput> {
    const workspaceDir = this.getWorkspaceDir(options);
    const reviewAction = new RequirementSpecReview();

    const generator = new StepwiseDocumentGenerator(this, {
      buildOutlinePrompt: buildRequirementSpecOutlinePrompt,
      buildSectionPrompt: buildRequirementSpecSectionPrompt,
      systemPrompt: REQUIREMENT_SPEC_SYSTEM_PROMPT,
      reviewAction: reviewAction,
      reviewTitle: '需求说明文档审查报告',
      documentTitle: '需求说明文档',
      documentType: 'REQUIREMENT',
      mainFileName: 'REQUIREMENT_SPEC.md',
      defaultSections: [
        { number: 1, title: '需求概述' },
        { number: 2, title: '用户分析' },
        { number: 3, title: '功能需求概述' },
        { number: 4, title: '市场分析' },
        { number: 5, title: '可行性分析' },
        { number: 6, title: '项目范围' },
      ],
      workspaceDir,
      applicationId: options?.applicationId,
      version: options?.version,
    });

    return await generator.generate(input);
  }
}

