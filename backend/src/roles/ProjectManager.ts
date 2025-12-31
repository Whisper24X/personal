/**
 * Project Manager Role
 * Manages project tasks breakdown, sub-project design, and task generation
 */

import {
  IRoleConfig,
  ACTION_WRITE_PRD,
  ACTION_WRITE_DESIGN,
} from '@mind2build/shared';
import { Role } from './Role';
import { Context } from '../core/context/Context';
import { BreakdownTasks } from '../actions/BreakdownTasks';
import { WriteSubProjectDesign } from '../actions/WriteSubProjectDesign';
import { GenerateTask } from '../actions/GenerateTask';
import { Message } from '../core/message/Message';
import { logger, SubtaskManager, WorkspaceOptions } from '../utils';

export class ProjectManager extends Role {
  constructor(context: Context, name: string = 'ProjectManager') {
    const config: IRoleConfig = {
      name,
      profile: 'ProjectManager',
      goal: 'Break down projects into minimal granularity tasks, provide sub-project design and task generation support for engineers',
      constraints: 'Ensure tasks are minimal granularity, independent, testable, and deliverable. Provide clear task descriptions and acceptance criteria.',
      description: 'Experienced project manager who specializes in task breakdown and project planning',
    };
    
    super(config, context);
    
    // Watch for PRD and Design completion to trigger task breakdown
    this.watch([ACTION_WRITE_PRD, ACTION_WRITE_DESIGN]);
    
    // Set actions
    this.setActions([
      new BreakdownTasks(),
      new WriteSubProjectDesign(),
      new GenerateTask(),
    ]);
  }

  /**
   * Override act to handle different action input requirements
   */
  async act(): Promise<Message | null> {
    if (!this.rc.todo) {
      return null;
    }
    
    const action = this.rc.todo;
    logger.info(`${this.profile} executing action: ${action.name}`);
    
    try {
      let result;
      
      // Handle different actions with specific input requirements
      if (action.name === 'BreakdownTasks') {
        // BreakdownTasks needs both PRD and Design
        const prdMessage = this.rc.news.find(msg => msg.causeBy === ACTION_WRITE_PRD);
        const designMessage = this.rc.news.find(msg => msg.causeBy === ACTION_WRITE_DESIGN);
        
        // Also check memory if not in news
        let prdContent = prdMessage?.content;
        let designContent = designMessage?.content;
        
        if (!prdContent) {
          const prdMessages = this.rc.memory.getByAction(ACTION_WRITE_PRD);
          if (prdMessages.length > 0) {
            prdContent = prdMessages[prdMessages.length - 1].content;
            logger.info(`${this.profile} BreakdownTasks: Found PRD in memory`);
          }
        }
        
        if (!designContent) {
          const designMessages = this.rc.memory.getByAction(ACTION_WRITE_DESIGN);
          if (designMessages.length > 0) {
            designContent = designMessages[designMessages.length - 1].content;
            logger.info(`${this.profile} BreakdownTasks: Found Design in memory`);
          }
        }
        
        if (!prdContent || !designContent) {
          logger.warn(`${this.profile} BreakdownTasks: Missing PRD or Design. PRD: ${!!prdContent}, Design: ${!!designContent}`);
          // Wait for both documents
          return null;
        }
        
        // 获取workspace选项
        const workspaceOptions = this.extractWorkspaceOptions();
        result = await action.run(prdContent, designContent, workspaceOptions);
      } else if (action.name === 'WriteSubProjectDesign') {
        // WriteSubProjectDesign needs task breakdown and design
        const taskBreakdownMessage = this.rc.news.find(msg => msg.causeBy === 'BreakdownTasks');
        const designMessage = this.rc.news.find(msg => msg.causeBy === ACTION_WRITE_DESIGN);
        
        let taskBreakdownContent = taskBreakdownMessage?.content;
        let designContent = designMessage?.content;
        
        // Check memory
        if (!taskBreakdownContent) {
          const taskMessages = this.rc.memory.getByAction('BreakdownTasks');
          if (taskMessages.length > 0) {
            taskBreakdownContent = taskMessages[taskMessages.length - 1].content;
          }
        }
        
        if (!designContent) {
          const designMessages = this.rc.memory.getByAction(ACTION_WRITE_DESIGN);
          if (designMessages.length > 0) {
            designContent = designMessages[designMessages.length - 1].content;
          }
        }
        
        if (!taskBreakdownContent || !designContent) {
          logger.warn(`${this.profile} WriteSubProjectDesign: Missing task breakdown or design`);
          return null;
        }
        
        // 获取workspace选项
        const workspaceOptions = this.extractWorkspaceOptions();
        result = await action.run(taskBreakdownContent, designContent, workspaceOptions);
      } else if (action.name === 'GenerateTask') {
        // GenerateTask needs task breakdown, optionally sub-project design
        const taskBreakdownMessage = this.rc.news.find(msg => msg.causeBy === 'BreakdownTasks');
        const subProjectDesignMessage = this.rc.news.find(msg => msg.causeBy === 'WriteSubProjectDesign');
        
        let taskBreakdownContent = taskBreakdownMessage?.content;
        let subProjectDesignContent = subProjectDesignMessage?.content;
        
        // Check memory
        if (!taskBreakdownContent) {
          const taskMessages = this.rc.memory.getByAction('BreakdownTasks');
          if (taskMessages.length > 0) {
            taskBreakdownContent = taskMessages[taskMessages.length - 1].content;
          }
        }
        
        if (!subProjectDesignContent) {
          const subProjectMessages = this.rc.memory.getByAction('WriteSubProjectDesign');
          if (subProjectMessages.length > 0) {
            subProjectDesignContent = subProjectMessages[subProjectMessages.length - 1].content;
          }
        }
        
        if (!taskBreakdownContent) {
          logger.warn(`${this.profile} GenerateTask: Missing task breakdown`);
          return null;
        }
        
        // 获取workspace选项（从消息的instructContent中获取）
        const workspaceOptions = this.extractWorkspaceOptions();
        
        result = await action.run(taskBreakdownContent, subProjectDesignContent, workspaceOptions);
        
        // GenerateTask完成后，检查子任务状态
        await this.checkAndManageSubtasks(workspaceOptions);
      } else {
        // Default: use all news messages as context
        const context = this.rc.news.map((msg) => msg.content).join('\n\n');
        result = await action.run(context);
      }
      
      // Create message from result
      const message = new Message({
        content: result.content,
        role: this.profile,
        causeBy: action.constructor.name,
        sentFrom: this.name,
        instructContent: result.data,
      });
      
      logger.info(`${this.profile} completed action: ${action.name}`);
      
      // Clear current action
      this.rc.todo = null;
      
      return message;
    } catch (error: any) {
      logger.error(`${this.profile} action failed:`, error);
      this.rc.todo = null;
      throw error;
    }
  }


