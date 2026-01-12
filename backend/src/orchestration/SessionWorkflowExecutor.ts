/**
 * Session Workflow Executor
 * Executes the workflow for interactive sessions
 */

import { Team } from './Team';
import { Environment } from './Environment';
import { WorkflowTracker } from './WorkflowTracker';
import { RoleReactMode } from '@mind2build/shared';
import { logger } from '../utils';
import { SessionMessageHandler } from './SessionMessageHandler';
import { SessionFileExtractor } from './SessionFileExtractor';
import { SessionStateRestorer } from './SessionStateRestorer';

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
    constructor(private workflowTracker: WorkflowTracker) { }

    /**
     * Check if confirmation is blocking workflow execution
     */
    async isConfirmationBlocking(): Promise<boolean> {
        const confirmationStatus = await this.workflowTracker.isConfirmationRequired();
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
        const confirmationStatus = await this.workflowTracker.isConfirmationRequired();

        // If confirmation is still required, cannot move
        if (confirmationStatus.required) {
            return false;
        }

        // If no current role, cannot move
        if (!currentRole) {
            return false;
        }

        // Check if all actions for current role are completed
        const allCompleted = await this.workflowTracker.areAllRoleActionsCompleted(currentRole);
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
        const lastRoleAllCompleted = await this.workflowTracker.areAllRoleActionsCompleted(lastRole);
        if (!lastRoleAllCompleted) {
            logger.info(`WorkflowStateChecker: Last role ${lastRole} has not completed all actions, cannot complete workflow`);
            return false;
        }

        // Third check: verify all workflow items are completed
        const workflowItems = await this.workflowTracker.getWorkflowItems();
        if (workflowItems.length === 0) {
            return false;
        }

        const pendingCount = workflowItems.filter(item => item.status === 'pending').length;
        const runningCount = workflowItems.filter(item => item.status === 'running').length;
        const completedCount = workflowItems.filter(item => item.status === 'completed').length;
        const totalCount = workflowItems.length;

        const allItemsCompleted = (
            pendingCount === 0 &&
            runningCount === 0 &&
            completedCount > 0 &&
            completedCount === totalCount
        );

        if (allItemsCompleted) {
            logger.info(`WorkflowStateChecker: Last role ${lastRole} completed all actions, and all workflow items are completed (${completedCount}/${totalCount}), workflow can be completed`);
        } else {
            logger.info(`WorkflowStateChecker: Last role ${lastRole} completed, but not all workflow items finished (pending: ${pendingCount}, running: ${runningCount}, completed: ${completedCount}/${totalCount}), cannot complete workflow`);
        }

        return allItemsCompleted;
    }

    /**
     * Check if role action is already completed
     */
    async isActionCompleted(role: string, action: string): Promise<boolean> {
        return await this.workflowTracker.isActionCompleted(role, action);
    }

    /**
     * Check if all role actions are completed
     */
    async areAllRoleActionsCompleted(role: string): Promise<boolean> {
        return await this.workflowTracker.areAllRoleActionsCompleted(role);
    }

    /**
     * Get workflow items statistics
     */
    async getWorkflowStatistics(): Promise<{
        pending: number;
        running: number;
        completed: number;
        total: number;
    }> {
        const workflowItems = await this.workflowTracker.getWorkflowItems();
        return {
            pending: workflowItems.filter(item => item.status === 'pending').length,
            running: workflowItems.filter(item => item.status === 'running').length,
            completed: workflowItems.filter(item => item.status === 'completed').length,
            total: workflowItems.length,
        };
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
    private workflowTracker: WorkflowTracker;
    private messageHandler: SessionMessageHandler;
    private config: WorkflowExecutorConfig;
    private stateChecker: WorkflowStateChecker;

    constructor(
        projectId: string,
        team: Team,
        workflowTracker: WorkflowTracker,
        messageHandler: SessionMessageHandler,
        config: WorkflowExecutorConfig
    ) {
        this.projectId = projectId;
        this.team = team;
        this.workflowTracker = workflowTracker;
        this.messageHandler = messageHandler;
        this.config = config;
        this.stateChecker = new WorkflowStateChecker(workflowTracker);
    }

    /**
     * Execute workflow with interactive interaction
     */
    async execute(): Promise<void> {
        const env = this.team.getEnvironment();
        const roles = env.getRoles();

        let currentRound = await this.loadCurrentRound();

        // Send initial progress
        this.messageHandler.sendMessage('progress', {
            message: 'Starting generation...',
            currentRound: currentRound,
            totalCost: 0,
        });

        // Restore message history from database
        await SessionStateRestorer.restoreMessageHistory(
            this.projectId,
            env,
            this.config.idea
        );

        // Initialize workflow state
        const { roleIndex, currentRound: updatedRound } = await this.initializeWorkflowState(roles, env, currentRound);
        currentRound = updatedRound;

        // Execute workflow loop
        await this.executeWorkflowLoop(roles, env, roleIndex, currentRound);
    }

    /**
     * Load current round from project database
     */
    private async loadCurrentRound(): Promise<number> {
        try {
            const { ProjectRepository } = await import('../database/repositories/ProjectRepository');
            const projectRepo = new ProjectRepository();
            const project = await projectRepo.findById(this.projectId);
            if (project && (project.current_round !== undefined && project.current_round !== null)) {
                const round = project.current_round;
                logger.info(`SessionWorkflowExecutor: Loaded current round ${round} from project ${this.projectId}`);
                return round;
            }
        } catch (error: any) {
            logger.warn(`SessionWorkflowExecutor: Failed to load current round from project ${this.projectId}`, { error: error.message });
        }
        return 0;
    }

    /**
     * Initialize workflow state and find starting role index
     */
    private async initializeWorkflowState(
        roles: any[],
        env: Environment,
        currentRound: number
    ): Promise<{ roleIndex: number; currentRound: number }> {
        const currentState = await this.workflowTracker.getCurrentState();

        // Determine if we should resume from current state or find next incomplete role
        const shouldResume = await this.shouldResumeFromCurrentState(currentState, roles);

        if (shouldResume.shouldResume && shouldResume.roleIndex !== null) {
            logger.info(`SessionWorkflowExecutor: Resuming from role index ${shouldResume.roleIndex} (${roles[shouldResume.roleIndex].profile})`);
            return { roleIndex: shouldResume.roleIndex, currentRound };
        }

        // Find next incomplete role
        const roleIndex = await this.findNextIncompleteRole(roles, env);
        logger.info(`SessionWorkflowExecutor: Starting from role index ${roleIndex} (${roles[roleIndex].profile})`);

        return { roleIndex, currentRound };
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
            await this.workflowTracker.clearState();
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
            await this.workflowTracker.clearState();
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

        const workflowItems = await this.workflowTracker.getWorkflowItems();
        const completedActions = new Set<string>();
        workflowItems.forEach(item => {
            if (item.status === 'completed') {
                completedActions.add(`${item.role}:${item.action}`);
            }
        });

        for (let i = 0; i < roles.length; i++) {
            const role = roles[i];
            const roleActions = role.actions.map((a: any) => a.name);

            const incompleteActions = roleActions.filter((action: string) => {
                const actionKey = `${role.profile}:${action}`;
                return !completedActions.has(actionKey);
            });

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

        logger.info(`SessionWorkflowExecutor: All roles are completed, starting from beginning`);
        return 0;
    }

    /**
     * Execute workflow loop
     * Continues until workflow is truly completed (no iteration limit)
     */
    private async executeWorkflowLoop(
        roles: any[],
        env: Environment,
        startRoleIndex: number,
        startRound: number
    ): Promise<void> {
        let iteration = 0;
        let roleIndex = startRoleIndex;
        let currentRound = startRound;

        // Continue until workflow is truly completed
        while (true) {
            iteration++;

            // Priority 1: Check if confirmation is blocking workflow
            if (await this.stateChecker.isConfirmationBlocking()) {
                await this.waitForConfirmation();
                continue;
            }

            // Priority 2: Check if we should move to next role (after confirmation cleared)
            const moveResult = await this.tryMoveToNextRole(roles, currentRound);
            if (moveResult.moved) {
                if (moveResult.completed) {
                    // Workflow completed
                    logger.info(`SessionWorkflowExecutor: Workflow completed successfully after ${iteration} iterations`);
                    break;
                }
                if (moveResult.nextRoleIndex !== undefined) {
                    roleIndex = moveResult.nextRoleIndex;
                }
                if (moveResult.currentRound !== undefined) {
                    currentRound = moveResult.currentRound;
                }
                continue;
            }

            // Priority 3: Update round number
            const roundUpdate = this.updateRound(iteration, roles.length, currentRound);
            if (roundUpdate.updated) {
                currentRound = roundUpdate.round;
            }

            // Priority 4: Process current role
            const processResult = await this.processRole(roles, env, roleIndex, iteration);
            if (processResult.shouldContinueWithSameRole) {
                // Continue with same role (has more actions)
                continue;
            }

            // Priority 5: Wait for confirmation if required
            if (processResult.requiresConfirmation) {
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
        const currentState = await this.workflowTracker.getCurrentState();

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
        currentRound: number
    ): Promise<{
        moved: boolean;
        nextRoleIndex?: number;
        currentRound?: number;
        completed?: boolean;
    }> {
        const currentState = await this.workflowTracker.getCurrentState();

        if (!currentState.role) {
            return { moved: false };
        }

        const currentRoleIndexInList = roles.findIndex(r => r.profile === currentState.role);
        if (currentRoleIndexInList === -1) {
            return { moved: false };
        }

        const nextRoleIndex = (currentRoleIndexInList + 1) % roles.length;
        const isLastRole = currentRoleIndexInList === roles.length - 1;
        const isRoundComplete = isLastRole && nextRoleIndex === 0;

        // Priority: Check exit conditions first (regardless of confirmation status)
        // Exit conditions:
        // 1. Last role has completed all its actions
        // 2. All workflow items are completed (no pending or running items)
        if (isRoundComplete) {
            // Verify this is the last role and it has completed all actions
            const lastRoleAllCompleted = await this.stateChecker.areAllRoleActionsCompleted(currentState.role);

            if (lastRoleAllCompleted) {
                // Last role has completed all actions, check if workflow should be completed
                const shouldComplete = await this.stateChecker.shouldCompleteWorkflow(currentState.role, roles);

                if (shouldComplete) {
                    const stats = await this.stateChecker.getWorkflowStatistics();
                    logger.info(`SessionWorkflowExecutor: Exit conditions met - Last role (${currentState.role}) completed all actions, and all workflow items completed (${stats.completed}/${stats.total}), marking project as completed`);
                    await this.checkAndMarkProjectCompleted(currentState.role, roles);
                    await this.workflowTracker.clearState();
                    return { moved: true, completed: true };
                }
            }
        }

        // Check if we can move to next role (requires confirmation cleared)
        const canMove = await this.stateChecker.canMoveToNextRole(currentState.role);
        if (!canMove) {
            return { moved: false };
        }

        // Move to next role in same round
        if (isRoundComplete) {
            // Last role hasn't completed all actions yet, continue workflow
            logger.info(`SessionWorkflowExecutor: Last role (${currentState.role}) hasn't completed all actions yet, continuing workflow`);
            await this.workflowTracker.clearState();
            this.messageHandler.sendMessage('progress', {
                message: `${currentState.role} continuing workflow`,
                currentRound: currentRound,
                totalCost: this.team.getCostReport().totalCost,
            });
            return { moved: true, nextRoleIndex, currentRound };
        }

        // Move to next role in same round
        await this.workflowTracker.clearState();
        this.messageHandler.sendMessage('progress', {
            message: `${currentState.role} completed`,
            currentRound: currentRound,
            totalCost: this.team.getCostReport().totalCost,
        });

        return { moved: true, nextRoleIndex, currentRound };
    }


    /**
     * Update round number
     * No limit on maximum rounds - continues until workflow completes
     */
    private updateRound(iteration: number, rolesLength: number, currentRound: number): { updated: boolean; round: number } {
        const calculatedRound = Math.max(
            Math.floor((iteration - 1) / rolesLength) + 1,
            currentRound
        );

        if (calculatedRound > currentRound) {
            const newRound = calculatedRound;
            this.updateProjectProgress(newRound).catch(error => {
                logger.warn(`SessionWorkflowExecutor: Failed to update project progress`, { error: error.message });
            });
            return { updated: true, round: newRound };
        }

        return { updated: false, round: currentRound };
    }

    /**
     * Update project progress in database
     */
    private async updateProjectProgress(currentRound: number): Promise<void> {
        try {
            const { ProjectRepository } = await import('../database/repositories/ProjectRepository');
            const projectRepo = new ProjectRepository();
            const progress = Math.min((currentRound / this.config.nRound) * 100, 100);
            await projectRepo.updateProgress(this.projectId, progress, currentRound);
            logger.info(`SessionWorkflowExecutor: Updated project ${this.projectId} progress: round ${currentRound}/${this.config.nRound}, progress ${progress.toFixed(1)}%`);
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

        // Step 1: Observe and think
        await role.observe();
        const hasTodo = await role.think();

        // Step 2: Handle idle state (no todo or todo already completed)
        const idleResult = await this.handleRoleIdleState(role, hasTodo);
        if (idleResult.isIdle) {
            return idleResult;
        }

        // Step 3: Execute role action
        const message = await this.executeRoleAction(role);

        // Step 4: Handle action execution result
        return await this.handleActionExecutionResult(role, message, env);
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
                logger.info(`SessionWorkflowExecutor: Role ${role.profile} todo action ${todoAction} is already completed, marking as idle`);
                await this.markRoleAsIdle(role);
                return { shouldContinueWithSameRole: false, requiresConfirmation: true, isIdle: true };
            }
        }

        // Check if role has no todo
        if (!hasTodo || !role.rc.todo) {
            logger.info(`SessionWorkflowExecutor: Role ${role.profile} has no todo after think(), marking as idle`);
            await this.markRoleAsIdle(role);
            return { shouldContinueWithSameRole: false, requiresConfirmation: true, isIdle: true };
        }

        return { shouldContinueWithSameRole: false, requiresConfirmation: false, isIdle: false };
    }

    /**
     * Mark role as idle
     */
    private async markRoleAsIdle(role: any): Promise<void> {
        await this.workflowTracker.onRoleIdle(role);
        await this.workflowTracker.setRunningState(role.profile, 'idle');

        if (await this.stateChecker.isConfirmationBlocking()) {
            return;
        }

        // Set confirmation required for current role
        // This will automatically clear any previous confirmation status and set the new role
        await this.workflowTracker.setConfirmationRequired(role.profile);
        this.sendIdleConfirmation(role);
    }

    /**
     * Execute role action
     */
    private async executeRoleAction(role: any): Promise<any> {
        await this.workflowTracker.onRoleStart(role);
        if (role.rc.todo) {
            await this.workflowTracker.setRunningState(role.profile, role.rc.todo.name);
        }

        const message = await role.act();
        await this.workflowTracker.onRoleComplete(role, message);

        if (message && message.causeBy && typeof message.causeBy === 'string' && message.causeBy.trim().length > 0) {
            await this.workflowTracker.setRunningState(role.profile, message.causeBy);
        }

        return message;
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

        logger.info(`SessionWorkflowExecutor: Using ${latestMessage ? 'database' : 'memory'} message content for confirmation (content length: ${finalContent?.length || 0})`);

        // Set confirmation required for current role
        // This will automatically clear any previous confirmation status
        await this.workflowTracker.setConfirmationRequired(role.profile);
        if (message.causeBy && typeof message.causeBy === 'string' && message.causeBy.trim().length > 0) {
            await this.workflowTracker.setRunningState(role.profile, message.causeBy);
        }

        // Send confirmation_required message with current role's content
        // This ensures the confirmation dialog shows the correct role and action
        this.messageHandler.sendMessage('confirmation_required', {
            role: role.profile,
            action: message.causeBy,
            content: finalContent,
            outputFiles: outputFiles,
            instructContent: finalInstructContent,
        });

        return { shouldContinueWithSameRole: false, requiresConfirmation: true, isIdle: false };
    }


    /**
     * Send idle confirmation message
     */
    private sendIdleConfirmation(role: any): void {
        const newsCauseBys = role.rc.news.map((msg: any) => msg.causeBy).join(', ');
        const watchSet = Array.from(role.rc.watch).join(', ');
        this.messageHandler.sendMessage('confirmation_required', {
            role: role.profile,
            action: 'idle',
            content: `**${role.profile} 状态检查**\n\n当前 ${role.profile} 没有需要执行的任务。\n\n- 已观察的消息数: ${role.rc.news.length}\n- 消息类型: ${newsCauseBys || '无'}\n- 待办任务: ${role.rc.todo ? role.rc.todo.name : '无'}\n- 关注的动作: ${watchSet || '无'}\n\n可以继续下一步，让其他角色继续工作。`,
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

