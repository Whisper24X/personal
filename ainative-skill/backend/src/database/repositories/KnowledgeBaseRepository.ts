/**
 * Knowledge Base Repository
 * Data access layer for knowledge base documents
 */

import { query } from '../client';
import { logger } from '../../utils';

export interface KnowledgeBaseDocument {
  id: string;
  project_id: string;
  title: string;
  content: string;
  description?: string;
  tags?: string[];
  metadata?: Record<string, any>;
  is_active: boolean;
  created_by?: string;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

export class KnowledgeBaseRepository {
  /**
   * Create a knowledge base document
   */
  async create(data: {
    projectId: string;
    title: string;
    content: string;
    description?: string;
    tags?: string[];
    metadata?: Record<string, any>;
    createdBy?: string;
  }): Promise<KnowledgeBaseDocument> {
    try {
      const result = await query<KnowledgeBaseDocument>(
        `INSERT INTO knowledge_base (
          project_id, title, content, description, tags, metadata, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`,
        [
          data.projectId,
          data.title,
          data.content,
          data.description || null,
          data.tags || [],
          JSON.stringify(data.metadata || {}),
          data.createdBy || null,
        ]
      );

      if (!result.rows[0]) {
        throw new Error('Failed to create knowledge base document: no row returned');
      }

      logger.info('KnowledgeBaseRepository: Document created', {
        id: result.rows[0].id,
        projectId: data.projectId,
        title: data.title,
      });

      return result.rows[0];
    } catch (error: any) {
      logger.error('KnowledgeBaseRepository: Failed to create document', {
        error: error.message,
        projectId: data.projectId,
        title: data.title,
      });
      throw error;
    }
  }

  /**
   * Find knowledge base document by ID
   */
  async findById(id: string): Promise<KnowledgeBaseDocument | null> {
    try {
      const result = await query<KnowledgeBaseDocument>(
        `SELECT * FROM knowledge_base 
         WHERE id = $1 AND deleted_at IS NULL`,
        [id]
      );

      return result.rows[0] || null;
    } catch (error: any) {
      logger.error('KnowledgeBaseRepository: Failed to find document by ID', {
        error: error.message,
        id,
      });
      throw error;
    }
  }

  /**
   * Find all active knowledge base documents for a project
   */
  async findByProjectId(projectId: string, includeInactive: boolean = false): Promise<KnowledgeBaseDocument[]> {
    try {
      let sql = `SELECT * FROM knowledge_base 
                 WHERE project_id = $1 AND deleted_at IS NULL`;
      const params: any[] = [projectId];

      if (!includeInactive) {
        sql += ' AND is_active = TRUE';
      }

      sql += ' ORDER BY created_at DESC';

      const result = await query<KnowledgeBaseDocument>(sql, params);
      return result.rows;
    } catch (error: any) {
      logger.error('KnowledgeBaseRepository: Failed to find documents by project', {
        error: error.message,
        projectId,
      });
      throw error;
    }
  }

  /**
   * Search knowledge base documents by keyword (title/description/content)
   */
  async searchByQuery(projectId: string, queryText: string, limit: number = 10): Promise<KnowledgeBaseDocument[]> {
    try {
      const safeLimit = Math.max(1, Math.min(limit, 50));
      const likeQuery = `%${queryText}%`;
      const result = await query<KnowledgeBaseDocument>(
        `SELECT * FROM knowledge_base
         WHERE project_id = $1
         AND deleted_at IS NULL
         AND is_active = TRUE
         AND (
           title ILIKE $2
           OR description ILIKE $2
           OR content ILIKE $2
         )
         ORDER BY created_at DESC
         LIMIT $3`,
        [projectId, likeQuery, safeLimit]
      );

      return result.rows;
    } catch (error: any) {
      logger.error('KnowledgeBaseRepository: Failed to search documents', {
        error: error.message,
        projectId,
        queryText,
      });
      throw error;
    }
  }

  /**
   * Update a knowledge base document
   */
  async update(
    id: string,
    data: {
      title?: string;
      content?: string;
      description?: string;
      tags?: string[];
      metadata?: Record<string, any>;
      isActive?: boolean;
    }
  ): Promise<KnowledgeBaseDocument> {
    try {
      const updates: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (data.title !== undefined) {
        updates.push(`title = $${paramIndex++}`);
        params.push(data.title);
      }
      if (data.content !== undefined) {
        updates.push(`content = $${paramIndex++}`);
        params.push(data.content);
      }
      if (data.description !== undefined) {
        updates.push(`description = $${paramIndex++}`);
        params.push(data.description);
      }
      if (data.tags !== undefined) {
        updates.push(`tags = $${paramIndex++}`);
        params.push(data.tags);
      }
      if (data.metadata !== undefined) {
        updates.push(`metadata = $${paramIndex++}`);
        params.push(JSON.stringify(data.metadata));
      }
      if (data.isActive !== undefined) {
        updates.push(`is_active = $${paramIndex++}`);
        params.push(data.isActive);
      }

      if (updates.length === 0) {
        throw new Error('No fields to update');
      }

      updates.push(`updated_at = NOW()`);
      params.push(id);

      const result = await query<KnowledgeBaseDocument>(
        `UPDATE knowledge_base 
         SET ${updates.join(', ')}
         WHERE id = $${paramIndex} AND deleted_at IS NULL
         RETURNING *`,
        params
      );

      if (!result.rows[0]) {
        throw new Error('Knowledge base document not found or already deleted');
      }

      logger.info('KnowledgeBaseRepository: Document updated', {
        id,
      });

      return result.rows[0];
    } catch (error: any) {
      logger.error('KnowledgeBaseRepository: Failed to update document', {
        error: error.message,
        id,
      });
      throw error;
    }
  }

  /**
   * Soft delete a knowledge base document
   */
  async delete(id: string): Promise<void> {
    try {
      const result = await query(
        `UPDATE knowledge_base 
         SET deleted_at = NOW()
         WHERE id = $1 AND deleted_at IS NULL
         RETURNING id`,
        [id]
      );

      if (result.rows.length === 0) {
        throw new Error('Knowledge base document not found or already deleted');
      }

      logger.info('KnowledgeBaseRepository: Document deleted', {
        id,
      });
    } catch (error: any) {
      logger.error('KnowledgeBaseRepository: Failed to delete document', {
        error: error.message,
        id,
      });
      throw error;
    }
  }

  /**
   * Search knowledge base documents by tags
   */
  async findByTags(projectId: string, tags: string[]): Promise<KnowledgeBaseDocument[]> {
    try {
      const result = await query<KnowledgeBaseDocument>(
        `SELECT * FROM knowledge_base 
         WHERE project_id = $1 
         AND deleted_at IS NULL 
         AND is_active = TRUE
         AND tags && $2
         ORDER BY created_at DESC`,
        [projectId, tags]
      );

      return result.rows;
    } catch (error: any) {
      logger.error('KnowledgeBaseRepository: Failed to find documents by tags', {
        error: error.message,
        projectId,
        tags,
      });
      throw error;
    }
  }
}
