/**
 * Workflow Execution Repository
 * Data access layer for workflow_executions table
 */

import { query, getClient } from '../database/client';
import { logger } from '../utils';
import {
  WorkflowExecution,
  WorkflowExecutionRow,
  WorkflowState,
  StepState,
  StepStatus,
  CurrentPosition,
  PendingConfirmation,
  WorkflowError,
  rowToWorkflowExecution,
  workflowConfigToSteps,
  CreateWorkflowExecutionOptions,
} from './types';
import { WorkflowConfig } from '../database/repositories/ApplicationWorkflowRepository';
import { v4 as uuidv4 } from 'uuid';

export class WorkflowExecutionRepository {
  /**
   * Find workflow execution by project ID
   */
  async findByProjectId(projectId: string): Promise<WorkflowExecution | null> {
    try {
      const result = await query<WorkflowExecutionRow>(
        `SELECT * FROM workflow_executions WHERE project_id = $1`,
        [projectId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return rowToWorkflowExecution(result.rows[0]);
    } catch (error: any) {
      logger.error('WorkflowExecutionRepository: Failed to find by project ID', {
        projectId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Find workflow execution by ID
   */
  async findById(id: string): Promise<WorkflowExecution | null> {
    try {
      const result = await query<WorkflowExecutionRow>(
        `SELECT * FROM workflow_executions WHERE id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return rowToWorkflowExecution(result.rows[0]);
    } catch (error: any) {
      logger.error('WorkflowExecutionRepository: Failed to find by ID', {
        id,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Find workflow executions by states
   */
  async findByStates(states: WorkflowState[]): Promise<WorkflowExecution[]> {
    try {
      const result = await query<WorkflowExecutionRow>(
        `SELECT * FROM workflow_executions WHERE state = ANY($1::text[])`,
        [states]
      );

      return result.rows.map(rowToWorkflowExecution);
    } catch (error: any) {
      logger.error('WorkflowExecutionRepository: Failed to find by states', {
        states,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Create a new workflow execution
   */
  async create(options: CreateWorkflowExecutionOptions): Promise<WorkflowExecution> {
    try {
      const id = uuidv4();
      const steps = workflowConfigToSteps(options.workflowConfig);

      const result = await query<WorkflowExecutionRow>(
        `INSERT INTO workflow_executions (
          id, project_id, workflow_snapshot, state, current_position,
          steps, pending_confirmation, last_error, execution_context, version
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`,
        [
          id,
          options.projectId,
          JSON.stringify(options.workflowConfig),
          WorkflowState.INITIALIZED,
          null,
          JSON.stringify(steps),
          null,
          null,
          JSON.stringify({}),
          0,
        ]
      );

      logger.info('WorkflowExecutionRepository: Created workflow execution', {
        id,
        projectId: options.projectId,
        stepsCount: steps.length,
      });

      return rowToWorkflowExecution(result.rows[0]);
    } catch (error: any) {
      // Handle unique constraint violation (project already has execution)
      if (error.code === '23505') {
        logger.warn('WorkflowExecutionRepository: Workflow execution already exists for project', {
          projectId: options.projectId,
        });
        // Return existing one
        const existing = await this.findByProjectId(options.projectId);
        if (existing) {
          return existing;
        }
      }
      logger.error('WorkflowExecutionRepository: Failed to create', {
        projectId: options.projectId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Update workflow execution with optimistic locking
   */
  async update(execution: WorkflowExecution): Promise<WorkflowExecution> {
    try {
      const result = await query<WorkflowExecutionRow>(
        `UPDATE workflow_executions SET
          state = $1,
          current_position = $2,
          steps = $3,
          pending_confirmation = $4,
          last_error = $5,
          execution_context = $6,
          version = $7,
          updated_at = NOW()
        WHERE id = $8 AND version = $9
        RETURNING *`,
        [
          execution.state,
          execution.currentPosition ? JSON.stringify(execution.currentPosition) : null,
          JSON.stringify(execution.steps),
          execution.pendingConfirmation ? JSON.stringify(execution.pendingConfirmation) : null,
          execution.lastError ? JSON.stringify(execution.lastError) : null,
          JSON.stringify(execution.executionContext),
          execution.version,
          execution.id,
          execution.version - 1, // Check against previous version
        ]
      );

      if (result.rows.length === 0) {
        // Optimistic lock failed - someone else updated the record
        throw new Error(`Optimistic lock failed for workflow execution ${execution.id}. Please retry.`);
      }

      logger.debug('WorkflowExecutionRepository: Updated workflow execution', {
        id: execution.id,
        state: execution.state,
        version: execution.version,
      });

      return rowToWorkflowExecution(result.rows[0]);
    } catch (error: any) {
      logger.error('WorkflowExecutionRepository: Failed to update', {
        id: execution.id,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Update workflow execution with atomic operation (no version check)
   * Use this for simple updates that don't require optimistic locking
   */
  async updateFields(
    projectId: string,
    fields: Partial<{
      state: WorkflowState;
      currentPosition: CurrentPosition | null;
      steps: StepStatus[];
      pendingConfirmation: PendingConfirmation | null;
      lastError: WorkflowError | null;
      executionContext: Record<string, any>;
    }>
  ): Promise<WorkflowExecution | null> {
    try {
      const setClauses: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (fields.state !== undefined) {
        setClauses.push(`state = $${paramIndex++}`);
        values.push(fields.state);
      }
      if (fields.currentPosition !== undefined) {
        setClauses.push(`current_position = $${paramIndex++}`);
        values.push(fields.currentPosition ? JSON.stringify(fields.currentPosition) : null);
      }
      if (fields.steps !== undefined) {
        setClauses.push(`steps = $${paramIndex++}`);
        values.push(JSON.stringify(fields.steps));
      }
      if (fields.pendingConfirmation !== undefined) {
        setClauses.push(`pending_confirmation = $${paramIndex++}`);
        values.push(fields.pendingConfirmation ? JSON.stringify(fields.pendingConfirmation) : null);
      }
      if (fields.lastError !== undefined) {
        setClauses.push(`last_error = $${paramIndex++}`);
        values.push(fields.lastError ? JSON.stringify(fields.lastError) : null);
      }
      if (fields.executionContext !== undefined) {
        setClauses.push(`execution_context = $${paramIndex++}`);
        values.push(JSON.stringify(fields.executionContext));
      }

      if (setClauses.length === 0) {
        return await this.findByProjectId(projectId);
      }

      setClauses.push(`version = version + 1`);
      setClauses.push(`updated_at = NOW()`);

      values.push(projectId);

      const result = await query<WorkflowExecutionRow>(
        `UPDATE workflow_executions SET ${setClauses.join(', ')} WHERE project_id = $${paramIndex} RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        return null;
      }

      return rowToWorkflowExecution(result.rows[0]);
    } catch (error: any) {
      logger.error('WorkflowExecutionRepository: Failed to update fields', {
        projectId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Delete workflow execution by project ID
   */
  async deleteByProjectId(projectId: string): Promise<boolean> {
    try {
      const result = await query(
        `DELETE FROM workflow_executions WHERE project_id = $1`,
        [projectId]
      );

      return (result.rowCount ?? 0) > 0;
    } catch (error: any) {
      logger.error('WorkflowExecutionRepository: Failed to delete', {
        projectId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get or create workflow execution for a project
   */
  async getOrCreate(
    projectId: string,
    workflowConfig: WorkflowConfig
  ): Promise<WorkflowExecution> {
    const existing = await this.findByProjectId(projectId);
    if (existing) {
      return existing;
    }

    return await this.create({
      projectId,
      workflowConfig,
    });
  }

  /**
   * Reset workflow execution to a specific role
   * This is an atomic operation that resets all steps from the target role onwards
   */
  async resetToRole(projectId: string, targetRole: string): Promise<WorkflowExecution | null> {
    const client = await getClient();

    try {
      await client.query('BEGIN');

      // Get current execution
      const getResult = await client.query<WorkflowExecutionRow>(
        `SELECT * FROM workflow_executions WHERE project_id = $1 FOR UPDATE`,
        [projectId]
      );

      if (getResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }

      const row = getResult.rows[0];
      const steps: StepStatus[] = row.steps || [];

      // Find target role index
      const targetStep = steps.find(s => s.role === targetRole);
      if (!targetStep) {
        await client.query('ROLLBACK');
        throw new Error(`Role ${targetRole} not found in workflow`);
      }

      // Ensure targetRoleIndex is a number for proper comparison
      const targetRoleIndex = Number(targetStep.roleIndex);

      // Log which steps will be reset (for debugging)
      const stepsToReset = steps.filter(s => Number(s.roleIndex) >= targetRoleIndex);
      logger.debug('WorkflowExecutionRepository: Steps to reset', {
        projectId,
        targetRole,
        targetRoleIndex,
        stepsToReset: stepsToReset.map(s => ({
          role: s.role,
          action: s.action,
          roleIndex: s.roleIndex,
          currentState: s.state,
        })),
      });

      // Reset all steps from target role onwards to PENDING
      // Use Number() to ensure proper numeric comparison (JSON may deserialize as strings)
      const updatedSteps = steps.map(step => {
        if (Number(step.roleIndex) >= targetRoleIndex) {
          return {
            ...step,
            state: StepState.PENDING,
            retryCount: 0,
            startedAt: undefined,
            completedAt: undefined,
            error: undefined,
          };
        }
        return step;
      });

      // Verify reset was applied correctly
      const resetCount = updatedSteps.filter(s => 
        Number(s.roleIndex) >= targetRoleIndex && s.state === StepState.PENDING
      ).length;
      const expectedResetCount = stepsToReset.length;

      if (resetCount !== expectedResetCount) {
        logger.warn('WorkflowExecutionRepository: Reset count mismatch', {
          projectId,
          targetRole,
          expectedResetCount,
          actualResetCount: resetCount,
        });
      }

      // Update execution - set state to INITIALIZED (not RUNNING)
      // The frontend will call /start to begin execution
      const updateResult = await client.query<WorkflowExecutionRow>(
        `UPDATE workflow_executions SET
          state = $1,
          current_position = $2,
          steps = $3,
          pending_confirmation = NULL,
          last_error = NULL,
          version = version + 1,
          updated_at = NOW()
        WHERE project_id = $4
        RETURNING *`,
        [
          WorkflowState.INITIALIZED,
          JSON.stringify({ roleIndex: targetRoleIndex, actionIndex: 0 }),
          JSON.stringify(updatedSteps),
          projectId,
        ]
      );

      await client.query('COMMIT');

      logger.info('WorkflowExecutionRepository: Reset workflow to role completed', {
        projectId,
        targetRole,
        targetRoleIndex,
        resetStepsCount: resetCount,
        totalSteps: steps.length,
      });

      return rowToWorkflowExecution(updateResult.rows[0]);
    } catch (error: any) {
      await client.query('ROLLBACK');
      logger.error('WorkflowExecutionRepository: Failed to reset to role', {
        projectId,
        targetRole,
        error: error.message,
      });
      throw error;
    } finally {
      client.release();
    }
  }
}
