/**
 * System Default Workflow Template Repository
 * Data access layer for system default workflow templates using native PostgreSQL
 */

import { query } from '../client';
import { logger } from '../../utils';
import { WorkflowConfig } from './ApplicationWorkflowRepository';

export interface SystemDefaultWorkflowTemplate {
  id: string;
  name: string;
  workflow_config: WorkflowConfig;
  is_active: boolean;
  description?: string;
  created_at: Date;
  updated_at: Date;
}

export class SystemDefaultWorkflowTemplateRepository {
  /**
   * Find active default workflow template
   */
  async findActive(): Promise<SystemDefaultWorkflowTemplate | null> {
    try {
      const result = await query<SystemDefaultWorkflowTemplate>(
        `SELECT * FROM system_default_workflow_templates 
         WHERE is_active = true 
         ORDER BY created_at ASC 
         LIMIT 1`
      );
      return result.rows[0] || null;
    } catch (error: any) {
      logger.error('SystemDefaultWorkflowTemplateRepository: Failed to find active template:', error);
      throw error;
    }
  }

  /**
   * Find template by name
   */
  async findByName(name: string): Promise<SystemDefaultWorkflowTemplate | null> {
    try {
      const result = await query<SystemDefaultWorkflowTemplate>(
        `SELECT * FROM system_default_workflow_templates 
         WHERE name = $1`,
        [name]
      );
      return result.rows[0] || null;
    } catch (error: any) {
      logger.error(`SystemDefaultWorkflowTemplateRepository: Failed to find template by name ${name}:`, error);
      throw error;
    }
  }

  /**
   * Find template by ID
   */
  async findById(id: string): Promise<SystemDefaultWorkflowTemplate | null> {
    try {
      const result = await query<SystemDefaultWorkflowTemplate>(
        `SELECT * FROM system_default_workflow_templates 
         WHERE id = $1`,
        [id]
      );
      return result.rows[0] || null;
    } catch (error: any) {
      logger.error(`SystemDefaultWorkflowTemplateRepository: Failed to find template by id ${id}:`, error);
      throw error;
    }
  }

  /**
   * Find all templates
   */
  async findAll(): Promise<SystemDefaultWorkflowTemplate[]> {
    try {
      const result = await query<SystemDefaultWorkflowTemplate>(
        `SELECT * FROM system_default_workflow_templates 
         ORDER BY created_at ASC`
      );
      return result.rows;
    } catch (error: any) {
      logger.error('SystemDefaultWorkflowTemplateRepository: Failed to find all templates:', error);
      throw error;
    }
  }

  /**
   * Create a new template
   */
  async create(data: {
    name: string;
    workflowConfig: WorkflowConfig;
    description?: string;
    isActive?: boolean;
  }): Promise<SystemDefaultWorkflowTemplate> {
    try {
      const result = await query<SystemDefaultWorkflowTemplate>(
        `INSERT INTO system_default_workflow_templates (
          name, workflow_config, description, is_active
        ) VALUES ($1, $2, $3, $4)
        RETURNING *`,
        [
          data.name,
          JSON.stringify(data.workflowConfig),
          data.description || null,
          data.isActive !== undefined ? data.isActive : true,
        ]
      );

      if (!result.rows[0]) {
        throw new Error('Failed to create template: no row returned');
      }

      logger.info(`SystemDefaultWorkflowTemplateRepository: Created template ${data.name}`);
      return result.rows[0];
    } catch (error: any) {
      logger.error(`SystemDefaultWorkflowTemplateRepository: Failed to create template ${data.name}:`, error);
      throw error;
    }
  }

  /**
   * Update template
   */
  async update(
    id: string,
    data: {
      name?: string;
      workflowConfig?: WorkflowConfig;
      description?: string;
      isActive?: boolean;
    }
  ): Promise<SystemDefaultWorkflowTemplate | null> {
    try {
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (data.name !== undefined) {
        updates.push(`name = $${paramIndex++}`);
        values.push(data.name);
      }
      if (data.workflowConfig !== undefined) {
        updates.push(`workflow_config = $${paramIndex++}`);
        values.push(JSON.stringify(data.workflowConfig));
      }
      if (data.description !== undefined) {
        updates.push(`description = $${paramIndex++}`);
        values.push(data.description);
      }
      if (data.isActive !== undefined) {
        updates.push(`is_active = $${paramIndex++}`);
        values.push(data.isActive);
      }

      if (updates.length === 0) {
        // No updates, just return the existing template
        return await this.findById(id);
      }

      updates.push(`updated_at = NOW()`);
      values.push(id);

      const result = await query<SystemDefaultWorkflowTemplate>(
        `UPDATE system_default_workflow_templates 
         SET ${updates.join(', ')}
         WHERE id = $${paramIndex}
         RETURNING *`,
        values
      );

      if (!result.rows[0]) {
        return null;
      }

      logger.info(`SystemDefaultWorkflowTemplateRepository: Updated template ${id}`);
      return result.rows[0];
    } catch (error: any) {
      logger.error(`SystemDefaultWorkflowTemplateRepository: Failed to update template ${id}:`, error);
      throw error;
    }
  }

  /**
   * Delete template (hard delete)
   */
  async delete(id: string): Promise<boolean> {
    try {
      const result = await query(
        `DELETE FROM system_default_workflow_templates 
         WHERE id = $1`,
        [id]
      );
      logger.info(`SystemDefaultWorkflowTemplateRepository: Deleted template ${id}`);
      return true;
    } catch (error: any) {
      logger.error(`SystemDefaultWorkflowTemplateRepository: Failed to delete template ${id}:`, error);
      throw error;
    }
  }
}
