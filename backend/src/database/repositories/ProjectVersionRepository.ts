/**
 * ProjectVersion Repository
 * Data access layer for project versions using native PostgreSQL
 */

import { query } from '../client';
import { logger } from '../../utils';

export interface ProjectVersion {
  id: string;
  project_id: string;
  version_name: string;
  description?: string;
  idea?: string;
  branch_name: string;
  is_active: boolean;
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface CreateVersionData {
  projectId: string;
  versionName: string;
  description?: string;
  idea?: string;
  branchName: string;
  isActive?: boolean;
  metadata?: Record<string, any>;
}

export interface UpdateVersionData {
  versionName?: string;
  description?: string;
  metadata?: Record<string, any>;
}

export class ProjectVersionRepository {
  /**
   * Create a new version
   */
  async create(data: CreateVersionData): Promise<ProjectVersion> {
    try {
      const result = await query<ProjectVersion>(
        `INSERT INTO project_versions (project_id, version_name, description, idea, branch_name, is_active, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          data.projectId,
          data.versionName,
          data.description || null,
          data.idea || null,
          data.branchName,
          data.isActive || false,
          JSON.stringify(data.metadata || {}),
        ]
      );

      if (!result.rows[0]) {
        throw new Error('Failed to create version: no row returned');
      }

      logger.info(`Successfully created version: ${data.versionName}`, {
        versionId: result.rows[0].id,
        projectId: data.projectId,
        branchName: data.branchName,
      });

      return result.rows[0];
    } catch (error: any) {
      logger.error('Failed to create version:', {
        versionName: data.versionName,
        projectId: data.projectId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Find version by ID
   */
  async findById(id: string): Promise<ProjectVersion | null> {
    const result = await query<ProjectVersion>(
      `SELECT * FROM project_versions WHERE id = $1`,
      [id]
    );

    return result.rows[0] || null;
  }

  /**
   * Find all versions for a project
   */
  async findByProjectId(projectId: string): Promise<ProjectVersion[]> {
    const result = await query<ProjectVersion>(
      `SELECT * FROM project_versions 
       WHERE project_id = $1 
       ORDER BY created_at DESC`,
      [projectId]
    );

    return result.rows;
  }

  /**
   * Find the active version for a project
   */
  async findActiveVersion(projectId: string): Promise<ProjectVersion | null> {
    const result = await query<ProjectVersion>(
      `SELECT * FROM project_versions 
       WHERE project_id = $1 AND is_active = true`,
      [projectId]
    );

    return result.rows[0] || null;
  }

  /**
   * Find version by project ID and version name
   */
  async findByProjectAndName(projectId: string, versionName: string): Promise<ProjectVersion | null> {
    const result = await query<ProjectVersion>(
      `SELECT * FROM project_versions 
       WHERE project_id = $1 AND version_name = $2`,
      [projectId, versionName]
    );

    return result.rows[0] || null;
  }

  /**
   * Set a version as active (will deactivate other versions via trigger)
   */
  async setActiveVersion(projectId: string, versionId: string): Promise<ProjectVersion> {
    try {
      const result = await query<ProjectVersion>(
        `UPDATE project_versions 
         SET is_active = true, updated_at = NOW() 
         WHERE id = $1 AND project_id = $2
         RETURNING *`,
        [versionId, projectId]
      );

      if (!result.rows[0]) {
        throw new Error('Version not found or does not belong to the project');
      }

      logger.info(`Set active version`, {
        versionId,
        projectId,
        versionName: result.rows[0].version_name,
      });

      return result.rows[0];
    } catch (error: any) {
      logger.error('Failed to set active version:', {
        versionId,
        projectId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Deactivate all versions for a project
   */
  async deactivateAllVersions(projectId: string): Promise<void> {
    await query(
      `UPDATE project_versions 
       SET is_active = false, updated_at = NOW() 
       WHERE project_id = $1`,
      [projectId]
    );
  }

  /**
   * Update version
   */
  async update(id: string, data: UpdateVersionData): Promise<ProjectVersion> {
    try {
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (data.versionName !== undefined) {
        updates.push(`version_name = $${paramIndex++}`);
        values.push(data.versionName);
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

      const result = await query<ProjectVersion>(
        `UPDATE project_versions 
         SET ${updates.join(', ')}
         WHERE id = $${paramIndex}
         RETURNING *`,
        values
      );

      if (!result.rows[0]) {
        throw new Error('Version not found');
      }

      logger.info(`Successfully updated version`, {
        versionId: id,
      });

      return result.rows[0];
    } catch (error: any) {
      logger.error('Failed to update version:', {
        versionId: id,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Delete version
   */
  async delete(id: string): Promise<void> {
    try {
      const result = await query(
        `DELETE FROM project_versions WHERE id = $1 RETURNING id`,
        [id]
      );

      if (result.rowCount === 0) {
        throw new Error('Version not found');
      }

      logger.info(`Successfully deleted version`, {
        versionId: id,
      });
    } catch (error: any) {
      logger.error('Failed to delete version:', {
        versionId: id,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Count versions for a project
   */
  async countByProjectId(projectId: string): Promise<number> {
    const result = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM project_versions WHERE project_id = $1`,
      [projectId]
    );

    return parseInt(result.rows[0]?.count || '0', 10);
  }

  /**
   * Check if a version name exists for a project
   */
  async existsByProjectAndName(projectId: string, versionName: string): Promise<boolean> {
    const result = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM project_versions 
       WHERE project_id = $1 AND version_name = $2`,
      [projectId, versionName]
    );

    return parseInt(result.rows[0]?.count || '0', 10) > 0;
  }

  /**
   * Check if a branch name exists for a project
   */
  async existsByProjectAndBranch(projectId: string, branchName: string): Promise<boolean> {
    const result = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM project_versions 
       WHERE project_id = $1 AND branch_name = $2`,
      [projectId, branchName]
    );

    return parseInt(result.rows[0]?.count || '0', 10) > 0;
  }
}

export default ProjectVersionRepository;
