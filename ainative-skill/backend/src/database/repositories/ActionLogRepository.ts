/**
 * Action Log Repository
 * Data access layer for action execution logs using native PostgreSQL
 * Schema V2: renamed from actions to action_logs, added project_id direct reference
 */

import { query } from '../client';
import { logger } from '../../utils';
import { ActionStatus } from '@mind2build/shared';

export interface DBActionLog {
  id: string;
  project_id: string;
  role_id?: string;
  message_id?: string;
  action_type: string;
  status: string;
  input_data?: any;
  output_data?: any;
  duration_ms?: number;
  error_message?: string;
  created_at: Date;
}

export class ActionLogRepository {
  /**
   * Save an action execution log
   */
  async save(data: {
    projectId: string;
    roleId?: string;
    actionType: string;
    messageId?: string;
    inputData?: any;
    outputData?: any;
    status: ActionStatus;
    durationMs?: number;
    errorMessage?: string;
  }): Promise<DBActionLog> {
    const result = await query<DBActionLog>(
      `INSERT INTO action_logs (
        project_id, role_id, message_id, action_type, 
        input_data, output_data, status, duration_ms, error_message
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        data.projectId,
        data.roleId || null,
        data.messageId || null,
        data.actionType,
        data.inputData ? JSON.stringify(data.inputData) : null,
        data.outputData ? JSON.stringify(data.outputData) : null,
        data.status,
        data.durationMs || null,
        data.errorMessage || null,
      ]
    );

    logger.debug(`ActionLogRepository: Saved action log ${data.actionType}`, {
      id: result.rows[0].id,
      projectId: data.projectId,
      status: data.status,
    });

    return result.rows[0];
  }

  /**
   * Update action log status
   */
  async updateStatus(
    id: string, 
    status: ActionStatus, 
    options?: { durationMs?: number; errorMessage?: string; outputData?: any }
  ): Promise<DBActionLog | null> {
    const setClauses = ['status = $1'];
    const values: any[] = [status];
    let paramIndex = 2;

    if (options?.durationMs !== undefined) {
      setClauses.push(`duration_ms = $${paramIndex++}`);
      values.push(options.durationMs);
    }

    if (options?.errorMessage !== undefined) {
      setClauses.push(`error_message = $${paramIndex++}`);
      values.push(options.errorMessage);
    }

    if (options?.outputData !== undefined) {
      setClauses.push(`output_data = $${paramIndex++}`);
      values.push(JSON.stringify(options.outputData));
    }

    values.push(id);

    const result = await query<DBActionLog>(
      `UPDATE action_logs SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  /**
   * Find action logs by project ID
   */
  async findByProjectId(projectId: string, limit: number = 100): Promise<DBActionLog[]> {
    const result = await query<DBActionLog>(
      `SELECT * FROM action_logs 
       WHERE project_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2`,
      [projectId, limit]
    );

    return result.rows;
  }

  /**
   * Find action logs by role ID
   */
  async findByRoleId(roleId: string, limit: number = 100): Promise<DBActionLog[]> {
    const result = await query<DBActionLog>(
      `SELECT * FROM action_logs 
       WHERE role_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2`,
      [roleId, limit]
    );

    return result.rows;
  }

  /**
   * Find action log by message ID
   */
  async findByMessageId(messageId: string): Promise<DBActionLog | null> {
    const result = await query<DBActionLog>(
      `SELECT * FROM action_logs WHERE message_id = $1 LIMIT 1`,
      [messageId]
    );

    return result.rows[0] || null;
  }

  /**
   * Find action logs by action type
   */
  async findByActionType(projectId: string, actionType: string, limit: number = 50): Promise<DBActionLog[]> {
    const result = await query<DBActionLog>(
      `SELECT * FROM action_logs 
       WHERE project_id = $1 AND action_type = $2
       ORDER BY created_at DESC 
       LIMIT $3`,
      [projectId, actionType, limit]
    );

    return result.rows;
  }

  /**
   * Find action logs by status
   */
  async findByStatus(projectId: string, status: ActionStatus, limit: number = 50): Promise<DBActionLog[]> {
    const result = await query<DBActionLog>(
      `SELECT * FROM action_logs 
       WHERE project_id = $1 AND status = $2
       ORDER BY created_at DESC 
       LIMIT $3`,
      [projectId, status, limit]
    );

    return result.rows;
  }

  /**
   * Get action statistics for a project
   */
  async getStatistics(projectId: string) {
    const result = await query<{
      total: string;
      completed: string;
      failed: string;
      running: string;
      avg_duration_ms: string;
    }>(
      `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        COUNT(*) FILTER (WHERE status = 'running') as running,
        AVG(duration_ms) FILTER (WHERE duration_ms IS NOT NULL) as avg_duration_ms
       FROM action_logs 
       WHERE project_id = $1`,
      [projectId]
    );

    const row = result.rows[0];
    return {
      total: parseInt(row.total),
      completed: parseInt(row.completed),
      failed: parseInt(row.failed),
      running: parseInt(row.running),
      avgDurationMs: row.avg_duration_ms ? parseFloat(row.avg_duration_ms) : null,
    };
  }

  /**
   * Delete action logs by project ID
   */
  async deleteByProjectId(projectId: string): Promise<number> {
    const result = await query(
      `DELETE FROM action_logs WHERE project_id = $1`,
      [projectId]
    );

    return result.rowCount || 0;
  }
}

// Export as both ActionLogRepository and ActionRepository for backward compatibility
export { ActionLogRepository as ActionRepository };
export default ActionLogRepository;
