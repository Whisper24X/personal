/**
 * Interactive Session Workflow Repository
 * Data access layer for interactive session workflow state
 */

import { ActionStatus } from '@mind2build/shared';
import { query } from '../client';
import { logger } from '../../utils';

export interface WorkflowItem {
    id: string;
    project_id: string;
    role: string;
    action: string | null;
    status: string;
    role_order: number | null;
    action_order: number | null;
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
    role_state?: number | null;
    role_todo_action?: string | null;
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

            // Insert all roles and actions with role_order and action_order (only if workflow doesn't exist)
            for (let roleIndex = 0; roleIndex < roles.length; roleIndex++) {
                const roleInfo = roles[roleIndex];
                for (let actionIndex = 0; actionIndex < roleInfo.actions.length; actionIndex++) {
                    const action = roleInfo.actions[actionIndex];
                    await query(
                        `INSERT INTO interactive_session_workflows (
              project_id, role, action, status, role_order, action_order
            ) VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (project_id, role, action) DO UPDATE SET
              status = COALESCE(interactive_session_workflows.status, EXCLUDED.status),
              role_order = COALESCE(interactive_session_workflows.role_order, EXCLUDED.role_order),
              action_order = COALESCE(interactive_session_workflows.action_order, EXCLUDED.action_order),
              updated_at = NOW()`,
                        [projectId, roleInfo.role, action.name, ActionStatus.PENDING, roleIndex, actionIndex]
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
        confirmationRole?: string | null,
        roleState?: number | null,
        roleTodoAction?: string | null
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

            // Build SQL based on provided fields
            const fields: string[] = ['project_id', '"current_role"', '"current_action"'];
            const values: any[] = [projectId, role, action];
            const updates: string[] = ['"current_role" = EXCLUDED."current_role"', '"current_action" = EXCLUDED."current_action"'];
            let paramIndex = 4;

            if (requiresConfirmation !== undefined) {
                fields.push('requires_confirmation', 'confirmation_role');
                values.push(requiresConfirmation, confirmationRole || null);
                updates.push('requires_confirmation = EXCLUDED.requires_confirmation', 'confirmation_role = EXCLUDED.confirmation_role');
                paramIndex += 2;
            }

            if (roleState !== undefined) {
                fields.push('role_state');
                values.push(roleState);
                updates.push('role_state = EXCLUDED.role_state');
                paramIndex += 1;
            }

            if (roleTodoAction !== undefined) {
                fields.push('role_todo_action');
                values.push(roleTodoAction);
                updates.push('role_todo_action = EXCLUDED.role_todo_action');
                paramIndex += 1;
            }

            updates.push('updated_at = NOW()');

            const result = await query<RunningState>(
                `INSERT INTO interactive_session_running_state (
              ${fields.join(', ')}
            ) VALUES (${fields.map((_, i) => `$${i + 1}`).join(', ')})
            ON CONFLICT (project_id) DO UPDATE SET
              ${updates.join(', ')}
            RETURNING *`,
                values
            );

            if (!result.rows[0]) {
                throw new Error('Failed to update running state: no row returned');
            }

            return result.rows[0];
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
                requires_confirmation, confirmation_role, role_state, role_todo_action,
                updated_at, created_at 
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
     * Returns items sorted by role_order and action_order (from database)
     */
    async getWorkflowItems(projectId: string): Promise<WorkflowItem[]> {
        try {
            // Order by role_order and action_order from database
            const result = await query<WorkflowItem>(
                `SELECT * FROM interactive_session_workflows 
         WHERE project_id = $1 
         ORDER BY role_order ASC NULLS LAST, action_order ASC NULLS LAST`,
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
     * Uses role_order from database to determine downstream roles
     */
    async resetWorkflowFromRole(
        projectId: string,
        role: string
    ): Promise<void> {
        try {
            // Get target role's role_order
            const targetRoleResult = await query<{ role_order: number }>(
                `SELECT role_order
                 FROM interactive_session_workflows
                 WHERE project_id = $1 AND role = $2
                 LIMIT 1`,
                [projectId, role]
            );

            if (targetRoleResult.rows.length === 0 || targetRoleResult.rows[0].role_order === null) {
                // Fallback to hardcoded order if role_order is NULL
                const roleOrder = [
                    'Salesperson',
                    'ProductManager',
                    'Architect',
                    'ProjectManager',
                    'Engineer',
                    'QAEngineer',
                ];
                const roleIndex = roleOrder.indexOf(role);
                if (roleIndex === -1) {
                    throw new Error(`Unknown role: ${role}`);
                }
                const downstreamRoles = roleOrder.slice(roleIndex);
                await query(
                    `UPDATE interactive_session_workflows 
                     SET status = $2, updated_at = NOW()
                     WHERE project_id = $1 AND role = ANY($3::text[])`,
                    [projectId, ActionStatus.PENDING, downstreamRoles]
                );
                return;
            }

            const targetRoleOrder = targetRoleResult.rows[0].role_order;

            // Reset all workflow items for downstream roles (role_order >= target role_order) to 'pending'
            await query(
                `UPDATE interactive_session_workflows 
                 SET status = $2, updated_at = NOW()
                 WHERE project_id = $1 
                 AND role_order >= $3
                 AND role_order IS NOT NULL`,
                [projectId, ActionStatus.PENDING, targetRoleOrder]
            );

            // Also handle roles with NULL role_order (fallback)
            await query(
                `UPDATE interactive_session_workflows 
                 SET status = $2, updated_at = NOW()
                 WHERE project_id = $1 
                 AND role_order IS NULL
                 AND role = $3`,
                [projectId, ActionStatus.PENDING, role]
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
                ORDER BY action_order ASC NULLS LAST`,
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

    /**
     * Get the first action for a role (action_order minimum)
     */
    async getFirstActionForRole(
        projectId: string,
        role: string
    ): Promise<{ role: string; action: string } | null> {
        try {
            const result = await query<{ role: string; action: string }>(
                `SELECT role, action
                 FROM interactive_session_workflows
                 WHERE project_id = $1 AND role = $2
                 ORDER BY action_order ASC NULLS LAST
                 LIMIT 1`,
                [projectId, role]
            );

            if (result.rows.length > 0) {
                return result.rows[0];
            }
            return null;
        } catch (error: any) {
            logger.error('InteractiveSessionWorkflowRepository: Failed to get first action', {
                projectId,
                role,
                error: error.message,
            });
            return null;
        }
    }

    /**
     * Get downstream roles based on role_order
     * Returns all roles with role_order >= target role's role_order
     */
    async getDownstreamRoles(
        projectId: string,
        role: string
    ): Promise<string[]> {
        try {
            // Get target role's role_order
            const targetRoleResult = await query<{ role_order: number }>(
                `SELECT role_order
                 FROM interactive_session_workflows
                 WHERE project_id = $1 AND role = $2
                 LIMIT 1`,
                [projectId, role]
            );

            if (targetRoleResult.rows.length === 0) {
                return [];
            }

            const targetRoleOrder = targetRoleResult.rows[0].role_order;
            if (targetRoleOrder === null || targetRoleOrder === undefined) {
                // If role_order is NULL, fallback to hardcoded order
                const roleOrder = [
                    'Salesperson',
                    'ProductManager',
                    'Architect',
                    'ProjectManager',
                    'Engineer',
                    'QAEngineer',
                ];
                const roleIndex = roleOrder.indexOf(role);
                if (roleIndex === -1) {
                    return [];
                }
                return roleOrder.slice(roleIndex);
            }

            // Get all roles with role_order >= target role_order
            const result = await query<{ role: string; role_order: number }>(
                `SELECT DISTINCT role, role_order
                 FROM interactive_session_workflows
                 WHERE project_id = $1 AND role_order >= $2
                 ORDER BY role_order ASC`,
                [projectId, targetRoleOrder]
            );

            return result.rows.map(row => row.role);
        } catch (error: any) {
            logger.error('InteractiveSessionWorkflowRepository: Failed to get downstream roles', {
                projectId,
                role,
                error: error.message,
            });
            // Fallback to hardcoded order
            const roleOrder = [
                'Salesperson',
                'ProductManager',
                'Architect',
                'ProjectManager',
                'Engineer',
                'QAEngineer',
            ];
            const roleIndex = roleOrder.indexOf(role);
            if (roleIndex === -1) {
                return [];
            }
            return roleOrder.slice(roleIndex);
        }
    }

    /**
     * Check if an action is the last action for a role (action_order maximum)
     */
    async isLastActionForRole(
        projectId: string,
        role: string,
        action: string
    ): Promise<boolean> {
        try {
            // Get max action_order for the role
            const maxOrderResult = await query<{ max_order: number }>(
                `SELECT MAX(action_order) as max_order
                 FROM interactive_session_workflows
                 WHERE project_id = $1 AND role = $2`,
                [projectId, role]
            );

            if (maxOrderResult.rows.length === 0 || maxOrderResult.rows[0].max_order === null) {
                return false;
            }

            const maxOrder = maxOrderResult.rows[0].max_order;

            // Get current action's action_order
            const actionResult = await query<{ action_order: number }>(
                `SELECT action_order
                 FROM interactive_session_workflows
                 WHERE project_id = $1 AND role = $2 AND action = $3`,
                [projectId, role, action]
            );

            if (actionResult.rows.length === 0 || actionResult.rows[0].action_order === null) {
                return false;
            }

            const actionOrder = actionResult.rows[0].action_order;
            return actionOrder === maxOrder;
        } catch (error: any) {
            logger.error('InteractiveSessionWorkflowRepository: Failed to check if last action', {
                projectId,
                role,
                action,
                error: error.message,
            });
            return false;
        }
    }

    /**
     * Clear message content for specific roles
     */
    async clearMessageContent(
        projectId: string,
        roles: string[]
    ): Promise<void> {
        try {
            await query(
                `UPDATE messages
                 SET content = ''
                 WHERE project_id = $1 AND sent_from = ANY($2::text[])`,
                [projectId, roles]
            );

            logger.info('InteractiveSessionWorkflowRepository: Cleared message content', {
                projectId,
                roles,
            });
        } catch (error: any) {
            logger.error('InteractiveSessionWorkflowRepository: Failed to clear message content', {
                projectId,
                roles,
                error: error.message,
            });
            throw error;
        }
    }
}

