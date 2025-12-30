/**
 * Engineer Role
 * Implements code based on design documents and executes subtasks
 */

import { IRoleConfig, ACTION_WRITE_DESIGN } from '@mind2build/shared';
import { Role } from './Role';
import { Context } from '../core/context/Context';
import { WriteCode } from '../actions/WriteCode';
import { ExecuteSubtask } from '../actions/ExecuteSubtask';
import { Message } from '../core/message/Message';
import { logger, SubtaskManager } from '../utils';

export class Engineer extends Role {
  constructor(context: Context, name: string = 'Engineer') {
    const config: IRoleConfig = {
      name,
      profile: 'Engineer',
      goal: 'Implement high-quality code based on design specifications and execute subtasks',
      constraints: 'Follow coding standards, write clean and maintainable code',
      description: 'Skilled engineer who brings designs to life through code and executes subtasks',
    };

    super(config, context);

    // Watch for design completion and task generation
    this.watch([ACTION_WRITE_DESIGN, 'GenerateTask']);

    // Set actions - WriteCode and ExecuteSubtask
    this.setActions([new WriteCode(), new ExecuteSubtask()]);
  }

  /**
   * Override act to handle subtask execution
   */
  async act(): Promise<Message | null> {
    if (!this.rc.todo) {
      return null;
    }

    const action = this.rc.todo;
    
    // 如果是ExecuteSubtask，需要从任务拆分中获取任务信息
    if (action.name === 'ExecuteSubtask') {
      return await this.executeSubtask();
    }

    // 否则使用基类的act方法
    return await super.act();
  }

  /**
   * Execute a subtask
   */
  private async executeSubtask(): Promise<Message | null> {
    const action = this.rc.todo!;
    logger.info(`${this.profile} executing subtask`);

    try {
      // 获取workspace选项
      const workspaceOptions = this.extractWorkspaceOptions();
      
      if (!workspaceOptions?.applicationId || !workspaceOptions?.version) {
        logger.warn(`${this.profile} ExecuteSubtask: Missing workspace options, falling back to WriteCode`);
        // 如果没有workspace选项，使用WriteCode
        const writeCodeAction = this.actions.find(a => a.name === 'WriteCode');
        if (writeCodeAction) {
          this.rc.todo = writeCodeAction;
          return await super.act();
        }
        return null;
      }

      // 加载任务管理器
      const subtaskManager = new SubtaskManager();
      const loaded = await subtaskManager.loadFromWorkspace({
        applicationId: workspaceOptions.applicationId,
        version: workspaceOptions.version,
        documentType: 'TASKS',
      });

      if (!loaded) {
        logger.warn(`${this.profile} ExecuteSubtask: Failed to load task breakdown, falling back to WriteCode`);
        const writeCodeAction = this.actions.find(a => a.name === 'WriteCode');
        if (writeCodeAction) {
          this.rc.todo = writeCodeAction;
          return await super.act();
        }
        return null;
      }

      // 获取待执行的任务
      const pendingTasks = subtaskManager.getPendingTasks();
      if (pendingTasks.length === 0) {
        logger.info(`${this.profile} ExecuteSubtask: No pending tasks, all tasks completed`);
        // 所有任务已完成，使用WriteCode处理设计文档
        const writeCodeAction = this.actions.find(a => a.name === 'WriteCode');
        if (writeCodeAction) {
          this.rc.todo = writeCodeAction;
          return await super.act();
        }
        return null;
      }

      // 执行第一个待执行的任务
      const task = pendingTasks[0];
      logger.info(`${this.profile} ExecuteSubtask: Executing task ${task.id}: ${task.name}`);

      // 标记任务为进行中
      subtaskManager.markTaskInProgress(task.id);

      // 获取设计文档
      const designMessages = this.rc.memory.getByAction('WriteDesign');
      const design = designMessages.length > 0 
        ? designMessages[designMessages.length - 1].content 
        : '';

      // 构建任务描述
      const taskDescription = this.buildTaskDescription(task);

      // 执行任务
      const result = await (action as any).run(taskDescription, {
        ...workspaceOptions,
        taskId: task.id,
        taskDescription: taskDescription,
        design: design,
      });

      // 创建消息
      const message = new Message({
        content: result.content,
        role: this.profile,
        causeBy: action.constructor.name,
        sentFrom: this.name,
        instructContent: result.data,
      });

      logger.info(`${this.profile} completed subtask: ${task.id}`);

      // Clear current action
      this.rc.todo = null;

      return message;
    } catch (error: any) {
      logger.error(`${this.profile} subtask execution failed:`, error);
      this.rc.todo = null;
      throw error;
    }
  }

  /**
   * Build task description from subtask
   */
  private buildTaskDescription(task: any): string {
    let description = `# 任务: ${task.name}\n\n`;
    description += `**任务ID**: ${task.id}\n`;
    description += `**任务类型**: ${task.type}\n`;
    description += `**优先级**: ${task.priority}\n`;
    description += `**预估工时**: ${task.estimatedHours} 小时\n\n`;
    
    if (task.dependencies && task.dependencies.length > 0) {
      description += `**依赖任务**: ${task.dependencies.join(', ')}\n\n`;
    }
    
    description += `## 任务描述\n\n${task.description}\n\n`;
    
    if (task.inputs && task.inputs.length > 0) {
      description += `## 输入\n\n${task.inputs.map((i: string) => `- ${i}`).join('\n')}\n\n`;
    }
    
    if (task.outputs && task.outputs.length > 0) {
      description += `## 输出\n\n${task.outputs.map((o: string) => `- ${o}`).join('\n')}\n\n`;
    }
    
    if (task.acceptanceCriteria && task.acceptanceCriteria.length > 0) {
      description += `## 验收标准\n\n${task.acceptanceCriteria.map((c: string) => `- ${c}`).join('\n')}\n\n`;
    }
    
    if (task.technicalPoints && task.technicalPoints.length > 0) {
      description += `## 技术要点\n\n${task.technicalPoints.map((p: string) => `- ${p}`).join('\n')}\n\n`;
    }
    
    return description;
  }
}

export default Engineer;

