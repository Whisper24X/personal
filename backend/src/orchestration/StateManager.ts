/**
 * State Manager
 * Unified state management for all workflow states
 * Integrates all WorkflowTracker functionality
 */

import { Team } from './Team';
import { InteractiveSessionWorkflowRepository } from '../database/repositories/InteractiveSessionWorkflowRepository';
import { ActionStatus } from '@mind2build/shared';
import { logger } from '../utils';
import { StepStateTracker, StepState } from './StepStateTracker';
import { query } from '../database/client';

export interface WorkflowState {
    role: string | null;
    action: string | null;
}

export interface ConfirmationStatus {
    required: boolean;
    role: string | null;
}

export interface RoleContextState {
    state: number;
    todo: string | null;
}

// Rollback lock map to prevent concurrent rollbacks
const rollbackLocks = new Map<string, Promise<void>>();

// Action execution lock map to prevent concurrent action execution
const actionExecutionLocks = new Map<string, Promise<void>>();

export class StateManager {
    private projectId: string;
    private team: Team;
    private repository: InteractiveSessionWorkflowRepository;
    private stepStateTracker: StepStateTracker;
    private abortControllers: Map<string, AbortController> = new Map();

    constructor(projectId: string, team: Team) {
        this.projectId = projectId;
        this.team = team;
        this.repository = new InteractiveSessionWorkflowRepository();
        this.stepStateTracker = new StepStateTracker(projectId);
    }

    /**
     * Initialize workflow tracking
     * Registers all roles and their actions in the database with role_order and action_order
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

            // Check and fix NULL order values
            await this.fixOrderFields();

            logger.info(`StateManager: Initialized workflow for project ${this.projectId}`, {
                projectId: this.projectId,
                rolesCount: roles.length,
            });
        } catch (error: any) {
            logger.error('StateManager: Failed to initialize workflow', {
                projectId: this.projectId,
                error: error.message,
            });
            throw error;
        }
    }

    /**
     * Fix NULL role_order and action_order fields
     */
    private async fixOrderFields(): Promise<void> {
        try {
            const items = await this.repository.getWorkflowItems(this.projectId);
            const nullItems = items.filter(item => {
                const itemAny = item as any;
                return itemAny.role_order === null || itemAny.action_order === null;
            });

            if (nullItems.length > 0) {
                logger.warn(`StateManager: Found ${nullItems.length} items with NULL order, fixing...`);
                
                const roles = this.team.getEnvironment().getRoles();
                const roleOrderMap = new Map<string, number>();
                roles.forEach((role, index) => {
                    roleOrderMap.set(role.profile, index);
                });

                for (const item of nullItems) {
                    const roleOrder = roleOrderMap.get(item.role) ?? null;
                    if (roleOrder === null) {
                        continue;
                    }

                    const role = roles.find(r => r.profile === item.role);
                    if (!role) {
                        continue;
                    }

                    const actionIndex = role.actions.findIndex(a => a.name === item.action);
                    if (actionIndex === -1) {
                        continue;
                    }

                    await query(
                        `UPDATE interactive_session_workflows
                         SET role_order = $1, action_order = $2, updated_at = NOW()
                         WHERE project_id = $3 AND role = $4 AND action = $5`,
                        [roleOrder, actionIndex, this.projectId, item.role, item.action || '']
                    );
                }

                logger.info(`StateManager: Fixed ${nullItems.length} items with NULL order`);
            }
        } catch (error: any) {
            logger.error('StateManager: Failed to fix order fields', {
                projectId: this.projectId,
                error: error.message,
            });
        }
    }

    /**
     * Get action status
     */
    async getActionStatus(role: string, action: string): Promise<ActionStatus> {
        try {
            const isCompleted = await this.repository.isActionCompleted(
                this.projectId,
                role,
                action
            );

            if (isCompleted) {
                return ActionStatus.COMPLETED;
            }

            // Check if it's RUNNING
            const runningState = await this.repository.getRunningState(this.projectId);
            if (runningState?.current_role === role && runningState?.current_action === action) {
                const items = await this.repository.getWorkflowItems(this.projectId);
                const item = items.find(i => i.role === role && i.action === action);
                if (item && item.status === ActionStatus.RUNNING) {
                    return ActionStatus.RUNNING;
                }
            }

            // Check if it's FAILED
            const items = await this.repository.getWorkflowItems(this.projectId);
            const item = items.find(i => i.role === role && i.action === action);
            if (item && item.status === ActionStatus.FAILED) {
                return ActionStatus.FAILED;
            }

            return ActionStatus.PENDING;
        } catch (error: any) {
            logger.error('StateManager: Failed to get action status', {
                projectId: this.projectId,
                role,
                action,
                error: error.message,
            });
            return ActionStatus.PENDING;
        }
    }

