/**
 * Document Repository
 * Data access layer for generated documents using native PostgreSQL
 */

import { query } from '../client';
import { DocumentType } from '@mind2build/shared';
import { logger } from '../../utils';

export interface Document {
  id: string;
  project_id: string;
  filename: string;
  doc_type: string;
  content: string;
  storage_path?: string;
  metadata: any;
  created_at: Date;
  version?: number;
  is_deleted?: boolean;
  deleted_at?: Date;
  parent_id?: string;
}

export class DocumentRepository {
  /**
   * Create a document
   */
  async create(data: {
    projectId: string;
    filename: string;
    docType: DocumentType;
    content: string;
    storagePath?: string;
    metadata?: Record<string, any>;
  }): Promise<Document> {
    try {
      const result = await query<Document>(
        `INSERT INTO documents (
          project_id, filename, doc_type, content, storage_path, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *`,
        [
          data.projectId,
          data.filename,
          data.docType,
          data.content,
          data.storagePath || null,
          JSON.stringify(data.metadata || {}),
        ]
      );
      
      if (!result.rows[0]) {
        throw new Error('Failed to create document: no row returned');
      }
      
      logger.info(`Successfully created document: ${data.filename}`, {
        projectId: data.projectId,
        docType: data.docType,
        contentLength: data.content.length,
      });
      return result.rows[0];
    } catch (error: any) {
      logger.error('Failed to create document:', {
        projectId: data.projectId,
        filename: data.filename,
        docType: data.docType,
        contentLength: data.content.length,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Find documents by project ID
   */
  async findByProjectId(projectId: string): Promise<Document[]> {
    const result = await query<Document>(
      `SELECT * FROM documents 
       WHERE project_id = $1 
       ORDER BY created_at ASC`,
      [projectId]
    );
    
    return result.rows;
  }

  /**
   * Find document by type
   */
  async findByType(projectId: string, docType: DocumentType): Promise<Document | null> {
    const result = await query<Document>(
      `SELECT * FROM documents 
       WHERE project_id = $1 AND doc_type = $2 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [projectId, docType]
    );
    
    return result.rows[0] || null;
  }

  /**
   * Find a document by ID
   */
  async findById(documentId: string): Promise<Document | null> {
    const result = await query<Document>(
      `SELECT * FROM documents WHERE id = $1`,
      [documentId]
    );
    return result.rows[0] || null;
  }

  /**
   * Update parent relationship for a document
   */
  async updateParent(documentId: string, parentId: string): Promise<void> {
    await query(
      `UPDATE documents SET parent_id = $1 WHERE id = $2`,
      [parentId, documentId]
    );
  }

  /**
   * Get document content
   */
  async getContent(id: string): Promise<string | null> {
    const result = await query<{ content: string }>(
      `SELECT content FROM documents WHERE id = $1`,
      [id]
    );
    
    return result.rows[0]?.content || null;
  }

  /**
   * Find all PRD documents for a project
   */
  async findPRDsByProject(projectId: string, includeDeleted: boolean = false): Promise<Document[]> {
    let sql = `
      SELECT * FROM documents 
      WHERE project_id = $1 AND doc_type = 'prd'
    `;
    
    const params: any[] = [projectId];
    
    if (!includeDeleted) {
      sql += ` AND (is_deleted IS NULL OR is_deleted = FALSE)`;
    }
    
    sql += ` ORDER BY version DESC, created_at DESC`;
    
    const result = await query<Document>(sql, params);
    return result.rows;
  }

  /**
   * Find the latest PRD for a project
   */
  async findLatestPRD(projectId: string): Promise<Document | null> {
    const result = await query<Document>(
      `SELECT * FROM documents 
       WHERE project_id = $1 AND doc_type = 'prd' 
       AND (is_deleted IS NULL OR is_deleted = FALSE)
       ORDER BY version DESC, created_at DESC 
       LIMIT 1`,
      [projectId]
    );
    
    return result.rows[0] || null;
  }

  /**
   * Create a new PRD version
   * Automatically increments version number
   */
  async createPRDVersion(
    projectId: string,
    content: string,
    parentId?: string
  ): Promise<Document> {
    try {
      // Get the latest version number for this project
      const latestPRD = await this.findLatestPRD(projectId);
      const nextVersion = latestPRD ? (latestPRD.version || 1) + 1 : 1;

      const result = await query<Document>(
        `INSERT INTO documents (
          project_id, filename, doc_type, content, storage_path, metadata, version, parent_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
        [
          projectId,
          `PRD_v${nextVersion}.md`,
          'prd',
          content,
          null,
          JSON.stringify({ version: nextVersion }),
          nextVersion,
          parentId || null,
        ]
      );

      if (!result.rows[0]) {
        throw new Error('Failed to create PRD version: no row returned');
      }

      logger.info(`Successfully created PRD version ${nextVersion}`, {
        projectId,
        documentId: result.rows[0].id,
        parentId,
      });

      return result.rows[0];
    } catch (error: any) {
      logger.error('Failed to create PRD version:', {
        projectId,
        parentId,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Soft delete a PRD document
   */
  async softDeletePRD(documentId: string): Promise<Document> {
    try {
      const result = await query<Document>(
        `UPDATE documents 
         SET is_deleted = TRUE, deleted_at = NOW() 
         WHERE id = $1 AND doc_type = 'prd'
         RETURNING *`,
        [documentId]
      );

      if (!result.rows[0]) {
        throw new Error('PRD document not found or already deleted');
      }

      logger.info(`Successfully soft deleted PRD`, {
        documentId,
        version: result.rows[0].version,
      });

      return result.rows[0];
    } catch (error: any) {
      logger.error('Failed to soft delete PRD:', {
        documentId,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Restore a soft-deleted PRD document
   */
  async restorePRD(documentId: string): Promise<Document> {
    try {
      const result = await query<Document>(
        `UPDATE documents 
         SET is_deleted = FALSE, deleted_at = NULL 
         WHERE id = $1 AND doc_type = 'prd'
         RETURNING *`,
        [documentId]
      );

      if (!result.rows[0]) {
        throw new Error('PRD document not found');
      }

      logger.info(`Successfully restored PRD`, {
        documentId,
        version: result.rows[0].version,
      });

      return result.rows[0];
    } catch (error: any) {
      logger.error('Failed to restore PRD:', {
        documentId,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Get PRD version history for a project
   */
  async getPRDVersions(projectId: string): Promise<Document[]> {
    const result = await query<Document>(
      `SELECT * FROM documents 
       WHERE project_id = $1 AND doc_type = 'prd'
       ORDER BY version ASC, created_at ASC`,
      [projectId]
    );

    return result.rows;
  }

  /**
   * Get a specific PRD document by ID
   */
  async findPRDById(documentId: string): Promise<Document | null> {
    const result = await query<Document>(
      `SELECT * FROM documents 
       WHERE id = $1 AND doc_type = 'prd'`,
      [documentId]
    );

    return result.rows[0] || null;
  }

  /**
   * Find all PRD documents for an application (across all projects)
   */
  async findPRDsByApplication(applicationId: string, includeDeleted: boolean = false): Promise<Document[]> {
    let sql = `
      SELECT d.* FROM documents d
      INNER JOIN projects p ON d.project_id = p.id
      WHERE p.application_id = $1 AND d.doc_type = 'prd'
    `;
    
    const params: any[] = [applicationId];
    
    if (!includeDeleted) {
      sql += ` AND (d.is_deleted IS NULL OR d.is_deleted = FALSE)`;
    }
    
    sql += ` ORDER BY d.version DESC, d.created_at DESC`;
    
    const result = await query<Document>(sql, params);
    return result.rows;
  }

  /**
   * Find all MRD documents for a project
   */
  async findMRDsByProject(projectId: string, includeDeleted: boolean = false): Promise<Document[]> {
    let sql = `
      SELECT * FROM documents 
      WHERE project_id = $1 AND doc_type = 'mrd'
    `;
    
    const params: any[] = [projectId];
    
    if (!includeDeleted) {
      sql += ` AND (is_deleted IS NULL OR is_deleted = FALSE)`;
    }
    
    sql += ` ORDER BY version DESC, created_at DESC`;
    
    const result = await query<Document>(sql, params);
    return result.rows;
  }

  /**
   * Find the latest MRD for a project
   */
  async findLatestMRD(projectId: string): Promise<Document | null> {
    const result = await query<Document>(
      `SELECT * FROM documents 
       WHERE project_id = $1 AND doc_type = 'mrd' 
       AND (is_deleted IS NULL OR is_deleted = FALSE)
       ORDER BY version DESC, created_at DESC 
       LIMIT 1`,
      [projectId]
    );

    return result.rows[0] || null;
  }

  /**
   * Find all MRD documents for an application (across all projects)
   */
  async findMRDsByApplication(applicationId: string, includeDeleted: boolean = false): Promise<Document[]> {
    let sql = `
      SELECT d.* FROM documents d
      INNER JOIN projects p ON d.project_id = p.id
      WHERE p.application_id = $1 AND d.doc_type = 'mrd'
    `;
    
    const params: any[] = [applicationId];
    
    if (!includeDeleted) {
      sql += ` AND (d.is_deleted IS NULL OR d.is_deleted = FALSE)`;
    }
    
    sql += ` ORDER BY d.version DESC, d.created_at DESC`;
    
    const result = await query<Document>(sql, params);
    return result.rows;
  }
}

export default DocumentRepository;
