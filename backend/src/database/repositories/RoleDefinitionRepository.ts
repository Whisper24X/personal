/**
 * Role Definition Repository
 * Data access layer for role definitions using native PostgreSQL
 */

import { query } from '../client';
import { logger } from '../../utils';

export interface RoleDefinition {
  id: string;
  profile: string;
  name: string;
  display_name?: string;
  goal?: string;
  constraints?: string;
  description?: string;
  class_name: string;
  is_active: boolean;
  metadata: any;
  created_at: Date;
  updated_at: Date;
}

export class RoleDefinitionRepository {
  /**
   * Find all role definitions
   */
  async findAll(): Promise<RoleDefinition[]> {
    const result = await query<RoleDefinition>(
      `SELECT * FROM role_definitions ORDER BY profile ASC`,
      []
    );
    return result.rows;
  }

  /**
   * Find active role definitions only
   */
  async findActive(): Promise<RoleDefinition[]> {
    const result = await query<RoleDefinition>(
      `SELECT * FROM role_definitions WHERE is_active = true ORDER BY profile ASC`,
      []
    );
    return result.rows;
  }

  /**
   * Find role definition by profile
   */
  async findByProfile(profile: string): Promise<RoleDefinition | null> {
    const result = await query<RoleDefinition>(
      `SELECT * FROM role_definitions WHERE profile = $1`,
      [profile]
    );
    return result.rows[0] || null;
  }

  /**
   * Find role definitions by profiles array
   */
  async findByProfiles(profiles: string[]): Promise<RoleDefinition[]> {
    if (profiles.length === 0) {
      return [];
    }
    const result = await query<RoleDefinition>(
      `SELECT * FROM role_definitions WHERE profile = ANY($1::VARCHAR[]) ORDER BY profile ASC`,
      [profiles]
    );
    return result.rows;
  }

  /**
   * Create a new role definition
   */
  async create(data: {
    profile: string;
    name: string;
    display_name?: string;
    goal?: string;
    constraints?: string;
    description?: string;
    class_name: string;
    is_active?: boolean;
    metadata?: Record<string, any>;
  }): Promise<RoleDefinition> {
    const result = await query<RoleDefinition>(
      `INSERT INTO role_definitions (
        profile, name, display_name, goal, constraints, description, class_name, is_active, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        data.profile,
        data.name,
        data.display_name || null,
        data.goal || null,
        data.constraints || null,
        data.description || null,
        data.class_name,
        data.is_active !== undefined ? data.is_active : true,
        JSON.stringify(data.metadata || {}),
      ]
    );
    return result.rows[0];
  }

  /**
   * Update role definition
   */
  async update(
    profile: string,
    data: {
      name?: string;
      display_name?: string;
      goal?: string;
      constraints?: string;
      description?: string;
      class_name?: string;
      is_active?: boolean;
      metadata?: Record<string, any>;
    }
  ): Promise<RoleDefinition | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(data.name);
    }
    if (data.display_name !== undefined) {
      updates.push(`display_name = $${paramIndex++}`);
      values.push(data.display_name);
    }
    if (data.goal !== undefined) {
      updates.push(`goal = $${paramIndex++}`);
      values.push(data.goal);
    }
    if (data.constraints !== undefined) {
      updates.push(`constraints = $${paramIndex++}`);
      values.push(data.constraints);
    }
    if (data.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(data.description);
    }
    if (data.class_name !== undefined) {
      updates.push(`class_name = $${paramIndex++}`);
      values.push(data.class_name);
    }
    if (data.is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(data.is_active);
    }
    if (data.metadata !== undefined) {
      updates.push(`metadata = $${paramIndex++}`);
      values.push(JSON.stringify(data.metadata));
    }

    if (updates.length === 0) {
      return this.findByProfile(profile);
    }

    updates.push(`updated_at = NOW()`);
    values.push(profile);

    const result = await query<RoleDefinition>(
      `UPDATE role_definitions 
       SET ${updates.join(', ')}
       WHERE profile = $${paramIndex}
       RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  /**
   * Delete role definition (soft delete by setting is_active = false)
   */
  async delete(profile: string): Promise<boolean> {
    const result = await query(
      `UPDATE role_definitions 
       SET is_active = false, updated_at = NOW()
       WHERE profile = $1`,
      [profile]
    );
    return result.rowCount > 0;
  }

  /**
   * Hard delete role definition
   */
  async hardDelete(profile: string): Promise<boolean> {
    const result = await query(`DELETE FROM role_definitions WHERE profile = $1`, [profile]);
    return result.rowCount > 0;
  }
}
