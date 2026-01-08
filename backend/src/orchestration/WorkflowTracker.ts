/**
 * Workflow Tracker
 * Generic workflow state tracking for any team with roles and actions
 */

import { Team } from './Team';
import { Role } from '../roles/Role';
import { InteractiveSessionWorkflowRepository } from '../database/repositories/InteractiveSessionWorkflowRepository';
import { logger } from '../utils';

export interface WorkflowState {
    role: string | null;
    action: string | null;
}

export interface WorkflowItem {
    role: string;
    action: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
}

export class WorkflowTracker {
    private sessionId: string;
    private projectId: string | null;
    private team: Team;
    private repository: InteractiveSessionWorkflowRepository;
    private currentState: WorkflowState = { role: null, action: null };

    constructor(sessionId: string, projectId: string | null, team: Team) {
        this.sessionId = sessionId;
        this.projectId = projectId;
        this.team = team;
        this.repository = new InteractiveSessionWorkflowRepository();
    }

    /**
     * Initialize workflow tracking
     * Registers all roles and their actions in the database
     */
    async initialize(): Promise<void> {
        try {
            const roles = this.team.getEnvironment().getRoles();
            const workflowData = roles.map(role => ({
                role: role.profile,
                actions: role.actions.map(action => ({
                    name: action.name,
                })),
            }));

            await this.repository.initializeWorkflow(
                this.sessionId,
                this.projectId,
                workflowData
            );

            logger.info(`WorkflowTracker: Initialized workflow for session ${this.sessionId}`, {
                sessionId: this.sessionId,
                rolesCount: roles.length,
            });
        } catch (error: any) {
            logger.error('WorkflowTracker: Failed to initialize workflow', {
                sessionId: this.sessionId,
                error: error.message,
            });
            throw error;
        }
    }

    /**
     * Track role execution start
     * Called before role.run() is executed
     */
    async onRoleStart(role: Role): Promise<void> {
        const roleName = role.profile;
        const actionName = role.rc.todo ? role.rc.todo.name : null;

        logger.info(`WorkflowTracker: onRoleStart - role=${roleName}, todo=${role.rc.todo ? role.rc.todo.name : 'null'}, actionName=${actionName}, sessionId=${this.sessionId}`);

        this.currentState = {
            role: roleName,
            action: actionName,
        };

        logger.info(`WorkflowTracker: onRoleStart - Updating state: role=${roleName}, action=${actionName}`);
        await this.updateState(roleName, actionName);
        logger.info(`WorkflowTracker: onRoleStart - State updated: role=${roleName}, action=${actionName}`);
    }

    /**
     * Track role execution completion
     * Called after role.run() completes
     */
    async onRoleComplete(role: Role, message: any | null): Promise<void> {
        const roleName = role.profile;
        let actionName: string | null = null;

        logger.info(`WorkflowTracker: onRoleComplete START - role=${roleName}, sessionId=${this.sessionId}`);
        logger.info(`WorkflowTracker: onRoleComplete - message exists: ${!!message}, message.causeBy: ${message?.causeBy}, message.causeBy type: ${typeof message?.causeBy}`);
        logger.info(`WorkflowTracker: onRoleComplete - role.rc.todo: ${role.rc.todo ? role.rc.todo.name : 'null'}`);

        // Determine the actual executed action
        // Priority: message.causeBy > role.rc.todo
        if (message) {
            // If message exists, try to get causeBy (even if it's an empty string)
            // Only use it if it's a non-empty string
            const causeBy = message.causeBy;
            const causeByType = typeof causeBy;
            const causeByTrimmed = causeBy && typeof causeBy === 'string' ? causeBy.trim() : null;
            const causeByLength = causeByTrimmed ? causeByTrimmed.length : 0;

            logger.info(`WorkflowTracker: onRoleComplete - Checking message.causeBy: value=${causeBy}, type=${causeByType}, trimmed=${causeByTrimmed}, length=${causeByLength}`);

            if (causeBy && causeByType === 'string' && causeByLength > 0) {
                actionName = causeBy;
                logger.info(`WorkflowTracker: onRoleComplete - Using message.causeBy: ${actionName}`);
            } else {
                // Fallback to todo if causeBy is not available
                const todo = role.rc.todo;
                if (todo) {
                    actionName = todo.name;
                    logger.info(`WorkflowTracker: onRoleComplete - Using role.rc.todo.name: ${actionName} (message.causeBy was invalid: ${causeBy})`);
                } else {
                    logger.warn(`WorkflowTracker: onRoleComplete - No action found. message.causeBy: ${causeBy}, role.rc.todo: null`);
                }
            }
        } else {
            // If no message, fallback to todo
            const todo = role.rc.todo;
            if (todo) {
                actionName = todo.name;
                logger.info(`WorkflowTracker: onRoleComplete - No message, using role.rc.todo.name: ${actionName}`);
            } else {
                logger.warn(`WorkflowTracker: onRoleComplete - No message and no todo, action will be null`);
            }
        }

        // Update state with the actual executed action
        this.currentState = {
            role: roleName,
            action: actionName,
        };

        logger.info(`WorkflowTracker: onRoleComplete - Determined action: ${actionName}, updating state: role=${roleName}, action=${actionName}, sessionId=${this.sessionId}`);
        await this.updateState(roleName, actionName);
        logger.info(`WorkflowTracker: onRoleComplete - State updated successfully: role=${roleName}, action=${actionName}`);

        // Update workflow item status if action was executed
        if (actionName) {
            logger.info(`WorkflowTracker: onRoleComplete - Updating workflow item status: role=${roleName}, action=${actionName}, status=${message ? 'completed' : 'running'}`);
            await this.repository.updateWorkflowItemStatus(
                this.sessionId,
                roleName,
                actionName,
                message ? 'completed' : 'running'
            );
            logger.info(`WorkflowTracker: onRoleComplete - Workflow item status updated`);
        } else {
            logger.warn(`WorkflowTracker: onRoleComplete - Skipping workflow item status update (actionName is null)`);
        }

        logger.info(`WorkflowTracker: onRoleComplete END - role=${roleName}, action=${actionName}, sessionId=${this.sessionId}`);
    }

