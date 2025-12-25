/**
 * Document Repository
 * Data access layer for generated documents using native PostgreSQL
 */

import { query } from '../client';
import { DocumentType } from '@mind2build/shared';

export interface Document {
  id: string;
  project_id: string;
  filename: string;
  doc_type: string;
  content: string;
  storage_path?: string;
  metadata: any;
  created_at: Date;
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
    
    return result.rows[0];
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
   * Get document content
   */
  async getContent(id: string): Promise<string | null> {
    const result = await query<{ content: string }>(
      `SELECT content FROM documents WHERE id = $1`,
      [id]
    );
    
    return result.rows[0]?.content || null;
  }
}

export default DocumentRepository;
