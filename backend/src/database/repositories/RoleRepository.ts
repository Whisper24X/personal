/**
 * Role Repository
 * Data access layer for roles using native PostgreSQL
 * Schema V2: roles now directly reference projects (team_id removed)
 */

import { query } from '../client';
import { Role } from '../../roles/Role';
import { logger } from '../../utils';

export interface DBRole {
  id: string;
  project_id: string;
  name: string;
  profile: string;
  goal?: string;
  constraints?: string;
  description?: string;
  is_idle: boolean;
  react_mode: string;
  actions_list: any;
  watch_actions: any;
  state: any;
  created_at: Date;
  updated_at: Date;
}

export class RoleRepository {
  /**
   * Save or update a role
   * @param projectId - Project ID (direct reference, no team needed)
   * @param role - Role instance
   */
  async upsert(projectId: string, role: Role): Promise<DBRole> {
    const roleData = {
      name: role.name,
      profile: role.profile,
      goal: role.goal || null,
      constraints: role.constraints || null,
      description: role.description || null,
      is_idle: role.isIdle,
      react_mode: (role as any).reactMode || 'react',
      actions_list: JSON.stringify(role.actions.map(a => a.name)),
      watch_actions: JSON.stringify((role as any).watchActions || []),
      state: JSON.stringify(role.rc.toJSON()),
    };

    // Try to find existing role by project_id and profile
    const existing = await query<DBRole>(
      `SELECT id FROM roles WHERE project_id = $1 AND profile = $2 LIMIT 1`,
      [projectId, role.profile]
    );

    if (existing.rows.length > 0) {
      // Update existing role
      const result = await query<DBRole>(
        `UPDATE roles SET
          name = $1,
          goal = $2,
          constraints = $3,
          description = $4,
          is_idle = $5,
          react_mode = $6,
          actions_list = $7,
          watch_actions = $8,
          state = $9,
          updated_at = NOW()
        WHERE project_id = $10 AND profile = $11
        RETURNING *`,
        [
          roleData.name,
          roleData.goal,
          roleData.constraints,
          roleData.description,
          roleData.is_idle,
          roleData.react_mode,
          roleData.actions_list,
          roleData.watch_actions,
          roleData.state,
          projectId,
          role.profile,
        ]
      );

      logger.debug(`RoleRepository: Updated role ${role.profile} for project ${projectId}`);
      return result.rows[0];
    } else {
      // Insert new role
      const result = await query<DBRole>(
        `INSERT INTO roles (
          project_id, name, profile, goal, constraints, description,
          is_idle, react_mode, actions_list, watch_actions, state
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *`,
        [
          projectId,
          roleData.name,
          role.profile,
          roleData.goal,
          roleData.constraints,
          roleData.description,
          roleData.is_idle,
          roleData.react_mode,
          roleData.actions_list,
          roleData.watch_actions,
          roleData.state,
        ]
      );

      logger.debug(`RoleRepository: Created role ${role.profile} for project ${projectId}`);
      return result.rows[0];
    }
  }

  /**
   * Save multiple roles
   */
  async saveMany(projectId: string, roles: Role[]): Promise<DBRole[]> {
    const savedRoles: DBRole[] = [];
    
    for (const role of roles) {
      try {
        const savedRole = await this.upsert(projectId, role);
        savedRoles.push(savedRole);
      } catch (error: any) {
        logger.error(`RoleRepository: Failed to save role ${role.profile}`, {
          projectId,
          profile: role.profile,
          error: error.message,
        });
      }
    }

    logger.info(`RoleRepository: Saved ${savedRoles.length}/${roles.length} roles for project ${projectId}`);
    return savedRoles;
  }

  /**
   * Find role by project ID and profile
   */
  async findByProjectAndProfile(projectId: string, profile: string): Promise<DBRole | null> {
    const result = await query<DBRole>(
      `SELECT * FROM roles WHERE project_id = $1 AND profile = $2 LIMIT 1`,
      [projectId, profile]
    );

    return result.rows[0] || null;
  }

  /**
   * Find all roles by project ID
   */
  async findByProjectId(projectId: string): Promise<DBRole[]> {
    const result = await query<DBRole>(
      `SELECT * FROM roles WHERE project_id = $1 ORDER BY created_at ASC`,
      [projectId]
    );

    return result.rows;
  }

  /**
   * Get role ID by project ID and profile
   */
  async getRoleId(projectId: string, profile: string): Promise<string | null> {
    const result = await query<{ id: string }>(
      `SELECT id FROM roles WHERE project_id = $1 AND profile = $2 LIMIT 1`,
      [projectId, profile]
    );

    return result.rows[0]?.id || null;
  }

  /**
   * Update role state
   */
  async updateState(projectId: string, profile: string, state: any): Promise<DBRole | null> {
    const result = await query<DBRole>(
      `UPDATE roles 
       SET state = $1, updated_at = NOW()
       WHERE project_id = $2 AND profile = $3
       RETURNING *`,
      [JSON.stringify(state), projectId, profile]
    );

    return result.rows[0] || null;
  }

  /**
   * Update role idle status
   */
  async updateIdleStatus(projectId: string, profile: string, isIdle: boolean): Promise<DBRole | null> {
    const result = await query<DBRole>(
      `UPDATE roles 
       SET is_idle = $1, updated_at = NOW()
       WHERE project_id = $2 AND profile = $3
       RETURNING *`,
      [isIdle, projectId, profile]
    );

    return result.rows[0] || null;
  }

  /**
   * Delete all roles for a project
   */
  async deleteByProjectId(projectId: string): Promise<number> {
    const result = await query(
      `DELETE FROM roles WHERE project_id = $1`,
      [projectId]
    );

    return result.rowCount || 0;
  }

  // Backward compatibility aliases
  async findByTeamAndProfile(teamId: string, profile: string): Promise<DBRole | null> {
    return this.findByProjectAndProfile(teamId, profile);
  }

  async findByTeamId(teamId: string): Promise<DBRole[]> {
    return this.findByProjectId(teamId);
  }
}

export default RoleRepository;
