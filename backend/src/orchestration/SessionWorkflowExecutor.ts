/**
 * Session Workflow Executor
 * Executes the workflow for interactive sessions
 */

import { Team } from './Team';
import { Environment } from './Environment';
import { StateManager } from './StateManager';
import { RoleReactMode, ActionStatus } from '@mind2build/shared';
import { logger } from '../utils';
import { SessionMessageHandler } from './SessionMessageHandler';
import { SessionFileExtractor } from './SessionFileExtractor';
import { SessionStateRestorer } from './SessionStateRestorer';
import { BaseAction } from '../core/base/BaseAction';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface WorkflowExecutorConfig {
    projectId: string;
    nRound: number;
    idea: string;
}

/**
 * Role processing result
 */
interface RoleProcessingResult {
    shouldContinueWithSameRole: boolean;
    requiresConfirmation: boolean;
    isIdle: boolean;
}

/**
 * Workflow state checker - encapsulates all state checking logic
 */
class WorkflowStateChecker {
    constructor(private stateManager: StateManager) { }

    /**
     * Check if confirmation is blocking workflow execution
     */
    async isConfirmationBlocking(): Promise<boolean> {
        const confirmationStatus = await this.stateManager.getConfirmationStatus();
        return confirmationStatus.required;
    }

    /**
     * Check if current role can move to next role
     * Returns true only if:
     * 1. Confirmation is NOT required (user has confirmed)
     * 2. Current role exists
     * 3. All actions for current role are completed
     */
    async canMoveToNextRole(currentRole: string | null): Promise<boolean> {
        const confirmationStatus = await this.stateManager.getConfirmationStatus();

        // If confirmation is still required, cannot move
        if (confirmationStatus.required) {
            return false;
        }

        // If no current role, cannot move
        if (!currentRole) {
            return false;
        }

        // Check if all actions for current role are completed
        const allCompleted = await this.stateManager.areAllRoleActionsCompleted(currentRole);
        return allCompleted;
    }

    /**
     * Check if workflow should be completed
     * Only returns true if:
     * 1. The last role has completed all its actions
     * 2. All workflow items are completed (no pending or running items)
     */
    async shouldCompleteWorkflow(lastRole: string, roles: any[]): Promise<boolean> {
        // First check: verify this is actually the last role
        const lastRoleIndex = roles.length - 1;
        const currentRoleIndex = roles.findIndex(r => r.profile === lastRole);
        const isLastRole = currentRoleIndex === lastRoleIndex;

        if (!isLastRole) {
            logger.info(`WorkflowStateChecker: Role ${lastRole} is not the last role (index ${currentRoleIndex}/${lastRoleIndex}), cannot complete workflow`);
            return false;
        }

        // Second check: verify the last role has completed all its actions
        const lastRoleAllCompleted = await this.stateManager.areAllRoleActionsCompleted(lastRole);
        if (!lastRoleAllCompleted) {
            logger.info(`WorkflowStateChecker: Last role ${lastRole} has not completed all actions, cannot complete workflow`);
            return false;
        }

        // Third check: verify all workflow items are completed
        const workflowItems = await this.stateManager.getWorkflowItems();
        if (workflowItems.length === 0) {
            return false;
        }

        const stats = await this.stateManager.getWorkflowStatistics();

        const allItemsCompleted = (
            stats.pending === 0 &&
            stats.running === 0 &&
            stats.completed > 0 &&
            stats.completed === stats.total
        );

        if (allItemsCompleted) {
            logger.info(`WorkflowStateChecker: Last role ${lastRole} completed all actions, and all workflow items are completed (${stats.completed}/${stats.total}), workflow can be completed`);
        } else {
            logger.info(`WorkflowStateChecker: Last role ${lastRole} completed, but not all workflow items finished (pending: ${stats.pending}, running: ${stats.running}, completed: ${stats.completed}/${stats.total}), cannot complete workflow`);
        }

        return allItemsCompleted;
    }

    /**
     * Check if role action is already completed
     */
    async isActionCompleted(role: string, action: string): Promise<boolean> {
        return await this.stateManager.isActionCompleted(role, action);
    }

    /**
     * Check if all role actions are completed
     */
    async areAllRoleActionsCompleted(role: string): Promise<boolean> {
        return await this.stateManager.areAllRoleActionsCompleted(role);
    }

    /**
     * Get workflow items statistics
     * Uses StateManager's efficient single-pass calculation
     */
    async getWorkflowStatistics(): Promise<{
        pending: number;
        running: number;
        completed: number;
        failed: number;
        total: number;
    }> {
        return await this.stateManager.getWorkflowStatistics();
    }

    /**
     * Check if role has pending actions that exceeded retry limit
     * Returns information about pending actions with retry_count >= 3
     */
    async hasPendingActionsExceededRetryLimit(role: string): Promise<{
        hasExceeded: boolean;
        exceededActions: Array<{ action: string; retry_count: number }>;
    }> {
        const workflowItems = await this.stateManager.getWorkflowItems();
        const roleItems = workflowItems.filter(item => item.role === role);
        
        // Check both pending and failed actions
        const pendingItems = roleItems.filter(item => item.status === ActionStatus.PENDING);
        const failedItems = roleItems.filter(item => item.status === ActionStatus.FAILED);
        
        const exceededActions: Array<{ action: string; retry_count: number }> = [];
        
        // Check pending items
        for (const item of pendingItems) {
            const retryCount = item.retry_count || 0;
            if (retryCount >= 3) {
                exceededActions.push({
                    action: item.action,
                    retry_count: retryCount,
                });
            }
        }
        
        // Check failed items (for completeness, though failed actions usually have exceeded retry limit)
        for (const item of failedItems) {
            const retryCount = item.retry_count || 0;
            if (retryCount >= 3) {
                exceededActions.push({
                    action: item.action,
                    retry_count: retryCount,
                });
            }
        }

        return {
            hasExceeded: exceededActions.length > 0,
            exceededActions,
        };
    }

