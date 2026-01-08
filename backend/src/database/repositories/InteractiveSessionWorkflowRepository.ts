/**
 * Interactive Session Workflow Repository
 * Data access layer for interactive session workflow state
 */

import { query } from '../client';
import { logger } from '../../utils';

export interface WorkflowItem {
    id: string;
    session_id: string;
    project_id?: string;
    role: string;
    action: string | null;
    status: string;
    created_at: Date;
    updated_at: Date;
}

export interface RunningState {
    id: string;
    session_id: string;
    project_id?: string;
    current_role: string | null;
    current_action: string | null;
    updated_at: Date;
    created_at: Date;
}

export class InteractiveSessionWorkflowRepository {
    /**
     * Initialize workflow for a session (save all roles and their actions)
     */
    async initializeWorkflow(
        sessionId: string,
        projectId: string | null,
        roles: Array<{ role: string; actions: Array<{ name: string }> }>
    ): Promise<void> {
        try {
            // Delete existing workflow items for this session
            await query(
                `DELETE FROM interactive_session_workflows WHERE session_id = $1`,
                [sessionId]
            );

            // Insert all roles and actions
            for (const roleInfo of roles) {
                for (const action of roleInfo.actions) {
                    await query(
                        `INSERT INTO interactive_session_workflows (
              session_id, project_id, role, action, status
            ) VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (session_id, role, action) DO UPDATE SET
              status = EXCLUDED.status,
              updated_at = NOW()`,
                        [sessionId, projectId, roleInfo.role, action.name, 'pending']
                    );
                }
            }

            logger.info(`Initialized workflow for session ${sessionId}`, {
                sessionId,
                projectId,
                rolesCount: roles.length,
            });
        } catch (error: any) {
            logger.error('Failed to initialize workflow:', {
                sessionId,
                projectId,
                error: error.message,
            });
            throw error;
        }
    }

    /**
     * Update running state
     */
    async updateRunningState(
        sessionId: string,
        projectId: string | null,
        role: string | null,
        action: string | null
    ): Promise<RunningState> {
        logger.info(`InteractiveSessionWorkflowRepository: updateRunningState called - sessionId=${sessionId}, projectId=${projectId}, role=${role}, action=${action}`);
        try {
            const result = await query<RunningState>(
                `INSERT INTO interactive_session_running_state (
          session_id, project_id, "current_role", "current_action"
        ) VALUES ($1, $2, $3, $4)
        ON CONFLICT (session_id) DO UPDATE SET
          "current_role" = EXCLUDED."current_role",
          "current_action" = EXCLUDED."current_action",
          updated_at = NOW()
        RETURNING *`,
                [sessionId, projectId, role, action]
            );

            if (!result.rows[0]) {
                logger.error(`InteractiveSessionWorkflowRepository: updateRunningState - No row returned from database`);
                throw new Error('Failed to update running state: no row returned');
            }

            const updatedState = result.rows[0];
            logger.info(`InteractiveSessionWorkflowRepository: updateRunningState succeeded - Updated state: role=${updatedState.current_role}, action=${updatedState.current_action}, sessionId=${sessionId}`);
            return updatedState;
        } catch (error: any) {
            logger.error('InteractiveSessionWorkflowRepository: Failed to update running state:', {
                sessionId,
                projectId,
                role,
                action,
                error: error.message,
                errorStack: error.stack,
            });
            throw error;
        }
    }

    /**
     * Get current running state
     */
    async getRunningState(sessionId: string): Promise<RunningState | null> {
        logger.info(`InteractiveSessionWorkflowRepository: getRunningState called - sessionId=${sessionId}`);
        try {
            const result = await query<RunningState>(
                `SELECT id, session_id, project_id, "current_role", "current_action", updated_at, created_at 
         FROM interactive_session_running_state WHERE session_id = $1`,
                [sessionId]
            );

            logger.info(`InteractiveSessionWorkflowRepository: getRunningState - Query returned ${result.rows.length} row(s)`);

            if (result.rows[0]) {
                const state = {
                    ...result.rows[0],
                    current_role: result.rows[0].current_role,
                    current_action: result.rows[0].current_action,
                };
                logger.info(`InteractiveSessionWorkflowRepository: getRunningState - Found state: role=${state.current_role}, action=${state.current_action}, sessionId=${sessionId}`);
                return state;
            }
            logger.warn(`InteractiveSessionWorkflowRepository: getRunningState - No state found for sessionId=${sessionId}`);
            return null;
        } catch (error: any) {
            logger.error('InteractiveSessionWorkflowRepository: Failed to get running state:', {
                sessionId,
                error: error.message,
                errorStack: error.stack,
            });
            return null;
        }
    }

    /**
     * Get workflow items for a session
     */
    async getWorkflowItems(sessionId: string): Promise<WorkflowItem[]> {
        try {
            const result = await query<WorkflowItem>(
                `SELECT * FROM interactive_session_workflows 
         WHERE session_id = $1 
         ORDER BY role, action`,
                [sessionId]
            );

            return result.rows;
        } catch (error: any) {
            logger.error('Failed to get workflow items:', {
                sessionId,
                error: error.message,
            });
            return [];
        }
    }

    /**
     * Update workflow item status
     */
    async updateWorkflowItemStatus(
        sessionId: string,
        role: string,
        action: string,
        status: string
    ): Promise<void> {
        try {
            await query(
                `UPDATE interactive_session_workflows 
         SET status = $1, updated_at = NOW()
         WHERE session_id = $2 AND role = $3 AND action = $4`,
                [status, sessionId, role, action]
            );
        } catch (error: any) {
            logger.error('Failed to update workflow item status:', {
                sessionId,
                role,
                action,
                status,
                error: error.message,
            });
        }
    }

    /**
     * Clear running state
     */
    async clearRunningState(sessionId: string): Promise<void> {
        try {
            await query(
                `UPDATE interactive_session_running_state 
         SET "current_role" = NULL, "current_action" = NULL, updated_at = NOW()
         WHERE session_id = $1`,
                [sessionId]
            );
        } catch (error: any) {
            logger.error('Failed to clear running state:', {
                sessionId,
                error: error.message,
            });
        }
    }
}

