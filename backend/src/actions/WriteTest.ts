/**
 * WriteTest Action
 * Write test cases
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import { TEST_SYSTEM_PROMPT, buildTestPrompt } from '../prompts/test';
import { logger, WorkspaceOptions, loadPrompt } from '../utils';

export interface WriteTestOptions extends WorkspaceOptions {
  // Inherits all options from WorkspaceOptions
}

export class WriteTest extends BaseAction {
  constructor() {
    super(
      'WriteTest',
      'Write test cases. Based on code implementation, write comprehensive test cases including unit tests and integration tests'
    );
  }

  async run(input: string, options?: WriteTestOptions): Promise<IActionOutput> {
    logger.info('WriteTest: Starting test generation');

    if (!input || input.trim() === '') {
      throw new Error('Input content not found');
    }

    try {
      // Parse input: may contain PRD and code
      let prd = '';
      let code = '';

      if (input.includes('PRD文档：') && input.includes('代码实现：')) {
        // Contains PRD and code
        const parts = input.split('代码实现：');
        prd = parts[0].replace('PRD文档：', '').trim();
        code = parts[1]?.trim() || '';
        logger.info('WriteTest: Parsed PRD and code from input', {
          prdLength: prd.length,
          codeLength: code.length,
        });
      } else {
        // Code only
        code = input;
        logger.info('WriteTest: Using code only (no PRD found)', {
          codeLength: code.length,
        });
      }

      if (!code || code.trim() === '') {
        throw new Error('Code implementation not found');
      }

      // Build prompt
      const prompt = buildTestPrompt(code, prd);

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
        contentLength: content.length,
        workspaceDir: this.getWorkspaceDir(workspaceOptions),
      });

      return {
        content: content,
        data: {
          type: 'test',
          filename: 'TEST.md',
          timestamp: new Date().toISOString(),
          workspaceDir: this.getWorkspaceDir(workspaceOptions),
        },
      };
    } catch (error: any) {
      logger.error('WriteTest: Failed to generate tests', error);
      throw error;
    }
  }
}