    /**
     * Get first retryable action (pending or failed) with retry_count < 3 for retry
     * Returns action with its current status
     */
    async getFirstRetryablePendingAction(role: string): Promise<{ action: string; retry_count: number; status: ActionStatus } | null> {
        const workflowItems = await this.stateManager.getWorkflowItems();
        const roleItems = workflowItems.filter(item => item.role === role);
        
        // Get both pending and failed actions
        const pendingItems = roleItems.filter(item => item.status === ActionStatus.PENDING);
        const failedItems = roleItems.filter(item => item.status === ActionStatus.FAILED);
        
        // Combine and sort by action_order, prioritizing pending over failed
        const allRetryableItems = [
            ...pendingItems.map(item => ({ ...item, priority: 0 })), // PENDING has priority 0
            ...failedItems.map(item => ({ ...item, priority: 1 })), // FAILED has priority 1
        ];
        
        // Sort by priority first (pending before failed), then by action_order
        const sortedItems = allRetryableItems.sort((a, b) => {
            if (a.priority !== b.priority) {
                return a.priority - b.priority;
            }
            const orderA = a.action_order ?? 999;
            const orderB = b.action_order ?? 999;
            return orderA - orderB;
        });

        for (const item of sortedItems) {
            const retryCount = item.retry_count || 0;
            if (retryCount < 3) {
                return {
                    action: item.action,
                    retry_count: retryCount,
                    status: item.status,
                };
            }
        }

        return null;
    }
}

/**
 * Role state analyzer - analyzes role state and determines next action
 */
class RoleStateAnalyzer {
    /**
     * Analyze if role has more actions to execute
     */
    static analyzeRoleActions(role: any, allActionsCompletedInDB: boolean): {
        hasMoreActions: boolean;
        hasImmediateActions: boolean;
    } {
        const isInSequence = role.rc.reactMode === RoleReactMode.BY_ORDER && role.rc.state >= 0;
        const hasMoreActionsInSequence = isInSequence && role.rc.state < role.actions.length - 1;
        const hasNextActionReady = role.rc.todo !== null;
        const allActionsCompletedInMemory = role.rc.reactMode === RoleReactMode.BY_ORDER &&
            (role.rc.state === -1 || role.rc.state >= role.actions.length - 1);
        const hasMoreActionsInMemory = !allActionsCompletedInMemory && (hasMoreActionsInSequence || hasNextActionReady);

        return {
            hasMoreActions: !allActionsCompletedInDB,
            hasImmediateActions: hasMoreActionsInMemory,
        };
    }
}

export class SessionWorkflowExecutor {
    private projectId: string;
    private team: Team;
    private stateManager: StateManager;
    private messageHandler: SessionMessageHandler;
    private config: WorkflowExecutorConfig;
    private stateChecker: WorkflowStateChecker;
    private isCancelled: boolean = false;

    constructor(
        projectId: string,
        team: Team,
        stateManager: StateManager,
        messageHandler: SessionMessageHandler,
        config: WorkflowExecutorConfig
    ) {
        this.projectId = projectId;
        this.team = team;
        this.stateManager = stateManager;
        this.messageHandler = messageHandler;
        this.config = config;
        this.stateChecker = new WorkflowStateChecker(stateManager);
    }

    /**
     * Cancel workflow execution
     */
    cancel(): void {
        this.isCancelled = true;
        logger.info(`SessionWorkflowExecutor: Cancellation requested for project ${this.projectId}`);
    }

    /**
     * Check if workflow execution is cancelled
     */
    private checkCancellation(): void {
        if (this.isCancelled) {
            throw new Error('SessionWorkflowExecutor: Workflow execution cancelled');
        }
    }

    /**
     * Check if workflow was reset by checking if current action status changed from RUNNING to PENDING
     */
    private async checkResetStatus(currentRole: string | null, currentAction: string | null): Promise<boolean> {
        if (!currentRole || !currentAction) {
            return false;
        }

        try {
            // Check if current action status is PENDING when it should be RUNNING
            // This indicates a reset occurred
            const actionStatus = await this.stateManager.getActionStatus(currentRole, currentAction);
            const runningState = await this.stateManager.getRunningState();
            
            // If we were processing this action but it's now PENDING, reset occurred
            if (runningState.role === currentRole && 
                runningState.action === currentAction && 
                actionStatus === ActionStatus.PENDING) {
                logger.info(`SessionWorkflowExecutor: Detected reset - action ${currentAction} for role ${currentRole} was reset from RUNNING to PENDING`);
                return true;
            }
            
            return false;
        } catch (error: any) {
            logger.warn('SessionWorkflowExecutor: Failed to check reset status', {
                error: error.message,
            });
            return false;
        }
    }

    /**
     * Execute workflow with interactive interaction
     */
    async execute(): Promise<void> {
        const env = this.team.getEnvironment();
        const roles = env.getRoles();

        // Send initial progress
        await this.updateProjectProgress();
        this.messageHandler.sendMessage('progress', {
            message: 'Starting generation...',
            totalCost: 0,
        });

        // Restore message history from database
        await SessionStateRestorer.restoreMessageHistory(
            this.projectId,
            env,
            this.config.idea
        );

        // Initialize workflow state
        const { roleIndex } = await this.initializeWorkflowState(roles, env);

        // Execute workflow loop
        await this.executeWorkflowLoop(roles, env, roleIndex);
    }

    /**
     * Initialize workflow state and find starting role index
     */
    private async initializeWorkflowState(
        roles: any[],
        env: Environment
    ): Promise<{ roleIndex: number }> {
        const currentState = await this.stateManager.getRunningState();

        // Determine if we should resume from current state or find next incomplete role
        const shouldResume = await this.shouldResumeFromCurrentState(currentState, roles);

        if (shouldResume.shouldResume && shouldResume.roleIndex !== null) {
            const role = roles[shouldResume.roleIndex];
            logger.info(`SessionWorkflowExecutor: Resuming from role index ${shouldResume.roleIndex} (${role.profile})`);
            // Sync RoleContext state when resuming
            await this.syncRoleContextFromDatabase(role);
            return { roleIndex: shouldResume.roleIndex };
        }

        // Find next incomplete role
        const roleIndex = await this.findNextIncompleteRole(roles, env);
        const role = roles[roleIndex];
        logger.info(`SessionWorkflowExecutor: Starting from role index ${roleIndex} (${role.profile})`);
        
        // Sync RoleContext state for the starting role
        await this.syncRoleContextFromDatabase(role);

        return { roleIndex };
    }

