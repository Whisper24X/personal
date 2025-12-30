/**
 * Engineer Role
 * Implements code based on design documents and executes subtasks
 */

import { IRoleConfig, ACTION_WRITE_DESIGN, ACTION_WRITE_PRD, ACTION_BREAKDOWN_TASKS } from '@mind2build/shared';
import { Role } from './Role';
import { Context } from '../core/context/Context';
import { WriteCode } from '../actions/WriteCode';
import { ExecuteSubtask } from '../actions/ExecuteSubtask';
import { Message } from '../core/message/Message';
import { logger, SubtaskManager } from '../utils';

export class Engineer extends Role {
  constructor(context: Context, name: string = 'Engineer') {
    // Check if Cursor LLM should be used for Engineer
    const useCursor = process.env.ENGINEER_USE_CURSOR === 'true';
    const cursorRepository = process.env.CURSOR_REPOSITORY || process.env.GITHUB_REPOSITORY;

    const config: IRoleConfig = {
      name,
      profile: 'Engineer',
      goal: 'Implement high-quality code based on ProductManager and Architect outputs, executing subtasks according to task breakdown',
      constraints: 'Follow coding standards, write clean and maintainable code',
      description: 'Skilled engineer who brings designs to life through code and executes subtasks based on task breakdown',
      // Configure Cursor LLM if enabled and repository is provided
      ...(useCursor && cursorRepository ? {
        llm: {
          provider: 'cursor',
          apiKey: process.env.CURSOR_API_KEY || 'key_a92ddf19fb19678761a887bc0dc43eed735db8c3b4a19ad120f8d43538893056',
          model: process.env.CURSOR_MODEL || 'auto', // Use auto model selection
          repository: cursorRepository,
          branchName: process.env.CURSOR_BRANCH_NAME || `cursor/engineer-${Date.now()}`,
          autoCreatePr: process.env.CURSOR_AUTO_CREATE_PR !== 'false',
        },
      } : {}),
    };

    super(config, context);

    // Watch for ProductManager output (WritePRD), Architect output (WriteDesign, BreakdownTasks)
    this.watch([ACTION_WRITE_PRD, ACTION_WRITE_DESIGN, ACTION_BREAKDOWN_TASKS]);

    // Set actions - WriteCode and ExecuteSubtask
    this.setActions([new WriteCode(), new ExecuteSubtask()]);

    if (useCursor && cursorRepository) {
      logger.info(`${this.profile} configured to use Cursor LLM`, {
        repository: cursorRepository,
        branchName: config.llm?.branchName,
      });
    }
  }

  /**
   * Override act to handle subtask execution based on ProductManager and Architect outputs
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

    // 如果是WriteCode，检查是否有任务拆分，如果有则拆解为多个子任务
    if (action.name === 'WriteCode') {
      return await this.writeCodeWithTaskBreakdown();
    }

    // 否则使用基类的act方法
    return await super.act();
  }

  /**
   * Write code based on ProductManager and Architect outputs, with task breakdown if available
   */
  private async writeCodeWithTaskBreakdown(): Promise<Message | null> {
    const action = this.rc.todo!;
    logger.info(`${this.profile} WriteCode: Starting code generation with task breakdown check`);

    try {
      // 获取ProductManager的输出（PRD）
      const prdMessages = this.rc.memory.getByAction('WritePRD');
      const prd = prdMessages.length > 0 ? prdMessages[prdMessages.length - 1].content : '';

      // 获取Architect的输出（Design）
      const designMessages = this.rc.memory.getByAction('WriteDesign');
      const design = designMessages.length > 0 ? designMessages[designMessages.length - 1].content : '';

      // 获取Architect的任务拆分（BreakdownTasks）
      const breakdownMessages = this.rc.memory.getByAction('BreakdownTasks');
      const taskBreakdown = breakdownMessages.length > 0 ? breakdownMessages[breakdownMessages.length - 1].content : '';

      // 获取workspace选项
      const workspaceOptions = this.extractWorkspaceOptions();

      // 如果有任务拆分，则根据任务拆分拆解出多个子任务完成代码编写
      if (taskBreakdown && workspaceOptions?.applicationId && workspaceOptions?.version) {
        logger.info(`${this.profile} WriteCode: Found task breakdown, will execute subtasks`);

        // 解析任务拆分
        const subtaskManager = new SubtaskManager();
        const breakdown = subtaskManager.parseTaskBreakdown(taskBreakdown);

        // 保存任务拆分到workspace（如果还没有保存）
        await subtaskManager.saveToWorkspace({
          ...workspaceOptions,
          documentType: 'TASKS',
        });

        // 获取待执行的任务
        const pendingTasks = subtaskManager.getPendingTasks();

        if (pendingTasks.length > 0) {
          // 有任务需要执行，切换到ExecuteSubtask
          const executeSubtaskAction = this.actions.find(a => a.name === 'ExecuteSubtask');
          if (executeSubtaskAction) {
            logger.info(`${this.profile} WriteCode: Found ${pendingTasks.length} pending tasks, switching to ExecuteSubtask`);
            this.rc.todo = executeSubtaskAction;
            return await this.executeSubtask();
          }
        } else {
          logger.info(`${this.profile} WriteCode: All tasks completed, proceeding with WriteCode`);
        }
      }

      // 如果没有任务拆分或所有任务已完成，使用WriteCode直接编写代码
      // 构建输入：PRD + Design
      const input = [prd, design].filter(Boolean).join('\n\n');

      if (!input) {
        logger.warn(`${this.profile} WriteCode: No PRD or Design found`);
        return null;
      }

      const result = await action.run(design || input, workspaceOptions);

      // 创建消息
      const message = new Message({
        content: result.content,
        role: this.profile,
        causeBy: action.constructor.name,
        sentFrom: this.name,
        instructContent: result.data,
      });

      logger.info(`${this.profile} WriteCode: Code generation completed`);

      // Clear current action
      this.rc.todo = null;

      return message;
    } catch (error: any) {
      logger.error(`${this.profile} WriteCode failed:`, error);
      this.rc.todo = null;
      throw error;
    }
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

      // 获取ProductManager的输出（PRD）
      const prdMessages = this.rc.memory.getByAction('WritePRD');
      const prd = prdMessages.length > 0 ? prdMessages[prdMessages.length - 1].content : '';

      // 获取Architect的输出（Design）
      const designMessages = this.rc.memory.getByAction('WriteDesign');
      const design = designMessages.length > 0
        ? designMessages[designMessages.length - 1].content
        : '';

      // 构建任务描述
      const taskDescription = this.buildTaskDescription(task);

      // 执行任务，传入PRD和Design信息
      const result = await (action as any).run(taskDescription, {
        ...workspaceOptions,
        taskId: task.id,
        taskDescription: taskDescription,
        prd: prd,
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

