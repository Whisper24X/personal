/**
 * ExecuteSubtask Action
 * 准备子任务执行所需的设计文档内容，不直接生成代码
 * 代码生成由Engineer角色通过WriteCode action来完成
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import { logger, WorkspaceOptions } from '../utils';

export interface ExecuteSubtaskOptions extends WorkspaceOptions {
  taskId: string; // 要执行的任务ID
  taskDescription: string; // 任务描述
  prd?: string; // PRD文档（可选）
  design?: string; // 设计文档（可选）
  taskBreakdown?: string; // 任务拆分文档（TASK_BREAKDOWN.md）内容（可选）
}

export class ExecuteSubtask extends BaseAction {
  constructor() {
    super('ExecuteSubtask', 'Prepare subtask execution design document for code generation');
  }

  async run(
    taskDescription: string,
    options?: ExecuteSubtaskOptions
  ): Promise<IActionOutput> {
    if (!options?.taskId) {
      throw new Error('ExecuteSubtask: taskId is required');
    }

    logger.info('ExecuteSubtask: Preparing subtask execution design', {
      taskId: options.taskId,
    });

    try {
      // TODO: 任务状态管理功能待实现（SubtaskManager 需要添加持久化方法）
      // 目前 SubtaskManager 只是一个解析器，不支持状态管理

      // 构建任务执行的prompt
      // 将任务描述转换为设计文档格式，供WriteCode使用
      const designContent = this.buildDesignFromTask(
        taskDescription,
        options.prd,
        options.design,
        options.taskBreakdown
      );

      logger.info('ExecuteSubtask: Design document prepared', {
        taskId: options.taskId,
        designContentLength: designContent.length,
      });

      // 返回设计文档内容，由Engineer角色通过WriteCode action来生成代码
      return {
        content: `# 子任务准备完成\n\n任务ID: ${options.taskId}\n\n已准备好任务执行所需的设计文档内容。`,
        data: {
          type: 'subtask_preparation',
          taskId: options.taskId,
          designContent: designContent,
          // 保留原始选项，供后续WriteCode使用
          workspaceOptions: {
            applicationId: options.applicationId,
            version: options.version,
            workspacePath: options.workspacePath,
            projectId: options.projectId,
            documentType: 'CODE',
          },
        },
      };
    } catch (error: any) {
      logger.error('ExecuteSubtask: Failed to prepare subtask', {
        taskId: options.taskId,
        error: error.message,
      });

      // TODO: 任务失败状态更新功能待实现

      throw error;
    }
  }

  /**
   * 从任务描述构建设计文档格式
   */
  private buildDesignFromTask(taskDescription: string, prd?: string, design?: string, taskBreakdown?: string): string {
    let designContent = `# 任务实现设计\n\n`;
    designContent += `**重要：你必须严格按照以下文档来实现代码：**\n`;
    designContent += `1. **任务拆分文档（TASK_BREAKDOWN.md）** - 必须严格按照任务定义实现\n`;
    designContent += `2. **系统设计文档（DESIGN.md）** - 必须严格遵循技术栈、架构、目录结构等设计规范\n\n`;
    designContent += `## 任务描述（来自 TASK_BREAKDOWN.md）\n\n`;
    designContent += `**此任务定义来自任务拆分文档（TASK_BREAKDOWN.md），你必须严格按照此任务定义来实现代码。**\n\n`;
    designContent += `${taskDescription}\n\n`;

    if (taskBreakdown) {
      designContent += `---\n\n`;
      designContent += `## 任务拆分文档（TASK_BREAKDOWN.md）- 必须严格遵循\n\n`;
      designContent += `**这是你必须严格遵循的任务拆分文档。所有代码实现必须符合此文档中的任务定义：**\n\n`;
      designContent += `${taskBreakdown}\n\n`;
    }

    if (prd) {
      designContent += `---\n\n`;
      designContent += `## 产品需求文档（PRD）参考\n\n${prd}\n\n`;
    }

    if (design) {
      designContent += `---\n\n`;
      designContent += `## 系统设计文档（DESIGN.md）- 必须严格遵循\n\n`;
      designContent += `**这是你必须严格遵循的系统设计文档。所有代码实现必须符合此设计文档的要求：**\n\n`;
      designContent += `${design}\n\n`;
    }

    designContent += `---\n\n`;
    designContent += `## 实现要求\n\n`;
    designContent += `**核心要求：必须严格按照以下文档来实现代码：**\n\n`;
    designContent += `### 1. 任务拆分文档（TASK_BREAKDOWN.md）要求：\n`;
    designContent += `- **必须严格按照任务拆分文档中的任务定义来实现**\n`;
    designContent += `- 必须实现任务描述中要求的所有功能\n`;
    designContent += `- 必须满足任务的所有验收标准\n`;
    designContent += `- 必须遵循任务中定义的技术要点\n`;
    designContent += `- 必须生成任务要求的所有输出\n\n`;
    designContent += `### 2. 系统设计文档（DESIGN.md）要求：\n`;
    designContent += `- **技术栈**：必须使用设计文档中指定的技术栈，不得使用其他技术\n`;
    designContent += `- **目录结构**：必须严格按照设计文档中的目录结构创建文件\n`;
    designContent += `- **数据模型**：必须严格按照设计文档中定义的数据模型实现\n`;
    designContent += `- **API 设计**：必须实现设计文档中定义的所有 API，路径和参数必须一致\n`;
    designContent += `- **文件组织**：文件命名和组织方式必须与设计文档一致\n\n`;
    designContent += `请根据任务拆分文档中的任务定义，在严格遵循系统设计文档的前提下，生成完整的代码实现。\n`;
    designContent += `确保代码符合设计规范，包含必要的注释和文档。\n`;

    return designContent;
  }
}

export default ExecuteSubtask;

