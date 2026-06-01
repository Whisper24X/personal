/**
 * Project Repository
 * Data access layer for projects using native PostgreSQL
 * Schema V2: teams table merged into projects
 */

import { query } from '../client';
import { ProjectStatus } from '@mind2build/shared';

export interface Project {
  id: string;
  user_id: string;
  application_id?: string;
  name: string;
  name_alias?: string;  // English alias for Git branch names
  idea: string;
  description?: string;
  workspace_path?: string;
  git_repo_url?: string;
  status: string;
  progress: number;
  budget: number;
  total_cost: number;
  // Team fields (merged from teams table)
  team_status: string;
  team_config: any;
  team_state: any;
  metadata: any;
  cli_api_key?: string;
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
    nameAlias?: string;
    idea?: string;
    description?: string;
    budget?: number;
    applicationId?: string;
    gitRepoUrl?: string;
    workspacePath?: string;
    teamConfig?: any;
    cliApiKey?: string;
  }): Promise<Project> {
    const result = await query<Project>(
      `INSERT INTO projects (
        user_id, application_id, name, name_alias, idea, description, 
        budget, status, progress, total_cost,
        workspace_path, git_repo_url, cli_api_key,
        team_status, team_config, team_state, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *`,
      [
        data.userId,
        data.applicationId || null,
        data.name,
        data.nameAlias || null,
        data.idea || null,
        data.description || null,
        data.budget || 10.0,
        ProjectStatus.PENDING,
        0,
        0.0,
        data.workspacePath || null,
        data.gitRepoUrl || null,
        data.cliApiKey || null,
        'idle', // team_status
        JSON.stringify(data.teamConfig || {}),
        JSON.stringify({}),
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
   * Check if a project with the same name exists in the same application
   */
  async existsByNameAndApplication(name: string, applicationId: string | null, userId: string): Promise<boolean> {
    if (applicationId) {
      const result = await query<{ count: string }>(
        `SELECT COUNT(*) as count FROM projects 
         WHERE name = $1 AND application_id = $2 AND user_id = $3 AND deleted_at IS NULL`,
        [name, applicationId, userId]
      );
      return parseInt(result.rows[0].count) > 0;
    }
    return false;
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
  async updateProgress(id: string, progress: number): Promise<Project> {
    const result = await query<Project>(
      `UPDATE projects 
       SET progress = $1, updated_at = NOW() 
       WHERE id = $2 
       RETURNING *`,
      [progress, id]
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
   * Update team status
   */
  async updateTeamStatus(id: string, teamStatus: 'idle' | 'running' | 'stopped'): Promise<Project> {
    const result = await query<Project>(
      `UPDATE projects 
       SET team_status = $1, updated_at = NOW() 
       WHERE id = $2 
       RETURNING *`,
      [teamStatus, id]
    );
    
    return result.rows[0];
  }

  /**
   * Update team state
   */
  async updateTeamState(id: string, teamState: any): Promise<Project> {
    const result = await query<Project>(
      `UPDATE projects 
       SET team_state = $1, updated_at = NOW() 
       WHERE id = $2 
       RETURNING *`,
      [JSON.stringify(teamState), id]
    );
    
    return result.rows[0];
  }

  /**
   * Update team config
   */
  async updateTeamConfig(id: string, teamConfig: any): Promise<Project> {
    const result = await query<Project>(
      `UPDATE projects 
       SET team_config = $1, updated_at = NOW() 
       WHERE id = $2 
       RETURNING *`,
      [JSON.stringify(teamConfig), id]
    );
    
    return result.rows[0];
  }

  /**
   * Update workspace path
   */
  async updateWorkspacePath(id: string, workspacePath: string): Promise<Project> {
    const result = await query<Project>(
      `UPDATE projects 
       SET workspace_path = $1, updated_at = NOW() 
       WHERE id = $2 
       RETURNING *`,
      [workspacePath, id]
    );
    
    return result.rows[0];
  }

  /**
   * Update name alias (English name for Git branch)
   */
  async updateNameAlias(id: string, nameAlias: string): Promise<Project> {
    const result = await query<Project>(
      `UPDATE projects 
       SET name_alias = $1, updated_at = NOW() 
       WHERE id = $2 
       RETURNING *`,
      [nameAlias, id]
    );
    
    return result.rows[0];
  }

  /**
   * Mark project as started
   */
  async markStarted(id: string): Promise<Project> {
    const result = await query<Project>(
      `UPDATE projects 
       SET status = $1, started_at = NOW(), team_status = 'running', updated_at = NOW() 
       WHERE id = $2 
       RETURNING *`,
      [ProjectStatus.RUNNING, id]
    );
    
    return result.rows[0];
  }

  /**
   * Mark project as completed
   */
  async markCompleted(id: string): Promise<Project> {
    const result = await query<Project>(
      `UPDATE projects 
       SET status = $1, completed_at = NOW(), progress = 100, team_status = 'stopped', updated_at = NOW() 
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
   * Update CLI API key for a project
   */
  async updateCliApiKey(projectId: string, apiKey: string | null): Promise<Project> {
    const result = await query<Project>(
      `UPDATE projects 
       SET cli_api_key = $1, updated_at = NOW() 
       WHERE id = $2 
       RETURNING *`,
      [apiKey || null, projectId]
    );
    
    if (result.rows.length === 0) {
      throw new Error(`Project not found: ${projectId}`);
    }
    
    return result.rows[0];
  }

  /**
   * Get CLI API key for a project
   */
  async getCliApiKey(projectId: string): Promise<string | null> {
    const result = await query<{ cli_api_key: string | null }>(
      `SELECT cli_api_key FROM projects WHERE id = $1 AND deleted_at IS NULL`,
      [projectId]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0].cli_api_key || null;
  }

  /**
   * Get project statistics
   */
  async getStatistics(userId: string) {
    const result = await query<{
      total: string;
      completed: string;
      running: string;
      failed: string;
    }>(
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
