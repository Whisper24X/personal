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
  version_id?: string;  // Added for version isolation
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
   * @param versionId - Optional version ID for version isolation
   */
  async save(projectId: string, message: Message, roleProfile?: string, versionId?: string): Promise<DBMessage> {
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
        project_id, version_id, role_profile, message_uuid, content, instruct_content,
        role_type, cause_by, sent_from, send_to, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        projectId,
        versionId || null,
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

  /**
   * Find messages by project and version with deduplication
   * Uses DISTINCT ON to get only the latest message for each role_profile + cause_by combination
   * This prevents duplicate messages when workflows are retried or resumed
   * 
   * @param projectId - Project ID
   * @param versionId - Version ID for isolation
   * @param limit - Maximum number of messages to return (default 100)
   * @returns Deduplicated list of messages, one per role_profile + cause_by combination
   */
  async findByVersionWithDedup(projectId: string, versionId: string, limit: number = 100): Promise<DBMessage[]> {
    const result = await query<DBMessage>(
      `SELECT DISTINCT ON (role_profile, cause_by) *
       FROM messages 
       WHERE project_id = $1 AND version_id = $2
       ORDER BY role_profile, cause_by, created_at DESC
       LIMIT $3`,
      [projectId, versionId, limit]
    );
    
    logger.debug(`MessageRepository: findByVersionWithDedup returned ${result.rows.length} messages`, {
      projectId,
      versionId,
      messageCount: result.rows.length,
    });
    
    return result.rows;
  }

  /**
   * Find messages by project and version (without deduplication)
   * 
   * @param projectId - Project ID
   * @param versionId - Version ID for isolation
   * @param limit - Maximum number of messages to return (default 100)
   */
  async findByProjectAndVersion(projectId: string, versionId: string, limit: number = 100): Promise<DBMessage[]> {
    const result = await query<DBMessage>(
      `SELECT * FROM messages 
       WHERE project_id = $1 AND version_id = $2
       ORDER BY created_at ASC 
       LIMIT $3`,
      [projectId, versionId, limit]
    );
    
    return result.rows;
  }

  // Backward compatibility alias
  async findByRoleId(roleProfile: string, limit: number = 50): Promise<DBMessage[]> {
    return this.findByRoleProfile(roleProfile, limit);
  }
}

export default MessageRepository;
