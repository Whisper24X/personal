/**
 * Role Action Executor
 * Handles action execution logic with workspace options and special input handling
 */

import { RoleReactMode, RoleStatus, ActionStatus } from '@mind2build/shared';
import { BaseAction } from '../core/base/BaseAction';
import { Message } from '../core/message/Message';
import { RoleContext } from '../core/context/RoleContext';
import { WorkspaceOptions } from '../utils';
import { logger } from '../utils';
import { RoleWorkspaceExtractor } from './RoleWorkspaceExtractor';

export class RoleActionExecutor {
    private static readonly ACTIONS_WITH_OPTIONS = [
        'WriteMRD',
        'WritePRD',
        'WriteDesign',
        'WriteSubProjectDesign',
        'BreakdownTasks',
        'GenerateTask',
        'WriteCode',
        'WriteTest',
        'ExecuteSubtask',
        'ImprovePRD',
        'ImproveMRD',
        'ImproveDesign',
        'MRDReview',
        'PRDReview',
        'DesignReview',
        'SubProjectDesignReview',
    ];

    constructor(
        private profile: string,
        private rc: RoleContext,
        private actions: BaseAction[],
        private workspaceExtractor: RoleWorkspaceExtractor
    ) { }

    /**
     * Execute the current action
     */
    async act(): Promise<Message | null> {
        if (!this.rc.todo) {
            return null;
        }

        const action = this.rc.todo;

        // Update status: action and role both set to running
        action.status = ActionStatus.RUNNING;
        this.rc.status = RoleStatus.RUNNING;

        logger.info(`${this.profile} executing action: ${action.name}`, {
            actionStatus: action.status,
            roleStatus: this.rc.status,
        });

        try {
            // Prepare action input
            const actionInput = this.prepareActionInput(action);
            const workspaceOptions = this.workspaceExtractor.extractWorkspaceOptions(action.name);

            this.logActInput(action, actionInput, workspaceOptions);

            // Execute action
            const result = await this.executeAction(action, actionInput, workspaceOptions);

            this.logActOutput(action, result);

            // Create message from result
            const message = new Message({
                content: result.content,
                role: this.profile,
                causeBy: action.constructor.name,
                sentFrom: this.profile, // Note: Role class will set this.name when creating message
                instructContent: result.data,
            });

            // Update status: action completed, role idle
            action.status = ActionStatus.COMPLETED;
            this.rc.status = RoleStatus.IDLE;

            logger.info(`${this.profile} completed action: ${action.name}`, {
                messageId: message.id,
                messageContentLength: message.content.length,
                messageInstructContent: message.instructContent,
                actionStatus: action.status,
                roleStatus: this.rc.status,
            });

            // Handle sequence continuation in BY_ORDER mode
            this.handleSequenceContinuation();

            return message;
        } catch (error: any) {
            // Update status: action failed, role idle
            action.status = ActionStatus.FAILED;
            this.rc.status = RoleStatus.IDLE;

            logger.error(`${this.profile} action failed:`, {
                actionName: action.name,
                error: error.message,
                errorStack: error.stack,
                contextLength: this.rc.news.map((msg) => msg.content).join('\n\n').length,
                actionStatus: action.status,
                roleStatus: this.rc.status,
            });

            // Don't clear news on error - allow retry
            this.rc.todo = null;
            throw error;
        }
    }

    /**
     * Prepare action input based on action type
     */
    private prepareActionInput(action: BaseAction): string {
        const context = this.rc.news.map((msg) => msg.content).join('\n\n');

        // Special handling for different action types
        switch (action.name) {
            case 'WriteTest':
                return this.prepareWriteTestInput(context);

            case 'MRDReview':
                return this.prepareReviewInput('WriteMRD', 'MRD');

            case 'PRDReview':
                return this.prepareReviewInput('WritePRD', 'PRD');

            case 'ImprovePRD':
                return this.prepareImproveInput('PRDReview', 'PRD review report');

            case 'ImproveMRD':
                return this.prepareImproveInput('MRDReview', 'MRD review report');

            case 'ImproveDesign':
                return this.prepareImproveInput('DesignReview', 'Design review report');

            default:
                return context;
        }
    }

    /**
     * Prepare input for WriteTest action
     */
    private prepareWriteTestInput(context: string): string {
        const prdMessages = this.rc.memory.getByAction('WritePRD');
        if (prdMessages.length > 0) {
            const prdContent = prdMessages[prdMessages.length - 1].content;
            logger.info(`${this.profile} WriteTest: Including PRD from memory`, {
                prdLength: prdContent.length,
                codeLength: context.length,
            });
            return `PRD文档：\n${prdContent}\n\n代码实现：\n${context}`;
        }
        logger.warn(`${this.profile} WriteTest: No PRD found in memory, proceeding with code only`);
        return context;
    }

