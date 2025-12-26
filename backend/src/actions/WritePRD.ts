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
      logger.error('WritePRD: Failed to generate PRD', {
        mode,
        error: error.message,
        stack: error.stack,
      });
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

