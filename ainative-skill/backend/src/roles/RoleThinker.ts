/**
 * Role Thinker
 * Handles decision-making logic for role actions
 */

import { RoleReactMode, RoleStatus, ActionStatus } from '@mind2build/shared';
import { BaseAction } from '../core/base/BaseAction';
import { RoleContext } from '../core/context/RoleContext';
import { logger } from '../utils';

export class RoleThinker {
  constructor(
    private profile: string,
    private rc: RoleContext,
    private actions: BaseAction[]
  ) {}

  /**
   * Main think method - routes to appropriate thinking strategy
   */
  async think(): Promise<boolean> {
    this.logThinkInput();

    let result = false;
    if (this.rc.reactMode === RoleReactMode.BY_ORDER) {
      result = this.thinkByOrder();
    } else if (this.rc.reactMode === RoleReactMode.PLAN_AND_ACT) {
      result = await this.thinkPlanAndAct();
    } else {
      result = await this.thinkReact();
    }

    this.logThinkOutput(result);
    return result;
  }

  /**
   * Think in BY_ORDER mode: Execute actions sequentially
   */
  private thinkByOrder(): boolean {
    const relevantMessages = this.rc.news.filter((msg) => this.rc.watch.has(msg.causeBy));
    const hasRelevantMessages = relevantMessages.length > 0;

    this.logThinkByOrderState(relevantMessages.length);

    // If we already have a todo, don't change it
    if (this.rc.todo !== null) {
      logger.debug(`${this.profile} thinkByOrder: Already has todo: ${this.rc.todo.name}`);
      return true;
    }

    // Validate we have actions to execute
    if (this.actions.length === 0) {
      logger.warn(`${this.profile} thinkByOrder: No actions configured`);
      return false;
    }

    // Check if we're in the middle of executing a sequence
    const isInSequence = this.rc.state >= 0 && this.rc.state < this.actions.length - 1;

    if (isInSequence) {
      return this.continueSequence();
    }

    // Check if we have relevant messages to start a new sequence
    if (!hasRelevantMessages) {
      return this.handleNoRelevantMessages();
    }

    // Start a new sequence or continue existing one
    const shouldStartNewSequence = this.rc.state === -1 || this.rc.state >= this.actions.length - 1;

    if (!shouldStartNewSequence && this.rc.state >= 0) {
      return this.continueSequence();
    }

    // Start a new sequence from the first action
    return this.startNewSequence();
  }

  /**
   * Continue executing the current sequence
   */
  private continueSequence(): boolean {
    const nextState = this.rc.state + 1;
    if (nextState >= this.actions.length) {
      logger.error(
        `${this.profile} thinkByOrder: Next state ${nextState} exceeds actions length ${this.actions.length}`
      );
      return false;
    }

    this.rc.state = nextState;
    this.rc.todo = this.actions[this.rc.state];
    this.rc.todo.status = ActionStatus.PENDING;
    this.rc.status = RoleStatus.PENDING;

    logger.info(`${this.profile} thinkByOrder: Continuing to next action ${this.rc.state}: ${this.rc.todo.name}`, {
      actionIndex: this.rc.state,
      actionName: this.rc.todo.name,
      totalActions: this.actions.length,
    });

    return true;
  }

  /**
   * Handle case when there are no relevant messages
   */
  private handleNoRelevantMessages(): boolean {
    const newsCauseBys = this.rc.news.map((msg) => msg.causeBy).join(', ');
    const watchSet = Array.from(this.rc.watch).join(', ');

    if (this.rc.news.length > 0) {
      logger.warn(
        `${this.profile} thinkByOrder: News exists but no relevant messages found. News causeBys: [${newsCauseBys}], Watch set: [${watchSet}]`
      );
    }

    // Reset state ONLY if we've completed all actions
    if (this.rc.state >= this.actions.length - 1) {
      logger.debug(
        `${this.profile} thinkByOrder: All actions completed (state=${this.rc.state} >= ${this.actions.length - 1}), resetting state`
      );
      this.rc.state = -1;
    } else if (this.rc.state >= 0) {
      logger.warn(
        `${this.profile} thinkByOrder: In sequence (state=${this.rc.state}) but no relevant messages. This may indicate a logic issue.`
      );
    }

    return false;
  }

