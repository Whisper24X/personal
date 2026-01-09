/**
 * FixBug Action
 * Fixes bugs in code based on error reports or test failures
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import { logger, WorkspaceOptions, loadPrompt } from '../utils';

export interface FixBugOptions extends WorkspaceOptions {
  errorReport?: string; // 错误报告内容
  testFailureReport?: string; // 测试失败报告内容
  codeContext?: string; // 相关代码上下文
}

export class FixBug extends BaseAction {
  constructor() {
    super('FixBug', 'Fix bugs in code based on error reports or test failures');
  }

  async run(
    bugDescription: string,
    options?: FixBugOptions
  ): Promise<IActionOutput> {
    logger.info('FixBug: Starting bug fix', {
      bugDescriptionLength: bugDescription.length,
      hasErrorReport: !!options?.errorReport,
      hasTestFailureReport: !!options?.testFailureReport,
    });

    try {
      // Load system prompt from database or use default
      const userId = this.context?.get('userId');
      const systemPrompt = await loadPrompt(
        userId,
        'code',
        'fix_bug_system_prompt',
        `你是一位资深的代码调试和修复专家，擅长分析和修复代码中的bug。

你的职责是：
- 仔细分析错误报告或测试失败报告
- 识别bug的根本原因
- 提供修复方案并生成修复后的代码
- 确保修复后的代码符合设计规范和最佳实践
- 避免引入新的bug

修复原则：
- 优先修复根本原因，而不是症状
- 保持代码风格和架构一致性
- 添加必要的错误处理和日志
- 确保修复后的代码通过相关测试
- 提供清晰的修复说明`
      );

      // Build the prompt
      let prompt = `请根据以下bug描述和相关信息，修复代码中的bug：

【Bug描述】
${bugDescription}

`;

      if (options?.errorReport) {
        prompt += `【错误报告】
${options.errorReport}

`;
      }

      if (options?.testFailureReport) {
        prompt += `【测试失败报告】
${options.testFailureReport}

`;
      }

      if (options?.codeContext) {
        prompt += `【相关代码上下文】
${options.codeContext}

`;
      }

      prompt += `修复要求：
1. **分析bug原因**：仔细分析错误报告或测试失败报告，识别bug的根本原因
2. **提供修复方案**：说明修复思路和方案
3. **生成修复代码**：提供完整的修复后的代码
4. **验证修复**：说明如何验证修复是否成功
5. **避免副作用**：确保修复不会引入新的bug

输出格式：
- 修复说明
- 修复后的完整代码
- 验证方法`;

      // Call LLM with system message and prompt
      const fixResult = await this.aask(prompt, [systemPrompt]);

      logger.info('FixBug: Bug fix completed', {
        fixResultLength: fixResult.length,
      });

      // Save fix result to workspace if options provided
      if (options?.applicationId && options?.version) {
        await this.saveToWorkspace('BUG_FIX.md', fixResult, {
          ...options,
          documentType: 'CODE',
        });
      }

      return {
        content: fixResult,
        data: {
          type: 'bug_fix',
          timestamp: new Date().toISOString(),
          hasErrorReport: !!options?.errorReport,
          hasTestFailureReport: !!options?.testFailureReport,
        },
      };
    } catch (error: any) {
      logger.error('FixBug: Failed to fix bug', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }
}

export default FixBug;