    /**
     * Determine if we should resume from current state
     */
    private async shouldResumeFromCurrentState(
        currentState: { role: string | null; action: string | null },
        roles: any[]
    ): Promise<{ shouldResume: boolean; roleIndex: number | null }> {
        // No previous state - find next incomplete role
        if (!currentState.role || !currentState.action) {
            logger.info(`SessionWorkflowExecutor: No previous state found, will find next incomplete role`);
            return { shouldResume: false, roleIndex: null };
        }

        logger.info(`SessionWorkflowExecutor: Resuming session - current role: ${currentState.role}, action: ${currentState.action}`);

        // If action is idle, find next incomplete role
        if (currentState.action === 'idle') {
            logger.info(`SessionWorkflowExecutor: Current role ${currentState.role} is idle, will find next incomplete role`);
            await this.stateManager.clearRunningState();
            return { shouldResume: false, roleIndex: null };
        }

        // Check if current role exists in roles list
        const currentRoleIndex = roles.findIndex(r => r.profile === currentState.role);
        if (currentRoleIndex === -1) {
            logger.warn(`SessionWorkflowExecutor: Could not find role ${currentState.role} in roles list, will find next incomplete role`);
            return { shouldResume: false, roleIndex: null };
        }

        // Check if current action is completed
        const isCompleted = await this.stateChecker.isActionCompleted(
            currentState.role,
            currentState.action
        );

        if (isCompleted) {
            logger.info(`SessionWorkflowExecutor: Current action ${currentState.action} for role ${currentState.role} is already completed, will find next incomplete role`);
            await this.stateManager.clearRunningState();
            return { shouldResume: false, roleIndex: null };
        }

        // Resume from current role
        logger.info(`SessionWorkflowExecutor: Current action ${currentState.action} for role ${currentState.role} is not completed, will continue from here`);
        return { shouldResume: true, roleIndex: currentRoleIndex };
    }

    /**
     * Find next incomplete role
     */
    private async findNextIncompleteRole(roles: any[], env: Environment): Promise<number> {
        logger.info(`SessionWorkflowExecutor: Finding next incomplete role...`);

        const workflowItems = await this.stateManager.getWorkflowItems();
        const completedActions = new Set<string>();
        workflowItems.forEach(item => {
            if (item.status === 'completed') {
                completedActions.add(`${item.role}:${item.action}`);
            }
        });

        // Log workflow items summary
        const stats = await this.stateChecker.getWorkflowStatistics();
        logger.info(`SessionWorkflowExecutor: Workflow statistics - completed: ${stats.completed}/${stats.total}, pending: ${stats.pending}, running: ${stats.running}, failed: ${stats.failed}`);

        for (let i = 0; i < roles.length; i++) {
            const role = roles[i];
            const roleActions = role.actions.map((a: any) => a.name);

            const incompleteActions = roleActions.filter((action: string) => {
                const actionKey = `${role.profile}:${action}`;
                return !completedActions.has(actionKey);
            });

            // Log each role's status
            logger.info(`SessionWorkflowExecutor: Role ${role.profile} (index ${i}) - total actions: ${roleActions.length}, incomplete: ${incompleteActions.length}, incomplete actions: [${incompleteActions.join(', ')}]`);

            if (incompleteActions.length > 0) {
                const watchSet = Array.from(role.rc.watch);
                if (watchSet.length > 0 && i > 0) {
                    const envHistory = env.history;
                    const hasWatchedMessages = envHistory.some(msg => watchSet.includes(msg.causeBy));

                    if (!hasWatchedMessages) {
                        let previousRolesCompleted = true;
                        for (let j = 0; j < i; j++) {
                            const prevRole = roles[j];
                            const prevRoleActions = prevRole.actions.map((a: any) => a.name);
                            const prevRoleCompleted = prevRoleActions.some((action: string) => {
                                const actionKey = `${prevRole.profile}:${action}`;
                                return completedActions.has(actionKey);
                            });
                            if (!prevRoleCompleted) {
                                previousRolesCompleted = false;
                                break;
                            }
                        }

                        if (!previousRolesCompleted) {
                            logger.info(`SessionWorkflowExecutor: Role ${role.profile} is waiting for messages from previous roles that haven't completed, skipping for now`);
                            continue;
                        } else {
                            logger.warn(`SessionWorkflowExecutor: Role ${role.profile} is waiting for messages (watch: [${watchSet.join(', ')}]) but messages not found in environment. Previous roles completed. Will try this role anyway.`);
                        }
                    }
                }

                logger.info(`SessionWorkflowExecutor: Found incomplete role: ${role.profile} at index ${i}, incomplete actions: [${incompleteActions.join(', ')}]`);
                return i;
            }
        }

        logger.info(`SessionWorkflowExecutor: All roles checked, no incomplete roles found. Returning index 0 (first role)`);
        return 0;
    }

    /**
     * Execute workflow loop
     * Continues until workflow is truly completed (no iteration limit)
     */
    private async executeWorkflowLoop(
        roles: any[],
        env: Environment,
        startRoleIndex: number
    ): Promise<void> {
        let iteration = 0;
        let roleIndex = startRoleIndex;

        // Continue until workflow is truly completed
        while (true) {
            iteration++;

            // Check if workflow execution is cancelled
            this.checkCancellation();

            // Priority 1: Check if confirmation is blocking workflow
            if (await this.stateChecker.isConfirmationBlocking()) {
                this.checkCancellation();
                await this.waitForConfirmation();
                continue;
            }

            // Priority 2: Check if we should move to next role (after confirmation cleared)
            const moveResult = await this.tryMoveToNextRole(roles, env);
            if (moveResult.moved) {
                if (moveResult.completed) {
                    // Workflow completed
                    logger.info(`SessionWorkflowExecutor: Workflow completed successfully after ${iteration} iterations`);
                    break;
                }
                if (moveResult.nextRoleIndex !== undefined) {
                    roleIndex = moveResult.nextRoleIndex;
                }
                // Update progress after role change
                await this.updateProjectProgress();
                continue;
            }

            // Priority 3: Process current role
            this.checkCancellation();
            
            // Check if workflow was reset
            const currentState = await this.stateManager.getRunningState();
            const wasReset = await this.checkResetStatus(currentState.role, currentState.action);
            if (wasReset) {
                logger.info(`SessionWorkflowExecutor: Workflow was reset, stopping execution loop`);
                throw new Error('SessionWorkflowExecutor: Workflow execution stopped due to reset');
            }
            
            // Check if workflow was cancelled due to exceeded retry limit
            if (this.isCancelled) {
                logger.info(`SessionWorkflowExecutor: Workflow was cancelled due to exceeded retry limit, stopping execution loop`);
                break;
            }
            
            const processResult = await this.processRole(roles, env, roleIndex, iteration);
            this.checkCancellation();
            
            // Check again after processing role (in case markRoleAsIdle cancelled the workflow)
            if (this.isCancelled) {
                logger.info(`SessionWorkflowExecutor: Workflow was cancelled after processing role, stopping execution loop`);
                break;
            }
            
            if (processResult.shouldContinueWithSameRole) {
                // Continue with same role (has more actions)
                // Update progress periodically
                if (iteration % 5 === 0) {
                    await this.updateProjectProgress();
                }
                continue;
            }

            // Priority 4: Wait for confirmation if required
            if (processResult.requiresConfirmation) {
                // Update progress before showing confirmation
                await this.updateProjectProgress();
                await this.waitForConfirmation();
                continue;
            }

            // Unexpected state - wait and retry
            logger.warn(`SessionWorkflowExecutor: Unexpected state after processRole, waiting...`);
            await this.waitForConfirmation();
        }

        // Verify workflow completion
        // Exit conditions:
        // 1. All workflow items are completed (no pending or running items)
        // 2. Last role has completed all its actions
        const stats = await this.stateChecker.getWorkflowStatistics();
        const currentState = await this.stateManager.getRunningState();

        if (stats.completed === stats.total && stats.pending === 0 && stats.running === 0) {
            // Check if last role completed all actions
            if (currentState.role) {
                const lastRoleAllCompleted = await this.stateChecker.areAllRoleActionsCompleted(currentState.role);
                if (lastRoleAllCompleted) {
                    logger.info(`SessionWorkflowExecutor: All roles processed, workflow completed (${stats.completed}/${stats.total} completed) after ${iteration} iterations`);
                } else {
                    logger.warn(`SessionWorkflowExecutor: Workflow loop exited but last role (${currentState.role}) has not completed all actions`);
                }
            } else {
                logger.info(`SessionWorkflowExecutor: All roles processed, workflow completed (${stats.completed}/${stats.total} completed) after ${iteration} iterations`);
            }
        } else {
            logger.warn(`SessionWorkflowExecutor: Workflow loop exited but status check shows incomplete - completed: ${stats.completed}/${stats.total}, pending: ${stats.pending}, running: ${stats.running}`);
        }
    }