    /**
     * Track role execution failure
     */
    async onRoleError(role: Role, error: Error): Promise<void> {
        const roleName = role.profile;
        const actionName = role.rc.todo ? role.rc.todo.name : null;

        logger.error('WorkflowTracker: Role execution error', {
            sessionId: this.sessionId,
            role: roleName,
            action: actionName,
            error: error.message,
        });

        if (actionName) {
            await this.repository.updateWorkflowItemStatus(
                this.sessionId,
                roleName,
                actionName,
                'failed'
            );
        }

        // Clear running state on error
        await this.clearState();
    }

    /**
     * Track role idle state (no action to execute)
     */
    async onRoleIdle(_role: Role): Promise<void> {
        // Clear running state when role is idle
        await this.clearState();
    }

    /**
     * Clear current running state
     * Called when moving to next role or session completes
     */
    async clearState(): Promise<void> {
        this.currentState = { role: null, action: null };
        await this.updateState(null, null);
    }

    /**
     * Get current running state
     * First tries database, then falls back to memory
     */
    async getCurrentState(): Promise<WorkflowState> {
        logger.info(`WorkflowTracker: getCurrentState called - sessionId=${this.sessionId}`);
        try {
            // Try database first (most reliable)
            const dbState = await this.repository.getRunningState(this.sessionId);
            logger.info(`WorkflowTracker: getCurrentState - Database state: ${JSON.stringify(dbState)}`);

            if (dbState && (dbState.current_role || dbState.current_action)) {
                const state = {
                    role: dbState.current_role,
                    action: dbState.current_action,
                };
                logger.info(`WorkflowTracker: getCurrentState - Returning database state: role=${state.role}, action=${state.action}`);
                return state;
            } else {
                logger.warn(`WorkflowTracker: getCurrentState - Database state is empty or null, will fallback to memory`);
            }
        } catch (error: any) {
            logger.warn('WorkflowTracker: Failed to get state from database, using memory', {
                sessionId: this.sessionId,
                error: error.message,
                errorStack: error.stack,
            });
        }

        // Fallback to memory state
        const memoryState = { ...this.currentState };
        logger.info(`WorkflowTracker: getCurrentState - Returning memory state: role=${memoryState.role}, action=${memoryState.action}`);
        return memoryState;
    }

    /**
     * Get all workflow items
     */
    async getWorkflowItems(): Promise<WorkflowItem[]> {
        try {
            const items = await this.repository.getWorkflowItems(this.sessionId);
            return items.map(item => ({
                role: item.role,
                action: item.action || '',
                status: item.status as 'pending' | 'running' | 'completed' | 'failed',
            }));
        } catch (error: any) {
            logger.error('WorkflowTracker: Failed to get workflow items', {
                sessionId: this.sessionId,
                error: error.message,
            });
            return [];
        }
    }

    /**
     * Get workflow structure (all roles and their actions)
     */
    getWorkflowStructure(): Array<{
        role: string;
        actions: Array<{
            name: string;
            description: string;
        }>;
    }> {
        const roles = this.team.getEnvironment().getRoles();
        return roles.map(role => ({
            role: role.profile,
            actions: role.actions.map(action => ({
                name: action.name,
                description: action.description || '',
            })),
        }));
    }

    /**
     * Set running state explicitly (public method for external updates)
     */
    async setRunningState(role: string | null, action: string | null): Promise<void> {
        logger.info(`WorkflowTracker: setRunningState called - role=${role}, action=${action}, sessionId=${this.sessionId}`);
        this.currentState = { role, action };
        logger.debug(`WorkflowTracker: setRunningState - Updated memory state: ${JSON.stringify(this.currentState)}`);
        await this.updateState(role, action);
        logger.info(`WorkflowTracker: setRunningState completed - role=${role}, action=${action}`);
    }

    /**
     * Update state in database
     */
    private async updateState(role: string | null, action: string | null): Promise<void> {
        logger.info(`WorkflowTracker: updateState called - role=${role}, action=${action}, sessionId=${this.sessionId}, projectId=${this.projectId}`);
        try {
            const result = await this.repository.updateRunningState(
                this.sessionId,
                this.projectId,
                role,
                action
            );
            logger.info(`WorkflowTracker: updateState succeeded - Database returned: role=${result.current_role}, action=${result.current_action}, sessionId=${this.sessionId}`);
        } catch (error: any) {
            logger.error('WorkflowTracker: Failed to update state in database', {
                sessionId: this.sessionId,
                role,
                action,
                error: error.message,
                errorStack: error.stack,
            });
            // Don't throw - allow workflow to continue even if DB update fails
        }
    }
}

