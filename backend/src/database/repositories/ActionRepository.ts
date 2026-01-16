/**
 * Action Repository
 * Data access layer for actions using native PostgreSQL
 */

import { query } from '../client';
import { Message } from '../../core/message/Message';
import { logger } from '../../utils';
import { ActionStatus } from '@mind2build/shared';

export interface DBAction {
  id: string;
  role_id: string;
  message_id?: string;
  action_type: string;
  input_data?: any;
  output_data?: any;
  status: string;
  duration?: number;
  created_at: Date;
}

export class ActionRepository {
  /**
   * Save an action execution record
   */
  async save(data: {
    roleId: string;
    actionType: string;
    messageId?: string;
    inputData?: any;
    outputData?: any;
    status: ActionStatus;
    duration?: number;
  }): Promise<DBAction> {
    const result = await query<DBAction>(
      `INSERT INTO actions (
        role_id, message_id, action_type, input_data, output_data, status, duration
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        data.roleId,
        data.messageId || null,
        data.actionType,
        data.inputData ? JSON.stringify(data.inputData) : null,
        data.outputData ? JSON.stringify(data.outputData) : null,
        data.status,
        data.duration || null,
      ]
    );

    logger.debug(`ActionRepository: Saved action ${data.actionType} for role ${data.roleId}`, {
      actionId: result.rows[0].id,
      status: data.status,
    });

    return result.rows[0];
  }

  /**
   * Update action status
   */
  async updateStatus(actionId: string, status: ActionStatus, duration?: number): Promise<void> {
    await query(
      `UPDATE actions SET status = $1, duration = $2 WHERE id = $3`,
      [status, duration || null, actionId]
    );
  }

  /**
   * Find actions by role ID
   */
  async findByRoleId(roleId: string, limit: number = 100): Promise<DBAction[]> {
    const result = await query<DBAction>(
      `SELECT * FROM actions 
       WHERE role_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2`,
      [roleId, limit]
    );

    return result.rows;
  }

  /**
   * Find actions by message ID
   */
  async findByMessageId(messageId: string): Promise<DBAction | null> {
    const result = await query<DBAction>(
      `SELECT * FROM actions WHERE message_id = $1 LIMIT 1`,
      [messageId]
    );

    return result.rows[0] || null;
  }

  /**
   * Find actions by project ID (through role -> team -> project)
   */
  async findByProjectId(projectId: string, limit: number = 100): Promise<DBAction[]> {
    const result = await query<DBAction>(
      `SELECT a.* FROM actions a
       INNER JOIN roles r ON a.role_id = r.id
       INNER JOIN teams t ON r.team_id = t.id
       WHERE t.project_id = $1
       ORDER BY a.created_at DESC
       LIMIT $2`,
      [projectId, limit]
    );

    return result.rows;
  }
}

export default ActionRepository;
