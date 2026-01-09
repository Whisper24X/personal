/**
 * Workflow Tracker
 * Generic workflow state tracking for any team with roles and actions
 */

import { Team } from './Team';
import { Role } from '../roles/Role';
import { InteractiveSessionWorkflowRepository } from '../database/repositories/InteractiveSessionWorkflowRepository';
import { ActionStatus } from '@mind2build/shared';
import { logger } from '../utils';

export interface WorkflowState {
    role: string | null;
    action: string | null;
}

export interface WorkflowItem {
    role: string;
    action: string;
    status: ActionStatus;
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
            // 使用统一的状态枚举
            const status = message ? ActionStatus.COMPLETED : ActionStatus.RUNNING;
            logger.info(`WorkflowTracker: onRoleComplete - Updating workflow item status: role=${roleName}, action=${actionName}, status=${status}`);
            await this.repository.updateWorkflowItemStatus(
                this.sessionId,
                roleName,
                actionName,
                status
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
                ActionStatus.FAILED
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
     * First tries database by sessionId, then by projectId, then falls back to memory
     */
    async getCurrentState(): Promise<WorkflowState> {
        try {
            // Try database first by sessionId (most reliable)
            let dbState = await this.repository.getRunningState(this.sessionId);

            // If not found and we have projectId, try by projectId
            if ((!dbState || (!dbState.current_role && !dbState.current_action)) && this.projectId) {
                logger.info(`WorkflowTracker: getCurrentState - No state found by sessionId, trying by projectId=${this.projectId}`);
                dbState = await this.repository.getRunningStateByProjectId(this.projectId);
                logger.info(`WorkflowTracker: getCurrentState - Database state by projectId: ${JSON.stringify(dbState)}`);
            }

            if (dbState && (dbState.current_role || dbState.current_action)) {
                const state = {
                    role: dbState.current_role,
                    action: dbState.current_action,
                };
                return state;
            } else {
                logger.warn(`WorkflowTracker: getCurrentState - Database state is empty or null, will fallback to memory`);
            }
        } catch (error: any) {
            logger.warn('WorkflowTracker: Failed to get state from database, using memory', {
                sessionId: this.sessionId,
                projectId: this.projectId,
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
     * First tries by sessionId, then by projectId if not found
     * Returns items sorted by role and action registration order (not alphabetical)
     */
    async getWorkflowItems(): Promise<WorkflowItem[]> {
        try {
            let items = await this.repository.getWorkflowItems(this.sessionId);

            // If no items found and we have projectId, try by projectId
            if (items.length === 0 && this.projectId) {
                logger.info(`WorkflowTracker: No workflow items found by sessionId, trying by projectId=${this.projectId}`);
                items = await this.repository.getWorkflowItemsByProjectId(this.projectId);
            }

            // Get workflow structure to determine the correct order
            const workflowStructure = this.getWorkflowStructure();

            // Create a map for quick lookup: role -> [action1, action2, ...] in registration order
            const roleActionOrderMap = new Map<string, Map<string, number>>();
            workflowStructure.forEach((roleInfo) => {
                const actionOrderMap = new Map<string, number>();
                roleInfo.actions.forEach((action, index) => {
                    actionOrderMap.set(action.name, index);
                });
                roleActionOrderMap.set(roleInfo.role, actionOrderMap);
            });

            // Create role order map
            const roleOrderMap = new Map<string, number>();
            workflowStructure.forEach((roleInfo, index) => {
                roleOrderMap.set(roleInfo.role, index);
            });

            // Sort items by role order first, then by action order within each role
            const sortedItems = items
                .map(item => ({
                    role: item.role,
                    action: item.action || '',
                    status: item.status as ActionStatus,
                }))
                .sort((a, b) => {
                    // First, sort by role order
                    const roleOrderA = roleOrderMap.get(a.role) ?? 999;
                    const roleOrderB = roleOrderMap.get(b.role) ?? 999;

                    if (roleOrderA !== roleOrderB) {
                        return roleOrderA - roleOrderB;
                    }

                    // If same role, sort by action order within that role
                    const actionOrderMap = roleActionOrderMap.get(a.role);
                    if (actionOrderMap) {
                        const actionOrderA = actionOrderMap.get(a.action) ?? 999;
                        const actionOrderB = actionOrderMap.get(b.action) ?? 999;
                        return actionOrderA - actionOrderB;
                    }

                    // Fallback to alphabetical if order not found
                    return a.action.localeCompare(b.action);
                });

            return sortedItems;
        } catch (error: any) {
            logger.error('WorkflowTracker: Failed to get workflow items', {
                sessionId: this.sessionId,
                projectId: this.projectId,
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
     * Check if a specific role and action is completed
     */
    async isActionCompleted(role: string, action: string): Promise<boolean> {
        logger.info(`WorkflowTracker: isActionCompleted called - role=${role}, action=${action}, sessionId=${this.sessionId}`);
        try {
            const isCompleted = await this.repository.isActionCompleted(
                this.sessionId,
                role,
                action
            );
            logger.info(`WorkflowTracker: isActionCompleted - role=${role}, action=${action}, completed=${isCompleted}`);
            return isCompleted;
        } catch (error: any) {
            logger.error('WorkflowTracker: Failed to check action completion', {
                sessionId: this.sessionId,
                role,
                action,
                error: error.message,
            });
            return false; // On error, assume not completed to be safe
        }
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

