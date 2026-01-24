/**
 * TestabilityReview Action
 * Reviews PRD and code for testability
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import { WorkspaceOptions, logger, loadPrompt } from '../utils';
import {
  buildCLISaveInstruction,
  isCLISummaryOutput,
  tryReadActualReviewFromWorkspace,
} from '../utils/stepwise';
import {
  TESTABILITY_REVIEW_SYSTEM_PROMPT,
  buildTestabilityReviewPrompt,
} from '../prompts/test';

export interface TestabilityReviewOptions extends WorkspaceOptions {
  // Inherits all options from WorkspaceOptions
}

export class TestabilityReview extends BaseAction {
  constructor() {
    super(
      'TestabilityReview',
      'Review PRD and code for testability, identifying untestable or difficult-to-test requirements'
    );
  }

  async run(input: string, options?: TestabilityReviewOptions): Promise<IActionOutput> {
    logger.info('TestabilityReview: Starting testability review');

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
        logger.info('TestabilityReview: Parsed PRD and code from input', {
          prdLength: prd.length,
          codeLength: code.length,
        });
      } else if (input.includes('PRD文档：')) {
        // PRD only
        prd = input.replace('PRD文档：', '').trim();
        logger.info('TestabilityReview: Using PRD only', {
          prdLength: prd.length,
        });
      } else {
        // Code only or try to read from workspace
        code = input;
        logger.info('TestabilityReview: Using code only (no PRD found)', {
          codeLength: code.length,
        });
      }

      // Try to read PRD from workspace if not in input
      if (!prd && options) {
        try {
          const prdFromWorkspace = await this.readWorkspaceFile('PRD.md', {
            ...options,
            documentType: 'PRD',
          });
          if (prdFromWorkspace) {
            prd = prdFromWorkspace;
            logger.info('TestabilityReview: Loaded PRD from workspace', {
              prdLength: prd.length,
            });
          }
        } catch (error: any) {
          logger.warn('TestabilityReview: Failed to read PRD from workspace', {
            error: error.message,
          });
        }
      }

      if (!prd && !code) {
        throw new Error('Neither PRD nor code found for testability review');
      }

      // Build prompt
      let prompt = buildTestabilityReviewPrompt(prd, code);

      // Load system prompt from database or use default
      const userId = this.context?.get('userId');
      const systemPrompt = await loadPrompt(
        userId,
        'test',
        'testability_review_system_prompt',
        TESTABILITY_REVIEW_SYSTEM_PROMPT
      );

      // CLI 模式处理
      const isCLIMode = this.isCLIMode();
      const workspaceOptions: WorkspaceOptions = {
        ...options,
        documentType: 'TEST',
      };

      // CLI 模式下，在 prompt 中指定文件保存路径和限制指令
      if (isCLIMode && options?.applicationId) {
        const savePath = `${this.getWorkspaceDir(workspaceOptions)}/TESTABILITY_REVIEW.md`;
        const saveInstruction = buildCLISaveInstruction(savePath, '可测试性审核报告');
        prompt += saveInstruction;
        
        logger.info('TestabilityReview: Added CLI save path instruction', { savePath });
      }

      // Call LLM/CLI to generate testability review
      const cliOutput = await this.aask(prompt, [systemPrompt]);
      
      let content: string;
      
      if (isCLIMode && isCLISummaryOutput(cliOutput)) {
        logger.info('TestabilityReview: CLI output appears to be a summary, reading actual review from workspace', {
          cliOutputLength: cliOutput.length,
          cliOutputPreview: cliOutput.substring(0, 200),
        });
        
        // 尝试从workspace读取CLI实际生成的审核结果
        const workspaceDir = this.getWorkspaceDir(workspaceOptions);
        const actualReview = await tryReadActualReviewFromWorkspace(workspaceDir, {
          reviewFileName: 'TESTABILITY_REVIEW.md',
          filePattern: 'testability_review',
        });
        
        if (actualReview) {
          content = actualReview;
          logger.info('TestabilityReview: Successfully read actual review from workspace', {
            actualReviewLength: actualReview.length,
          });
        } else {
          logger.warn('TestabilityReview: Could not find actual review in workspace, using CLI output', {
            cliOutputLength: cliOutput.length,
          });
          content = cliOutput;
        }
      } else {
        content = cliOutput;
      }

      // Save to workspace (只有当内容不是CLI总结时才保存)
      if (!isCLISummaryOutput(content)) {
        await this.saveToWorkspace('TESTABILITY_REVIEW.md', content, workspaceOptions);
      }

      logger.info('TestabilityReview: Testability review completed', {
        contentLength: content.length,
        workspaceDir: this.getWorkspaceDir(workspaceOptions),
      });

      return {
        content: content,
        data: {
          type: 'testability_review',
          filename: 'TESTABILITY_REVIEW.md',
          timestamp: new Date().toISOString(),
          workspaceDir: this.getWorkspaceDir(workspaceOptions),
        },
      };
    } catch (error: any) {
      logger.error('TestabilityReview: Failed to generate testability review', error);
      throw error;
    }
  }
}
