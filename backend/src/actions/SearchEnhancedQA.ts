/**
 * SearchEnhancedQA Action
 * Enhanced search and Q&A for ProductManager
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import { logger } from '../utils';

const SEARCH_ENHANCED_QA_SYSTEM_PROMPT = `你是一位专业的信息搜索和分析专家，擅长通过智能搜索和问答来获取准确的信息。

你的角色是帮助产品经理进行市场调研、竞品分析和需求验证。

主要职责：
- 理解搜索问题并提取关键信息
- 提供准确、有引用的答案
- 分析市场趋势和竞品信息
- 验证产品需求的可行性

输出格式：结构化的答案，包含引用来源和关键信息。`;

export class SearchEnhancedQA extends BaseAction {
  constructor() {
    super(
      'SearchEnhancedQA',
      'Enhanced search and Q&A for market research and requirement validation. Perform intelligent search and provide answers with citations for product research'
    );
  }

  async run(question: string): Promise<IActionOutput> {
    logger.info('SearchEnhancedQA: Starting enhanced search');
    
    if (!question || question.trim() === '') {
      throw new Error('未提供搜索问题');
    }

    try {
      // Build the prompt for enhanced search
      const prompt = this.buildSearchPrompt(question);
      
      // Call LLM with system message and prompt
      const answer = await this.aask(prompt, [SEARCH_ENHANCED_QA_SYSTEM_PROMPT]);
      
      logger.info('SearchEnhancedQA: Search completed', {
        questionLength: question.length,
        answerLength: answer.length,
      });
      
      return {
        content: answer,
        data: {
          type: 'search_result',
          question: question,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      logger.error('SearchEnhancedQA: Failed to perform search', error);
      throw error;
    }
  }

  private buildSearchPrompt(question: string): string {
    return `请基于以下问题，提供详细的分析和答案：

问题：${question}

请提供：
1. **核心答案**：直接回答问题的关键信息
2. **详细分析**：深入分析问题的各个方面
3. **市场趋势**：如果涉及市场或产品，提供相关趋势分析
4. **竞品信息**：如果涉及产品，提供竞品对比
5. **可行性评估**：评估相关需求的可行性
6. **引用来源**：标注信息来源（如适用）

**重要要求**：
- 答案要准确、全面且有价值
- 如果涉及技术问题，提供技术细节
- 如果涉及市场问题，提供数据支持
- 确保答案对产品决策有帮助

请使用 Markdown 格式输出，结构清晰。`;
  }
}

export default SearchEnhancedQA;

