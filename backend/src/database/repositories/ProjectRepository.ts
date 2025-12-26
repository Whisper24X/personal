/**
 * Project Repository
 * Data access layer for projects using native PostgreSQL
 */

import { query, transaction } from '../client';
import { ProjectStatus } from '@mind2build/shared';

export interface Project {
  id: string;
  user_id: string;
  application_id?: string;
  name: string;
  idea: string;
  description?: string;
  project_path?: string;
  status: string;
  progress: number;
  n_round: number;
  current_round: number;
  investment: number;
  total_cost: number;
  metadata: any;
  started_at?: Date;
  completed_at?: Date;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

export class ProjectRepository {
  /**
   * Create a new project
   */
  async create(data: {
    userId: string;
    name: string;
    idea: string;
    description?: string;
    investment?: number;
    nRound?: number;
    applicationId?: string;
  }): Promise<Project> {
    const result = await query<Project>(
      `INSERT INTO projects (
        user_id, application_id, name, idea, description, investment, n_round, status, progress, current_round, total_cost, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        data.userId,
        data.applicationId || null,
        data.name,
        data.idea,
        data.description || null,
        data.investment || 10.0,
        data.nRound || 5,
        ProjectStatus.PENDING,
        0,
        0,
        0.0,
        JSON.stringify({}),
      ]
    );
    
    return result.rows[0];
  }

  /**
   * Find project by ID
   */
  async findById(id: string): Promise<Project | null> {
    const result = await query<Project>(
      `SELECT * FROM projects WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    
    return result.rows[0] || null;
  }

  /**
   * Find projects by user ID
   */
  async findByUserId(userId: string, limit: number = 50): Promise<Project[]> {
    const result = await query<Project>(
      `SELECT * FROM projects 
       WHERE user_id = $1 AND deleted_at IS NULL 
       ORDER BY created_at DESC 
       LIMIT $2`,
      [userId, limit]
    );
    
    return result.rows;
  }

  /**
   * Find projects by application ID
   */
  async findByApplicationId(applicationId: string): Promise<Project[]> {
    const result = await query<Project>(
      `SELECT * FROM projects 
       WHERE application_id = $1 AND deleted_at IS NULL 
       ORDER BY created_at DESC`,
      [applicationId]
    );
    
    return result.rows;
  }

  /**
   * Update project status
   */
  async updateStatus(id: string, status: ProjectStatus): Promise<Project> {
    const result = await query<Project>(
      `UPDATE projects 
       SET status = $1, updated_at = NOW() 
       WHERE id = $2 
       RETURNING *`,
      [status, id]
    );
    
    return result.rows[0];
  }

  /**
   * Update project progress
   */
  async updateProgress(id: string, progress: number, currentRound: number): Promise<Project> {
    const result = await query<Project>(
      `UPDATE projects 
       SET progress = $1, current_round = $2, updated_at = NOW() 
       WHERE id = $3 
       RETURNING *`,
      [progress, currentRound, id]
    );
    
    return result.rows[0];
  }

  /**
   * Update total cost
   */
  async updateCost(id: string, totalCost: number): Promise<Project> {
    const result = await query<Project>(
      `UPDATE projects 
       SET total_cost = $1, updated_at = NOW() 
       WHERE id = $2 
       RETURNING *`,
      [totalCost, id]
    );
    
    return result.rows[0];
  }

  /**
   * Mark project as completed
   */
  async markCompleted(id: string): Promise<Project> {
    const result = await query<Project>(
      `UPDATE projects 
       SET status = $1, completed_at = NOW(), progress = 100, updated_at = NOW() 
       WHERE id = $2 
       RETURNING *`,
      [ProjectStatus.COMPLETED, id]
    );
    
    return result.rows[0];
  }

  /**
   * Soft delete project
   */
  async softDelete(id: string): Promise<Project> {
    const result = await query<Project>(
      `UPDATE projects 
       SET deleted_at = NOW(), updated_at = NOW() 
       WHERE id = $1 
       RETURNING *`,
      [id]
    );
    
    return result.rows[0];
  }

  /**
   * Get project statistics
   */
  async getStatistics(userId: string) {
    const result = await query(
      `SELECT 
        COUNT(*) FILTER (WHERE deleted_at IS NULL) as total,
        COUNT(*) FILTER (WHERE status = $2 AND deleted_at IS NULL) as completed,
        COUNT(*) FILTER (WHERE status = $3 AND deleted_at IS NULL) as running,
        COUNT(*) FILTER (WHERE status = $4 AND deleted_at IS NULL) as failed
       FROM projects 
       WHERE user_id = $1`,
      [userId, ProjectStatus.COMPLETED, ProjectStatus.RUNNING, ProjectStatus.FAILED]
    );

    const row = result.rows[0];
    return {
      total: parseInt(row.total),
      completed: parseInt(row.completed),
      running: parseInt(row.running),
      failed: parseInt(row.failed),
    };
  }
}

export default ProjectRepository;
