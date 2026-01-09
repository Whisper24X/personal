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
    private projectId: string;
    private team: Team;
    private repository: InteractiveSessionWorkflowRepository;

    constructor(projectId: string, team: Team) {
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
                this.projectId,
                workflowData
            );

            logger.info(`WorkflowTracker: Initialized workflow for project ${this.projectId}`, {
                projectId: this.projectId,
                rolesCount: roles.length,
            });
        } catch (error: any) {
            logger.error('WorkflowTracker: Failed to initialize workflow', {
                projectId: this.projectId,
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

        logger.info(`WorkflowTracker: onRoleStart - role=${roleName}, todo=${role.rc.todo ? role.rc.todo.name : 'null'}, actionName=${actionName}, projectId=${this.projectId}`);

        // IMPORTANT: Clear all running statuses before setting a new one
        // This ensures only one action can be running at a time
        logger.info(`WorkflowTracker: onRoleStart - Clearing all running statuses before starting new action`);
        await this.repository.clearAllRunningStatuses(this.projectId);
        logger.info(`WorkflowTracker: onRoleStart - All running statuses cleared`);

        logger.info(`WorkflowTracker: onRoleStart - Updating state: role=${roleName}, action=${actionName}`);
        await this.updateState(roleName, actionName);
        logger.info(`WorkflowTracker: onRoleStart - State updated: role=${roleName}, action=${actionName}`);

        // Update workflow item status to RUNNING when action starts
        if (actionName) {
            logger.info(`WorkflowTracker: onRoleStart - Updating workflow item status to RUNNING: role=${roleName}, action=${actionName}`);
            await this.repository.updateWorkflowItemStatus(
                this.projectId,
                roleName,
                actionName,
                ActionStatus.RUNNING
            );
            logger.info(`WorkflowTracker: onRoleStart - Workflow item status updated to RUNNING`);
        }
    }

    /**
     * Track role execution completion
     * Called after role.run() completes
     */
    async onRoleComplete(role: Role, message: any | null): Promise<void> {
        const roleName = role.profile;
        let actionName: string | null = null;

        logger.info(`WorkflowTracker: onRoleComplete START - role=${roleName}, projectId=${this.projectId}`);
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

        logger.info(`WorkflowTracker: onRoleComplete - Determined action: ${actionName}, updating state: role=${roleName}, action=${actionName}, projectId=${this.projectId}`);
        await this.updateState(roleName, actionName);
        logger.info(`WorkflowTracker: onRoleComplete - State updated successfully: role=${roleName}, action=${actionName}`);

        // Update workflow item status if action was executed
        if (actionName) {
            // If message exists, action is completed; otherwise, set to pending (not running)
            // This ensures we don't have multiple running actions at the same time
            const status = message ? ActionStatus.COMPLETED : ActionStatus.PENDING;
            logger.info(`WorkflowTracker: onRoleComplete - Updating workflow item status: role=${roleName}, action=${actionName}, status=${status} (message exists: ${!!message})`);
            await this.repository.updateWorkflowItemStatus(
                this.projectId,
                roleName,
                actionName,
                status
            );
            logger.info(`WorkflowTracker: onRoleComplete - Workflow item status updated`);
        } else {
            logger.warn(`WorkflowTracker: onRoleComplete - Skipping workflow item status update (actionName is null)`);
        }

        logger.info(`WorkflowTracker: onRoleComplete END - role=${roleName}, action=${actionName}, projectId=${this.projectId}`);
    }

    /**
     * Track role execution failure
     */
    async onRoleError(role: Role, error: Error): Promise<void> {
        const roleName = role.profile;
        const actionName = role.rc.todo ? role.rc.todo.name : null;

        logger.error('WorkflowTracker: Role execution error', {
            projectId: this.projectId,
            role: roleName,
            action: actionName,
            error: error.message,
        });

        if (actionName) {
            await this.repository.updateWorkflowItemStatus(
                this.projectId,
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
        await this.updateState(null, null);
    }

    /**
     * Get current running state
     * Only reads from database (no memory fallback)
     */
    async getCurrentState(): Promise<WorkflowState> {
        try {
            const dbState = await this.repository.getRunningState(this.projectId);

            if (dbState) {
                const state = {
                    role: dbState.current_role,
                    action: dbState.current_action,
                };
                logger.info(`WorkflowTracker: getCurrentState - Returning database state: role=${state.role}, action=${state.action}`);
                return state;
            }

            // Return empty state if no database record exists
            logger.info(`WorkflowTracker: getCurrentState - No database state found, returning empty state`);
            return { role: null, action: null };
        } catch (error: any) {
            logger.error('WorkflowTracker: Failed to get state from database', {
                projectId: this.projectId,
                error: error.message,
                errorStack: error.stack,
            });
            // Return empty state on error
            return { role: null, action: null };
        }
    }

    /**
     * Get all workflow items
     * Returns items sorted by role and action registration order (not alphabetical)
     */
    async getWorkflowItems(): Promise<WorkflowItem[]> {
        try {
            const items = await this.repository.getWorkflowItems(this.projectId);

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
     * Directly updates database, no memory state
     */
    async setRunningState(role: string | null, action: string | null): Promise<void> {
        logger.info(`WorkflowTracker: setRunningState called - role=${role}, action=${action}, projectId=${this.projectId}`);
        await this.updateState(role, action);
        logger.info(`WorkflowTracker: setRunningState completed - role=${role}, action=${action}`);
    }

    /**
     * Check if a specific role and action is completed
     */
    async isActionCompleted(role: string, action: string): Promise<boolean> {
        logger.info(`WorkflowTracker: isActionCompleted called - role=${role}, action=${action}, projectId=${this.projectId}`);
        try {
            const isCompleted = await this.repository.isActionCompleted(
                this.projectId,
                role,
                action
            );
            logger.info(`WorkflowTracker: isActionCompleted - role=${role}, action=${action}, completed=${isCompleted}`);
            return isCompleted;
        } catch (error: any) {
            logger.error('WorkflowTracker: Failed to check action completion', {
                projectId: this.projectId,
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
        logger.info(`WorkflowTracker: updateState called - role=${role}, action=${action}, projectId=${this.projectId}`);
        try {
            const result = await this.repository.updateRunningState(
                this.projectId,
                role,
                action
            );
            logger.info(`WorkflowTracker: updateState succeeded - Database returned: role=${result.current_role}, action=${result.current_action}, projectId=${this.projectId}`);
        } catch (error: any) {
            logger.error('WorkflowTracker: Failed to update state in database', {
                projectId: this.projectId,
                role,
                action,
                error: error.message,
                errorStack: error.stack,
            });
            // Don't throw - allow workflow to continue even if DB update fails
        }
    }

    /**
     * Check if all actions for a role are completed
     * Based on database state for the given project
     */
    async areAllRoleActionsCompleted(role: string): Promise<boolean> {
        logger.info(`WorkflowTracker: areAllRoleActionsCompleted called - role=${role}, projectId=${this.projectId}`);
        try {
            const allCompleted = await this.repository.areAllRoleActionsCompleted(
                this.projectId,
                role
            );
            logger.info(`WorkflowTracker: areAllRoleActionsCompleted - role=${role}, allCompleted=${allCompleted}, projectId=${this.projectId}`);
            return allCompleted;
        } catch (error: any) {
            logger.error('WorkflowTracker: Failed to check if all role actions are completed', {
                projectId: this.projectId,
                role,
                error: error.message,
            });
            return false; // On error, assume not completed to be safe
        }
    }

    /**
     * Get all actions status for a role
     * Returns array of action statuses for the given project and role
     */
    async getRoleActionsStatus(role: string): Promise<Array<{ action: string; status: ActionStatus }>> {
        logger.info(`WorkflowTracker: getRoleActionsStatus called - role=${role}, projectId=${this.projectId}`);
        try {
            const statuses = await this.repository.getRoleActionsStatus(
                this.projectId,
                role
            );
            logger.info(`WorkflowTracker: getRoleActionsStatus - role=${role}, actionCount=${statuses.length}, projectId=${this.projectId}`);
            return statuses;
        } catch (error: any) {
            logger.error('WorkflowTracker: Failed to get role actions status', {
                projectId: this.projectId,
                role,
                error: error.message,
            });
            return [];
        }
    }

    /**
     * Set confirmation required status for a role
     */
    async setConfirmationRequired(role: string): Promise<void> {
        logger.info(`WorkflowTracker: setConfirmationRequired called - role=${role}, projectId=${this.projectId}`);
        try {
            await this.repository.setConfirmationRequired(this.projectId, role);
            logger.info(`WorkflowTracker: setConfirmationRequired completed - role=${role}, projectId=${this.projectId}`);
        } catch (error: any) {
            logger.error('WorkflowTracker: Failed to set confirmation required', {
                projectId: this.projectId,
                role,
                error: error.message,
            });
            throw error;
        }
    }

    /**
     * Clear confirmation required status
     */
    async clearConfirmationRequired(): Promise<void> {
        logger.info(`WorkflowTracker: clearConfirmationRequired called - projectId=${this.projectId}`);
        try {
            await this.repository.clearConfirmationRequired(this.projectId);
            logger.info(`WorkflowTracker: clearConfirmationRequired completed - projectId=${this.projectId}`);
        } catch (error: any) {
            logger.error('WorkflowTracker: Failed to clear confirmation required', {
                projectId: this.projectId,
                error: error.message,
            });
            throw error;
        }
    }

    /**
     * Get confirmation status
     */
    async isConfirmationRequired(): Promise<{ required: boolean; role: string | null }> {
        logger.info(`WorkflowTracker: isConfirmationRequired called - projectId=${this.projectId}`);
        try {
            const status = await this.repository.getConfirmationStatus(this.projectId);
            logger.info(`WorkflowTracker: isConfirmationRequired - required=${status.required}, role=${status.role}, projectId=${this.projectId}`);
            return status;
        } catch (error: any) {
            logger.error('WorkflowTracker: Failed to get confirmation status', {
                projectId: this.projectId,
                error: error.message,
            });
            return { required: false, role: null };
        }
    }
}

