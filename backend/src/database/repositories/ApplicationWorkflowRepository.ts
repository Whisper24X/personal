/**
 * Application Workflow Repository
 * Data access layer for application workflows using native PostgreSQL
 */

import { query } from '../client';
import { logger } from '../../utils';

export interface WorkflowConfig {
  roles: Array<{
    profile: string;
    name?: string;
    order: number;
    actions: string[];
    watch_actions?: string[];
    config?: Record<string, any>;
  }>;
}

export interface ApplicationWorkflow {
  id: string;
  application_id: string;
  name: string;
  description?: string;
  is_default: boolean;
  workflow_config: WorkflowConfig;
  created_at: Date;
  updated_at: Date;
}

export class ApplicationWorkflowRepository {
  /**
   * Find all workflows for an application
   */
  async findByApplicationId(applicationId: string): Promise<ApplicationWorkflow[]> {
    const result = await query<ApplicationWorkflow>(
      `SELECT * FROM application_workflows 
       WHERE application_id = $1 
       ORDER BY is_default DESC, created_at ASC`,
      [applicationId]
    );
    return result.rows;
  }

  /**
   * Find default workflow for an application
   */
  async findDefaultByApplicationId(applicationId: string): Promise<ApplicationWorkflow | null> {
    const result = await query<ApplicationWorkflow>(
      `SELECT * FROM application_workflows 
       WHERE application_id = $1 AND is_default = true
       LIMIT 1`,
      [applicationId]
    );
    return result.rows[0] || null;
  }

  /**
   * Find workflow by ID
   */
  async findById(id: string): Promise<ApplicationWorkflow | null> {
    const result = await query<ApplicationWorkflow>(
      `SELECT * FROM application_workflows WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Create a new workflow
   */
  async create(data: {
    applicationId: string;
    name: string;
    description?: string;
    isDefault?: boolean;
    workflowConfig: WorkflowConfig;
  }): Promise<ApplicationWorkflow> {
    // If this is set as default, ensure no other default exists
    if (data.isDefault) {
      await query(
        `UPDATE application_workflows 
         SET is_default = false, updated_at = NOW()
         WHERE application_id = $1 AND is_default = true`,
        [data.applicationId]
      );
    }

    const result = await query<ApplicationWorkflow>(
      `INSERT INTO application_workflows (
        application_id, name, description, is_default, workflow_config
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [
        data.applicationId,
        data.name,
        data.description || null,
        data.isDefault !== undefined ? data.isDefault : false,
        JSON.stringify(data.workflowConfig),
      ]
    );

    // Update application_roles and application_actions tables
    await this.updateWorkflowAssociations(result.rows[0].id, data.applicationId, data.workflowConfig);

    return result.rows[0];
  }

  /**
   * Update workflow
   */
  async update(
    id: string,
    data: {
      name?: string;
      description?: string;
      isDefault?: boolean;
      workflowConfig?: WorkflowConfig;
    }
  ): Promise<ApplicationWorkflow | null> {
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
    if (data.isDefault !== undefined) {
      // If setting as default, unset other defaults first
      if (data.isDefault) {
        const workflow = await this.findById(id);
        if (workflow) {
          await query(
            `UPDATE application_workflows 
             SET is_default = false, updated_at = NOW()
             WHERE application_id = $1 AND id != $2 AND is_default = true`,
            [workflow.application_id, id]
          );
        }
      }
      updates.push(`is_default = $${paramIndex++}`);
      values.push(data.isDefault);
    }
    if (data.workflowConfig !== undefined) {
      updates.push(`workflow_config = $${paramIndex++}`);
      values.push(JSON.stringify(data.workflowConfig));
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await query<ApplicationWorkflow>(
      `UPDATE application_workflows 
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    const updated = result.rows[0];
    if (updated && data.workflowConfig) {
      // Update associations
      await this.updateWorkflowAssociations(id, updated.application_id, data.workflowConfig);
    }

    return updated || null;
  }

  /**
   * Delete workflow
   */
  async delete(id: string): Promise<boolean> {
    // Delete associations first
    await query(`DELETE FROM application_roles WHERE workflow_id = $1`, [id]);
    await query(`DELETE FROM application_actions WHERE workflow_id = $1`, [id]);

    const result = await query(`DELETE FROM application_workflows WHERE id = $1`, [id]);
    return result.rowCount > 0;
  }

  /**
   * Set workflow as default
   */
  async setDefault(applicationId: string, workflowId: string): Promise<boolean> {
    // Unset other defaults
    await query(
      `UPDATE application_workflows 
       SET is_default = false, updated_at = NOW()
       WHERE application_id = $1 AND id != $2 AND is_default = true`,
      [applicationId, workflowId]
    );

    // Set this as default
    const result = await query(
      `UPDATE application_workflows 
       SET is_default = true, updated_at = NOW()
       WHERE id = $1 AND application_id = $2`,
      [workflowId, applicationId]
    );

    return result.rowCount > 0;
  }

  /**
   * Update workflow associations (application_roles and application_actions)
   */
  private async updateWorkflowAssociations(
    workflowId: string,
    applicationId: string,
    config: WorkflowConfig
  ): Promise<void> {
    // Delete existing associations
    await query(`DELETE FROM application_roles WHERE workflow_id = $1`, [workflowId]);
    await query(`DELETE FROM application_actions WHERE workflow_id = $1`, [workflowId]);

    // Insert role associations
    for (const role of config.roles) {
      await query(
        `INSERT INTO application_roles (application_id, role_profile, workflow_id, "order")
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (application_id, workflow_id, role_profile) 
         DO UPDATE SET "order" = EXCLUDED."order"`,
        [applicationId, role.profile, workflowId, role.order]
      );

      // Insert action associations
      for (const actionName of role.actions) {
        await query(
          `INSERT INTO application_actions (application_id, action_name, role_profile, workflow_id)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (application_id, workflow_id, role_profile, action_name) DO NOTHING`,
          [applicationId, actionName, role.profile, workflowId]
        );
      }
    }
  }
}
