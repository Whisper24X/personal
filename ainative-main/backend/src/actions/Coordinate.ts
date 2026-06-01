/**
 * Coordinate Action
 * Coordinates team work and makes decisions based on all messages
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import { logger } from '../utils';

const COORDINATE_SYSTEM_PROMPT = `你是一位经验丰富的团队领导，擅长协调团队工作和制定决策。

你的角色是基于所有团队成员的消息和输出，协调工作流程并做出决策。

主要职责：
- 分析所有角色的工作进展
- 识别阻塞和问题
- 制定任务分配计划
- 做出关键决策
- 协调团队协作

输出格式：结构化的任务分配和决策文档。`;

export class Coordinate extends BaseAction {
  constructor() {
    super(
      'Coordinate',
      'Coordinate team work and make decisions based on all messages. Analyze all team messages and coordinate work with task assignments'
    );
  }

  async run(allMessages: string): Promise<IActionOutput> {
    logger.info('Coordinate: Starting coordination');
    
    if (!allMessages || allMessages.trim() === '') {
      throw new Error('未提供团队消息');
    }

    try {
      // Build the prompt for coordination
      const prompt = this.buildCoordinatePrompt(allMessages);
      
      // Call LLM with system message and prompt
      const coordinationResult = await this.aask(prompt, [COORDINATE_SYSTEM_PROMPT]);
      
      logger.info('Coordinate: Coordination completed', {
        messagesLength: allMessages.length,
        resultLength: coordinationResult.length,
      });
      
      return {
        content: coordinationResult,
        data: {
          type: 'coordination',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      logger.error('Coordinate: Failed to coordinate', error);
      throw error;
    }
  }

  private buildCoordinatePrompt(messages: string): string {
    return `请基于以下所有团队成员的消息和输出，进行团队协调和任务分配：

团队消息历史：
${messages}

请分析并提供：
1. **工作进展总结**：各角色的工作完成情况
2. **问题识别**：识别当前存在的阻塞和问题
3. **任务分配**：为各角色分配下一步任务
4. **优先级排序**：确定任务的优先级
5. **决策建议**：提供关键决策建议
6. **协调计划**：制定团队协作计划

**分析要求**：
- 全面分析所有角色的输出
- 识别工作流程中的依赖关系
- 发现潜在的冲突和问题
- 提供清晰的行动建议

**输出格式**：
使用以下结构输出：

# 团队协调报告

## 1. 工作进展总结
[各角色的工作完成情况]

## 2. 问题识别
[当前存在的阻塞和问题]

## 3. 任务分配
[为各角色分配的具体任务]

## 4. 优先级排序
[任务的优先级列表]

## 5. 决策建议
[关键决策建议]

## 6. 协调计划
[团队协作计划]

**重要要求**：
- 分析要全面、深入
- 任务分配要具体、可执行
- 决策建议要有理有据
- 协调计划要清晰明确

请使用 Markdown 格式输出完整的协调报告。`;
  }
}

export default Coordinate;