    /**
     * Prepare input for review actions
     */
    private prepareReviewInput(actionName: string, docType: string): string {
        const docMessage = this.rc.news.find((msg) => msg.causeBy === actionName);
        if (docMessage) {
            logger.info(`${this.profile} ${docType}Review: Using ${docType} content from news`, {
                docLength: docMessage.content.length,
            });
            return docMessage.content;
        }

        // Try memory
        const docMessages = this.rc.memory.getByAction(actionName);
        if (docMessages.length > 0) {
            logger.info(`${this.profile} ${docType}Review: Using ${docType} content from memory`, {
                docLength: docMessages[docMessages.length - 1].content.length,
            });
            return docMessages[docMessages.length - 1].content;
        }

        logger.warn(
            `${this.profile} ${docType}Review: No ${docType} found in news or memory, will try to read from workspace`
        );
        return '';
    }

    /**
     * Prepare input for improve actions
     */
    private prepareImproveInput(reviewActionName: string, reviewType: string): string {
        const reviewMessage = this.rc.news.find((msg) => msg.causeBy === reviewActionName);
        if (reviewMessage) {
            logger.info(`${this.profile} Improve: Using ${reviewType} from news`, {
                reviewLength: reviewMessage.content.length,
            });
            return reviewMessage.content;
        }

        // Try memory
        const reviewMessages = this.rc.memory.getByAction(reviewActionName);
        if (reviewMessages.length > 0) {
            logger.info(`${this.profile} Improve: Using ${reviewType} from memory`, {
                reviewLength: reviewMessages[reviewMessages.length - 1].content.length,
            });
            return reviewMessages[reviewMessages.length - 1].content;
        }

        logger.warn(
            `${this.profile} Improve: No ${reviewType} found in news or memory, will try to read from workspace`
        );
        return '';
    }

    /**
     * Execute action with appropriate parameters
     */
    private async executeAction(
        action: BaseAction,
        input: string,
        workspaceOptions: WorkspaceOptions | undefined
    ): Promise<any> {
        const actionStartTime = Date.now();

        try {
            let result;
            if (this.actionAcceptsOptions(action.name)) {
                result = await this.runActionWithOptions(action, input, workspaceOptions);
            } else {
                result = await action.run(input);
            }

            const executionTime = Date.now() - actionStartTime;
            logger.info(`Action [${action.name}]: Execution completed successfully`, {
                actionName: action.name,
                role: this.profile,
                executionTimeMs: executionTime,
                outputType: result.data?.type,
                contentLength: result.content?.length || 0,
            });

            return result;
        } catch (error: any) {
            const executionTime = Date.now() - actionStartTime;
            logger.error(`Action [${action.name}]: Execution failed`, {
                actionName: action.name,
                role: this.profile,
                executionTimeMs: executionTime,
                error: error.message,
                errorStack: error.stack,
            });
            throw error;
        }
    }

    /**
     * Run action with workspace options
     */
    private async runActionWithOptions(
        action: BaseAction,
        input: string,
        workspaceOptions: WorkspaceOptions | undefined
    ): Promise<any> {
        const actionName = action.name;

        switch (actionName) {
            case 'WriteMRD':
            case 'WritePRD':
            case 'WriteDesign':
            case 'WriteCode':
            case 'WriteTest':
            case 'ExecuteSubtask':
            case 'ImprovePRD':
            case 'ImproveMRD':
            case 'ImproveDesign':
            case 'MRDReview':
            case 'PRDReview':
            case 'DesignReview':
            case 'SubProjectDesignReview':
                return await (action as any).run(input, workspaceOptions);

            case 'WriteSubProjectDesign':
                return await (action as any).run(input, undefined, workspaceOptions);

            case 'BreakdownTasks':
                return await this.runBreakdownTasks(action, workspaceOptions);

            case 'GenerateTask':
                return await this.runGenerateTask(action, input, workspaceOptions);

            default:
                return await action.run(input);
        }
    }

