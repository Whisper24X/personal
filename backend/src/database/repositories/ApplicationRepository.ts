/**
 * Application Repository
 * Data access layer for applications using native PostgreSQL
 */

import { query, transaction } from '../client';
import { logger } from '../../utils';

export interface Application {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  metadata: any;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

export class ApplicationRepository {
  /**
   * Create a new application
   */
  async create(data: {
    userId: string;
    name: string;
    description?: string;
    metadata?: Record<string, any>;
  }): Promise<Application> {
    try {
      const result = await query<Application>(
        `INSERT INTO applications (user_id, name, description, metadata)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [
          data.userId,
          data.name,
          data.description || null,
          JSON.stringify(data.metadata || {}),
        ]
      );

      if (!result.rows[0]) {
        throw new Error('Failed to create application: no row returned');
      }

      logger.info(`Successfully created application: ${data.name}`, {
        applicationId: result.rows[0].id,
        userId: data.userId,
      });

      return result.rows[0];
    } catch (error: any) {
      logger.error('Failed to create application:', {
        name: data.name,
        userId: data.userId,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Find application by ID
   */
  async findById(id: string): Promise<Application | null> {
    const result = await query<Application>(
      `SELECT * FROM applications 
       WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );

    return result.rows[0] || null;
  }

  /**
   * Find all applications for a user
   */
  async findByUserId(userId: string): Promise<Application[]> {
    const result = await query<Application>(
      `SELECT * FROM applications 
       WHERE user_id = $1 AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      [userId]
    );

    return result.rows;
  }

  /**
   * Update application
   */
  async update(
    id: string,
    data: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<Application> {
    try {
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (data.name !== undefined) {
        updates.push(`name = $${paramIndex++}`);
        values.push(data.name);
      }

      if (data.description !== undefined) {
        updates.push(`description = $${paramIndex++}`);
        values.push(data.description);
      }

      if (data.metadata !== undefined) {
        updates.push(`metadata = $${paramIndex++}`);
        values.push(JSON.stringify(data.metadata));
      }

      if (updates.length === 0) {
        throw new Error('No fields to update');
      }

      updates.push(`updated_at = NOW()`);
      values.push(id);

      const result = await query<Application>(
        `UPDATE applications 
         SET ${updates.join(', ')}
         WHERE id = $${paramIndex} AND deleted_at IS NULL
         RETURNING *`,
        values
      );

      if (!result.rows[0]) {
        throw new Error('Application not found or already deleted');
      }

      logger.info(`Successfully updated application`, {
        applicationId: id,
      });

      return result.rows[0];
    } catch (error: any) {
      logger.error('Failed to update application:', {
        applicationId: id,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Soft delete application
   */
  async softDelete(id: string): Promise<Application> {
    try {
      const result = await query<Application>(
        `UPDATE applications 
         SET deleted_at = NOW() 
         WHERE id = $1 AND deleted_at IS NULL
         RETURNING *`,
        [id]
      );

      if (!result.rows[0]) {
        throw new Error('Application not found or already deleted');
      }

      logger.info(`Successfully soft deleted application`, {
        applicationId: id,
      });

      return result.rows[0];
    } catch (error: any) {
      logger.error('Failed to soft delete application:', {
        applicationId: id,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Get projects count for an application
   */
  async getProjectsCount(applicationId: string): Promise<number> {
    const result = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM projects 
       WHERE application_id = $1 AND deleted_at IS NULL`,
      [applicationId]
    );

    return parseInt(result.rows[0]?.count || '0', 10);
  }
}

export default ApplicationRepository;

