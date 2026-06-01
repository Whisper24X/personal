/**
 * Role Action Factory
 * Dynamically creates role and action instances based on registry and database configuration
 * 
 * This factory uses centralized registries from roles/index.ts and actions/index.ts
 * to create instances, eliminating the need for hardcoded mappings in multiple files.
 */

import { Context } from '../core/context/Context';
import { Role } from '../roles/Role';
import { BaseAction } from '../core/base/BaseAction';
import { logger } from '../utils';

// Import registries from centralized locations
import { ROLE_REGISTRY } from '../roles';
import { ACTION_REGISTRY } from '../actions';

export class RoleActionFactory {
  /**
   * Create a role instance from role definition
   */
  static createRoleFromDefinition(
    profile: string,
    context: Context,
    name?: string,
    actions?: string[],
    watchActions?: string[]
  ): Role {
    const RoleClass = ROLE_REGISTRY[profile];
    if (!RoleClass) {
      throw new Error(`Unknown role profile: ${profile}. Available profiles: ${Object.keys(ROLE_REGISTRY).join(', ')}`);
    }

    // Create role instance
    const role = new RoleClass(context, name);

    // Override actions if specified
    if (actions && actions.length > 0) {
      const actionInstances = actions
        .map((actionName) => {
          const ActionClass = ACTION_REGISTRY[actionName];
          if (!ActionClass) {
            logger.warn(`Unknown action: ${actionName}, skipping`);
            return null;
          }
          return new ActionClass();
        })
        .filter((action): action is BaseAction => action !== null);

      role.setActions(actionInstances);
    }

    // Override watch actions if specified
    if (watchActions && watchActions.length > 0) {
      role.watch(watchActions);
    }

    return role;
  }

  /**
   * Create an action instance from action definition
   */
  static createActionFromDefinition(actionName: string): BaseAction {
    const ActionClass = ACTION_REGISTRY[actionName];
    if (!ActionClass) {
      throw new Error(`Unknown action: ${actionName}. Available actions: ${Object.keys(ACTION_REGISTRY).join(', ')}`);
    }
    return new ActionClass();
  }

  /**
   * Create all role instances from the registry
   * Useful for getting metadata from all roles
   */
  static createAllRoleInstances(context: Context): Role[] {
    return Object.entries(ROLE_REGISTRY).map(([profile, RoleClass]) => {
      try {
        return new RoleClass(context);
      } catch (error: any) {
        logger.warn(`Failed to create role instance for ${profile}:`, error.message);
        return null;
      }
    }).filter((role): role is Role => role !== null);
  }

  /**
   * Create all action instances from the registry
   * Useful for getting metadata from all actions
   */
  static createAllActionInstances(): BaseAction[] {
    return Object.entries(ACTION_REGISTRY).map(([name, ActionClass]) => {
      try {
        return new ActionClass();
      } catch (error: any) {
        logger.warn(`Failed to create action instance for ${name}:`, error.message);
        return null;
      }
    }).filter((action): action is BaseAction => action !== null);
  }

  /**
   * Get available role profiles
   */
  static getAvailableRoleProfiles(): string[] {
    return Object.keys(ROLE_REGISTRY);
  }

  /**
   * Get available action names
   */
  static getAvailableActionNames(): string[] {
    return Object.keys(ACTION_REGISTRY);
  }

  /**
   * Check if a role profile exists in the registry
   */
  static hasRoleProfile(profile: string): boolean {
    return profile in ROLE_REGISTRY;
  }

  /**
   * Check if an action name exists in the registry
   */
  static hasActionName(name: string): boolean {
    return name in ACTION_REGISTRY;
  }
}
