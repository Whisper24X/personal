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
            // Check if workflow already exists for this session
            const existingWorkflow = await query<{ count: number }>(
                `SELECT COUNT(*) as count FROM interactive_session_workflows WHERE session_id = $1`,
                [sessionId]
            );

            // If workflow already exists, don't reinitialize (preserve existing status)
            if (existingWorkflow.rows[0] && parseInt(existingWorkflow.rows[0].count) > 0) {
                logger.info(`Workflow already exists for session ${sessionId}, skipping reinitialization to preserve existing status`);
                return;
            }

            // Insert all roles and actions (only if workflow doesn't exist)
            for (const roleInfo of roles) {
                for (const action of roleInfo.actions) {
                    await query(
                        `INSERT INTO interactive_session_workflows (
              session_id, project_id, role, action, status
            ) VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (session_id, role, action) DO UPDATE SET
              status = COALESCE(interactive_session_workflows.status, EXCLUDED.status),
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
     * Get current running state by sessionId
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
     * Get current running state by projectId (for resuming sessions)
     */
    async getRunningStateByProjectId(projectId: string): Promise<RunningState | null> {
        logger.info(`InteractiveSessionWorkflowRepository: getRunningStateByProjectId called - projectId=${projectId}`);
        try {
            const result = await query<RunningState>(
                `SELECT id, session_id, project_id, "current_role", "current_action", updated_at, created_at 
         FROM interactive_session_running_state 
         WHERE project_id = $1 
         ORDER BY updated_at DESC 
         LIMIT 1`,
                [projectId]
            );

            logger.info(`InteractiveSessionWorkflowRepository: getRunningStateByProjectId - Query returned ${result.rows.length} row(s)`);

            if (result.rows[0]) {
                const state = {
                    ...result.rows[0],
                    current_role: result.rows[0].current_role,
                    current_action: result.rows[0].current_action,
                };
                logger.info(`InteractiveSessionWorkflowRepository: getRunningStateByProjectId - Found state: role=${state.current_role}, action=${state.current_action}, sessionId=${state.session_id}, projectId=${projectId}`);
                return state;
            }
            logger.warn(`InteractiveSessionWorkflowRepository: getRunningStateByProjectId - No state found for projectId=${projectId}`);
            return null;
        } catch (error: any) {
            logger.error('InteractiveSessionWorkflowRepository: Failed to get running state by projectId:', {
                projectId,
                error: error.message,
                errorStack: error.stack,
            });
            return null;
        }
    }

    /**
     * Get workflow items by projectId (for resuming sessions)
     */
    async getWorkflowItemsByProjectId(projectId: string): Promise<WorkflowItem[]> {
        try {
            // Get the most recent session_id for this project
            const sessionResult = await query<{ session_id: string }>(
                `SELECT session_id FROM interactive_session_workflows 
         WHERE project_id = $1 
         ORDER BY updated_at DESC 
         LIMIT 1`,
                [projectId]
            );

            if (sessionResult.rows.length === 0) {
                logger.warn(`InteractiveSessionWorkflowRepository: No workflow found for projectId=${projectId}`);
                return [];
            }

            const sessionId = sessionResult.rows[0].session_id;
            return this.getWorkflowItems(sessionId);
        } catch (error: any) {
            logger.error('InteractiveSessionWorkflowRepository: Failed to get workflow items by projectId:', {
                projectId,
                error: error.message,
            });
            return [];
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
     * Migrate workflow item from old session to new session
     */
    async migrateWorkflowItem(
        newSessionId: string,
        projectId: string | null,
        role: string,
        action: string,
        status: string
    ): Promise<void> {
        try {
            await query(
                `INSERT INTO interactive_session_workflows (
              session_id, project_id, role, action, status
            ) VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (session_id, role, action) DO UPDATE SET
              status = EXCLUDED.status,
              updated_at = NOW()`,
                [newSessionId, projectId, role, action, status]
            );
        } catch (error: any) {
            logger.error('Failed to migrate workflow item:', {
                newSessionId,
                projectId,
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

    /**
     * Check if a specific role and action is completed
     */
    async isActionCompleted(
        sessionId: string,
        role: string,
        action: string
    ): Promise<boolean> {
        try {
            const result = await query<{ status: string }>(
                `SELECT status FROM interactive_session_workflows 
         WHERE session_id = $1 AND role = $2 AND action = $3`,
                [sessionId, role, action]
            );

            if (result.rows.length === 0) {
                // If workflow item doesn't exist, consider it not completed
                return false;
            }

            return result.rows[0].status === 'completed';
        } catch (error: any) {
            logger.error('Failed to check action completion status:', {
                sessionId,
                role,
                action,
                error: error.message,
            });
            return false; // On error, assume not completed to be safe
        }
    }

    /**
     * Reset workflow items for a role and all downstream roles
     * Role order: Salesperson -> ProductManager -> Architect -> ProjectManager -> Engineer -> QAEngineer
     */
    async resetWorkflowFromRole(
        sessionId: string,
        role: string
    ): Promise<void> {
        try {
            // Define role order (upstream to downstream)
            const roleOrder = [
                'Salesperson',
                'ProductManager',
                'Architect',
                'ProjectManager',
                'Engineer',
                'QAEngineer',
            ];

            // Find the index of the target role
            const roleIndex = roleOrder.indexOf(role);
            if (roleIndex === -1) {
                throw new Error(`Unknown role: ${role}`);
            }

            // Get all downstream roles (including the target role)
            const downstreamRoles = roleOrder.slice(roleIndex);

            logger.info(`Resetting workflow from role ${role}`, {
                sessionId,
                role,
                downstreamRoles,
            });

            // Reset all workflow items for downstream roles to 'pending'
            await query(
                `UPDATE interactive_session_workflows 
         SET status = 'pending', updated_at = NOW()
         WHERE session_id = $1 AND role = ANY($2::text[])`,
                [sessionId, downstreamRoles]
            );

            logger.info(`Successfully reset workflow from role ${role}`, {
                sessionId,
                role,
                downstreamRoles,
            });
        } catch (error: any) {
            logger.error('Failed to reset workflow from role:', {
                sessionId,
                role,
                error: error.message,
            });
            throw error;
        }
    }
}

