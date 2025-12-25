/**
 * WriteTest Action
 * 编写测试用例
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import { TEST_SYSTEM_PROMPT, buildTestPrompt } from '../prompts/test';
import { logger } from '../utils';

export class WriteTest extends BaseAction {
  constructor() {
    super(
      'WriteTest',
      '编写测试用例',
      '基于代码实现，编写全面的测试用例，包括单元测试和集成测试'
    );
  }

  async run(input: string): Promise<IActionOutput> {
    logger.info('WriteTest: Starting test generation');
    
    if (!input || input.trim() === '') {
      throw new Error('未找到输入内容');
    }

    try {
      // 解析输入：可能包含 PRD 和代码
      let prd = '';
      let code = '';
      
      if (input.includes('PRD文档：') && input.includes('代码实现：')) {
        // 包含 PRD 和代码
        const parts = input.split('代码实现：');
        prd = parts[0].replace('PRD文档：', '').trim();
        code = parts[1]?.trim() || '';
        logger.info('WriteTest: Parsed PRD and code from input', {
          prdLength: prd.length,
          codeLength: code.length,
        });
      } else {
        // 只有代码
        code = input;
        logger.info('WriteTest: Using code only (no PRD found)', {
          codeLength: code.length,
        });
      }

      if (!code || code.trim() === '') {
        throw new Error('未找到代码实现');
      }

      // 构建提示词
      const prompt = buildTestPrompt(code, prd);

    // 调用 LLM 生成测试用例
      const content = await this.aask(prompt, [TEST_SYSTEM_PROMPT]);
      
      logger.info('WriteTest: Test generation completed', {
        contentLength: content.length,
      });
      
      return {
        content: content,
        data: {
          type: 'test',
          filename: 'TEST.md',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      logger.error('WriteTest: Failed to generate tests', error);
      throw error;
    }
  }
}

