/**
 * Action Definition Repository
 * Data access layer for action definitions using native PostgreSQL
 */

import { query } from '../client';

export interface ActionDefinition {
  id: string;
  name: string;
  display_name?: string;
  description?: string;
  class_name: string;
  category?: string;
  is_active: boolean;
  metadata: any;
  created_at: Date;
  updated_at: Date;
}

export class ActionDefinitionRepository {
  /**
   * Find all action definitions
   */
  async findAll(): Promise<ActionDefinition[]> {
    const result = await query<ActionDefinition>(
      `SELECT * FROM action_definitions ORDER BY name ASC`,
      []
    );
    return result.rows;
  }

  /**
   * Find active action definitions only
   */
  async findActive(): Promise<ActionDefinition[]> {
    const result = await query<ActionDefinition>(
      `SELECT * FROM action_definitions WHERE is_active = true ORDER BY name ASC`,
      []
    );
    return result.rows;
  }

  /**
   * Find action definition by name
   */
  async findByName(name: string): Promise<ActionDefinition | null> {
    const result = await query<ActionDefinition>(
      `SELECT * FROM action_definitions WHERE name = $1`,
      [name]
    );
    return result.rows[0] || null;
  }

  /**
   * Find action definitions by names array
   */
  async findByNames(names: string[]): Promise<ActionDefinition[]> {
    if (names.length === 0) {
      return [];
    }
    const result = await query<ActionDefinition>(
      `SELECT * FROM action_definitions WHERE name = ANY($1::VARCHAR[]) ORDER BY name ASC`,
      [names]
    );
    return result.rows;
  }

  /**
   * Find action definitions by category
   */
  async findByCategory(category: string): Promise<ActionDefinition[]> {
    const result = await query<ActionDefinition>(
      `SELECT * FROM action_definitions WHERE category = $1 AND is_active = true ORDER BY name ASC`,
      [category]
    );
    return result.rows;
  }

  /**
   * Create a new action definition
   */
  async create(data: {
    name: string;
    display_name?: string;
    description?: string;
    class_name: string;
    category?: string;
    is_active?: boolean;
    metadata?: Record<string, any>;
  }): Promise<ActionDefinition> {
    const result = await query<ActionDefinition>(
      `INSERT INTO action_definitions (
        name, display_name, description, class_name, category, is_active, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        data.name,
        data.display_name || null,
        data.description || null,
        data.class_name,
        data.category || null,
        data.is_active !== undefined ? data.is_active : true,
        JSON.stringify(data.metadata || {}),
      ]
    );
    return result.rows[0];
  }

  /**
   * Update action definition
   */
  async update(
    name: string,
    data: {
      display_name?: string;
      description?: string;
      class_name?: string;
      category?: string;
      is_active?: boolean;
      metadata?: Record<string, any>;
    }
  ): Promise<ActionDefinition | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.display_name !== undefined) {
      updates.push(`display_name = $${paramIndex++}`);
      values.push(data.display_name);
    }
    if (data.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(data.description);
    }
    if (data.class_name !== undefined) {
      updates.push(`class_name = $${paramIndex++}`);
      values.push(data.class_name);
    }
    if (data.category !== undefined) {
      updates.push(`category = $${paramIndex++}`);
      values.push(data.category);
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
      return this.findByName(name);
    }

    updates.push(`updated_at = NOW()`);
    values.push(name);

    const result = await query<ActionDefinition>(
      `UPDATE action_definitions 
       SET ${updates.join(', ')}
       WHERE name = $${paramIndex}
       RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  /**
   * Delete action definition (soft delete by setting is_active = false)
   */
  async delete(name: string): Promise<boolean> {
    const result = await query(
      `UPDATE action_definitions 
       SET is_active = false, updated_at = NOW()
       WHERE name = $1`,
      [name]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Hard delete action definition
   */
  async hardDelete(name: string): Promise<boolean> {
    const result = await query(`DELETE FROM action_definitions WHERE name = $1`, [name]);
    return (result.rowCount ?? 0) > 0;
  }
}
