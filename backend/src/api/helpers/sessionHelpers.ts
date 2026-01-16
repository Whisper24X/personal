/**
 * Session Helper Functions
 * Utility functions for managing interactive sessions
 */

import { sessionManager } from '../../orchestration/InteractiveSessionManager';
import { logger } from '../../utils';
import { InteractiveSession } from '../../orchestration/InteractiveSession';

/**
 * Helper function to get or restore session from database
 * If session doesn't exist in memory, tries to restore it from database
 */
export async function getOrRestoreSession(projectId: string): Promise<InteractiveSession | null> {
    let session = sessionManager.getSession(projectId);

    // If session exists, check executor status before returning
    if (session) {
        // Check if executor is running (prevent duplicate executor on page refresh)
        const executorPromise = (session as any).executorPromise;
        if (executorPromise) {
            // Use debug level to reduce log noise during frequent polling
        }
        return session;
    }

    // Try to restore from database
    logger.info(`API: Session not found in memory for project ${projectId}, attempting to restore from database`);

    try {
        const { ProjectRepository } = await import('../../database/repositories/ProjectRepository');
        const projectRepo = new ProjectRepository();
        const project = await projectRepo.findById(projectId);

        if (!project) {
            logger.warn(`API: Project ${projectId} not found in database`);
            return null;
        }

        // Check if there's an action running in database before restoring
        // This prevents creating a new executor when one might already be running
        try {
            const { StateManager } = await import('../../orchestration/StateManager');
            const { Team } = await import('../../orchestration/Team');
            const { Context } = await import('../../core/context/Context');
            
            // Create temporary state manager to check running state
            const tempCtx = new Context(undefined, parseFloat(project.investment?.toString() || '10.0'));
            const tempTeam = new Team(tempCtx, false);
            const tempStateManager = new StateManager(projectId, tempTeam);
            
            const runningState = await tempStateManager.getRunningState();
            if (runningState.role && runningState.action) {
                const { ActionStatus } = await import('@mind2build/shared');
                const actionStatus = await tempStateManager.getActionStatus(runningState.role, runningState.action);
                if (actionStatus === ActionStatus.RUNNING) {
                    logger.warn(`API: Action ${runningState.action} for role ${runningState.role} is RUNNING for project ${projectId}, but session not in memory. This may indicate an orphaned executor.`);
                }
            }
        } catch (checkError: any) {
            logger.warn(`API: Failed to check running state before restoring session for project ${projectId}`, {
                error: checkError.message,
            });
            // Continue with restoration even if check fails
        }

        // Restore session from project data
        const DEFAULT_USER_ID = '302769d6-247d-43db-a005-0519712255fb';
        const userId = project.user_id || DEFAULT_USER_ID;

        logger.info(`API: Restoring session for project ${projectId} from database`);
        session = sessionManager.createSession({
            name: project.name,
            idea: project.idea,
            description: project.description || '',
            investment: parseFloat(project.investment?.toString() || '10.0'),
            nRound: project.n_round || 5,
            userId,
            applicationId: project.application_id || undefined,
            projectId: project.id,
        });

        logger.info(`API: Successfully restored session for project ${projectId}`);
        return session;
    } catch (error: any) {
        logger.error(`API: Failed to restore session for project ${projectId}`, {
            error: error.message,
            errorStack: error.stack,
        });
        return null;
    }
}

