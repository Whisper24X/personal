/**
 * Step State Tracker
 * Manages step state for StepwiseDocumentGenerator
 * As internal implementation of StateManager
 */

import { query } from '../database/client';
import { logger } from '../utils';

export enum StepState {
    PENDING = 'pending',
    RUNNING = 'running',
    COMPLETED = 'completed',
    FAILED = 'failed'
}

export interface StepStateInfo {
    stepId: string;
    stepName?: string;
    status: StepState;
    startTime?: Date;
    endTime?: Date;
    error?: string;
}

export class StepStateTracker {
    private projectId: string;

    constructor(projectId: string) {
        this.projectId = projectId;
    }

    /**
     * Get step state for a specific step
     */
    async getStepState(
        role: string,
        action: string,
        stepId: string
    ): Promise<StepState> {
        try {
            const result = await query<{ status: string }>(
                `SELECT status FROM interactive_session_step_state
                 WHERE project_id = $1 AND role = $2 AND action = $3 AND step_id = $4`,
                [this.projectId, role, action, stepId]
            );

            if (result.rows.length === 0) {
                return StepState.PENDING;
            }

            return result.rows[0].status as StepState;
        } catch (error: any) {
            logger.error('StepStateTracker: Failed to get step state', {
                projectId: this.projectId,
                role,
                action,
                stepId,
                error: error.message,
            });
            return StepState.PENDING;
        }
    }

    /**
     * Set step state
     */
    async setStepState(
        role: string,
        action: string,
        stepId: string,
        status: StepState
    ): Promise<void> {
        try {
            await query(
                `INSERT INTO interactive_session_step_state
                 (project_id, role, action, step_id, status, updated_at)
                 VALUES ($1, $2, $3, $4, $5, NOW())
                 ON CONFLICT (project_id, role, action, step_id)
                 DO UPDATE SET
                     status = EXCLUDED.status,
                     updated_at = NOW()`,
                [this.projectId, role, action, stepId, status]
            );

            logger.info('StepStateTracker: Step state updated', {
                projectId: this.projectId,
                role,
                action,
                stepId,
                status,
            });
        } catch (error: any) {
            logger.error('StepStateTracker: Failed to set step state', {
                projectId: this.projectId,
                role,
                action,
                stepId,
                status,
                error: error.message,
            });
            throw error;
        }
    }

    /**
     * Get all step states for a role and action
     */
    async getAllStepStates(
        role: string,
        action: string
    ): Promise<StepStateInfo[]> {
        try {
            const result = await query<{
                step_id: string;
                status: string;
                created_at: Date;
                updated_at: Date;
            }>(
                `SELECT step_id, status, created_at, updated_at
                 FROM interactive_session_step_state
                 WHERE project_id = $1 AND role = $2 AND action = $3
                 ORDER BY created_at ASC`,
                [this.projectId, role, action]
            );

            return result.rows.map(row => ({
                stepId: row.step_id,
                status: row.status as StepState,
                startTime: row.created_at,
                endTime: row.updated_at,
            }));
        } catch (error: any) {
            logger.error('StepStateTracker: Failed to get all step states', {
                projectId: this.projectId,
                role,
                action,
                error: error.message,
            });
            return [];
        }
    }

    /**
     * Reset all step states for a role and action
     */
    async resetStepStates(role: string, action: string): Promise<void> {
        try {
            await query(
                `DELETE FROM interactive_session_step_state
                 WHERE project_id = $1 AND role = $2 AND action = $3`,
                [this.projectId, role, action]
            );

            logger.info('StepStateTracker: Step states reset', {
                projectId: this.projectId,
                role,
                action,
            });
        } catch (error: any) {
            logger.error('StepStateTracker: Failed to reset step states', {
                projectId: this.projectId,
                role,
                action,
                error: error.message,
            });
            throw error;
        }
    }

    /**
     * Reset all step states for a role (all actions)
     */
    async resetStepStatesForRole(role: string): Promise<void> {
        try {
            await query(
                `DELETE FROM interactive_session_step_state
                 WHERE project_id = $1 AND role = $2`,
                [this.projectId, role]
            );

            logger.info('StepStateTracker: Step states reset for role', {
                projectId: this.projectId,
                role,
            });
        } catch (error: any) {
            logger.error('StepStateTracker: Failed to reset step states for role', {
                projectId: this.projectId,
                role,
                error: error.message,
            });
            throw error;
        }
    }

    /**
     * On step start
     */
    async onStepStart(
        role: string,
        action: string,
        stepId: string
    ): Promise<void> {
        await this.setStepState(role, action, stepId, StepState.RUNNING);
    }

    /**
     * On step complete
     */
    async onStepComplete(
        role: string,
        action: string,
        stepId: string
    ): Promise<void> {
        await this.setStepState(role, action, stepId, StepState.COMPLETED);
    }

    /**
     * On step error
     */
    async onStepError(
        role: string,
        action: string,
        stepId: string,
        error: Error
    ): Promise<void> {
        try {
            await query(
                `UPDATE interactive_session_step_state
                 SET status = $5, updated_at = NOW()
                 WHERE project_id = $1 AND role = $2 AND action = $3 AND step_id = $4`,
                [this.projectId, role, action, stepId, StepState.FAILED]
            );

            logger.error('StepStateTracker: Step error', {
                projectId: this.projectId,
                role,
                action,
                stepId,
                error: error.message,
            });
        } catch (err: any) {
            logger.error('StepStateTracker: Failed to set step error', {
                projectId: this.projectId,
                role,
                action,
                stepId,
                error: err.message,
            });
        }
    }
}
