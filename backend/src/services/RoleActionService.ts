/**
 * Role Action Service
 * Provides role and action metadata query services
 */

import {
  RoleDefinitionRepository,
  ActionDefinitionRepository,
} from '../database/repositories';
import { logger } from '../utils';

export interface RoleMetadata {
  profile: string;
  name: string;
  displayName?: string;
  goal?: string;
  constraints?: string;
  description?: string;
  actions: ActionMetadata[];
}

export interface ActionMetadata {
  name: string;
  displayName?: string;
  description?: string;
  category?: string;
}

export class RoleActionService {
  private roleDefRepo: RoleDefinitionRepository;
  private actionDefRepo: ActionDefinitionRepository;

  constructor() {
    this.roleDefRepo = new RoleDefinitionRepository();
    this.actionDefRepo = new ActionDefinitionRepository();
  }

  /**
   * Get all role metadata
   */
  async getAllRoles(): Promise<RoleMetadata[]> {
    try {
      const roleDefs = await this.roleDefRepo.findActive();
      const actionDefs = await this.actionDefRepo.findActive();

      // Build a map of actions by name for quick lookup
      const actionMap = new Map<string, ActionMetadata>();
      actionDefs.forEach((def) => {
        actionMap.set(def.name, {
          name: def.name,
          displayName: def.display_name,
          description: def.description,
          category: def.category,
        });
      });

      // Get role-action associations from application_actions table
      // For now, we'll return all actions for each role based on the code definitions
      // In the future, this could be filtered by application
      const roles: RoleMetadata[] = roleDefs.map((roleDef) => {
        // Get actions for this role from the code-based mapping
        // This is a temporary solution until we have proper role-action associations
        const roleActions: ActionMetadata[] = [];

        return {
          profile: roleDef.profile,
          name: roleDef.name,
          displayName: roleDef.display_name,
          goal: roleDef.goal,
          constraints: roleDef.constraints,
          description: roleDef.description,
          actions: roleActions,
        };
      });

      return roles;
    } catch (error: any) {
      logger.error('RoleActionService: Failed to get all roles:', error);
      throw error;
    }
  }

  /**
   * Get all action metadata
   */
  async getAllActions(): Promise<ActionMetadata[]> {
    try {
      const actionDefs = await this.actionDefRepo.findActive();
      return actionDefs.map((def) => ({
        name: def.name,
        displayName: def.display_name,
        description: def.description,
        category: def.category,
      }));
    } catch (error: any) {
      logger.error('RoleActionService: Failed to get all actions:', error);
      throw error;
    }
  }

  /**
   * Get roles and actions metadata together
   */
  async getRolesAndActions(): Promise<{
    roles: RoleMetadata[];
    actions: ActionMetadata[];
  }> {
    try {
      const [roles, actions] = await Promise.all([
        this.getAllRoles(),
        this.getAllActions(),
      ]);

      return { roles, actions };
    } catch (error: any) {
      logger.error('RoleActionService: Failed to get roles and actions:', error);
      throw error;
    }
  }

  /**
   * Get role metadata by profile
   */
  async getRoleByProfile(profile: string): Promise<RoleMetadata | null> {
    try {
      const roleDef = await this.roleDefRepo.findByProfile(profile);
      if (!roleDef) {
        return null;
      }

      return {
        profile: roleDef.profile,
        name: roleDef.name,
        displayName: roleDef.display_name,
        goal: roleDef.goal,
        constraints: roleDef.constraints,
        description: roleDef.description,
        actions: [], // Actions will be populated from workflow config
      };
    } catch (error: any) {
      logger.error(`RoleActionService: Failed to get role by profile ${profile}:`, error);
      throw error;
    }
  }

  /**
   * Get action metadata by name
   */
  async getActionByName(name: string): Promise<ActionMetadata | null> {
    try {
      const actionDef = await this.actionDefRepo.findByName(name);
      if (!actionDef) {
        return null;
      }

      return {
        name: actionDef.name,
        displayName: actionDef.display_name,
        description: actionDef.description,
        category: actionDef.category,
      };
    } catch (error: any) {
      logger.error(`RoleActionService: Failed to get action by name ${name}:`, error);
      throw error;
    }
  }
}
