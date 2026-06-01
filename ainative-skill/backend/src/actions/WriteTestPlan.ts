/**
 * WriteTestPlan Action
 * Creates a comprehensive test plan based on PRD, code, and testability review
 *
 * 工作流程：
 * 1) CLI模式：使用 DocumentWriteHandler 直接生成（只传PRD文件夹路径）
 *    - CLI工具从 prd 目录读取 PRD.md 作为输入
 *    - 生成 TEST_PLAN.md 到 test 目录
 * 2) LLM模式：
 *    - 从 workspace 读取 PRD.md 和 TESTABILITY_REVIEW.md
 *    - 调用 LLM 生成测试计划
 * 3) 保存到 workspace/test/TEST_PLAN.md
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import { WorkspaceOptions, logger } from '../utils';
import {
  TEST_PLAN_SYSTEM_PROMPT,
  buildTestPlanPrompt,
} from '../prompts/test';
import {
  DocumentWriteHandler,
  DOCUMENT_CONFIGS,
  WriteConfig,
} from '../utils/document';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface WriteTestPlanOptions extends WorkspaceOptions {
  // Inherits all options from WorkspaceOptions
}

export class WriteTestPlan extends BaseAction {
  constructor() {
    super(
      'WriteTestPlan',
      'Create a comprehensive test plan including test scope, test strategy, and test resources'
    );
  }

  /**
   * 创建 WriteHandler
   * CLI模式下使用文件路径而非内容进行生成
   */
  private async createWriteHandler(): Promise<DocumentWriteHandler> {
    const systemPrompt = await this.loadSystemPrompt('test', 'test_plan_system_prompt', TEST_PLAN_SYSTEM_PROMPT);

    const config: WriteConfig = {
      ...DOCUMENT_CONFIGS.TEST_PLAN,
      buildWritePrompt: (input: string) => buildTestPlanPrompt(input, '', ''),
      systemPrompt,
    };

    return new DocumentWriteHandler(this, config);
  }

  async run(input: string, options?: WriteTestPlanOptions): Promise<IActionOutput> {
    // 使用 BaseAction 提供的验证方法
    const workspaceOptions = this.validateWorkspaceOptions(options, 'TEST');
    const { applicationId, projectId } = workspaceOptions;

    const isCLIMode = this.isCLIMode();

    logger.info('WriteTestPlan: Starting test plan generation', {
      applicationId,
      projectId,
      isCLIMode,
      inputLength: input?.length || 0,
    });

    try {
      // CLI模式：使用 DocumentWriteHandler（只传文件路径，不传内容）
      // CLI工具会从 prd 目录读取 PRD.md 作为输入
      if (isCLIMode) {
        const handler = await this.getCachedHandler('write', () => this.createWriteHandler());
        return await this.executeWriteHandler(handler, '', workspaceOptions, {
          type: 'test_plan',
        });
      }

      // LLM模式：解析输入或从workspace读取
      let prd = '';
      let code = '';
      let testabilityReview = '';

      // Try to read testability review from workspace
      try {
        const reviewFromWorkspace = await this.readWorkspaceFile('TESTABILITY_REVIEW.md', {
          ...workspaceOptions,
          documentType: 'TEST',
        });
        if (reviewFromWorkspace) {
          testabilityReview = reviewFromWorkspace;
          logger.info('WriteTestPlan: Loaded testability review from workspace', {
            reviewLength: testabilityReview.length,
          });
        }
      } catch (error: any) {
        logger.warn('WriteTestPlan: Failed to read testability review from workspace', {
          error: error.message,
        });
      }

      // Parse input for PRD and code
      if (input && input.includes('PRD文档：') && input.includes('代码实现：')) {
        const parts = input.split('代码实现：');
        prd = parts[0].replace('PRD文档：', '').trim();
        code = parts[1]?.trim() || '';
      } else if (input && input.includes('PRD文档：')) {
        prd = input.replace('PRD文档：', '').trim();
      } else if (input) {
        code = input;
      }

      // Try to read PRD from workspace if not in input
      if (!prd) {
        try {
          const prdFromWorkspace = await this.readWorkspaceFile('PRD.md', {
            ...workspaceOptions,
            documentType: 'PRD',
          });
          if (prdFromWorkspace) {
            prd = prdFromWorkspace;
            logger.info('WriteTestPlan: Loaded PRD from workspace', {
              prdLength: prd.length,
            });
          }
        } catch (error: any) {
          logger.warn('WriteTestPlan: Failed to read PRD from workspace', {
            error: error.message,
          });
        }
      }

      if (!prd && !code) {
        throw new Error('Neither PRD nor code found for test plan generation');
      }

      // Build prompt
      const prompt = buildTestPlanPrompt(prd, code, testabilityReview);

      // Load system prompt from database or use default
      const systemPrompt = await this.loadSystemPrompt('test', 'test_plan_system_prompt', TEST_PLAN_SYSTEM_PROMPT);

      // Call LLM to generate test plan
      const content = await this.aask(prompt, [systemPrompt]);

      // Save to workspace
      await this.saveToWorkspace('TEST_PLAN.md', content, workspaceOptions);

      logger.info('WriteTestPlan: Test plan generation completed', {
        contentLength: content.length,
        workspaceDir: this.getWorkspaceDir(workspaceOptions),
      });

      // 尝试从 workspace 读取 TEST_PLAN.md 主文件内容
      let finalContent = content;
      try {
        const workspaceDir = this.getWorkspaceDir(workspaceOptions);
        const mainFilePath = path.join(workspaceDir, 'TEST_PLAN.md');
        const mainFileContent = await fs.readFile(mainFilePath, 'utf-8');
        if (mainFileContent && mainFileContent.length > 0) {
          finalContent = mainFileContent;
          logger.info('WriteTestPlan: Loaded TEST_PLAN.md from workspace', {
            contentLength: finalContent.length,
          });
        }
      } catch (error: any) {
        logger.debug('WriteTestPlan: TEST_PLAN.md not found in workspace, using direct content', {
          error: error.message,
        });
      }

      return this.createActionOutput(finalContent, {
        type: 'test_plan',
        filename: 'TEST_PLAN.md',
        workspaceDir: this.getWorkspaceDir(workspaceOptions),
      });
    } catch (error: any) {
      logger.error('WriteTestPlan: Failed to generate test plan', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }
}
