/**
 * WriteRequirementSpec Action
 * 编写需求说明文档
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import { REQUIREMENT_SPEC_SYSTEM_PROMPT, buildRequirementSpecPrompt } from '../prompts/requirement';
import { logger } from '../utils';

export class WriteRequirementSpec extends BaseAction {
  constructor() {
    super(
      'WriteRequirementSpec',
      '编写需求说明文档',
      '分析用户原始需求，进行市场调研，输出详细的需求说明文档'
    );
  }

  async run(userIdea: string): Promise<IActionOutput> {
    logger.info('WriteRequirementSpec: Starting requirement spec generation');
    
    if (!userIdea || userIdea.trim() === '') {
      throw new Error('未找到用户需求');
    }

    try {
    // 构建提示词
      const prompt = buildRequirementSpecPrompt(userIdea);

    // 调用 LLM 生成需求说明文档
      const content = await this.aask(prompt, [REQUIREMENT_SPEC_SYSTEM_PROMPT]);
      
      logger.info('WriteRequirementSpec: Requirement spec generation completed', {
        contentLength: content.length,
      });
      
      return {
        content: content,
        data: {
          type: 'requirement',
          filename: 'REQUIREMENT_SPEC.md',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      logger.error('WriteRequirementSpec: Failed to generate requirement spec', error);
      throw error;
    }
  }
}

