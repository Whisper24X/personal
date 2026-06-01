/**
 * Project Manager Role
 * Manages project tasks breakdown using OpenSpec workflow
 * Uses skills-based approach with a single action that executes complete workflow
 */

import { IRoleConfig, ACTION_WRITE_PRD, ACTION_WRITE_DESIGN, ActionStatus, RoleStatus } from '@mind2build/shared';
import { Role } from './Role';
import { Context } from '../core/context/Context';
import { ExecuteProjectManagement } from '../actions/ExecuteProjectManagement';
import { Message } from '../core/message/Message';
import { logger } from '../utils';

// Action name constants
const ACTION_EXECUTE_PROJECT_MANAGEMENT = 'ExecuteProjectManagement';

export class ProjectManager extends Role {
  constructor(context: Context, name: string = 'ProjectManager') {
    const config: IRoleConfig = {
      name,
      profile: 'ProjectManager',
      goal: 'Break down projects into minimal granularity tasks with story point estimates',
      constraints:
        'Ensure tasks are minimal granularity, independent, testable, and deliverable. Provide clear task descriptions and acceptance criteria.',
      description: 'Project manager who executes complete project management workflow using skills',
    };

    super(config, context);

    // Watch for PRD and Design completion to trigger project management workflow
    this.watch([ACTION_WRITE_PRD, ACTION_WRITE_DESIGN]);

    // Set single action that executes the complete workflow via skill
    this.setActions([new ExecuteProjectManagement()]);
  }

  /**
   * Determine if we should execute the project management workflow.
   * Executes when both PRD and Design are available and workflow hasn't run yet.
   */
  async think(): Promise<boolean> {
    if (this.rc.todo !== null) {
      logger.debug(`${this.profile} think: Already has todo: ${this.rc.todo.name}`);
      return true;
    }

    // Check if PRD and Design are both available
    const prdMessage = this.findLatestMessage(ACTION_WRITE_PRD);
    const designMessage = this.findLatestMessage(ACTION_WRITE_DESIGN);

    if (!prdMessage || !designMessage) {
      logger.debug(`${this.profile} think: Waiting for PRD and Design`, {
        hasPRD: !!prdMessage,
        hasDesign: !!designMessage,
      });
      return false;
    }

    // Validate project IDs match
    const prdIds = this.extractProjectIds(prdMessage);
    const designIds = this.extractProjectIds(designMessage);

    const canMatch = prdIds.applicationId && prdIds.projectId && designIds.applicationId && designIds.projectId;

    if (canMatch) {
      const sameProject = prdIds.applicationId === designIds.applicationId && prdIds.projectId === designIds.projectId;

      if (!sameProject) {
        logger.warn(`${this.profile} think: PRD/Design project mismatch`, {
          prdApplicationId: prdIds.applicationId,
          prdProjectId: prdIds.projectId,
          designApplicationId: designIds.applicationId,
          designProjectId: designIds.projectId,
        });
        return false;
      }
    } else if (prdIds.applicationId || prdIds.projectId || designIds.applicationId || designIds.projectId) {
      logger.warn(`${this.profile} think: Missing IDs for PRD/Design pairing`, {
        prdIds,
        designIds,
      });
      return false;
    }

    // Check if workflow has already been executed
    const completedMessages = this.rc.memory.getByAction(ACTION_EXECUTE_PROJECT_MANAGEMENT);
    if (completedMessages.length > 0) {
      logger.info(`${this.profile} think: Project management workflow already executed`);
      return false;
    }

    // Set the action to execute
    this.rc.todo = this.actions[0];
    this.rc.todo.status = ActionStatus.PENDING;
    this.rc.status = RoleStatus.PENDING;

    logger.info(`${this.profile} think: Ready to execute project management workflow`);

    return true;
  }

  /**
   * Execute the project management workflow
   */
  async act(): Promise<Message | null> {
    if (!this.rc.todo) {
      return null;
    }

    const action = this.rc.todo;
    logger.info(`${this.profile} executing workflow: ${action.name}`);

    try {
      // Get workspace options
      const workspaceOptions = this.extractWorkspaceOptions();

      logger.info(`${this.profile} ${action.name}: Executing complete workflow`, {
        hasWorkspaceOptions: !!workspaceOptions,
        applicationId: workspaceOptions?.applicationId,
        projectId: workspaceOptions?.projectId,
      });

      const result = await action.run(workspaceOptions);

      // Create message from result
      const message = new Message({
        content: result.content,
        role: this.profile,
        causeBy: action.name,
        sentFrom: this.name,
        instructContent: result.data,
      });

      logger.info(`${this.profile} completed workflow: ${action.name}`, {
        success: result.data?.success,
        type: result.data?.type,
      });

      // Clear current action
      this.rc.todo = null;

      return message;
    } catch (error: any) {
      logger.error(`${this.profile} workflow failed:`, error);
      this.rc.todo = null;
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