    /**
     * Set action status
     */
    async setActionStatus(role: string, action: string, status: ActionStatus): Promise<void> {
        try {
            await this.repository.updateWorkflowItemStatus(
                this.projectId,
                role,
                action,
                status
            );

            this.logStateChange('action', role, action, status);
        } catch (error: any) {
            logger.error('StateManager: Failed to set action status', {
                projectId: this.projectId,
                role,
                action,
                status,
                error: error.message,
            });
            throw error;
        }
    }

    /**
     * Get role actions status
     */
    async getRoleActionsStatus(role: string): Promise<Array<{ action: string; status: ActionStatus }>> {
        try {
            return await this.repository.getRoleActionsStatus(this.projectId, role);
        } catch (error: any) {
            logger.error('StateManager: Failed to get role actions status', {
                projectId: this.projectId,
                role,
                error: error.message,
            });
            return [];
        }
    }

    /**
     * Get running state
     */
    async getRunningState(): Promise<WorkflowState> {
        try {
            const dbState = await this.repository.getRunningState(this.projectId);

            if (dbState) {
                return {
                    role: dbState.current_role,
                    action: dbState.current_action,
                };
            }

            return { role: null, action: null };
        } catch (error: any) {
            logger.error('StateManager: Failed to get running state', {
                projectId: this.projectId,
                error: error.message,
            });
            return { role: null, action: null };
        }
    }

    /**
     * Set running state
     */
    async setRunningState(role: string | null, action: string | null): Promise<void> {
        try {
            await this.repository.updateRunningState(
                this.projectId,
                role,
                action
            );

            this.logStateChange('running', role || 'null', action || 'null', { role, action });
        } catch (error: any) {
            logger.error('StateManager: Failed to set running state', {
                projectId: this.projectId,
                role,
                action,
                error: error.message,
            });
            throw error;
        }
    }

    /**
     * Get running state with timestamp
     */
    async getRunningStateWithTimestamp(): Promise<{ role: string | null; action: string | null; updatedAt: Date | null }> {
        try {
            const dbState = await this.repository.getRunningState(this.projectId);
            
            if (dbState) {
                return {
                    role: dbState.current_role,
                    action: dbState.current_action,
                    updatedAt: dbState.updated_at,
                };
            }

            return { role: null, action: null, updatedAt: null };
        } catch (error: any) {
            logger.error('StateManager: Failed to get running state with timestamp', {
                projectId: this.projectId,
                error: error.message,
            });
            return { role: null, action: null, updatedAt: null };
        }
    }

    /**
     * Clear running state
     */
    async clearRunningState(): Promise<void> {
        await this.setRunningState(null, null);
    }

    /**
     * Get RoleContext state (state and todo)
     */
    async getRoleContextState(role: string): Promise<RoleContextState> {
        try {
            const runningState = await this.repository.getRunningState(this.projectId);
            
            if (runningState && runningState.current_role === role) {
                return {
                    state: runningState.role_state ?? -1,
                    todo: runningState.role_todo_action ?? null,
                };
            }

            return { state: -1, todo: null };
        } catch (error: any) {
            logger.error('StateManager: Failed to get RoleContext state', {
                projectId: this.projectId,
                role,
                error: error.message,
            });
            return { state: -1, todo: null };
        }
    }

    /**
     * Set RoleContext state (state and todo)
     */
    async setRoleContextState(role: string, state: number, todo: string | null): Promise<void> {
        try {
            // Get current running state to preserve other fields
            const currentState = await this.repository.getRunningState(this.projectId);
            
            await this.repository.updateRunningState(
                this.projectId,
                currentState?.current_role ?? null,
                currentState?.current_action ?? null,
                currentState?.requires_confirmation,
                currentState?.confirmation_role ?? null,
                state,
                todo
            );

            this.logStateChange('roleContext', role, null, { state, todo });
        } catch (error: any) {
            logger.error('StateManager: Failed to set RoleContext state', {
                projectId: this.projectId,
                role,
                state,
                todo,
                error: error.message,
            });
            throw error;
        }
    }

