/**
 * Project Manager Role
 * Manages project tasks breakdown
 */

import {
  IRoleConfig,
  ACTION_WRITE_PRD,
  ACTION_WRITE_DESIGN,
  ActionStatus,
  RoleStatus,
} from '@mind2build/shared';
import { Role } from './Role';
import { Context } from '../core/context/Context';
import { BreakdownTasks } from '../actions/BreakdownTasks';
import { Message } from '../core/message/Message';
import { logger } from '../utils';

export class ProjectManager extends Role {
  private pendingBreakdown?: {
    applicationId?: string;
    projectId?: string;
    prdContent: string;
  };

  constructor(context: Context, name: string = 'ProjectManager') {
    const config: IRoleConfig = {
      name,
      profile: 'ProjectManager',
      goal: 'Break down projects into minimal granularity tasks',
      constraints: 'Ensure tasks are minimal granularity, independent, testable, and deliverable. Provide clear task descriptions and acceptance criteria.',
      description: 'Experienced project manager who specializes in task breakdown and project planning',
    };
    
    super(config, context);
    
    // Watch for PRD and Design completion to trigger task breakdown
    this.watch([ACTION_WRITE_PRD, ACTION_WRITE_DESIGN]);
    
    // Set actions
    this.setActions([
      new BreakdownTasks(),
    ]);
  }

  /**
   * Only trigger BreakdownTasks when PRD and Design both exist
   * and belong to the same project.
   */
  async think(): Promise<boolean> {
    if (this.rc.todo !== null) {
      logger.debug(`${this.profile} think: Already has todo: ${this.rc.todo.name}`);
      return true;
    }

    const prdMessage = this.findLatestMessage(ACTION_WRITE_PRD);
    const designMessage = this.findLatestMessage(ACTION_WRITE_DESIGN);

    if (!prdMessage || !designMessage) {
      return false;
    }

    const prdIds = this.extractProjectIds(prdMessage);
    const designIds = this.extractProjectIds(designMessage);

    const canMatch =
      prdIds.applicationId &&
      prdIds.projectId &&
      designIds.applicationId &&
      designIds.projectId;

    if (canMatch) {
      const sameProject =
        prdIds.applicationId === designIds.applicationId &&
        prdIds.projectId === designIds.projectId;

      if (!sameProject) {
        logger.warn(`${this.profile} think: PRD/Design project mismatch`, {
          prdApplicationId: prdIds.applicationId,
          prdProjectId: prdIds.projectId,
          designApplicationId: designIds.applicationId,
          designProjectId: designIds.projectId,
        });
        return false;
      }
    } else if (
      prdIds.applicationId ||
      prdIds.projectId ||
      designIds.applicationId ||
      designIds.projectId
    ) {
      // If only one side has IDs, we cannot safely match the same project.
      logger.warn(`${this.profile} think: Missing IDs for PRD/Design pairing`, {
        prdIds,
        designIds,
      });
      return false;
    }

    const breakdownAction = this.actions.find((action) => action.name === 'BreakdownTasks');
    if (!breakdownAction) {
      logger.warn(`${this.profile} think: BreakdownTasks action not configured`);
      return false;
    }

    this.pendingBreakdown = {
      applicationId: prdIds.applicationId || designIds.applicationId,
      projectId: prdIds.projectId || designIds.projectId,
      prdContent: prdMessage.content,
    };

    this.rc.todo = breakdownAction;
    (this.rc.todo as any).status = ActionStatus.PENDING;
    this.rc.status = RoleStatus.PENDING;
    return true;
  }

  /**
   * Override act to handle different action input requirements
   * Supports both think()->act() flow and direct WorkflowExecutor calls
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
        // 优先使用 pendingBreakdown（来自 think()）
        // 如果没有，从 memory 获取（来自 WorkflowExecutor.loadRelevantMessages）
        let prdContent = this.pendingBreakdown?.prdContent;
        let designContent = '';
        
        if (!prdContent) {
          // Fallback: get PRD from memory (loaded by WorkflowExecutor)
          const prdMessages = this.rc.memory.getByAction('WritePRD');
          if (prdMessages.length > 0) {
            prdContent = prdMessages[prdMessages.length - 1].content;
            logger.info(`${this.profile} BreakdownTasks: Got PRD from memory`, {
              prdLength: prdContent.length,
            });
          }
        }
        
        // Get Design content from memory
        const designMessages = this.rc.memory.getByAction('WriteDesign');
        if (designMessages.length > 0) {
          designContent = designMessages[designMessages.length - 1].content;
          logger.info(`${this.profile} BreakdownTasks: Got Design from memory`, {
            designLength: designContent.length,
          });
        }
        
        if (!prdContent) {
          logger.warn(`${this.profile} BreakdownTasks: No PRD content found in pendingBreakdown or memory`);
          return null;
        }
        
        // 获取workspace选项
        const workspaceOptions = this.extractWorkspaceOptions();
        if (
          this.pendingBreakdown?.applicationId &&
          this.pendingBreakdown?.projectId &&
          workspaceOptions &&
          (workspaceOptions.applicationId !== this.pendingBreakdown.applicationId ||
            workspaceOptions.projectId !== this.pendingBreakdown.projectId)
        ) {
          logger.warn(`${this.profile} BreakdownTasks: workspaceOptions mismatch`, {
            pendingApplicationId: this.pendingBreakdown.applicationId,
            pendingProjectId: this.pendingBreakdown.projectId,
            workspaceApplicationId: workspaceOptions.applicationId,
            workspaceProjectId: workspaceOptions.projectId,
          });
        }
        
        logger.info(`${this.profile} BreakdownTasks: Executing with content`, {
          prdLength: prdContent.length,
          designLength: designContent.length,
          hasWorkspaceOptions: !!workspaceOptions,
        });
        
        result = await action.run(prdContent, designContent, workspaceOptions);
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
      this.pendingBreakdown = undefined;
      
      return message;
    } catch (error: any) {
      logger.error(`${this.profile} action failed:`, error);
      this.rc.todo = null;
      this.pendingBreakdown = undefined;
      throw error;
    }
  }

  private findLatestMessage(actionName: string): Message | undefined {
    const newsMatch = [...this.rc.news].reverse().find((msg) => msg.causeBy === actionName);
    if (newsMatch) {
      return newsMatch;
    }
    const memoryMatches = this.rc.memory.getByAction(actionName);
    return memoryMatches.length > 0 ? memoryMatches[memoryMatches.length - 1] : undefined;
  }

  private extractProjectIds(message: Message): { applicationId?: string; projectId?: string } {
    const content = message.instructContent as { applicationId?: string; projectId?: string } | undefined;
    return {
      applicationId: content?.applicationId,
      projectId: content?.projectId,
    };
  }
}

export default ProjectManager;