  /**
   * Start a new sequence from the first action
   */
  private startNewSequence(): boolean {
    logger.info(
      `${this.profile} thinkByOrder: Starting new sequence with relevant messages (current state: ${this.rc.state}, actions: ${this.actions.length})`
    );

    this.rc.state = -1;
    this.rc.state++;

    if (this.rc.state >= this.actions.length) {
      logger.error(
        `${this.profile} thinkByOrder: State ${this.rc.state} exceeds actions length ${this.actions.length}`
      );
      return false;
    }

    this.rc.todo = this.actions[this.rc.state];
    this.rc.todo.status = ActionStatus.PENDING;
    this.rc.status = RoleStatus.PENDING;

    logger.info(`${this.profile} thinkByOrder: Set todo to action ${this.rc.state}: ${this.rc.todo.name}`, {
      actionIndex: this.rc.state,
      actionName: this.rc.todo.name,
      actionDescription: this.rc.todo.description,
      totalActions: this.actions.length,
    });

    return true;
  }

  /**
   * Think in REACT mode: LLM decides next action
   */
  private async thinkReact(): Promise<boolean> {
    // For MVP, use simple logic
    // TODO: Implement LLM-based action selection in future
    if (this.actions.length > 0 && this.rc.todo === null) {
      this.rc.todo = this.actions[0];
      this.rc.todo.status = ActionStatus.PENDING;
      this.rc.status = RoleStatus.PENDING;
      return true;
    }
    return false;
  }

  /**
   * Think in PLAN_AND_ACT mode: Plan all actions first
   */
  private async thinkPlanAndAct(): Promise<boolean> {
    // For MVP, similar to BY_ORDER
    // TODO: Implement planning logic in future
    return this.thinkByOrder();
  }

  /**
   * Log think input
   */
  private logThinkInput(): void {
    const newsContents = this.rc.news
      .map(
        (msg, idx) =>
          `[${idx + 1}] ${msg.causeBy} (from ${msg.sentFrom}): ${msg.content.substring(0, 200)}${msg.content.length > 200 ? '...' : ''}`
      )
      .join('\n');

    logger.debug(`${this.profile} think() input - news count: ${this.rc.news.length}, reactMode: ${this.rc.reactMode}`, {
      newsContents: newsContents,
      newsDetails: this.rc.news.map((msg) => ({
        causeBy: msg.causeBy,
        sentFrom: msg.sentFrom,
        contentLength: msg.content.length,
        hasInstructContent: !!msg.instructContent,
      })),
    });
  }

  /**
   * Log think output
   */
  private logThinkOutput(result: boolean): void {
    logger.debug(`${this.profile} think() output:`, {
      result: result,
      selectedTodo: this.rc.todo
        ? {
            name: this.rc.todo.name,
            description: this.rc.todo.description,
            type: this.rc.todo.constructor.name,
          }
        : null,
      state: this.rc.state,
    });
  }

  /**
   * Log thinkByOrder state
   */
  private logThinkByOrderState(relevantCount: number): void {
    const newsCauseBys = this.rc.news.map((msg) => msg.causeBy).join(', ');
    const watchSet = Array.from(this.rc.watch).join(', ');

    logger.debug(
      `${this.profile} thinkByOrder: news=${this.rc.news.length}, news.causeBy=[${newsCauseBys}], watch=[${watchSet}], relevant=${relevantCount}, state=${this.rc.state}, todo=${this.rc.todo ? this.rc.todo.name : 'null'}, actions.length=${this.actions.length}`
    );
  }
}

