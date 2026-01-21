/**
 * Role Action Factory
 * Dynamically creates role and action instances based on database configuration
 */

import { Context } from '../core/context/Context';
import { Team } from '../orchestration/Team';
import { Role } from '../roles/Role';
import { BaseAction } from '../core/base/BaseAction';
import { WorkflowConfig } from '../database/repositories/ApplicationWorkflowRepository';
import { logger } from '../utils';

// Import all role classes
import { Salesperson } from '../roles/Salesperson';
import { ProductManager } from '../roles/ProductManager';
import { Architect } from '../roles/Architect';
import { ProjectManager } from '../roles/ProjectManager';
import { Engineer } from '../roles/Engineer';
import { QAEngineer } from '../roles/QAEngineer';
import { TeamLeader } from '../roles/TeamLeader';
import { DataAnalyst } from '../roles/DataAnalyst';

// Import all action classes
import { WriteMRD } from '../actions/WriteMRD';
import { WritePRD } from '../actions/WritePRD';
import { WriteDesign } from '../actions/WriteDesign';
import { WriteSubProjectDesign } from '../actions/WriteSubProjectDesign';
import { WriteCode } from '../actions/WriteCode';
import { WriteTest } from '../actions/WriteTest';
import { WriteTestPlan } from '../actions/WriteTestPlan';
import { MRDReview } from '../actions/MRDReview';
import { PRDReview } from '../actions/PRDReview';
import { DesignReview } from '../actions/DesignReview';
import { SubProjectDesignReview } from '../actions/SubProjectDesignReview';
import { CodeReview } from '../actions/CodeReview';
import { TestCaseReview } from '../actions/TestCaseReview';
import { TestReview } from '../actions/TestReview';
import { ImprovePRD } from '../actions/ImprovePRD';
import { ImproveMRD } from '../actions/ImproveMRD';
import { ImproveDesign } from '../actions/ImproveDesign';
import { ImproveTest } from '../actions/ImproveTest';
import { BreakdownTasks } from '../actions/BreakdownTasks';
import { ExecuteSubtask } from '../actions/ExecuteSubtask';
import { RunCode } from '../actions/RunCode';
import { FixBug } from '../actions/FixBug';
import { TestabilityReview } from '../actions/TestabilityReview';
import { AutomationPlanning } from '../actions/AutomationPlanning';
import { AutomationExecution } from '../actions/AutomationExecution';
import { CoverageQualityCheck } from '../actions/CoverageQualityCheck';
import { QAConclusion } from '../actions/QAConclusion';
import { SearchEnhancedQA } from '../actions/SearchEnhancedQA';
import { DataAnalysis } from '../actions/DataAnalysis';
import { Coordinate } from '../actions/Coordinate';

// Role class mapping
const ROLE_CLASS_MAP: Record<string, new (context: Context, name?: string) => Role> = {
  Salesperson,
  ProductManager,
  Architect,
  ProjectManager,
  Engineer,
  QAEngineer,
  TeamLeader,
  DataAnalyst,
};

// Action class mapping
const ACTION_CLASS_MAP: Record<string, new () => BaseAction> = {
  WriteMRD,
  WritePRD,
  WriteDesign,
  WriteSubProjectDesign,
  WriteCode,
  WriteTest,
  WriteTestPlan,
  MRDReview,
  PRDReview,
  DesignReview,
  SubProjectDesignReview,
  CodeReview,
  TestCaseReview,
  TestReview,
  ImprovePRD,
  ImproveMRD,
  ImproveDesign,
  ImproveTest,
  BreakdownTasks,
  ExecuteSubtask,
  RunCode,
  FixBug,
  TestabilityReview,
  AutomationPlanning,
  AutomationExecution,
  CoverageQualityCheck,
  QAConclusion,
  SearchEnhancedQA,
  DataAnalysis,
  Coordinate,
};

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
    const RoleClass = ROLE_CLASS_MAP[profile];
    if (!RoleClass) {
      throw new Error(`Unknown role profile: ${profile}`);
    }

    // Create role instance
    const role = new RoleClass(context, name);

    // Override actions if specified
    if (actions && actions.length > 0) {
      const actionInstances = actions
        .map((actionName) => {
          const ActionClass = ACTION_CLASS_MAP[actionName];
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
    const ActionClass = ACTION_CLASS_MAP[actionName];
    if (!ActionClass) {
      throw new Error(`Unknown action: ${actionName}`);
    }
    return new ActionClass();
  }

  /**
   * Create a Team from workflow configuration
   */
  static createTeamFromWorkflow(
    workflowConfig: WorkflowConfig,
    context: Context
  ): Team {
    const team = new Team(context, false);

    // Sort roles by order
    const sortedRoles = [...workflowConfig.roles].sort((a, b) => a.order - b.order);

    // Create and hire roles
    const roleInstances = sortedRoles.map((roleConfig) => {
      const role = this.createRoleFromDefinition(
        roleConfig.profile,
        context,
        roleConfig.name,
        roleConfig.actions,
        roleConfig.watch_actions
      );

      // Apply role-specific config if provided
      if (roleConfig.config) {
        // Apply config to role (if role supports it)
        // This could be extended to support role-specific configurations
        logger.debug(`Applying config to role ${roleConfig.profile}:`, roleConfig.config);
      }

      return role;
    });

    team.hire(roleInstances);

    logger.info(`Created team with ${roleInstances.length} roles from workflow config`, {
      roles: roleInstances.map((r) => r.profile),
    });

    return team;
  }

  /**
   * Get available role profiles
   */
  static getAvailableRoleProfiles(): string[] {
    return Object.keys(ROLE_CLASS_MAP);
  }

  /**
   * Get available action names
   */
  static getAvailableActionNames(): string[] {
    return Object.keys(ACTION_CLASS_MAP);
  }
}