  /**
   * 检查和管理子任务执行状态
   */
  private async checkAndManageSubtasks(options?: WorkspaceOptions): Promise<void> {
    if (!options?.applicationId || !options?.version) {
      logger.warn('ProjectManager: Cannot check subtasks without workspace options');
      return;
    }

    try {
      const subtaskManager = new SubtaskManager();
      const loaded = await subtaskManager.loadFromWorkspace({
        applicationId: options.applicationId,
        version: options.version,
        documentType: 'TASKS',
      });

      if (!loaded) {
        logger.warn('ProjectManager: Failed to load task breakdown from workspace');
        return;
      }

      const stats = subtaskManager.getStatistics();
      logger.info('ProjectManager: Subtask status', stats);

      // 检查是否所有任务都已完成
      if (subtaskManager.areAllTasksCompleted()) {
        logger.info('ProjectManager: All subtasks completed!');
        
        // 生成最终执行报告
        // const report = subtaskManager.getExecutionReport(); // Unused for now
        await subtaskManager.saveToWorkspace({
          applicationId: options.applicationId,
          version: options.version,
          documentType: 'TASKS',
        });

        // 可以在这里发布一个消息，通知所有任务已完成
        // 或者让Engineer继续执行剩余的任务
      } else {
        // 获取待执行的任务
        const pendingTasks = subtaskManager.getPendingTasks();
        logger.info('ProjectManager: Pending tasks', {
          count: pendingTasks.length,
          taskIds: pendingTasks.map(t => t.id),
        });

        // 如果有待执行的任务，可以在这里触发执行
        // 或者让Engineer角色来处理这些任务
        if (pendingTasks.length > 0) {
          logger.info('ProjectManager: There are pending tasks that need to be executed', {
            pendingCount: pendingTasks.length,
            taskIds: pendingTasks.map(t => `${t.id}: ${t.name}`),
          });
        }
      }
    } catch (error: any) {
      logger.error('ProjectManager: Failed to check subtasks', {
        error: error.message,
      });
    }
  }
}

export default ProjectManager;

