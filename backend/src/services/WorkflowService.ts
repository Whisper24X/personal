/**
 * Workflow Service
 * Provides workflow configuration and management services
 * 
 * Schema V2: Default workflow configuration is imported from defaultWorkflowConfig.ts
 */

import { ApplicationWorkflowRepository, WorkflowConfig } from '../database/repositories/ApplicationWorkflowRepository';
import { ApplicationRepository } from '../database/repositories/ApplicationRepository';
import { RoleDefinitionRepository } from '../database/repositories/RoleDefinitionRepository';
import { ActionDefinitionRepository } from '../database/repositories/ActionDefinitionRepository';
import { logger } from '../utils';

// Import from single source of truth
import { getDefaultWorkflowConfig } from './defaultWorkflowConfig';

// Re-export for backward compatibility
export { getDefaultWorkflowConfig };

export class WorkflowService {
  private workflowRepo: ApplicationWorkflowRepository;
  private applicationRepo: ApplicationRepository;
  private roleDefRepo: RoleDefinitionRepository;
  private actionDefRepo: ActionDefinitionRepository;

  constructor() {
    this.workflowRepo = new ApplicationWorkflowRepository();
    this.applicationRepo = new ApplicationRepository();
    this.roleDefRepo = new RoleDefinitionRepository();
    this.actionDefRepo = new ActionDefinitionRepository();
  }

  /**
   * Validate that an application exists and is not deleted
   */
  async validateApplicationExists(applicationId: string): Promise<void> {
    const application = await this.applicationRepo.findById(applicationId);
    if (!application) {
      throw new Error(`Application ${applicationId} not found`);
    }
  }

  /**
   * Validate workflow configuration
   * - roles array must not be empty
   * - each role must have profile, order (number), and actions (non-empty array)
   * - role.profile must exist in role_definitions and be active
   * - each action must exist in action_definitions and be active
   * - watch_actions (if provided) must exist
   * - order values must be unique within the workflow
   */
  async validateWorkflowConfig(config: WorkflowConfig): Promise<void> {
    if (!config.roles || !Array.isArray(config.roles) || config.roles.length === 0) {
      throw new Error('Workflow config must have at least one role');
    }

    // Collect all profiles and actions for batch validation
    const profiles = config.roles.map((role) => role.profile).filter(Boolean);
    const allActions: string[] = [];
    const watchActions: string[] = [];

    // Validate each role
    for (let i = 0; i < config.roles.length; i++) {
      const role = config.roles[i];

      // Validate required fields
      if (!role.profile || typeof role.profile !== 'string') {
        throw new Error(`Role at index ${i} must have a valid profile`);
      }

      if (typeof role.order !== 'number' || isNaN(role.order)) {
        throw new Error(`Role at index ${i} must have a valid order (number)`);
      }

      if (!Array.isArray(role.actions) || role.actions.length === 0) {
        throw new Error(`Role at index ${i} must have at least one action`);
      }

      // Collect actions for validation
      allActions.push(...role.actions);

      // Collect watch_actions if provided
      if (role.watch_actions && Array.isArray(role.watch_actions)) {
        watchActions.push(...role.watch_actions);
      }
    }

    // Validate order uniqueness
    const orders = config.roles.map((role) => role.order);
    const uniqueOrders = new Set(orders);
    if (orders.length !== uniqueOrders.size) {
      throw new Error('Order values must be unique within the workflow');
    }

    // Batch validate profiles
    const roleDefs = await this.roleDefRepo.findByProfiles(profiles);
    const validProfiles = new Set(roleDefs.filter((r) => r.is_active).map((r) => r.profile));
    const invalidProfiles = profiles.filter((p) => !validProfiles.has(p));
    if (invalidProfiles.length > 0) {
      throw new Error(
        `Invalid or inactive role profiles: ${invalidProfiles.join(', ')}. Please ensure all roles exist and are active.`
      );
    }

    // Batch validate actions
    const uniqueActions = Array.from(new Set(allActions));
    const actionDefs = await this.actionDefRepo.findByNames(uniqueActions);
    const validActions = new Set(actionDefs.filter((a) => a.is_active).map((a) => a.name));
    const invalidActions = uniqueActions.filter((a) => !validActions.has(a));
    if (invalidActions.length > 0) {
      throw new Error(
        `Invalid or inactive actions: ${invalidActions.join(', ')}. Please ensure all actions exist and are active.`
      );
    }

    // Validate watch_actions if provided
    if (watchActions.length > 0) {
      const uniqueWatchActions = Array.from(new Set(watchActions));
      const watchActionDefs = await this.actionDefRepo.findByNames(uniqueWatchActions);
      const validWatchActions = new Set(watchActionDefs.map((a) => a.name));
      const invalidWatchActions = uniqueWatchActions.filter((a) => !validWatchActions.has(a));
      if (invalidWatchActions.length > 0) {
        throw new Error(
          `Invalid watch_actions: ${invalidWatchActions.join(', ')}. Please ensure all watch actions exist.`
        );
      }
    }

    // Validate data passing mappings if provided
    this.validateDataMappings(config);
  }

