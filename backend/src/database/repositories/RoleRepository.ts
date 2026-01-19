/**
 * Role Repository
 * Data access layer for roles using native PostgreSQL
 */

import { query } from '../client';
import { Role } from '../../roles/Role';
import { logger } from '../../utils';

export interface DBRole {
  id: string;
  team_id: string;
  name: string;
  profile: string;
  goal?: string;
  constraints?: string;
  description?: string;
  is_idle: boolean;
  state_index: number;
  max_react_loop: number;
  react_mode: string;
  enable_memory: boolean;
  use_fixed_sop: boolean;
  tools: any;
  actions_list: any;
  watch_actions: any;
  state: any;
  created_at: Date;
  updated_at: Date;
}

export class RoleRepository {
  /**
   * Save or update a role
   */
  async upsert(teamId: string, role: Role): Promise<DBRole> {
    const roleData = {
      name: role.name,
      profile: role.profile,
      goal: role.goal || null,
      constraints: role.constraints || null,
      description: role.description || null,
      is_idle: role.isIdle,
      state_index: role.rc.stateIndex || 0,
      max_react_loop: (role as any).maxReactLoop || 1,
      react_mode: (role as any).reactMode || 'react',
      enable_memory: (role as any).enableMemory !== false,
      use_fixed_sop: (role as any).useFixedSop || false,
      tools: JSON.stringify((role as any).tools || []),
      actions_list: JSON.stringify(role.actions.map(a => a.name)),
      watch_actions: JSON.stringify((role as any).watchActions || []),
      state: JSON.stringify(role.rc.toJSON()),
    };

    // Try to find existing role by team_id and profile
    const existing = await query<DBRole>(
      `SELECT id FROM roles WHERE team_id = $1 AND profile = $2 LIMIT 1`,
      [teamId, role.profile]
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
          state_index = $6,
          max_react_loop = $7,
          react_mode = $8,
          enable_memory = $9,
          use_fixed_sop = $10,
          tools = $11,
          actions_list = $12,
          watch_actions = $13,
          state = $14,
          updated_at = NOW()
        WHERE team_id = $15 AND profile = $16
        RETURNING *`,
        [
          roleData.name,
          roleData.goal,
          roleData.constraints,
          roleData.description,
          roleData.is_idle,
          roleData.state_index,
          roleData.max_react_loop,
          roleData.react_mode,
          roleData.enable_memory,
          roleData.use_fixed_sop,
          roleData.tools,
          roleData.actions_list,
          roleData.watch_actions,
          roleData.state,
          teamId,
          role.profile,
        ]
      );

      logger.info(`RoleRepository: Updated role ${role.profile} for team ${teamId}`);
      return result.rows[0];
    } else {
      // Insert new role
      const result = await query<DBRole>(
        `INSERT INTO roles (
          team_id, name, profile, goal, constraints, description,
          is_idle, state_index, max_react_loop, react_mode,
          enable_memory, use_fixed_sop, tools, actions_list, watch_actions, state
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING *`,
        [
          teamId,
          roleData.name,
          role.profile,
          roleData.goal,
          roleData.constraints,
          roleData.description,
          roleData.is_idle,
          roleData.state_index,
          roleData.max_react_loop,
          roleData.react_mode,
          roleData.enable_memory,
          roleData.use_fixed_sop,
          roleData.tools,
          roleData.actions_list,
          roleData.watch_actions,
          roleData.state,
        ]
      );

      logger.info(`RoleRepository: Created role ${role.profile} for team ${teamId}`);
      return result.rows[0];
    }
  }

  /**
   * Save multiple roles
   */
  async saveMany(teamId: string, roles: Role[]): Promise<DBRole[]> {
    const savedRoles: DBRole[] = [];
    
    for (const role of roles) {
      try {
        const savedRole = await this.upsert(teamId, role);
        savedRoles.push(savedRole);
      } catch (error: any) {
        logger.error(`RoleRepository: Failed to save role ${role.profile}`, {
          teamId,
          profile: role.profile,
          error: error.message,
        });
        // Continue with other roles
      }
    }

    logger.info(`RoleRepository: Saved ${savedRoles.length}/${roles.length} roles for team ${teamId}`);
    return savedRoles;
  }

  /**
   * Find role by team ID and profile
   */
  async findByTeamAndProfile(teamId: string, profile: string): Promise<DBRole | null> {
    const result = await query<DBRole>(
      `SELECT * FROM roles WHERE team_id = $1 AND profile = $2 LIMIT 1`,
      [teamId, profile]
    );

    return result.rows[0] || null;
  }

  /**
   * Find all roles by team ID
   */
  async findByTeamId(teamId: string): Promise<DBRole[]> {
    const result = await query<DBRole>(
      `SELECT * FROM roles WHERE team_id = $1 ORDER BY created_at ASC`,
      [teamId]
    );

    return result.rows;
  }

  /**
   * Get role ID by team ID and profile
   */
  async getRoleId(teamId: string, profile: string): Promise<string | null> {
    const result = await query<{ id: string }>(
      `SELECT id FROM roles WHERE team_id = $1 AND profile = $2 LIMIT 1`,
      [teamId, profile]
    );

    return result.rows[0]?.id || null;
  }
}

export default RoleRepository;
