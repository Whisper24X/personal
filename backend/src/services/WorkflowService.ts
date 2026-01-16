/**
 * Workflow Service
 * Provides workflow configuration and management services
 */

import { ApplicationWorkflowRepository, WorkflowConfig } from '../database/repositories/ApplicationWorkflowRepository';
import { SystemDefaultWorkflowTemplateRepository } from '../database/repositories/SystemDefaultWorkflowTemplateRepository';
import { logger } from '../utils';

// 默认工作流配置（与init_role_action_definitions.ts中的配置保持一致）
const DEFAULT_WORKFLOW_CONFIG: WorkflowConfig = {
  roles: [
    {
      profile: 'Salesperson',
      name: 'Salesperson',
      order: 0,
      actions: ['WriteMRD', 'MRDReview', 'ImproveMRD'],
      watch_actions: ['User'],
    },
    {
      profile: 'ProductManager',
      name: 'ProductManager',
      order: 1,
      actions: ['WritePRD', 'PRDReview', 'ImprovePRD'],
      watch_actions: ['WriteMRD'],
    },
    {
      profile: 'Architect',
      name: 'Architect',
      order: 2,
      actions: ['WriteDesign', 'DesignReview', 'ImproveDesign'],
      watch_actions: ['WritePRD'],
    },
    {
      profile: 'ProjectManager',
      name: 'ProjectManager',
      order: 3,
      actions: ['BreakdownTasks'],
      watch_actions: ['WritePRD'],
    },
    {
      profile: 'Engineer',
      name: 'Engineer',
      order: 4,
      actions: ['WriteCode'],
      watch_actions: ['WritePRD', 'WriteDesign', 'BreakdownTasks'],
    },
    {
      profile: 'QAEngineer',
      name: 'QAEngineer',
      order: 5,
      actions: [
        'TestabilityReview',
        'WriteTestPlan',
        'WriteTest',
        'TestCaseReview',
        'AutomationPlanning',
        'AutomationExecution',
        'CoverageQualityCheck',
        'QAConclusion',
      ],
      watch_actions: ['WritePRD', 'WriteCode'],
    },
  ],
};

export class WorkflowService {
  private workflowRepo: ApplicationWorkflowRepository;

  constructor() {
    this.workflowRepo = new ApplicationWorkflowRepository();
  }

  /**
   * Get all workflows for an application
   */
  async getApplicationWorkflows(applicationId: string) {
    try {
      return await this.workflowRepo.findByApplicationId(applicationId);
    } catch (error: any) {
      logger.error(`WorkflowService: Failed to get workflows for application ${applicationId}:`, error);
      throw error;
    }
  }

  /**
   * Get default workflow for an application
   */
  async getDefaultWorkflow(applicationId: string) {
    try {
      const workflow = await this.workflowRepo.findDefaultByApplicationId(applicationId);
      if (!workflow) {
        throw new Error(`No default workflow found for application ${applicationId}`);
      }
      return workflow;
    } catch (error: any) {
      logger.error(`WorkflowService: Failed to get default workflow for application ${applicationId}:`, error);
      throw error;
    }
  }