    /**
     * Clear RoleContext state (reset to state=-1, todo=null)
     */
    async clearRoleContextState(role: string): Promise<void> {
        await this.setRoleContextState(role, -1, null);
    }

    /**
     * Get confirmation status
     */
    async getConfirmationStatus(): Promise<ConfirmationStatus> {
        try {
            return await this.repository.getConfirmationStatus(this.projectId);
        } catch (error: any) {
            logger.error('StateManager: Failed to get confirmation status', {
                projectId: this.projectId,
                error: error.message,
            });
            return { required: false, role: null };
        }
    }

    /**
     * Set confirmation required
     */
    async setConfirmationRequired(role: string): Promise<void> {
        try {
            await this.repository.setConfirmationRequired(this.projectId, role);
            this.logStateChange('confirmation', role, null, { required: true });
        } catch (error: any) {
            logger.error('StateManager: Failed to set confirmation required', {
                projectId: this.projectId,
                role,
                error: error.message,
            });
            throw error;
        }
    }

    /**
     * Clear confirmation required
     */
    async clearConfirmationRequired(): Promise<void> {
        try {
            await this.repository.clearConfirmationRequired(this.projectId);
            this.logStateChange('confirmation', 'null', null, { required: false });
        } catch (error: any) {
            logger.error('StateManager: Failed to clear confirmation required', {
                projectId: this.projectId,
                error: error.message,
            });
            throw error;
        }
    }

    /**
     * Get step state
     */
    async getStepState(role: string, action: string, stepId: string): Promise<StepState> {
        return await this.stepStateTracker.getStepState(role, action, stepId);
    }

    /**
     * Set step state
     */
    async setStepState(role: string, action: string, stepId: string, status: StepState): Promise<void> {
        await this.stepStateTracker.setStepState(role, action, stepId, status);
        this.logStateChange('step', role, action, status, stepId);
    }

    /**
     * Reset step states
     */
    async resetStepStates(role: string, action: string): Promise<void> {
        await this.stepStateTracker.resetStepStates(role, action);
    }

    /**
     * Get workflow items (sorted by role_order and action_order)
     */
    async getWorkflowItems(): Promise<Array<{ role: string; action: string; status: ActionStatus; retry_count?: number }>> {
        try {
            const items = await this.repository.getWorkflowItems(this.projectId);
            return items.map(item => ({
                role: item.role,
                action: item.action || '',
                status: item.status as ActionStatus,
                retry_count: item.retry_count || 0,
            }));
        } catch (error: any) {
            logger.error('StateManager: Failed to get workflow items', {
                projectId: this.projectId,
                error: error.message,
            });
            return [];
        }
    }

    /**
     * Get workflow structure
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
     * Get next action for a role (first pending action by action_order)
     */
    async getNextAction(role: string): Promise<{ role: string; action: string } | null> {
        try {
            const items = await this.repository.getWorkflowItems(this.projectId);
            const pendingItems = items.filter(item => 
                item.role === role && item.status === ActionStatus.PENDING
            );

            if (pendingItems.length === 0) {
                return null;
            }

            // Sort by action_order and return first
            // Note: items from repository should already be sorted, but we ensure it here
            const sortedItems = pendingItems.sort((a, b) => {
                const itemA = a as any;
                const itemB = b as any;
                const orderA = itemA.action_order ?? 999;
                const orderB = itemB.action_order ?? 999;
                return orderA - orderB;
            });

            return {
                role: sortedItems[0].role,
                action: sortedItems[0].action || '',
            };
        } catch (error: any) {
            logger.error('StateManager: Failed to get next action', {
                projectId: this.projectId,
                role,
                error: error.message,
            });
            return null;
        }
    }

    /**
     * Check if action is completed
     */
    async isActionCompleted(role: string, action: string): Promise<boolean> {
        return await this.repository.isActionCompleted(this.projectId, role, action);
    }

    /**
     * Check if all role actions are completed
     */
    async areAllRoleActionsCompleted(role: string): Promise<boolean> {
        return await this.repository.areAllRoleActionsCompleted(this.projectId, role);
    }

    /**
     * Check if action is last action for role
     */
    async isLastActionForRole(role: string, action: string): Promise<boolean> {
        return await this.repository.isLastActionForRole(this.projectId, role, action);
    }