    /**
     * Wait for confirmation (with delay)
     */
    private async waitForConfirmation(): Promise<void> {
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    /**
     * Try to move to next role after confirmation cleared
     * Exit conditions (checked first, regardless of confirmation status):
     * 1. Last role has completed all its actions
     * 2. All workflow items are completed (no pending or running items)
     */
    private async tryMoveToNextRole(
        roles: any[],
        env: Environment
    ): Promise<{
        moved: boolean;
        nextRoleIndex?: number;
        completed?: boolean;
    }> {
        // Check if workflow was cancelled due to exceeded retry limit
        if (this.isCancelled) {
            logger.info(`SessionWorkflowExecutor: Workflow was cancelled due to exceeded retry limit, cannot move to next role`);
            return { moved: false };
        }
        
        const currentState = await this.stateManager.getRunningState();
        
        // If running state is cleared (last action completed), get role from confirmation status
        let currentRole = currentState.role;
        if (!currentRole) {
            const confirmationStatus = await this.stateManager.getConfirmationStatus();
            if (confirmationStatus.role) {
                currentRole = confirmationStatus.role;
                logger.info(`SessionWorkflowExecutor: Running state is null, using confirmation role: ${currentRole}`);
                
                // Check if this role has pending actions that exceeded retry limit
                const exceededRetryCheck = await this.stateChecker.hasPendingActionsExceededRetryLimit(currentRole);
                if (exceededRetryCheck.hasExceeded) {
                    logger.info(`SessionWorkflowExecutor: Role ${currentRole} has pending actions that exceeded retry limit, cannot move to next role`);
                    return { moved: false };
                }
            } else {
                return { moved: false };
            }
        }

        const currentRoleIndexInList = roles.findIndex(r => r.profile === currentRole);
        if (currentRoleIndexInList === -1) {
            return { moved: false };
        }

        // Special handling for idle state (current action is null)
        if (currentState.action === null) {
            // Check if current role has completed all actions
            const allCompleted = await this.stateChecker.areAllRoleActionsCompleted(currentRole);
            
            if (allCompleted) {
                logger.info(`SessionWorkflowExecutor: Current role ${currentRole} is idle and all actions completed, finding next incomplete role`);
                
                // Find next incomplete role
                const nextRoleIndex = await this.findNextIncompleteRole(roles, env);
                
                // Check if all roles are completed
                const stats = await this.stateChecker.getWorkflowStatistics();
                const allRolesCompleted = stats.completed === stats.total && stats.pending === 0 && stats.running === 0;
                
                if (allRolesCompleted) {
                    // All workflow items are completed
                    const shouldComplete = await this.stateChecker.shouldCompleteWorkflow(currentRole, roles);
                    
                    if (shouldComplete) {
                        logger.info(`SessionWorkflowExecutor: All roles completed (${stats.completed}/${stats.total}), marking project as completed`);
                        await this.checkAndMarkProjectCompleted(currentRole, roles);
                        await this.stateManager.clearRunningState();
                        return { moved: true, completed: true };
                    }
                }
                
                // Check if the next role found actually has incomplete actions
                const nextRole = roles[nextRoleIndex];
                const nextRoleIncomplete = await this.hasIncompleteActions(nextRole);
                
                if (!nextRoleIncomplete) {
                    logger.warn(`SessionWorkflowExecutor: Next role (${nextRole?.profile}) has no incomplete actions, but workflow not completed`);
                    await this.stateManager.clearRunningState();
                    return { moved: false };
                }
                
                // Move to next incomplete role
                await this.stateManager.clearRunningState();
                logger.info(`SessionWorkflowExecutor: Moving from idle role ${currentRole} to next incomplete role ${nextRole.profile}`);
                this.messageHandler.sendMessage('progress', {
                    message: `${currentRole} completed, moving to ${nextRole.profile}`,
                    totalCost: this.team.getCostReport().totalCost,
                });
                
                return { moved: true, nextRoleIndex };
            }
        }

        // Check if we can move to next role (requires confirmation cleared)
        const canMove = await this.stateChecker.canMoveToNextRole(currentRole);
        if (!canMove) {
            return { moved: false };
        }

        // Find next incomplete role instead of simple round-robin
        const nextRoleIndex = await this.findNextIncompleteRole(roles, env);
        
        // Check if all roles are completed
        const stats = await this.stateChecker.getWorkflowStatistics();
        const allRolesCompleted = stats.completed === stats.total && stats.pending === 0 && stats.running === 0;
        
        if (allRolesCompleted) {
            // All workflow items are completed, check if workflow should be completed
            const shouldComplete = await this.stateChecker.shouldCompleteWorkflow(currentRole, roles);
            
            if (shouldComplete) {
                logger.info(`SessionWorkflowExecutor: All roles completed (${stats.completed}/${stats.total}), marking project as completed`);
                await this.checkAndMarkProjectCompleted(currentRole, roles);
                await this.stateManager.clearRunningState();
                return { moved: true, completed: true };
            }
        }

        // Check if the next role found actually has incomplete actions
        const nextRole = roles[nextRoleIndex];
        const nextRoleIncomplete = await this.hasIncompleteActions(nextRole);
        
        if (!nextRoleIncomplete) {
            logger.warn(`SessionWorkflowExecutor: Next role (${nextRole?.profile}) has no incomplete actions, but workflow not completed`);
            await this.stateManager.clearRunningState();
            return { moved: false };
        }

        // Move to next incomplete role
        await this.stateManager.clearRunningState();
        this.messageHandler.sendMessage('progress', {
            message: `${currentRole} completed, moving to ${nextRole.profile}`,
            totalCost: this.team.getCostReport().totalCost,
        });

        return { moved: true, nextRoleIndex };
    }

    /**
     * Check if a role has incomplete actions
     */
    private async hasIncompleteActions(role: any): Promise<boolean> {
        const workflowItems = await this.stateManager.getWorkflowItems();
        const roleItems = workflowItems.filter(item => item.role === role.profile);
        const incompleteItems = roleItems.filter(item => 
            item.status === ActionStatus.PENDING || 
            item.status === ActionStatus.RUNNING ||
            item.status === ActionStatus.FAILED
        );
        return incompleteItems.length > 0;
    }


    /**
     * Update project progress in database
     * Progress is calculated based on completed workflow items
     */
    private async updateProjectProgress(): Promise<void> {
        try {
            const workflowItems = await this.stateManager.getWorkflowItems();
            const totalCount = workflowItems.length;
            const completedCount = workflowItems.filter(item => item.status === 'completed').length;
            
            // Calculate progress as percentage and round to integer (database field is INT)
            const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
            const progress = Math.round(Math.min(progressPercent, 100));
            
            const { ProjectRepository } = await import('../database/repositories/ProjectRepository');
            const projectRepo = new ProjectRepository();
            await projectRepo.updateProgress(this.projectId, progress);
            logger.info(`SessionWorkflowExecutor: Updated project ${this.projectId} progress: ${completedCount}/${totalCount} actions completed, progress ${progress}%`);
        } catch (error: any) {
            logger.warn(`SessionWorkflowExecutor: Failed to update project progress for ${this.projectId}`, { error: error.message });
        }
    }

    /**
     * Process a single role
     */
    private async processRole(roles: any[], env: Environment, roleIndex: number, iteration: number): Promise<RoleProcessingResult> {
        const role = roles[roleIndex];
        logger.info(`SessionWorkflowExecutor: Processing role ${role.profile} (iteration ${iteration}, roleIndex ${roleIndex})`);

        // Step 0: Sync RoleContext state from database before processing
        await this.syncRoleContextFromDatabase(role);

        // Step 1: Observe and think
        await role.observe();
        const hasTodo = await role.think();

        // Sync RoleContext state to database after think() (in case think() modified state/todo)
        await this.syncRoleContextToDatabase(role);

        // Step 2: Handle idle state (no todo or todo already completed)
        const idleResult = await this.handleRoleIdleState(role, hasTodo);
        if (idleResult.isIdle) {
            return idleResult;
        }

        // Step 3: Execute role action
        try {
            const message = await this.executeRoleAction(role);

            // Step 4: Handle action execution result
            return await this.handleActionExecutionResult(role, message, env);
        } catch (error: any) {
            // Check if this is a retry error
            if (error.message && error.message.includes('will retry')) {
                logger.info(`SessionWorkflowExecutor: Action will retry, continuing with same role`, {
                    projectId: this.projectId,
                    role: role.profile,
                    error: error.message,
                });
                // Return to continue with same role (retry)
                return { shouldContinueWithSameRole: true, requiresConfirmation: false, isIdle: false };
            }
            // Re-throw other errors
            throw error;
        }
    }

    /**
     * Handle role idle state
     */
    private async handleRoleIdleState(role: any, hasTodo: boolean): Promise<RoleProcessingResult> {
        // Check if todo is already completed
        if (hasTodo && role.rc.todo) {
            const todoAction = role.rc.todo.name;
            const isTodoCompleted = await this.stateChecker.isActionCompleted(role.profile, todoAction);

            if (isTodoCompleted) {
                logger.info(`SessionWorkflowExecutor: Role ${role.profile} todo action ${todoAction} is already completed, checking for retryable pending/failed actions`);
                
                // Check if there are pending or failed actions that can be retried
                const retryableAction = await this.stateChecker.getFirstRetryablePendingAction(role.profile);
                if (retryableAction) {
                    logger.info(`SessionWorkflowExecutor: Found retryable action ${retryableAction.action} (status: ${retryableAction.status}, retry_count: ${retryableAction.retry_count}), setting as todo`);
                    
                    // If action is failed, reset it to pending first
                    if (retryableAction.status === ActionStatus.FAILED) {
                        logger.info(`SessionWorkflowExecutor: Resetting failed action ${retryableAction.action} to pending status`);
                        await this.stateManager.setActionStatus(role.profile, retryableAction.action, ActionStatus.PENDING);
                    }
                    
                    // Set the retryable action as todo
                    const action = role.actions.find((a: BaseAction) => a.name === retryableAction.action);
                    if (action) {
                        role.rc.todo = action;
                        await this.syncRoleContextToDatabase(role);
                        return { shouldContinueWithSameRole: true, requiresConfirmation: false, isIdle: false };
                    }
                }
                
                await this.markRoleAsIdle(role);
                return { shouldContinueWithSameRole: false, requiresConfirmation: true, isIdle: true };
            }
        }

        // Check if role has no todo
        if (!hasTodo || !role.rc.todo) {
            logger.info(`SessionWorkflowExecutor: Role ${role.profile} has no todo after think(), checking for retryable pending/failed actions`);
            
            // Check if there are pending or failed actions that can be retried
            const retryableAction = await this.stateChecker.getFirstRetryablePendingAction(role.profile);
            if (retryableAction) {
                logger.info(`SessionWorkflowExecutor: Found retryable action ${retryableAction.action} (status: ${retryableAction.status}, retry_count: ${retryableAction.retry_count}), setting as todo`);
                
                // If action is failed, reset it to pending first
                if (retryableAction.status === ActionStatus.FAILED) {
                    logger.info(`SessionWorkflowExecutor: Resetting failed action ${retryableAction.action} to pending status`);
                    await this.stateManager.setActionStatus(role.profile, retryableAction.action, ActionStatus.PENDING);
                }
                
                // Set the retryable action as todo
                const action = role.actions.find((a: BaseAction) => a.name === retryableAction.action);
                if (action) {
                    role.rc.todo = action;
                    await this.syncRoleContextToDatabase(role);
                    return { shouldContinueWithSameRole: true, requiresConfirmation: false, isIdle: false };
                }
            }
            
            await this.markRoleAsIdle(role);
            return { shouldContinueWithSameRole: false, requiresConfirmation: true, isIdle: true };
        }

        return { shouldContinueWithSameRole: false, requiresConfirmation: false, isIdle: false };
    }

    /**
     * Mark role as idle
     * Checks if role has failed actions or exceeded retry limit before setting confirmation required
     * to avoid duplicate confirmation dialogs
     */
    private async markRoleAsIdle(role: any): Promise<void> {
        await this.stateManager.onActionIdle(role.profile);
        await this.stateManager.setRunningState(role.profile, null);

        if (await this.stateChecker.isConfirmationBlocking()) {
            return;
        }

        // Check if role has pending actions that exceeded retry limit
        const exceededRetryCheck = await this.stateChecker.hasPendingActionsExceededRetryLimit(role.profile);
        if (exceededRetryCheck.hasExceeded) {
            logger.error(`SessionWorkflowExecutor: Role ${role.profile} has pending actions that exceeded retry limit, ending workflow`, {
                projectId: this.projectId,
                role: role.profile,
                exceededActions: exceededRetryCheck.exceededActions,
            });
            
            // End workflow by cancelling executor
            this.cancel();
            
            // Set error confirmation status
            await this.stateManager.setConfirmationRequired(role.profile);
            
            // Send error confirmation message
            this.sendIdleConfirmation(role, exceededRetryCheck.exceededActions);
            
            return;
        }

        // Check if role has failed actions
        const workflowItems = await this.stateManager.getWorkflowItems();
        const roleItems = workflowItems.filter(item => item.role === role.profile);
        const failedItems = roleItems.filter(item => item.status === ActionStatus.FAILED);
        const completedItems = roleItems.filter(item => item.status === ActionStatus.COMPLETED);
        const pendingItems = roleItems.filter(item => item.status === ActionStatus.PENDING);
        const runningItems = roleItems.filter(item => item.status === ActionStatus.RUNNING);

        // If there are failed actions, check if all actions are completed (including failed)
        if (failedItems.length > 0) {
            // Check if all actions are completed (completed + failed = total)
            const totalItems = roleItems.length;
            const finishedItems = completedItems.length + failedItems.length;
            
            // Only set confirmation if all actions are finished (no pending or running)
            if (pendingItems.length === 0 && runningItems.length === 0 && finishedItems === totalItems) {
                // All actions finished (some may be failed), set confirmation required
                logger.info(`SessionWorkflowExecutor: Role ${role.profile} has failed actions but all actions finished, setting confirmation required`, {
                    projectId: this.projectId,
                    role: role.profile,
                    failedCount: failedItems.length,
                    completedCount: completedItems.length,
                    totalCount: totalItems,
                });
                await this.stateManager.setConfirmationRequired(role.profile);
                this.sendIdleConfirmation(role);
            } else {
                // Not all actions finished, don't set confirmation - let workflow move to next role
                logger.info(`SessionWorkflowExecutor: Role ${role.profile} has failed actions but not all actions finished, skipping confirmation`, {
                    projectId: this.projectId,
                    role: role.profile,
                    failedCount: failedItems.length,
                    pendingCount: pendingItems.length,
                    runningCount: runningItems.length,
                });
            }
        } else {
            // No failed actions, proceed normally
            await this.stateManager.setConfirmationRequired(role.profile);
            this.sendIdleConfirmation(role);
        }
    }

    /**
     * Execute role action
     */
    private async executeRoleAction(role: any): Promise<any> {
        // Sync RoleContext state from database before execution
        await this.syncRoleContextFromDatabase(role);

        const actionName = role.rc.todo ? role.rc.todo.name : null;
        if (actionName) {
            await this.stateManager.onActionStart(role.profile, actionName);
        }

        try {
            // Add timeout for action execution
            const ACTION_TIMEOUT_MS = process.env.ACTION_TIMEOUT_MINUTES
                ? parseInt(process.env.ACTION_TIMEOUT_MINUTES, 10) * 60 * 1000
                : 10 * 60 * 1000; // Default 10 minutes

            const timeoutPromise = new Promise<never>((_, reject) => {
                setTimeout(() => {
                    reject(new Error(`Action ${actionName || 'unknown'} execution timeout after ${ACTION_TIMEOUT_MS}ms`));
                }, ACTION_TIMEOUT_MS);
            });

            const actionPromise = role.act();

            // Race between action execution and timeout
            const message = await Promise.race([actionPromise, timeoutPromise]);
            
            if (actionName) {
                await this.stateManager.onActionComplete(role.profile, actionName, message);
            }

            // Sync RoleContext state to database after execution
            await this.syncRoleContextToDatabase(role);

            // Only set running state if this is NOT the last action
            // If it's the last action, running state should be cleared in onActionComplete()
            if (message && message.causeBy && typeof message.causeBy === 'string' && message.causeBy.trim().length > 0) {
                if (actionName) {
                    const isLastAction = await this.stateManager.isLastActionForRole(role.profile, actionName);
                    
                    if (!isLastAction) {
                        await this.stateManager.setRunningState(role.profile, message.causeBy);
                    }
                    // If it's the last action, running state is already cleared in onActionComplete()
                } else {
                    // Fallback: set running state if actionName is not available
                    await this.stateManager.setRunningState(role.profile, message.causeBy);
                }
            }

            return message;
        } catch (error: any) {
            // Handle timeout error specifically
            if (error.message?.includes('timeout')) {
                logger.error(`SessionWorkflowExecutor: Action ${actionName || 'unknown'} timed out`, {
                    projectId: this.projectId,
                    role: role.profile,
                    action: actionName,
                    timeoutMs: process.env.ACTION_TIMEOUT_MINUTES
                        ? parseInt(process.env.ACTION_TIMEOUT_MINUTES, 10) * 60 * 1000
                        : 10 * 60 * 1000,
                });
            }

            // Handle action execution error
            if (actionName) {
                const retryResult = await this.stateManager.onActionError(role.profile, actionName, error);
                
                // If should retry, throw a special error to trigger retry in processRole
                if (retryResult.shouldRetry) {
                    throw new Error(`Action ${actionName} failed, will retry`);
                }
                // Otherwise, the error is already handled (marked as FAILED, confirmation set if needed)
                // Re-throw to stop execution
                throw error;
            } else {
                // No action name, just throw
                throw error;
            }
        }
    }

    /**
     * Sync RoleContext state from database
     * Reads state and todo from StateManager and updates RoleContext memory
     */
    private async syncRoleContextFromDatabase(role: any): Promise<void> {
        try {
            const contextState = await this.stateManager.getRoleContextState(role.profile);
            
            // Update RoleContext state
            role.rc.state = contextState.state;
            
            // Update RoleContext todo
            if (contextState.todo) {
                const action = role.actions.find((a: BaseAction) => a.name === contextState.todo);
                role.rc.todo = action || null;
            } else {
                role.rc.todo = null;
            }

            logger.debug('SessionWorkflowExecutor: Synced RoleContext from database', {
                projectId: this.projectId,
                role: role.profile,
                state: contextState.state,
                todo: contextState.todo,
            });
        } catch (error: any) {
            logger.warn('SessionWorkflowExecutor: Failed to sync RoleContext from database', {
                projectId: this.projectId,
                role: role.profile,
                error: error.message,
            });
            // Don't throw - continue with current memory state
        }
    }

    /**
     * Sync RoleContext state to database
     * Writes current state and todo from RoleContext memory to StateManager
     */
    private async syncRoleContextToDatabase(role: any): Promise<void> {
        try {
            const todoActionName = role.rc.todo ? role.rc.todo.name : null;
            await this.stateManager.setRoleContextState(
                role.profile,
                role.rc.state,
                todoActionName
            );

            logger.debug('SessionWorkflowExecutor: Synced RoleContext to database', {
                projectId: this.projectId,
                role: role.profile,
                state: role.rc.state,
                todo: todoActionName,
            });
        } catch (error: any) {
            logger.warn('SessionWorkflowExecutor: Failed to sync RoleContext to database', {
                projectId: this.projectId,
                role: role.profile,
                error: error.message,
            });
            // Don't throw - state will be synced on next execution
        }
    }

    /**
     * Handle action execution result
     */
    private async handleActionExecutionResult(role: any, message: any, env: Environment): Promise<RoleProcessingResult> {
        // Handle no message case
        if (!message) {
            await this.markRoleAsIdle(role);
            return { shouldContinueWithSameRole: false, requiresConfirmation: true, isIdle: true };
        }

        // Handle message produced
        this.messageHandler.sendMessage('role_start', {
            role: role.profile,
            action: message.causeBy,
        });

        const outputFiles = SessionFileExtractor.extractOutputFiles(message);

        // Publish and save message first before checking completion status
        await this.publishAndSaveMessage(env, message);

        // Wait for message to be fully saved to database and ensure content is complete
        // This ensures the last action's content is fully generated and persisted before showing confirmation
        await this.waitForMessageContentComplete(message.id);

        // Check if role has more actions
        const allActionsCompletedInDB = await this.stateChecker.areAllRoleActionsCompleted(role.profile);
        const roleActionsAnalysis = RoleStateAnalyzer.analyzeRoleActions(role, allActionsCompletedInDB);

        // If not all actions are completed, continue with same role
        if (roleActionsAnalysis.hasMoreActions) {
            if (roleActionsAnalysis.hasImmediateActions) {
                logger.info(`SessionWorkflowExecutor: Role ${role.profile} has more actions ready, continuing with same role`);
            } else {
                logger.info(`SessionWorkflowExecutor: Role ${role.profile} doesn't have immediate actions but not all completed, continuing to let it observe/think`);
            }
            return { shouldContinueWithSameRole: true, requiresConfirmation: false, isIdle: false };
        }

        // All actions completed - wait for confirmation
        // IMPORTANT: Get the latest message content from database to ensure it's fully generated
        logger.info(`SessionWorkflowExecutor: All actions completed for role ${role.profile}, ensuring last action content is complete before showing confirmation`);
        const latestMessage = await this.getLatestMessageFromDatabase(message.id);
        const finalContent = latestMessage ? latestMessage.content : message.content;
        const finalInstructContent = latestMessage && latestMessage.instruct_content 
            ? (typeof latestMessage.instruct_content === 'string' 
                ? JSON.parse(latestMessage.instruct_content) 
                : latestMessage.instruct_content)
            : message.instructContent;

        const confirmationContent = await this.resolveConfirmationContent(
            message.causeBy,
            finalInstructContent,
            finalContent
        );

        logger.info(`SessionWorkflowExecutor: Using ${latestMessage ? 'database' : 'memory'} message content for confirmation (content length: ${confirmationContent?.length || 0})`);

        // Set confirmation required for current role
        // This will automatically clear any previous confirmation status
        // NOTE: Running state should already be cleared in onActionComplete() for last action
        await this.stateManager.setConfirmationRequired(role.profile);
        // DO NOT set running state here - it should be cleared when last action completes
        // The running state is cleared in onActionComplete() when isLastActionForRole() returns true

        // Send confirmation_required message with current role's content
        // This ensures the confirmation dialog shows the correct role and action
        this.messageHandler.sendMessage('confirmation_required', {
            role: role.profile,
            action: message.causeBy,
            content: confirmationContent,
            outputFiles: outputFiles,
            instructContent: finalInstructContent,
        });

        return { shouldContinueWithSameRole: false, requiresConfirmation: true, isIdle: false };
    }


    /**
     * Send idle confirmation message
     * @param role - The role that is idle
     * @param exceededActions - Optional array of actions that exceeded retry limit
     */
    private sendIdleConfirmation(role: any, exceededActions?: Array<{ action: string; retry_count: number }>): void {
        const newsCauseBys = role.rc.news.map((msg: any) => msg.causeBy).join(', ');
        const watchSet = Array.from(role.rc.watch).join(', ');
        
        let content: string;
        
        if (exceededActions && exceededActions.length > 0) {
            // Error message for exceeded retry limit
            const actionList = exceededActions.map(a => `- ${a.action} (重试次数: ${a.retry_count})`).join('\n');
            content = `**${role.profile} 工作流错误**\n\n⚠️ 以下 actions 超过最大重试次数（3次），工作流已终止：\n\n${actionList}\n\n请检查并修复问题后重新开始工作流。`;
        } else {
            // Normal idle message
            content = `**${role.profile} 状态检查**\n\n当前 ${role.profile} 没有需要执行的任务。\n\n- 已观察的消息数: ${role.rc.news.length}\n- 消息类型: ${newsCauseBys || '无'}\n- 待办任务: ${role.rc.todo ? role.rc.todo.name : '无'}\n- 关注的动作: ${watchSet || '无'}\n\n可以继续下一步，让其他角色继续工作。`;
        }
        
        this.messageHandler.sendMessage('confirmation_required', {
            role: role.profile,
            action: 'idle',
            content,
            outputFiles: [],
        });
    }


    /**
     * Publish and save message
     */
    private async publishAndSaveMessage(env: Environment, message: any): Promise<void> {
        env.publishMessage(message);
        logger.info(`SessionWorkflowExecutor: Published message from ${message.role} (causeBy: ${message.causeBy}) to environment`);

        try {
            const { MessageRepository } = await import('../database/repositories/MessageRepository');
            const messageRepo = new MessageRepository();
            await messageRepo.save(this.projectId, message);
            logger.info(`SessionWorkflowExecutor: Saved message ${message.id} to database for project ${this.projectId}`);
        } catch (error: any) {
            logger.warn(`SessionWorkflowExecutor: Failed to save message to database`, {
                error: error.message,
                messageId: message.id,
                projectId: this.projectId,
            });
        }
    }

    /**
     * Wait for message content to be fully saved to database
     * This ensures the last action's content is complete before showing confirmation dialog
     */
    private async waitForMessageContentComplete(messageId: string, maxRetries: number = 10, retryDelay: number = 200): Promise<void> {
        const { MessageRepository } = await import('../database/repositories/MessageRepository');
        const messageRepo = new MessageRepository();

        for (let i = 0; i < maxRetries; i++) {
            try {
                const dbMessage = await messageRepo.findByUuid(messageId);
                if (dbMessage && dbMessage.content) {
                    logger.info(`SessionWorkflowExecutor: Message ${messageId} content confirmed in database (length: ${dbMessage.content.length})`);
                    return;
                }
            } catch (error: any) {
                logger.warn(`SessionWorkflowExecutor: Error checking message content (attempt ${i + 1}/${maxRetries})`, {
                    error: error.message,
                    messageId,
                });
            }

            if (i < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, retryDelay));
            }
        }

