/**
 * Interactive Session Workflow Repository
 * Data access layer for interactive session workflow state
 */

import { ActionStatus } from '@mind2build/shared';
import { query } from '../client';

export interface WorkflowItem {
    id: string;
    project_id: string;
    role: string;
    action: string | null;
    status: string;
    created_at: Date;
    updated_at: Date;
}

export interface RunningState {
    id: string;
    project_id: string;
    current_role: string | null;
    current_action: string | null;
    requires_confirmation?: boolean;
    confirmation_role?: string | null;
    updated_at: Date;
    created_at: Date;
}

export class InteractiveSessionWorkflowRepository {
    /**
     * Initialize workflow for a project (save all roles and their actions)
     */
    async initializeWorkflow(
        projectId: string,
        roles: Array<{ role: string; actions: Array<{ name: string }> }>
    ): Promise<void> {
        try {
            // Check if workflow already exists for this project
            const existingWorkflow = await query<{ count: number }>(
                `SELECT COUNT(*) as count FROM interactive_session_workflows WHERE project_id = $1`,
                [projectId]
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
              project_id, role, action, status
            ) VALUES ($1, $2, $3, $4)
            ON CONFLICT (project_id, role, action) DO UPDATE SET
              status = COALESCE(interactive_session_workflows.status, EXCLUDED.status),
              updated_at = NOW()`,
                        [projectId, roleInfo.role, action.name, ActionStatus.PENDING]
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
        projectId: string,
        role: string | null,
        action: string | null,
        requiresConfirmation?: boolean,
        confirmationRole?: string | null
    ): Promise<RunningState> {
        try {
            // Validate projectId
            try {
                const { ProjectRepository } = await import('./ProjectRepository');
                const projectRepo = new ProjectRepository();
                const project = await projectRepo.findById(projectId);
                if (!project) {
                    throw new Error(`Project ${projectId} does not exist`);
                }
            } catch (error: any) {
                throw new Error(`Failed to validate project: ${error.message}`);
            }

            // Build SQL based on whether confirmation fields are provided
            if (requiresConfirmation !== undefined) {
                const result = await query<RunningState>(
                    `INSERT INTO interactive_session_running_state (
              project_id, "current_role", "current_action", requires_confirmation, confirmation_role
            ) VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (project_id) DO UPDATE SET
              "current_role" = EXCLUDED."current_role",
              "current_action" = EXCLUDED."current_action",
              requires_confirmation = EXCLUDED.requires_confirmation,
              confirmation_role = EXCLUDED.confirmation_role,
              updated_at = NOW()
            RETURNING *`,
                    [projectId, role, action, requiresConfirmation, confirmationRole || null]
                );

                if (!result.rows[0]) {
                    throw new Error('Failed to update running state: no row returned');
                }

                return result.rows[0];
            } else {
                const result = await query<RunningState>(
                    `INSERT INTO interactive_session_running_state (
              project_id, "current_role", "current_action"
            ) VALUES ($1, $2, $3)
            ON CONFLICT (project_id) DO UPDATE SET
              "current_role" = EXCLUDED."current_role",
              "current_action" = EXCLUDED."current_action",
              updated_at = NOW()
            RETURNING *`,
                    [projectId, role, action]
                );

                if (!result.rows[0]) {
                    throw new Error('Failed to update running state: no row returned');
                }

                return result.rows[0];
            }
        } catch (error: any) {
            throw error;
        }
    }

    /**
     * Get current running state by projectId
     */
    async getRunningState(projectId: string): Promise<RunningState | null> {
        try {
            const result = await query<RunningState>(
                `SELECT id, project_id, "current_role", "current_action", 
                requires_confirmation, confirmation_role, updated_at, created_at 
         FROM interactive_session_running_state WHERE project_id = $1`,
                [projectId]
            );

            if (result.rows[0]) {
                const state = {
                    ...result.rows[0],
                    current_role: result.rows[0].current_role,
                    current_action: result.rows[0].current_action,
                    requires_confirmation: result.rows[0].requires_confirmation || false,
                    confirmation_role: result.rows[0].confirmation_role || null,
                };
                return state;
            }
            return null;
        } catch (error: any) {
            return null;
        }
    }

    /**
     * Get workflow items for a project
     * Note: Items are returned without action ordering - sorting by registration order
     * is handled by WorkflowTracker.getWorkflowItems()
     */
    async getWorkflowItems(projectId: string): Promise<WorkflowItem[]> {
        try {
            // Only order by role, not by action, to preserve registration order
            // Action ordering is handled by WorkflowTracker based on getWorkflowStructure()
            const result = await query<WorkflowItem>(
                `SELECT * FROM interactive_session_workflows 
         WHERE project_id = $1 
         ORDER BY role`,
                [projectId]
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
        projectId: string,
        role: string,
        action: string,
        status: ActionStatus
    ): Promise<void> {
        try {
            await query(
                `UPDATE interactive_session_workflows 
         SET status = $1, updated_at = NOW()
         WHERE project_id = $2 AND role = $3 AND action = $4`,
                [status, projectId, role, action]
            );
        } catch (error: any) {
            // Error handling
        }
    }

    /**
     * Clear all running statuses for a project
     * This ensures only one action can be running at a time
     */
    async clearAllRunningStatuses(projectId: string): Promise<void> {
        try {
            await query(
                `UPDATE interactive_session_workflows 
         SET status = $1, updated_at = NOW()
         WHERE project_id = $2 AND status = $3`,
                [ActionStatus.PENDING, projectId, ActionStatus.RUNNING]
            );
        } catch (error: any) {
            // Error handling
        }
    }

    /**
     * Clear running state
     * Also clears confirmation status
     */
    async clearRunningState(projectId: string): Promise<void> {
        try {
            await query(
                `UPDATE interactive_session_running_state 
         SET "current_role" = NULL, 
             "current_action" = NULL, 
             requires_confirmation = FALSE,
             confirmation_role = NULL,
             updated_at = NOW()
         WHERE project_id = $1`,
                [projectId]
            );
        } catch (error: any) {
            // Error handling
        }
    }

    /**
     * Check if a specific role and action is completed
     */
    async isActionCompleted(
        projectId: string,
        role: string,
        action: string
    ): Promise<boolean> {
        try {
            const result = await query<{ status: string }>(
                `SELECT status FROM interactive_session_workflows 
         WHERE project_id = $1 AND role = $2 AND action = $3`,
                [projectId, role, action]
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
        projectId: string,
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
         SET status = $2, updated_at = NOW()
         WHERE project_id = $1 AND role = ANY($3::text[])`,
                [projectId, ActionStatus.PENDING, downstreamRoles]
            );
        } catch (error: any) {
            throw error;
        }
    }

    /**
     * Check if all actions for a role are completed
     * Based on database state for the given project
     */
    async areAllRoleActionsCompleted(
        projectId: string,
        role: string
    ): Promise<boolean> {
        try {
            const result = await query<{ count: number; completed_count: number }>(
                `SELECT 
                    COUNT(*) as count,
                    COUNT(*) FILTER (WHERE status = $3) as completed_count
                FROM interactive_session_workflows 
                WHERE project_id = $1 AND role = $2`,
                [projectId, role, ActionStatus.COMPLETED]
            );

            if (result.rows.length === 0) {
                return false;
            }

            const row = result.rows[0];
            const totalCount = typeof row.count === 'number' ? row.count : parseInt(String(row.count), 10);
            const completedCount = typeof row.completed_count === 'number'
                ? row.completed_count
                : parseInt(String(row.completed_count), 10);

            // All actions are completed if completed_count equals total count and total count > 0
            return totalCount > 0 && completedCount === totalCount;
        } catch (error: any) {
            // On error, assume not completed to be safe
            return false;
        }
    }

    /**
     * Get all actions status for a role
     * Returns array of action statuses for the given project and role
     */
    async getRoleActionsStatus(
        projectId: string,
        role: string
    ): Promise<Array<{ action: string; status: ActionStatus }>> {
        try {
            const result = await query<{ action: string; status: string }>(
                `SELECT action, status 
                FROM interactive_session_workflows 
                WHERE project_id = $1 AND role = $2
                ORDER BY action`,
                [projectId, role]
            );

            return result.rows.map(row => ({
                action: row.action || '',
                status: row.status as ActionStatus,
            }));
        } catch (error: any) {
            return [];
        }
    }

    /**
     * Set confirmation required status for a role
     */
    async setConfirmationRequired(
        projectId: string,
        role: string
    ): Promise<void> {
        try {
            await query(
                `UPDATE interactive_session_running_state 
                SET requires_confirmation = TRUE, 
                    confirmation_role = $2,
                    updated_at = NOW()
                WHERE project_id = $1`,
                [projectId, role]
            );
        } catch (error: any) {
            // If no row exists, create one
            await query(
                `INSERT INTO interactive_session_running_state 
                (project_id, requires_confirmation, confirmation_role)
                VALUES ($1, TRUE, $2)
                ON CONFLICT (project_id) DO UPDATE SET
                    requires_confirmation = TRUE,
                    confirmation_role = $2,
                    updated_at = NOW()`,
                [projectId, role]
            );
        }
    }

    /**
     * Clear confirmation required status
     */
    async clearConfirmationRequired(
        projectId: string
    ): Promise<void> {
        try {
            await query(
                `UPDATE interactive_session_running_state 
                SET requires_confirmation = FALSE, 
                    confirmation_role = NULL,
                    updated_at = NOW()
                WHERE project_id = $1`,
                [projectId]
            );
        } catch (error: any) {
            // Ignore errors if row doesn't exist
        }
    }

    /**
     * Get confirmation status
     */
    async getConfirmationStatus(
        projectId: string
    ): Promise<{ required: boolean; role: string | null }> {
        try {
            const result = await query<{ requires_confirmation: boolean; confirmation_role: string | null }>(
                `SELECT requires_confirmation, confirmation_role 
                FROM interactive_session_running_state 
                WHERE project_id = $1`,
                [projectId]
            );

            if (result.rows.length > 0) {
                const row = result.rows[0];
                return {
                    required: row.requires_confirmation || false,
                    role: row.confirmation_role || null,
                };
            }

            return { required: false, role: null };
        } catch (error: any) {
            return { required: false, role: null };
        }
    }
}