    /**
     * On action start
     */
    async onActionStart(role: string, action: string): Promise<void> {
        const lockKey = `${this.projectId}:${role}:${action}`;

        // Check if action execution is already in progress
        if (actionExecutionLocks.has(lockKey)) {
            logger.warn('StateManager: Action execution already in progress, waiting...', {
                projectId: this.projectId,
                role,
                action,
            });
            await actionExecutionLocks.get(lockKey);
            return;
        }

        // Check if another action is currently running
        const currentRunningState = await this.getRunningState();
        if (currentRunningState.role && currentRunningState.action) {
            // If different action is running, wait a bit and check again
            if (currentRunningState.role !== role || currentRunningState.action !== action) {
                const currentActionStatus = await this.getActionStatus(currentRunningState.role, currentRunningState.action);
                if (currentActionStatus === ActionStatus.RUNNING) {
                    logger.warn('StateManager: Another action is already running, waiting before starting new action', {
                        projectId: this.projectId,
                        currentRole: currentRunningState.role,
                        currentAction: currentRunningState.action,
                        newRole: role,
                        newAction: action,
                    });
                    // Wait up to 2 seconds for current action to complete
                    const maxWaitTime = 2000;
                    const startTime = Date.now();
                    while (Date.now() - startTime < maxWaitTime) {
                        await this.delay(200);
                        const checkState = await this.getRunningState();
                        if (!checkState.action || checkState.role !== currentRunningState.role || checkState.action !== currentRunningState.action) {
                            break; // Current action completed
                        }
                        const checkStatus = await this.getActionStatus(checkState.role, checkState.action);
                        if (checkStatus !== ActionStatus.RUNNING) {
                            break; // Current action is no longer running
                        }
                    }
                }
            }
        }

        // Create action execution lock
        const executionPromise = (async () => {
            try {
                // Clear all running statuses
                await this.repository.clearAllRunningStatuses(this.projectId);

                // Set current action to RUNNING
                await this.setActionStatus(role, action, ActionStatus.RUNNING);

                // Update running state
                await this.repository.updateRunningState(this.projectId, role, action);

                // Update RoleContext state
                const actionIndex = await this.getActionIndex(role, action);
                await this.setRoleContextState(role, actionIndex, action);

                this.logStateChange('actionStart', role, action, ActionStatus.RUNNING);
            } catch (error: any) {
                logger.error('StateManager: Failed to handle action start', {
                    projectId: this.projectId,
                    role,
                    action,
                    error: error.message,
                });
                throw error;
            } finally {
                // Remove lock after execution completes
                actionExecutionLocks.delete(lockKey);
            }
        })();

        actionExecutionLocks.set(lockKey, executionPromise);

        try {
            await executionPromise;
        } catch (error: any) {
            // Remove lock on error
            actionExecutionLocks.delete(lockKey);
            throw error;
        }
    }

    /**
     * On action complete
     */
    async onActionComplete(role: string, action: string, _message?: any): Promise<void> {
        try {
            // Reset retry count when action succeeds
            await this.repository.resetRetryCount(this.projectId, role, action);

            // Set action to COMPLETED
            await this.setActionStatus(role, action, ActionStatus.COMPLETED);

            // Check if this is the last action for the role
            const isLastAction = await this.isLastActionForRole(role, action);
            if (isLastAction) {
                // Set confirmation required BEFORE clearing running state
                await this.setConfirmationRequired(role);
                // Clear running state when last action completes
                await this.clearRunningState();
            }

            this.logStateChange('actionComplete', role, action, ActionStatus.COMPLETED);
        } catch (error: any) {
            logger.error('StateManager: Failed to handle action complete', {
                projectId: this.projectId,
                role,
                action,
                error: error.message,
            });
            throw error;
        }
    }

