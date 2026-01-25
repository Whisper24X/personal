/**
 * Application Workflow Repository
 * Data access layer for application workflows using native PostgreSQL
 */

import { query } from '../client';

export interface WorkflowConfig {
  roles: Array<{
    profile: string;
    name?: string;
    order: number;
    actions: string[];
    watch_actions?: string[];
    config?: Record<string, any>;
    // 数据传递配置
    input?: {
      source: string | string[]; // 'user', 'step1', ['step1', 'step2']
      mapping?: Record<string, string>; // { "prd": "${step1.output.prd}" }
    };
    output?: {
      target: string | string[]; // 'step2', 'user', ['step2', 'storage']
      mapping?: Record<string, string>; // { "prd": "${output.prd}" }
    };
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

    return result.rows[0];
  }

  /**
   * Update workflow
   * @param id Workflow ID
   * @param applicationId Application ID (for security validation)
   * @param data Update data
   */
  async update(
    id: string,
    applicationId: string,
    data: {
      name?: string;
      description?: string;
      isDefault?: boolean;
      workflowConfig?: WorkflowConfig;
    }
  ): Promise<ApplicationWorkflow | null> {
    // First verify the workflow exists and belongs to this application
    const existing = await this.findById(id);
    if (!existing) {
      return null;
    }
    if (existing.application_id !== applicationId) {
      throw new Error('Workflow does not belong to this application');
    }

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
        await query(
          `UPDATE application_workflows 
           SET is_default = false, updated_at = NOW()
           WHERE application_id = $1 AND id != $2 AND is_default = true`,
          [applicationId, id]
        );
      }
      updates.push(`is_default = $${paramIndex++}`);
      values.push(data.isDefault);
    }
    if (data.workflowConfig !== undefined) {
      updates.push(`workflow_config = $${paramIndex++}`);
      values.push(JSON.stringify(data.workflowConfig));
    }

    if (updates.length === 0) {
      return existing;
    }

    updates.push(`updated_at = NOW()`);
    values.push(id, applicationId);

    const result = await query<ApplicationWorkflow>(
      `UPDATE application_workflows 
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex} AND application_id = $${paramIndex + 1}
       RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  /**
   * Delete workflow
   * @param id Workflow ID
   * @param applicationId Application ID (for security validation)
   */
  async delete(id: string, applicationId: string): Promise<boolean> {
    // First verify the workflow exists and belongs to this application
    const existing = await this.findById(id);
    if (!existing) {
      return false;
    }
    if (existing.application_id !== applicationId) {
      throw new Error('Workflow does not belong to this application');
    }
    if (existing.is_default) {
      throw new Error('Cannot delete default workflow');
    }

    const result = await query(
      `DELETE FROM application_workflows WHERE id = $1 AND application_id = $2`,
      [id, applicationId]
    );
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
}
