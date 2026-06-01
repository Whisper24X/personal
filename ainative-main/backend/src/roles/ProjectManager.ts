/**
 * Project Manager Role
 * Manages project tasks breakdown using OpenSpec workflow
 */

import { IRoleConfig, ACTION_WRITE_PRD, ACTION_WRITE_DESIGN, ActionStatus, RoleStatus } from '@mind2build/shared';
import { Role } from './Role';
import { Context } from '../core/context/Context';
import { FillProjectContext } from '../actions/FillProjectContext';
import { CreateOpenSpecProposal } from '../actions/CreateOpenSpecProposal';
import { ValidateOpenSpecProposal } from '../actions/ValidateOpenSpecProposal';
import { EstimateStoryPoints } from '../actions/EstimateStoryPoints';
import { ValidateStoryPointEstimates } from '../actions/ValidateStoryPointEstimates';
import { Message } from '../core/message/Message';
import { logger } from '../utils';

// Action name constants
const ACTION_FILL_PROJECT_CONTEXT = 'FillProjectContext';
const ACTION_CREATE_OPENSPEC_PROPOSAL = 'CreateOpenSpecProposal';
const ACTION_VALIDATE_OPENSPEC_PROPOSAL = 'ValidateOpenSpecProposal';
const ACTION_ESTIMATE_STORY_POINTS = 'EstimateStoryPoints';
const ACTION_VALIDATE_STORY_POINT_ESTIMATES = 'ValidateStoryPointEstimates';

export class ProjectManager extends Role {
  constructor(context: Context, name: string = 'ProjectManager') {
    const config: IRoleConfig = {
      name,
      profile: 'ProjectManager',
      goal: 'Break down projects into minimal granularity tasks with story point estimates',
      constraints:
        'Ensure tasks are minimal granularity, independent, testable, and deliverable. Provide clear task descriptions and acceptance criteria.',
      description: 'Experienced project manager who specializes in task breakdown and project planning using OpenSpec workflow',
    };

    super(config, context);

    // Watch for PRD and Design completion to trigger task breakdown
    this.watch([ACTION_WRITE_PRD, ACTION_WRITE_DESIGN]);

    // Set actions - 5 independent actions in execution order
    this.setActions([
      new FillProjectContext(),
      new CreateOpenSpecProposal(),
      new ValidateOpenSpecProposal(),
      new EstimateStoryPoints(),
      new ValidateStoryPointEstimates(),
    ]);
  }

  /**
   * Determine the next action to execute based on current state.
   * Actions are executed in order:
   * 1. FillProjectContext
   * 2. CreateOpenSpecProposal
   * 3. ValidateOpenSpecProposal
   * 4. EstimateStoryPoints
   * 5. ValidateStoryPointEstimates
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

    // Determine which action to execute next based on completed actions
    const nextAction = this.determineNextAction();
    if (!nextAction) {
      logger.info(`${this.profile} think: All actions completed`);
      return false;
    }

    this.rc.todo = nextAction;
    (this.rc.todo as any).status = ActionStatus.PENDING;
    this.rc.status = RoleStatus.PENDING;

    logger.info(`${this.profile} think: Selected next action`, {
      actionName: nextAction.name,
    });

    return true;
  }

  /**
   * Determine the next action to execute based on completed actions in memory
   */
  private determineNextAction() {
    // Define the action sequence
    const actionSequence = [
      ACTION_FILL_PROJECT_CONTEXT,
      ACTION_CREATE_OPENSPEC_PROPOSAL,
      ACTION_VALIDATE_OPENSPEC_PROPOSAL,
      ACTION_ESTIMATE_STORY_POINTS,
      ACTION_VALIDATE_STORY_POINT_ESTIMATES,
    ];

    // Find the first action that hasn't been completed
    for (const actionName of actionSequence) {
      const completedMessages = this.rc.memory.getByAction(actionName);
      const hasCompleted = completedMessages.length > 0;

      if (!hasCompleted) {
        const action = this.actions.find((a) => a.name === actionName);
        if (action) {
          return action;
        }
      }
    }

    return null;
  }

  /**
   * Execute the current action
   */
  async act(): Promise<Message | null> {
    if (!this.rc.todo) {
      return null;
    }

    const action = this.rc.todo;
    logger.info(`${this.profile} executing action: ${action.name}`);

    try {
      // Get workspace options
      const workspaceOptions = this.extractWorkspaceOptions();

      // All OpenSpec actions only need workspace options
      logger.info(`${this.profile} ${action.name}: Executing with workspace options`, {
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

      logger.info(`${this.profile} completed action: ${action.name}`, {
        passed: result.data?.passed,
        type: result.data?.type,
      });

      // Clear current action
      this.rc.todo = null;

      return message;
    } catch (error: any) {
      logger.error(`${this.profile} action failed:`, error);
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
