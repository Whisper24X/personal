/**
 * WriteTest Action
 * Write test cases
 *
 * 工作流程：
 * 1) 从 workspace 读取 PRD.md 和代码文件（优先 workspace，失败或不存在则回退到 input）
 * 2) 支持 new 和 update 模式
 * 3) 调用 LLM 生成测试用例
 * 4) 保存到 workspace/TEST/TEST.md
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import {
  TEST_SYSTEM_PROMPT,
  TEST_REVIEW_SYSTEM_PROMPT,
  TEST_IMPROVE_SYSTEM_PROMPT,
  buildTestPrompt,
  buildTestOutlinePrompt,
  buildTestSectionPrompt,
  buildTestSectionReviewPrompt,
  buildTestSectionImprovePrompt,
} from '../prompts/test';
import { logger, WorkspaceOptions, loadPrompt } from '../utils';
import { WorkspaceManager } from '../utils/WorkspaceManager';
import { TestCaseStepwiseGenerator } from '../utils/TestCaseStepwiseGenerator';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface WriteTestOptions extends WorkspaceOptions {
  mode?: 'new' | 'update';
  historyTest?: string; // 历史测试用例（用于 update 模式）
  useStepwiseGeneration?: boolean; // 是否使用分步骤生成
}

export class WriteTest extends BaseAction {
  constructor() {
    super(
      'WriteTest',
      'Write test cases. Based on code implementation, write comprehensive test cases including unit tests and integration tests'
    );
  }

  async run(input: string, options?: WriteTestOptions): Promise<IActionOutput> {
    const mode = options?.mode || 'new';
    const useStepwise = options?.useStepwiseGeneration ?? false; // 默认不启用分步骤生成

    logger.info('WriteTest: Starting test generation', {
      mode,
      useStepwise,
      inputLength: input.length,
    });

    try {
      // 优先从 workspace 读取 PRD.md 和代码文件
      let prd = '';
      let code = '';

      // 尝试从 workspace 读取 PRD
      const applicationId = options?.applicationId || (this.context?.get('applicationId') as string | undefined);
      const projectId = options?.projectId || (this.context?.get('projectId') as string | undefined);
      const version = options?.version || 1;

      if (applicationId && projectId) {
        try {
          const prdFromWorkspace = await WorkspaceManager.readFile('PRD.md', {
            applicationId,
            projectId,
            version,
            documentType: 'PRD',
            workspacePath: options?.workspacePath,
          });

          if (prdFromWorkspace) {
            prd = prdFromWorkspace;
            logger.info('WriteTest: Loaded PRD from workspace', {
              prdLength: prd.length,
            });
          }
        } catch (error: any) {
          logger.warn('WriteTest: Failed to read PRD from workspace', {
            error: error.message,
          });
        }

        // 尝试从 workspace 读取代码文件
        try {
          const codeFromWorkspace = await this.readCodeFromWorkspace({
            applicationId,
            projectId,
            version,
            documentType: 'CODE',
            workspacePath: options?.workspacePath,
          });

          if (codeFromWorkspace) {
            code = codeFromWorkspace;
            logger.info('WriteTest: Loaded code from workspace', {
              codeLength: code.length,
            });
          }
        } catch (error: any) {
          logger.warn('WriteTest: Failed to read code from workspace', {
            error: error.message,
          });
        }
      }

      // 如果 workspace 中没有找到，尝试从 input 解析
      if (!prd && !code) {
        if (input.includes('PRD文档：') && input.includes('代码实现：')) {
          // Contains PRD and code
          const parts = input.split('代码实现：');
          prd = parts[0].replace('PRD文档：', '').trim();
          code = parts[1]?.trim() || '';
          logger.info('WriteTest: Parsed PRD and code from input', {
            prdLength: prd.length,
            codeLength: code.length,
          });
        } else if (input.includes('PRD文档：')) {
          prd = input.replace('PRD文档：', '').trim();
          logger.info('WriteTest: Parsed PRD from input', {
            prdLength: prd.length,
          });
        } else {
          // Code only
          code = input;
          logger.info('WriteTest: Using code only (no PRD found)', {
            codeLength: code.length,
          });
        }
      } else if (!code && input.trim().length > 0) {
        // 如果只有 PRD 没有代码，尝试从 input 获取代码
        if (input.includes('代码实现：')) {
          const parts = input.split('代码实现：');
          code = parts[1]?.trim() || '';
        } else if (!input.includes('PRD文档：')) {
          code = input;
        }
      }

      if (!code || code.trim() === '') {
        throw new Error('Code implementation not found. Please provide code in input or ensure code files exist in workspace.');
      }

      // 如果启用分步骤生成且是新模式，使用分步骤生成
      if (useStepwise && mode === 'new' && prd) {
        return await this.generateStepwise(prd, code, options);
      }

      // 如果是 update 模式，读取现有的测试用例
      let historyTest = options?.historyTest;
      if (mode === 'update' && !historyTest && applicationId && projectId) {
        try {
          const testFromWorkspace = await WorkspaceManager.readFile('TEST.md', {
            applicationId,
            projectId,
            version,
            documentType: 'TEST',
            workspacePath: options?.workspacePath,
          });

          if (testFromWorkspace) {
            historyTest = testFromWorkspace;
            logger.info('WriteTest: Loaded existing test cases from workspace for update', {
              testLength: historyTest.length,
            });
          }
        } catch (error: any) {
          logger.warn('WriteTest: Failed to read existing test cases from workspace', {
            error: error.message,
          });
        }
      }

      // Build prompt
      let prompt: string;
      if (mode === 'update' && historyTest) {
        // Update mode: use history test + new PRD/code
        prompt = `请基于以下现有测试用例和新的${prd ? 'PRD（产品需求文档）和' : ''}代码实现，更新和完善测试用例：

## 现有测试用例：
${historyTest}

${prd ? `## PRD（产品需求文档）：
${prd}

` : ''}## 代码实现：
${code}

请根据新的 PRD 和代码实现，更新现有测试用例，补充缺失的测试用例，并确保测试用例的完整性和准确性。`;
      } else {
        // New mode: standard test generation
        prompt = buildTestPrompt(code, prd);
      }

      // Load system prompt from database or use default
      const userId = this.context?.get('userId');
      const systemPrompt = await loadPrompt(userId, 'test', 'system_prompt', TEST_SYSTEM_PROMPT);

      // Call LLM to generate test cases
      const content = await this.aask(prompt, [systemPrompt]);

      // Save to workspace
      const workspaceOptions: WorkspaceOptions = {
        ...options,
        documentType: 'TEST',
      };
      await this.saveToWorkspace('TEST.md', content, workspaceOptions);

      logger.info('WriteTest: Test generation completed', {
        mode,
        contentLength: content.length,
        workspaceDir: this.getWorkspaceDir(workspaceOptions),
      });

      return {
        content: content,
        data: {
          type: 'test',
          filename: 'TEST.md',
          timestamp: new Date().toISOString(),
          mode,
          workspaceDir: this.getWorkspaceDir(workspaceOptions),
        },
      };
    } catch (error: any) {
      logger.error('WriteTest: Failed to generate tests', error);
      throw error;
    }
  }

  /**
   * 分步骤生成测试用例
   * 使用 TestCaseStepwiseGenerator
   */
  private async generateStepwise(
    prd: string,
    code: string,
    options?: WriteTestOptions
  ): Promise<IActionOutput> {
    const workspaceDir = this.getWorkspaceDir({ ...options, documentType: 'TEST' });

    // Load system prompts from database or use defaults
    const userId = this.context?.get('userId');
    const systemPrompt = await loadPrompt(userId, 'test', 'system_prompt', TEST_SYSTEM_PROMPT);
    const reviewSystemPrompt = await loadPrompt(
      userId,
      'test',
      'review_system_prompt',
      TEST_REVIEW_SYSTEM_PROMPT
    );
    const improveSystemPrompt = await loadPrompt(
      userId,
      'test',
      'improve_system_prompt',
      TEST_IMPROVE_SYSTEM_PROMPT
    );

    // Get StateManager and role from context (if available)
    const stateManager = this.context?.get('stateManager') as any;
    const role = (this as any).role?.profile || undefined;

    const generator = new TestCaseStepwiseGenerator(this as unknown as BaseAction, {
      buildOutlinePrompt: buildTestOutlinePrompt,
      buildSectionPrompt: buildTestSectionPrompt,
      buildSectionReviewPrompt: buildTestSectionReviewPrompt,
      buildSectionImprovePrompt: buildTestSectionImprovePrompt,
      systemPrompt: systemPrompt,
      reviewSystemPrompt: reviewSystemPrompt,
      improveSystemPrompt: improveSystemPrompt,
      documentTitle: '功能测试用例文档',
      documentType: 'TEST',
      mainFileName: 'TEST.md',
      workspaceDir,
      applicationId: options?.applicationId,
      projectId: options?.projectId || (this.context?.get('projectId') as string | undefined),
      version: options?.version,
      stateManager,
      role,
      prd,
      code,
    });

    return await generator.generate();
  }

  /**
   * 从 workspace 读取代码文件
   */
  private async readCodeFromWorkspace(options: WorkspaceOptions): Promise<string> {
    try {
      const workspaceDir = this.getWorkspaceDir({
        ...options,
        documentType: 'CODE',
      });

      // 检查目录是否存在
      try {
        await fs.access(workspaceDir);
      } catch {
        logger.warn('WriteTest: Code workspace directory does not exist', {
          workspaceDir,
        });
        return '';
      }

      const codeFiles: string[] = [];
      const entries = await fs.readdir(workspaceDir, { withFileTypes: true });

      // 过滤代码文件
      const codeFileExtensions = ['.ts', '.js', '.tsx', '.jsx', '.py', '.java', '.go', '.rs', '.cpp', '.c'];
      const codeEntries = entries.filter(entry => {
        if (!entry.isFile()) return false;
        return codeFileExtensions.some(ext => entry.name.endsWith(ext));
      });

      // 按文件名排序
      codeEntries.sort((a, b) => a.name.localeCompare(b.name));

      for (const entry of codeEntries) {
        const filePath = path.join(workspaceDir, entry.name);
        const content = await fs.readFile(filePath, 'utf-8');
        codeFiles.push(`// File: ${entry.name}\n${content}`);
      }

      const mergedCode = codeFiles.join('\n\n---\n\n');

      logger.info('WriteTest: Read code files from workspace', {
        workspaceDir,
        fileCount: codeEntries.length,
        totalLength: mergedCode.length,
      });

      return mergedCode;
    } catch (error: any) {
      logger.error('WriteTest: Failed to read code files from workspace', {
        error: error.message,
      });
      return '';
    }
  }
}