  /**
   * Get or create default workflow for an application
   * If no default workflow exists, automatically creates one using default template from database
   * Handles concurrency safely using database unique constraints
   */
  async getOrCreateDefaultWorkflow(applicationId: string) {
    try {
      // First, try to get existing default workflow
      let workflow = await this.workflowRepo.findDefaultByApplicationId(applicationId);
      
      if (workflow) {
        logger.info(`WorkflowService: Found existing default workflow for application ${applicationId}`, {
          workflowId: workflow.id,
          workflowName: workflow.name,
        });
        return workflow;
      }

      // No default workflow exists, create one
      logger.info(`WorkflowService: No default workflow found for application ${applicationId}, creating default workflow`);
      
      // Load default workflow config from database
      let defaultConfig: WorkflowConfig;
      try {
        const templateRepo = new SystemDefaultWorkflowTemplateRepository();
        const template = await templateRepo.findActive();
        
        if (template && template.workflow_config) {
          defaultConfig = template.workflow_config;
          logger.info(`WorkflowService: Using default workflow template from database`);
        } else {
          throw new Error('No active default workflow template found in database');
        }
      } catch (templateError: any) {
        // Fallback to hardcoded config (with warning)
        logger.warn(`WorkflowService: Failed to load default template from database, using hardcoded config:`, templateError.message);
        defaultConfig = DEFAULT_WORKFLOW_CONFIG; // 保留作为fallback
      }
      
      try {
        workflow = await this.workflowRepo.create({
          applicationId,
          name: '默认工作流',
          description: '默认的完整工作流，包含从需求收集到QA的完整流程',
          isDefault: true,
          workflowConfig: defaultConfig,
        });
        
        logger.info(`WorkflowService: Successfully created default workflow for application ${applicationId}`, {
          workflowId: workflow.id,
          workflowName: workflow.name,
        });
        
        return workflow;
      } catch (createError: any) {
        // Handle concurrent creation: if another process created the workflow between our check and create,
        // the unique constraint will prevent our creation. In this case, query again.
        if (createError.message?.includes('is_default') || createError.code === '23505') {
          logger.info(`WorkflowService: Concurrent creation detected for application ${applicationId}, querying again`);
          workflow = await this.workflowRepo.findDefaultByApplicationId(applicationId);
          
          if (workflow) {
            logger.info(`WorkflowService: Retrieved default workflow created by concurrent process for application ${applicationId}`, {
              workflowId: workflow.id,
              workflowName: workflow.name,
            });
            return workflow;
          }
        }
        
        // Re-throw if it's not a concurrency issue or if we still can't find the workflow
        throw createError;
      }
    } catch (error: any) {
      logger.error(`WorkflowService: Failed to get or create default workflow for application ${applicationId}:`, error);
      throw error;
    }
  }

  /**
   * Create a new workflow
   */
  async createWorkflow(
    applicationId: string,
    config: {
      name: string;
      description?: string;
      isDefault?: boolean;
      workflowConfig: WorkflowConfig;
    }
  ) {
    try {
      return await this.workflowRepo.create({
        applicationId,
        ...config,
      });
    } catch (error: any) {
      logger.error(`WorkflowService: Failed to create workflow for application ${applicationId}:`, error);
      throw error;
    }
  }

  /**
   * Update workflow
   */
  async updateWorkflow(
    workflowId: string,
    config: {
      name?: string;
      description?: string;
      isDefault?: boolean;
      workflowConfig?: WorkflowConfig;
    }
  ) {
    try {
      return await this.workflowRepo.update(workflowId, config);
    } catch (error: any) {
      logger.error(`WorkflowService: Failed to update workflow ${workflowId}:`, error);
      throw error;
    }
  }

  /**
   * Delete workflow
   */
  async deleteWorkflow(workflowId: string) {
    try {
      return await this.workflowRepo.delete(workflowId);
    } catch (error: any) {
      logger.error(`WorkflowService: Failed to delete workflow ${workflowId}:`, error);
      throw error;
    }
  }

  /**
   * Set workflow as default
   */
  async setDefaultWorkflow(applicationId: string, workflowId: string) {
    try {
      return await this.workflowRepo.setDefault(applicationId, workflowId);
    } catch (error: any) {
      logger.error(
        `WorkflowService: Failed to set default workflow ${workflowId} for application ${applicationId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get workflow by ID
   */
  async getWorkflowById(workflowId: string) {
    try {
      const workflow = await this.workflowRepo.findById(workflowId);
      if (!workflow) {
        throw new Error(`Workflow ${workflowId} not found`);
      }
      return workflow;
    } catch (error: any) {
      logger.error(`WorkflowService: Failed to get workflow ${workflowId}:`, error);
      throw error;
    }
  }
}