        logger.warn(`SessionWorkflowExecutor: Could not confirm message ${messageId} content in database after ${maxRetries} attempts, proceeding anyway`);
    }

    /**
     * Get latest message from database by UUID
     * Returns null if message not found
     */
    private async getLatestMessageFromDatabase(messageId: string): Promise<any | null> {
        try {
            const { MessageRepository } = await import('../database/repositories/MessageRepository');
            const messageRepo = new MessageRepository();
            const dbMessage = await messageRepo.findByUuid(messageId);
            return dbMessage;
        } catch (error: any) {
            logger.warn(`SessionWorkflowExecutor: Failed to get message from database`, {
                error: error.message,
                messageId,
            });
            return null;
        }
    }

    private async resolveConfirmationContent(
        action: string,
        instructContent: any,
        fallbackContent: string
    ): Promise<string> {
        const workspaceDir = instructContent?.workspaceDir;
        if (!workspaceDir) {
            return fallbackContent;
        }

        const docType = String(instructContent?.documentType || instructContent?.type || '').toLowerCase();
        const isPrdAction = action === 'WritePRD' || action === 'ImprovePRD' || action === 'PRDReview';
        const isPrdDoc = docType === 'prd';

        if (!isPrdAction && !isPrdDoc) {
            return fallbackContent;
        }

        const prdContent = await this.readWorkspaceFile(workspaceDir, 'PRD.md');
        if (prdContent && prdContent.trim().length > 0) {
            return prdContent;
        }

        return fallbackContent;
    }

    private async readWorkspaceFile(workspaceDir: string, fileName: string): Promise<string | null> {
        const fullPath = path.resolve(workspaceDir, fileName);
        try {
            return await fs.readFile(fullPath, 'utf-8');
        } catch (error: any) {
            logger.warn('SessionWorkflowExecutor: Failed to read workspace file for confirmation', {
                fileName,
                workspaceDir,
                error: error.message,
            });
            return null;
        }
    }

    /**
     * Check and mark project as completed
     * Only marks as completed if:
     * 1. The last role has completed all its actions
     * 2. ALL workflow items are completed (no pending or running items)
     */
    private async checkAndMarkProjectCompleted(lastRole: string, roles: any[]): Promise<void> {
        try {
            await new Promise(resolve => setTimeout(resolve, 200));

            // Double-check: verify this is the last role
            const lastRoleIndex = roles.length - 1;
            const currentRoleIndex = roles.findIndex(r => r.profile === lastRole);
            const isLastRole = currentRoleIndex === lastRoleIndex;

            if (!isLastRole) {
                logger.warn(`SessionWorkflowExecutor: Cannot mark project as completed - role ${lastRole} is not the last role (index ${currentRoleIndex}/${lastRoleIndex})`);
                return;
            }

            // Double-check: verify the last role has completed all actions
            const lastRoleAllCompleted = await this.stateChecker.areAllRoleActionsCompleted(lastRole);
            if (!lastRoleAllCompleted) {
                logger.warn(`SessionWorkflowExecutor: Cannot mark project as completed - last role ${lastRole} has not completed all actions`);
                return;
            }

            // Double-check: verify all workflow items are completed
            const stats = await this.stateChecker.getWorkflowStatistics();
            const shouldMarkCompleted = stats.total > 0 &&
                stats.pending === 0 &&
                stats.running === 0 &&
                stats.completed > 0 &&
                stats.completed === stats.total;

            if (shouldMarkCompleted) {
                logger.info(`SessionWorkflowExecutor: Last role (${lastRole}) completed all actions, and all workflow items completed (${stats.completed}/${stats.total}), marking project ${this.projectId} as completed`);
                const { ProjectRepository } = await import('../database/repositories/ProjectRepository');
                const projectRepo = new ProjectRepository();
                await projectRepo.markCompleted(this.projectId);
                logger.info(`SessionWorkflowExecutor: Project ${this.projectId} marked as completed`);
            } else {
                logger.warn(`SessionWorkflowExecutor: Cannot mark project as completed - workflow items status: pending=${stats.pending}, running=${stats.running}, completed=${stats.completed}/${stats.total}`);
            }
        } catch (error: any) {
            logger.error(`SessionWorkflowExecutor: Failed to update project status`, { error: error.message });
        }
    }
}