    /**
     * Run BreakdownTasks action
     */
    private async runBreakdownTasks(action: BaseAction, workspaceOptions: WorkspaceOptions | undefined): Promise<any> {
        const prdMessages = this.rc.memory.getByAction('WritePRD');
        const designMessages = this.rc.memory.getByAction('WriteDesign');
        const prd = prdMessages.length > 0 ? prdMessages[prdMessages.length - 1].content : '';
        const design = designMessages.length > 0 ? designMessages[designMessages.length - 1].content : '';
        return await (action as any).run(prd, design, workspaceOptions);
    }

    /**
     * Run GenerateTask action
     */
    private async runGenerateTask(
        action: BaseAction,
        input: string,
        workspaceOptions: WorkspaceOptions | undefined
    ): Promise<any> {
        const taskBreakdownMessages = this.rc.memory.getByAction('BreakdownTasks');
        const subProjectMessages = this.rc.memory.getByAction('WriteSubProjectDesign');
        const taskBreakdown =
            taskBreakdownMessages.length > 0 ? taskBreakdownMessages[taskBreakdownMessages.length - 1].content : input;
        const subProjectDesign =
            subProjectMessages.length > 0 ? subProjectMessages[subProjectMessages.length - 1].content : undefined;
        return await (action as any).run(taskBreakdown, subProjectDesign, workspaceOptions);
    }

    /**
     * Check if action accepts options parameter
     */
    private actionAcceptsOptions(actionName: string): boolean {
        return RoleActionExecutor.ACTIONS_WITH_OPTIONS.includes(actionName);
    }

    /**
     * Handle sequence continuation in BY_ORDER mode
     */
    private handleSequenceContinuation(): void {
        const hasMoreActions =
            this.rc.reactMode === RoleReactMode.BY_ORDER &&
            this.rc.state >= 0 &&
            this.rc.state < this.actions.length - 1;

        logger.info(
            `${this.profile} act() completed: action=${this.rc.todo?.name}, state=${this.rc.state}, actions.length=${this.actions.length}, hasMoreActions=${hasMoreActions}`,
            {
                reactMode: this.rc.reactMode,
                currentState: this.rc.state,
                totalActions: this.actions.length,
                actionNames: this.actions.map((a) => a.name).join(', '),
                nextActionIndex: this.rc.state + 1,
                nextActionName: hasMoreActions ? this.actions[this.rc.state + 1].name : 'none',
                newsCount: this.rc.news.length,
            }
        );

        if (hasMoreActions) {
            logger.info(
                `${this.profile} has more actions in sequence (state=${this.rc.state}, total=${this.actions.length}), clearing todo to allow think() to select next action`
            );
            this.rc.todo = null;
            logger.debug(
                `${this.profile} cleared todo but kept news (${this.rc.news.length} messages) for next action in sequence`
            );
        } else {
            // All actions completed - clear todo and news, and reset state
            this.rc.todo = null;
            this.rc.news = [];
            // Reset state to -1 to indicate sequence is complete
            if (this.rc.reactMode === RoleReactMode.BY_ORDER && this.rc.state >= this.actions.length - 1) {
                logger.debug(`${this.profile} all actions completed (state=${this.rc.state} >= ${this.actions.length - 1}), resetting state to -1`);
                this.rc.state = -1;
            }
            logger.debug(`${this.profile} cleared todo and news after successful action execution (no more actions in sequence)`);
        }
    }

    /**
     * Log act input
     */
    private logActInput(action: BaseAction, actionInput: string, workspaceOptions: WorkspaceOptions | undefined): void {
        logger.info(`${this.profile} act() input:`, {
            actionName: action.name,
            actionType: action.constructor.name,
            contextLength: actionInput.length,
            contextPreview: actionInput.substring(0, 500) + (actionInput.length > 500 ? '...' : ''),
            newsCount: this.rc.news.length,
            workspaceOptions,
            newsDetails: this.rc.news.map((msg) => ({
                causeBy: msg.causeBy,
                sentFrom: msg.sentFrom,
                contentLength: msg.content.length,
                contentPreview: msg.content.substring(0, 200) + (msg.content.length > 200 ? '...' : ''),
            })),
        });

        logger.info(`Action [${action.name}]: Starting execution`, {
            actionName: action.name,
            role: this.profile,
            description: action.description,
            inputLength: actionInput.length,
        });
    }

    /**
     * Log act output
     */
    private logActOutput(action: BaseAction, result: any): void {
        logger.info(`${this.profile} act() output:`, {
            actionName: action.name,
            resultContentLength: result.content.length,
            resultContentPreview: result.content.substring(0, 500) + (result.content.length > 500 ? '...' : ''),
            resultData: result.data,
            hasData: !!result.data,
        });
    }
}

