/**
 * Message Repository
 * Data access layer for messages using native PostgreSQL
 */

import { query } from '../client';
import { Message } from '../../core/message/Message';
import { logger } from '../../utils';

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
   * @param projectId - Project ID
   * @param message - Message to save
   * @param roleProfile - Optional role profile (if not provided, uses message.sentFrom)
   */
  async save(projectId: string, message: Message, roleProfile?: string): Promise<DBMessage> {
    // role_id now stores the profile (role type) directly
    // If roleProfile not provided, use message.sentFrom (which is already the profile)
    // For user messages (sentFrom === 'User'), role_id should be 'user'
    let finalRoleProfile: string = roleProfile || '';
    if (!finalRoleProfile && message.sentFrom) {
      // Use sentFrom as profile, but set to 'user' for user messages
      if (message.sentFrom === 'User' || message.sentFrom === 'user') {
        finalRoleProfile = 'user';
      } else {
        finalRoleProfile = message.sentFrom;
      }
    }
    // If still empty, default to 'user'
    if (!finalRoleProfile) {
      finalRoleProfile = 'user';
    }

    const result = await query<DBMessage>(
      `INSERT INTO messages (
        project_id, role_id, message_uuid, content, instruct_content,
        role_type, cause_by, sent_from, send_to, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        projectId,
        finalRoleProfile,
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
    
    // role_id now stores the profile directly, so we can use sentFrom directly
    // No need for database lookups anymore
    const values: any[] = [];
    const placeholders: string[] = [];
    let paramIndex = 1;
    
    messages.forEach((msg) => {
      placeholders.push(
        `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7}, $${paramIndex + 8}, $${paramIndex + 9})`
      );
      
      // Determine role_id: use sentFrom as profile, 'user' for user messages
      let roleId: string = 'user';
      if (msg.sentFrom && msg.sentFrom !== 'User' && msg.sentFrom !== 'user') {
        roleId = msg.sentFrom;
      }
      
      values.push(
        projectId,
        roleId,
        msg.id,
        msg.content,
        msg.instructContent ? JSON.stringify(msg.instructContent) : null,
        msg.role,
        msg.causeBy,
        msg.sentFrom,
        JSON.stringify(Array.from(msg.sendTo)),
        JSON.stringify(msg.metadata)
      );
      
      paramIndex += 10;
    });
    
    const sql = `
      INSERT INTO messages (
        project_id, role_id, message_uuid, content, instruct_content,
        role_type, cause_by, sent_from, send_to, metadata
      ) VALUES ${placeholders.join(', ')}
    `;
    
    try {
      const result = await query(sql, values);
      logger.info(`Successfully saved ${result.rowCount || 0} messages to database`, {
        projectId,
        messageCount: messages.length,
        roleProfilesResolved: messages.filter(msg => msg.sentFrom && msg.sentFrom !== 'User' && msg.sentFrom !== 'user').length,
      });
      return result.rowCount || 0;
    } catch (error: any) {
      // Log detailed error information
      logger.error('Failed to save messages:', {
        projectId,
        messageCount: messages.length,
        error: error.message,
        stack: error.stack,
        sql: sql.substring(0, 200) + '...',
        valuesCount: values.length,
      });
      throw error;
    }
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
   * Find messages by role profile (role_id now stores profile string)
   * @param roleProfile - Role profile (e.g., 'ProductManager', 'Architect')
   */
  async findByRoleId(roleProfile: string, limit: number = 50): Promise<DBMessage[]> {
    const result = await query<DBMessage>(
      `SELECT * FROM messages 
       WHERE role_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2`,
      [roleProfile, limit]
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
