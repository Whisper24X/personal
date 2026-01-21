/**
 * Engineer Role
 * 使用Cursor CLI执行代码生成
 */

import { IRoleConfig, ACTION_WRITE_DESIGN, ACTION_WRITE_PRD, ACTION_BREAKDOWN_TASKS } from '@mind2build/shared';
import { Role } from './Role';
import { Context } from '../core/context/Context';
import { WriteCode } from '../actions/WriteCode';
import { Message } from '../core/message/Message';
import { logger } from '../utils';

export class Engineer extends Role {
  constructor(context: Context, name: string = 'Engineer') {
    const config: IRoleConfig = {
      name,
      profile: 'Engineer',
      goal: 'Implement high-quality code based on ProductManager and Architect outputs',
      constraints: 'Follow coding standards, write clean and maintainable code',
      description: 'Skilled engineer who brings designs to life through code',
    };

    super(config, context);

    // 监听 ProductManager 和 Architect 的输出
    this.watch([ACTION_WRITE_PRD, ACTION_WRITE_DESIGN, ACTION_BREAKDOWN_TASKS]);

    // 只设置 WriteCode action
    this.setActions([new WriteCode()]);
  }

  /**
   * 执行代码生成
   */
  async act(): Promise<Message | null> {
    if (!this.rc.todo) {
      return null;
    }

    const action = this.rc.todo;

    // 只处理 WriteCode
    if (action.name === 'WriteCode') {
      return await this.executeWriteCode();
    }

    // 否则使用基类的 act 方法
    return await super.act();
  }

  /**
   * 执行 WriteCode action
   */
  private async executeWriteCode(): Promise<Message | null> {
    const action = this.rc.todo!;
    logger.info(`${this.profile} WriteCode: Starting code generation`);

    try {
      // 获取 workspace 选项
      const workspaceOptions = this.extractWorkspaceOptions();

      // 验证必需参数
      if (!workspaceOptions?.applicationId) {
        logger.error(`${this.profile} WriteCode: applicationId is required`);
        this.rc.todo = null;
        return null;
      }
      if (!workspaceOptions?.projectId) {
        logger.error(`${this.profile} WriteCode: projectId is required`);
        this.rc.todo = null;
        return null;
      }

      // 从 memory 中获取 design 文档
      const designMessages = this.rc.memory.getByAction('WriteDesign');
      const design = designMessages.length > 0 ? designMessages[designMessages.length - 1].content : '';

      if (!design) {
        logger.warn(`${this.profile} WriteCode: No Design document found`);
      }

      // 调用 WriteCode action
      const result = await (action as any).run(design, workspaceOptions);

      // 创建消息
      const message = new Message({
        content: result.content,
        role: this.profile,
        causeBy: action.constructor.name,
        sentFrom: this.name,
        instructContent: result.data,
      });

      logger.info(`${this.profile} WriteCode: Code generation completed`);

      // 清除当前 action
      this.rc.todo = null;

      return message;
    } catch (error: any) {
      logger.error(`${this.profile} WriteCode failed:`, {
        message: error.message,
        stack: error.stack,
      });
      this.rc.todo = null;
      throw error;
    }
  }
}

export default Engineer;
