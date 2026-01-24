/**
 * WriteTest Action
 * Write test cases
 *
 * 工作流程：
 * 1) CLI模式：使用 DocumentWriteHandler 直接生成（只传PRD文件夹路径）
 * 2) LLM模式：
 *    - 从 workspace 读取 PRD.md 和代码文件（优先 workspace，失败或不存在则回退到 input）
 *    - 支持 new 和 update 模式
 *    - 调用 LLM 生成测试用例
 * 3) 保存到 workspace/TEST/TEST.md
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
import { logger, WorkspaceOptions } from '../utils';
import { TestCaseStepwiseGenerator } from '../utils/TestCaseStepwiseGenerator';
import {
  DocumentWriteHandler,
  DOCUMENT_CONFIGS,
  WriteConfig,
} from '../utils/document';

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

  /**
   * 创建 WriteHandler
   */
  private async createWriteHandler(): Promise<DocumentWriteHandler> {
    const systemPrompt = await this.loadSystemPrompt('test', 'system_prompt', TEST_SYSTEM_PROMPT);

    const config: WriteConfig = {
      ...DOCUMENT_CONFIGS.TEST,
      buildWritePrompt: (input: string) => buildTestPrompt(input, ''),
      systemPrompt,
    };

    return new DocumentWriteHandler(this, config);
  }

  async run(input: string, options?: WriteTestOptions): Promise<IActionOutput> {
    const mode = options?.mode || 'new';
    const useStepwise = options?.useStepwiseGeneration ?? false; // 默认不启用分步骤生成

    // 使用 BaseAction 提供的验证方法
    const workspaceOptions = this.validateWorkspaceOptions(options, 'TEST');
    const { applicationId, projectId } = workspaceOptions;

    const isCLIMode = this.isCLIMode();

    logger.info('WriteTest: Starting test generation', {
      applicationId,
      projectId,
      mode,
      useStepwise,
      isCLIMode,
      inputLength: input.length,
    });

    try {
      // CLI模式：使用 BaseAction 封装的执行方法
      // 不使用 StepwiseDocumentGenerator
      if (isCLIMode && mode === 'new') {
        const handler = await this.getCachedHandler('write', () => this.createWriteHandler());
        return await this.executeWriteHandler(handler, '', workspaceOptions, {
          type: 'test',
          mode,
        });
      }

      // LLM模式：优先从 workspace 读取 PRD.md 和代码文件
      const prd = await this.loadDocumentFromWorkspace('PRD.md', workspaceOptions, 'PRD');
      let code = await this.loadCodeFilesFromWorkspace(workspaceOptions);

      // 如果 workspace 中没有找到代码，尝试从 input 解析
      if (!code) {
        if (input.includes('代码实现：')) {
          const parts = input.split('代码实现：');
          code = parts[1]?.trim() || '';
          logger.info('WriteTest: Parsed code from input', {
            codeLength: code.length,
          });
        } else if (!input.includes('PRD文档：')) {
          code = input;
          logger.info('WriteTest: Using input as code', {
            codeLength: code.length,
          });
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
      if (mode === 'update' && !historyTest) {
        historyTest = await this.loadDocumentFromWorkspace('TEST.md', workspaceOptions);
        if (historyTest) {
          logger.info('WriteTest: Loaded existing test cases from workspace for update', {
            testLength: historyTest.length,
          });
        }
      }

      // Build prompt
      let prompt: string;
      if (mode === 'update' && historyTest) {
        prompt = `请基于以下现有测试用例和新的${prd ? 'PRD（产品需求文档）和' : ''}代码实现，更新和完善测试用例：

## 现有测试用例：
${historyTest}

${prd ? `## PRD（产品需求文档）：
${prd}

` : ''}## 代码实现：
${code}

请根据新的 PRD 和代码实现，更新现有测试用例，补充缺失的测试用例，并确保测试用例的完整性和准确性。`;
      } else {
        prompt = buildTestPrompt(code, prd);
      }

      // Load system prompt from database or use default
      const systemPrompt = await this.loadSystemPrompt('test', 'system_prompt', TEST_SYSTEM_PROMPT);

      // Call LLM to generate test cases
      const content = await this.aask(prompt, [systemPrompt]);

      // Save to workspace
      await this.saveToWorkspace('TEST.md', content, workspaceOptions);

      logger.info('WriteTest: Test generation completed', {
        mode,
        contentLength: content.length,
        workspaceDir: this.getWorkspaceDir(workspaceOptions),
      });

      return this.createActionOutput(content, {
        type: 'test',
        filename: 'TEST.md',
        mode,
        workspaceDir: this.getWorkspaceDir(workspaceOptions),
      });
    } catch (error: any) {
      logger.error('WriteTest: Failed to generate tests', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * 分步骤生成测试用例
   * 使用 TestCaseStepwiseGenerator（仅LLM模式）
   */
  private async generateStepwise(
    prd: string,
    code: string,
    options?: WriteTestOptions
  ): Promise<IActionOutput> {
    const workspaceDir = this.getWorkspaceDir({ ...options, documentType: 'TEST' });

    // Load system prompts from database or use defaults
    const systemPrompt = await this.loadSystemPrompt('test', 'system_prompt', TEST_SYSTEM_PROMPT);
    const reviewSystemPrompt = await this.loadSystemPrompt('test', 'review_system_prompt', TEST_REVIEW_SYSTEM_PROMPT);
    const improveSystemPrompt = await this.loadSystemPrompt('test', 'improve_system_prompt', TEST_IMPROVE_SYSTEM_PROMPT);

    // Get role from context (if available)
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
      role,
      prd,
      code,
    });

    return await generator.generate();
  }
}
