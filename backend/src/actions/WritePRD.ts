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
} from '../prompts/prd';
import { logger } from '../utils';

export interface WritePRDOptions {
  mode?: 'new' | 'update';
  historyPRD?: string;
  relevantChunks?: string;
  useRAG?: boolean;
}

export class WritePRD extends BaseAction {
  constructor() {
    super('WritePRD', 'Generate Product Requirements Document from user idea');
  }

  async run(input: string, options?: WritePRDOptions): Promise<IActionOutput> {
    const mode = options?.mode || 'new';
    const useRAG = options?.useRAG || false;

    logger.info('WritePRD: Starting PRD generation', {
      mode,
      useRAG,
      hasHistoryPRD: !!options?.historyPRD,
      hasRelevantChunks: !!options?.relevantChunks,
      requestTimeout: process.env.REQUEST_TIMEOUT || '300',
      inputLength: input.length,
    });

    try {
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

      logger.info('WritePRD: PRD generation completed', {
        mode,
        contentLength: prdContent.length,
      });

      return {
        content: prdContent,
        data: {
          type: 'prd',
          filename: 'PRD.md',
          timestamp: new Date().toISOString(),
          mode,
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