    /**
     * On action error
     * Implements auto-retry mechanism: retry up to 3 times, then require manual intervention
     */
    async onActionError(role: string, action: string, error: Error): Promise<{ shouldRetry: boolean }> {
        try {
            // Get current retry count
            const retryCount = await this.repository.getRetryCount(this.projectId, role, action);

            if (retryCount < 3) {
                // Increment retry count and reset action to PENDING for retry
                const newRetryCount = await this.repository.incrementRetryCount(this.projectId, role, action);
                logger.info('StateManager: Action failed, retrying', {
                    projectId: this.projectId,
                    role,
                    action,
                    retryCount: newRetryCount,
                    maxRetries: 3,
                    error: error.message,
                });

                // Reset action status to PENDING to allow retry
                await this.setActionStatus(role, action, ActionStatus.PENDING);
                await this.clearRunningState();
                await this.clearRoleContextState(role);

                this.logStateChange('actionError', role, action, { status: ActionStatus.PENDING, retryCount: newRetryCount });

                return { shouldRetry: true };
            } else {
                // Max retries reached, mark as FAILED and require manual intervention
                logger.error('StateManager: Action failed after max retries, requiring manual intervention', {
                    projectId: this.projectId,
                    role,
                    action,
                    retryCount,
                    error: error.message,
                });

                await this.setActionStatus(role, action, ActionStatus.FAILED);
                await this.clearRunningState();
                await this.clearRoleContextState(role);

                // Check if this is the last action for the role
                const isLastAction = await this.isLastActionForRole(role, action);
                if (isLastAction) {
                    // Set confirmation required for manual intervention
                    await this.setConfirmationRequired(role);
                    logger.info('StateManager: Set confirmation required for failed last action', {
                        projectId: this.projectId,
                        role,
                        action,
                    });
                }

                this.logStateChange('actionError', role, action, { status: ActionStatus.FAILED, retryCount, maxRetriesReached: true });

                return { shouldRetry: false };
            }
        } catch (err: any) {
            logger.error('StateManager: Failed to handle action error', {
                projectId: this.projectId,
                role,
                action,
                error: err.message,
            });
            // On error, mark as FAILED and don't retry
            await this.setActionStatus(role, action, ActionStatus.FAILED);
            await this.clearRunningState();
            return { shouldRetry: false };
        }
    }

    /**
     * On action idle
     */
    async onActionIdle(role: string): Promise<void> {
        await this.clearRunningState();
        await this.clearRoleContextState(role);
    }

    /**
     * Reset workflow from a role
     */
    async resetWorkflow(role: string): Promise<void> {
        const lockKey = `${this.projectId}:${role}`;

        // Check if rollback is already in progress
        if (rollbackLocks.has(lockKey)) {
            logger.warn('StateManager: Rollback already in progress, waiting...');
            await rollbackLocks.get(lockKey);
            return;
        }

        // Create rollback promise
        const rollbackPromise = this.executeRollback(role);
        rollbackLocks.set(lockKey, rollbackPromise);

        try {
            await rollbackPromise;
        } finally {
            rollbackLocks.delete(lockKey);
        }
    }

    /**
     * Execute rollback
     */
    private async executeRollback(role: string): Promise<void> {
        try {
            // Step 1: Stop running operations
            await this.stopRunningOperations();

            // Step 2: Reset database state
            await this.repository.resetWorkflowFromRole(this.projectId, role);

            // Step 3: Clear message content
            const downstreamRoles = await this.repository.getDownstreamRoles(this.projectId, role);
            await this.repository.clearMessageContent(this.projectId, downstreamRoles);

            // Step 4: Reset step states
            for (const downstreamRole of downstreamRoles) {
                await this.stepStateTracker.resetStepStatesForRole(downstreamRole);
            }

            // Step 5: Reset RoleContext state
            await this.clearRoleContextState(role);

            // Step 6: Set first action to RUNNING
            const firstAction = await this.repository.getFirstActionForRole(this.projectId, role);
            if (firstAction) {
                await this.setActionStatus(role, firstAction.action, ActionStatus.RUNNING);
                await this.setRunningState(role, firstAction.action);
                await this.setRoleContextState(role, 0, firstAction.action);
            }

            // Step 7: Clear confirmation state
            await this.clearConfirmationRequired();

            // Step 8: Verify rollback result
            await this.verifyRollbackResult(role);

            logger.info('StateManager: Rollback completed', {
                projectId: this.projectId,
                role,
                status: 'completed',
            });
        } catch (error: any) {
            logger.error('StateManager: Rollback failed', {
                projectId: this.projectId,
                role,
                status: 'failed',
                error: error.message,
            });
            throw error;
        }
    }