  /**
   * Validate data passing mappings in workflow config
   */
  private validateDataMappings(config: WorkflowConfig): void {
    // Create a map of role indices by order for quick lookup
    const roleMap = new Map<number, { profile: string; order: number }>();
    config.roles.forEach((role, _index) => {
      roleMap.set(role.order, { profile: role.profile, order: role.order });
    });

    // Validate each role's input/output mappings
    for (let i = 0; i < config.roles.length; i++) {
      const role = config.roles[i];

      // Validate input mapping
      if (role.input) {
        // Validate source
        if (typeof role.input.source === 'string') {
          if (role.input.source !== 'user' && role.input.source !== 'storage' && role.input.source !== 'constant') {
            // Check if it's a step reference (e.g., 'step1', 'step2')
            if (role.input.source.startsWith('step')) {
              const stepOrder = parseInt(role.input.source.replace('step', ''));
              if (isNaN(stepOrder) || !roleMap.has(stepOrder)) {
                throw new Error(
                  `Role at index ${i} (${role.profile}): Invalid input source '${role.input.source}'. Step not found.`
                );
              }
              // Ensure source step comes before current step
              const sourceRole = roleMap.get(stepOrder);
              if (sourceRole && sourceRole.order >= role.order) {
                throw new Error(
                  `Role at index ${i} (${role.profile}): Input source '${role.input.source}' must come before current step (order ${role.order}).`
                );
              }
            } else {
              throw new Error(
                `Role at index ${i} (${role.profile}): Invalid input source '${role.input.source}'. Must be 'user', 'storage', 'constant', or a step reference like 'step1'.`
              );
            }
          }
        } else if (Array.isArray(role.input.source)) {
          // Validate multiple sources
          for (const source of role.input.source) {
            if (typeof source === 'string') {
              if (source !== 'user' && source !== 'storage' && source !== 'constant') {
                if (source.startsWith('step')) {
                  const stepOrder = parseInt(source.replace('step', ''));
                  if (isNaN(stepOrder) || !roleMap.has(stepOrder)) {
                    throw new Error(
                      `Role at index ${i} (${role.profile}): Invalid input source '${source}'. Step not found.`
                    );
                  }
                  const sourceRole = roleMap.get(stepOrder);
                  if (sourceRole && sourceRole.order >= role.order) {
                    throw new Error(
                      `Role at index ${i} (${role.profile}): Input source '${source}' must come before current step (order ${role.order}).`
                    );
                  }
                } else {
                  throw new Error(
                    `Role at index ${i} (${role.profile}): Invalid input source '${source}'. Must be 'user', 'storage', 'constant', or a step reference.`
                  );
                }
              }
            }
          }
        }

        // Validate mapping expressions syntax
        if (role.input.mapping) {
          for (const [key, value] of Object.entries(role.input.mapping)) {
            if (typeof value !== 'string') {
              throw new Error(
                `Role at index ${i} (${role.profile}): Input mapping value for '${key}' must be a string expression.`
              );
            }
            // Basic validation of expression syntax: should contain ${...}
            if (!value.includes('${')) {
              logger.warn(
                `Role at index ${i} (${role.profile}): Input mapping '${key}' does not use expression syntax. Consider using \${...} format.`
              );
            }
          }
        }
      }

      // Validate output mapping
      if (role.output) {
        // Validate target
        if (typeof role.output.target === 'string') {
          if (role.output.target !== 'user' && role.output.target !== 'storage') {
            // Check if it's a step reference
            if (role.output.target.startsWith('step')) {
              const stepOrder = parseInt(role.output.target.replace('step', ''));
              if (isNaN(stepOrder) || !roleMap.has(stepOrder)) {
                throw new Error(
                  `Role at index ${i} (${role.profile}): Invalid output target '${role.output.target}'. Step not found.`
                );
              }
              // Ensure target step comes after current step
              const targetRole = roleMap.get(stepOrder);
              if (targetRole && targetRole.order <= role.order) {
                throw new Error(
                  `Role at index ${i} (${role.profile}): Output target '${role.output.target}' must come after current step (order ${role.order}).`
                );
              }
            } else {
              throw new Error(
                `Role at index ${i} (${role.profile}): Invalid output target '${role.output.target}'. Must be 'user', 'storage', or a step reference like 'step2'.`
              );
            }
          }
        } else if (Array.isArray(role.output.target)) {
          // Validate multiple targets
          for (const target of role.output.target) {
            if (typeof target === 'string') {
              if (target !== 'user' && target !== 'storage') {
                if (target.startsWith('step')) {
                  const stepOrder = parseInt(target.replace('step', ''));
                  if (isNaN(stepOrder) || !roleMap.has(stepOrder)) {
                    throw new Error(
                      `Role at index ${i} (${role.profile}): Invalid output target '${target}'. Step not found.`
                    );
                  }
                  const targetRole = roleMap.get(stepOrder);
                  if (targetRole && targetRole.order <= role.order) {
                    throw new Error(
                      `Role at index ${i} (${role.profile}): Output target '${target}' must come after current step (order ${role.order}).`
                    );
                  }
                } else {
                  throw new Error(
                    `Role at index ${i} (${role.profile}): Invalid output target '${target}'. Must be 'user', 'storage', or a step reference.`
                  );
                }
              }
            }
          }
        }

        // Validate mapping expressions syntax
        if (role.output.mapping) {
          for (const [key, value] of Object.entries(role.output.mapping)) {
            if (typeof value !== 'string') {
              throw new Error(
                `Role at index ${i} (${role.profile}): Output mapping value for '${key}' must be a string expression.`
              );
            }
            // Basic validation of expression syntax
            if (!value.includes('${')) {
              logger.warn(
                `Role at index ${i} (${role.profile}): Output mapping '${key}' does not use expression syntax. Consider using \${...} format.`
              );
            }
          }
        }
      }
    }
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
      
      // Use default workflow config
      const defaultConfig: WorkflowConfig = getDefaultWorkflowConfig();
      logger.info(`WorkflowService: Using default workflow config`);
      
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
    applicationId: string,
    config: {
      name?: string;
      description?: string;
      isDefault?: boolean;
      workflowConfig?: WorkflowConfig;
    }
  ) {
    try {
      return await this.workflowRepo.update(workflowId, applicationId, config);
    } catch (error: any) {
      logger.error(`WorkflowService: Failed to update workflow ${workflowId}:`, error);
      throw error;
    }
  }

  /**
   * Delete workflow
   */
  async deleteWorkflow(workflowId: string, applicationId: string) {
    try {
      return await this.workflowRepo.delete(workflowId, applicationId);
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
