/**
 * Interactive Session Workflow Repository
 * Data access layer for interactive session workflow state
 */

import { ActionStatus } from '@mind2build/shared';
import { query } from '../client';

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
            const count = existingWorkflow.rows[0]?.count;
            if (count && (typeof count === 'number' ? count > 0 : parseInt(String(count), 10) > 0)) {
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
                        [sessionId, projectId, roleInfo.role, action.name, ActionStatus.PENDING]
                    );
                }
            }
        } catch (error: any) {
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
                throw new Error('Failed to update running state: no row returned');
            }

            const updatedState = result.rows[0];
            return updatedState;
        } catch (error: any) {
            throw error;
        }
    }

    /**
     * Get current running state by sessionId
     */
    async getRunningState(sessionId: string): Promise<RunningState | null> {
        try {
            const result = await query<RunningState>(
                `SELECT id, session_id, project_id, "current_role", "current_action", updated_at, created_at 
         FROM interactive_session_running_state WHERE session_id = $1`,
                [sessionId]
            );

            if (result.rows[0]) {
                const state = {
                    ...result.rows[0],
                    current_role: result.rows[0].current_role,
                    current_action: result.rows[0].current_action,
                };
                return state;
            }
            return null;
        } catch (error: any) {
            return null;
        }
    }

    /**
     * Get current running state by projectId (for resuming sessions)
     */
    async getRunningStateByProjectId(projectId: string): Promise<RunningState | null> {
        try {
            const result = await query<RunningState>(
                `SELECT id, session_id, project_id, "current_role", "current_action", updated_at, created_at 
         FROM interactive_session_running_state 
         WHERE project_id = $1 
         ORDER BY updated_at DESC 
         LIMIT 1`,
                [projectId]
            );

            if (result.rows[0]) {
                const state = {
                    ...result.rows[0],
                    current_role: result.rows[0].current_role,
                    current_action: result.rows[0].current_action,
                };
                return state;
            }
            return null;
        } catch (error: any) {
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
                return [];
            }

            const sessionId = sessionResult.rows[0].session_id;
            return this.getWorkflowItems(sessionId);
        } catch (error: any) {
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
        status: ActionStatus
    ): Promise<void> {
        try {
            await query(
                `UPDATE interactive_session_workflows 
         SET status = $1, updated_at = NOW()
         WHERE session_id = $2 AND role = $3 AND action = $4`,
                [status, sessionId, role, action]
            );
        } catch (error: any) {
            // Error handling
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
        status: ActionStatus
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
            // Error handling
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
            // Error handling
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

            return result.rows[0].status === ActionStatus.COMPLETED;
        } catch (error: any) {
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

            // Reset all workflow items for downstream roles to 'pending'
            await query(
                `UPDATE interactive_session_workflows 
         SET status = $3, updated_at = NOW()
         WHERE session_id = $1 AND role = ANY($2::text[])`,
                [sessionId, downstreamRoles, ActionStatus.PENDING]
            );
        } catch (error: any) {
            throw error;
        }
    }
}

