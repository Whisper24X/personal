/**
 * Message Repository
 * Data access layer for messages using native PostgreSQL
 */

import { query } from '../client';
import { Message } from '../../core/message/Message';

export interface DBMessage {
  id: string;
  project_id: string;
  role_id?: string;
  message_uuid: string;
  content: string;
  instruct_content?: any;
  role_type: string;
  cause_by: string;
  sent_from: string;
  send_to: any;
  metadata: any;
  created_at: Date;
}

export class MessageRepository {
  /**
   * Save a message to database
   */
  async save(projectId: string, message: Message, roleId?: string): Promise<DBMessage> {
    const result = await query<DBMessage>(
      `INSERT INTO messages (
        project_id, role_id, message_uuid, content, instruct_content,
        role_type, cause_by, sent_from, send_to, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        projectId,
        roleId || null,
        message.id,
        message.content,
        message.instructContent ? JSON.stringify(message.instructContent) : null,
        message.role,
        message.causeBy,
        message.sentFrom,
        JSON.stringify(Array.from(message.sendTo)),
        JSON.stringify(message.metadata),
      ]
    );
    
    return result.rows[0];
  }

  /**
   * Save multiple messages
   */
  async saveMany(projectId: string, messages: Message[]): Promise<number> {
    if (messages.length === 0) return 0;
    
    const values: any[] = [];
    const placeholders: string[] = [];
    
    messages.forEach((msg, index) => {
      const offset = index * 9;
      placeholders.push(
        `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9})`
      );
      
      values.push(
        projectId,
        msg.id,
        msg.content,
        msg.instructContent ? JSON.stringify(msg.instructContent) : null,
        msg.role,
        msg.causeBy,
        msg.sentFrom,
        JSON.stringify(Array.from(msg.sendTo)),
        JSON.stringify(msg.metadata)
      );
    });
    
    const sql = `
      INSERT INTO messages (
        project_id, message_uuid, content, instruct_content,
        role_type, cause_by, sent_from, send_to, metadata
      ) VALUES ${placeholders.join(', ')}
    `;
    
    const result = await query(sql, values);
    return result.rowCount || 0;
  }

  /**
   * Find messages by project ID
   */
  async findByProjectId(projectId: string, limit: number = 100): Promise<DBMessage[]> {
    const result = await query<DBMessage>(
      `SELECT * FROM messages 
       WHERE project_id = $1 
       ORDER BY created_at ASC 
       LIMIT $2`,
      [projectId, limit]
    );
    
    return result.rows;
  }

  /**
   * Find messages by role ID
   */
  async findByRoleId(roleId: string, limit: number = 50): Promise<DBMessage[]> {
    const result = await query<DBMessage>(
      `SELECT * FROM messages 
       WHERE role_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2`,
      [roleId, limit]
    );
    
    return result.rows;
  }

  /**
   * Find message by UUID
   */
  async findByUuid(messageUuid: string): Promise<DBMessage | null> {
    const result = await query<DBMessage>(
      `SELECT * FROM messages WHERE message_uuid = $1`,
      [messageUuid]
    );
    
    return result.rows[0] || null;
  }

  /**
   * Get message count for project
   */
  async countByProject(projectId: string): Promise<number> {
    const result = await query(
      `SELECT COUNT(*) as count FROM messages WHERE project_id = $1`,
      [projectId]
    );
    
    return parseInt(result.rows[0].count);
  }
}

export default MessageRepository;
