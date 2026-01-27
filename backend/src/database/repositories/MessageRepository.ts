/**
 * Message Repository
 * Data access layer for messages using native PostgreSQL
 * Schema V2: role_id renamed to role_profile for clarity
 */

import { query } from '../client';
import { Message } from '../../core/message/Message';
import { logger } from '../../utils';

export interface DBMessage {
  id: string;
  project_id: string;
  role_profile?: string;  // Changed from role_id
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
    // Determine role_profile: use provided value, or derive from message.sentFrom
    let finalRoleProfile: string = roleProfile || '';
    if (!finalRoleProfile && message.sentFrom) {
      if (message.sentFrom === 'User' || message.sentFrom === 'user') {
        finalRoleProfile = 'user';
      } else {
        finalRoleProfile = message.sentFrom;
      }
    }
    if (!finalRoleProfile) {
      finalRoleProfile = 'user';
    }

    const result = await query<DBMessage>(
      `INSERT INTO messages (
        project_id, role_profile, message_uuid, content, instruct_content,
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
    
    const values: any[] = [];
    const placeholders: string[] = [];
    let paramIndex = 1;
    
    messages.forEach((msg) => {
      placeholders.push(
        `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7}, $${paramIndex + 8}, $${paramIndex + 9})`
      );
      
      // Determine role_profile
      let roleProfile: string = 'user';
      if (msg.sentFrom && msg.sentFrom !== 'User' && msg.sentFrom !== 'user') {
        roleProfile = msg.sentFrom;
      }
      
      values.push(
        projectId,
        roleProfile,
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
        project_id, role_profile, message_uuid, content, instruct_content,
        role_type, cause_by, sent_from, send_to, metadata
      ) VALUES ${placeholders.join(', ')}
    `;
    
    try {
      const result = await query(sql, values);
      logger.debug(`MessageRepository: Saved ${result.rowCount || 0} messages`, {
        projectId,
        messageCount: messages.length,
      });
      return result.rowCount || 0;
    } catch (error: any) {
      logger.error('MessageRepository: Failed to save messages', {
        projectId,
        messageCount: messages.length,
        error: error.message,
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
   * Find messages by role profile
   * @param roleProfile - Role profile (e.g., 'ProductManager', 'Architect', 'user')
   */
  async findByRoleProfile(roleProfile: string, limit: number = 50): Promise<DBMessage[]> {
    const result = await query<DBMessage>(
      `SELECT * FROM messages 
       WHERE role_profile = $1 
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
    const result = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM messages WHERE project_id = $1`,
      [projectId]
    );
    
    return parseInt(result.rows[0].count);
  }

  /**
   * Find messages by project and role profile
   */
  async findByProjectAndRole(projectId: string, roleProfile: string, limit: number = 50): Promise<DBMessage[]> {
    const result = await query<DBMessage>(
      `SELECT * FROM messages 
       WHERE project_id = $1 AND role_profile = $2
       ORDER BY created_at ASC 
       LIMIT $3`,
      [projectId, roleProfile, limit]
    );
    
    return result.rows;
  }

  /**
   * Delete messages by project ID
   */
  async deleteByProjectId(projectId: string): Promise<number> {
    const result = await query(
      `DELETE FROM messages WHERE project_id = $1`,
      [projectId]
    );
    
    return result.rowCount || 0;
  }

  // Backward compatibility alias
  async findByRoleId(roleProfile: string, limit: number = 50): Promise<DBMessage[]> {
    return this.findByRoleProfile(roleProfile, limit);
  }
}

export default MessageRepository;