    /**
     * Stop running operations
     */
    private async stopRunningOperations(): Promise<void> {
        const abortController = this.getAbortController();
        abortController.abort();

        // Wait for operations to stop (max 30 seconds)
        const maxWaitTime = 30000;
        const startTime = Date.now();

        while (Date.now() - startTime < maxWaitTime) {
            const runningState = await this.getRunningState();
            if (!runningState.action) {
                break;
            }
            await this.delay(500);
        }

        // Force reset if still running
        const finalState = await this.getRunningState();
        if (finalState.action) {
            logger.warn('StateManager: Action still running after timeout, forcing reset', {
                projectId: this.projectId,
                role: finalState.role,
                action: finalState.action,
                status: 'timeout',
            });
            await this.repository.clearAllRunningStatuses(this.projectId);
        }

        // Create a new AbortController for future operations
        // This ensures that after reset, new actions get a fresh (non-aborted) signal
        this.abortControllers.delete(this.projectId);
        logger.info('StateManager: Created new AbortController after reset', {
            projectId: this.projectId,
        });
    }

    /**
     * Verify rollback result
     */
    private async verifyRollbackResult(role: string): Promise<void> {
        const firstAction = await this.repository.getFirstActionForRole(this.projectId, role);
        if (!firstAction) {
            throw new Error(`No action found for role ${role}`);
        }

        // Verify action status
        const actionStatus = await this.getActionStatus(role, firstAction.action);
        if (actionStatus !== ActionStatus.RUNNING) {
            logger.warn('StateManager: First action not RUNNING, fixing...', {
                projectId: this.projectId,
                role,
                action: firstAction.action,
                currentStatus: actionStatus,
                expectedStatus: ActionStatus.RUNNING,
            });
            await this.setActionStatus(role, firstAction.action, ActionStatus.RUNNING);
        }

        // Verify running state
        const runningState = await this.getRunningState();
        if (runningState.role !== role || runningState.action !== firstAction.action) {
            logger.warn('StateManager: Running state incorrect, fixing...', {
                projectId: this.projectId,
                role,
                action: firstAction.action,
                currentRunningRole: runningState.role,
                currentRunningAction: runningState.action,
                expectedRole: role,
                expectedAction: firstAction.action,
            });
            await this.setRunningState(role, firstAction.action);
        }

        // Verify RoleContext state
        const contextState = await this.getRoleContextState(role);
        if (contextState.state !== 0 || contextState.todo !== firstAction.action) {
            logger.warn('StateManager: RoleContext state incorrect, fixing...', {
                projectId: this.projectId,
                role,
                action: firstAction.action,
                currentState: contextState.state,
                currentTodo: contextState.todo,
                expectedState: 0,
                expectedTodo: firstAction.action,
            });
            await this.setRoleContextState(role, 0, firstAction.action);
        }
    }

    /**
     * Get action index for a role
     */
    private async getActionIndex(role: string, action: string): Promise<number> {
        try {
            const result = await query<{ action_order: number }>(
                `SELECT action_order
                 FROM interactive_session_workflows
                 WHERE project_id = $1 AND role = $2 AND action = $3`,
                [this.projectId, role, action]
            );

            if (result.rows.length > 0 && result.rows[0].action_order !== null) {
                return result.rows[0].action_order;
            }

            // Fallback: find index in team
            const roles = this.team.getEnvironment().getRoles();
            const roleInstance = roles.find(r => r.profile === role);
            if (roleInstance) {
                const actionIndex = roleInstance.actions.findIndex(a => a.name === action);
                return actionIndex >= 0 ? actionIndex : -1;
            }

            return -1;
        } catch (error: any) {
            logger.error('StateManager: Failed to get action index', {
                projectId: this.projectId,
                role,
                action,
                error: error.message,
            });
            return -1;
        }
    }

    /**
     * Get abort controller for this project
     */
    private getAbortController(): AbortController {
        if (!this.abortControllers.has(this.projectId)) {
            this.abortControllers.set(this.projectId, new AbortController());
        }
        return this.abortControllers.get(this.projectId)!;
    }

    /**
     * Get abort signal for this project
     * Used by actions to check cancellation status
     */
    getAbortSignal(): AbortSignal {
        return this.getAbortController().signal;
    }

    /**
     * Delay helper
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Log state change
     */
    private logStateChange(
        type: string,
        role: string | null,
        action: string | null,
        status: any,
        stepId?: string
    ): void {
        logger.info('StateManager: State changed', {
            projectId: this.projectId,
            type,
            role,
            action,
            status,
            stepId,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Check if rollback is in progress
     */
    async isRollbackInProgress(role: string): Promise<boolean> {
        const lockKey = `${this.projectId}:${role}`;
        return rollbackLocks.has(lockKey);
    }
}
