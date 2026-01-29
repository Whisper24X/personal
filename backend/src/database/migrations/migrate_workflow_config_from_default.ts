/**
 * Migration Script: Migrate workflow configs from defaultWorkflowConfig.ts
 *
 * This script automatically detects differences between database configurations
 * and the standard configuration in defaultWorkflowConfig.ts, then migrates:
 * - application_workflows.workflow_config: Align to standard config
 * - workflow_executions.workflow_snapshot: Update snapshot to standard config
 * - workflow_executions.steps: Intelligently map steps based on changes
 * - workflow_executions.current_position: Adjust position if needed
 *
 * Usage: pnpm exec tsx src/database/migrations/migrate_workflow_config_from_default.ts
 */

import { Pool } from 'pg';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { defaultWorkflowConfig } from '../../services/defaultWorkflowConfig';
import { WorkflowConfig } from '../../database/repositories/ApplicationWorkflowRepository';
import { StepStatus, CurrentPosition, StepState } from '../../workflow/types';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

interface WorkflowRole {
  profile: string;
  name?: string;
  order: number;
  actions: string[];
  watch_actions?: string[];
  config?: Record<string, any>;
  input?: {
    source: string | string[];
    mapping?: Record<string, string>;
  };
  output?: {
    target: string | string[];
    mapping?: Record<string, string>;
  };
}

export interface ConfigDiff {
  addedRoles: string[];
  removedRoles: string[];
  modifiedRoles: {
    profile: string;
    addedActions: string[];
    removedActions: string[];
    reorderedActions: boolean;
    watchActionsChanged: boolean;
  }[];
  roleOrderChanged: boolean;
}

export interface MigrationResult {
  success: boolean;
  workflowsChecked: number;
  workflowsUpdated: number;
  executionsChecked: number;
  executionsUpdated: number;
  snapshotsUpdated: number;
  stepsUpdated: number;
  positionsUpdated: number;
  workflowDiffs: Array<{ id: string; name: string; diff: ConfigDiff }>;
  error?: string;
}

interface WorkflowExecutionRow {
  id: string;
  project_id: string;
  version_id: string;
  workflow_snapshot: WorkflowConfig;
  state: string;
  current_position: CurrentPosition | null;
  steps: StepStatus[];
  version: number;
}

/**
 * Compare two workflow configurations and detect differences
 */
function compareConfigs(standard: WorkflowConfig, current: WorkflowConfig): ConfigDiff {
  const diff: ConfigDiff = {
    addedRoles: [],
    removedRoles: [],
    modifiedRoles: [],
    roleOrderChanged: false,
  };

  // Sort roles by order
  const standardRoles = [...standard.roles].sort((a, b) => a.order - b.order);
  const currentRoles = [...(current.roles || [])].sort((a, b) => a.order - b.order);

  // Check role order
  const standardOrder = standardRoles.map((r) => r.profile).join(',');
  const currentOrder = currentRoles.map((r) => r.profile).join(',');
  if (standardOrder !== currentOrder) {
    diff.roleOrderChanged = true;
  }

  // Create maps for easy lookup
  const standardRoleMap = new Map<string, WorkflowRole>();
  standardRoles.forEach((r) => standardRoleMap.set(r.profile, r));

  const currentRoleMap = new Map<string, WorkflowRole>();
  currentRoles.forEach((r) => currentRoleMap.set(r.profile, r));

  // Find added and removed roles
  standardRoleMap.forEach((_, profile) => {
    if (!currentRoleMap.has(profile)) {
      diff.addedRoles.push(profile);
    }
  });

  currentRoleMap.forEach((_, profile) => {
    if (!standardRoleMap.has(profile)) {
      diff.removedRoles.push(profile);
    }
  });

  // Check modified roles
  standardRoleMap.forEach((standardRole, profile) => {
    const currentRole = currentRoleMap.get(profile);
    if (!currentRole) {
      return; // Already handled as added role
    }

    const roleDiff: ConfigDiff['modifiedRoles'][0] = {
      profile,
      addedActions: [],
      removedActions: [],
      reorderedActions: false,
      watchActionsChanged: false,
    };

    // Compare actions (order sensitive)
    const standardActions = standardRole.actions || [];
    const currentActions = currentRole.actions || [];

    if (JSON.stringify(standardActions) !== JSON.stringify(currentActions)) {
      // Check if it's a reorder or add/remove
      const standardActionSet = new Set(standardActions);
      const currentActionSet = new Set(currentActions);

      // Find added actions
      standardActions.forEach((action) => {
        if (!currentActionSet.has(action)) {
          roleDiff.addedActions.push(action);
        }
      });

      // Find removed actions
      currentActions.forEach((action) => {
        if (!standardActionSet.has(action)) {
          roleDiff.removedActions.push(action);
        }
      });

      // Check if order changed (if no add/remove, it's just reorder)
      if (roleDiff.addedActions.length === 0 && roleDiff.removedActions.length === 0) {
        roleDiff.reorderedActions = true;
      }
    }

    // Compare watch_actions (order insensitive)
    const standardWatchActions = new Set((standardRole.watch_actions || []).sort());
    const currentWatchActions = new Set((currentRole.watch_actions || []).sort());

    if (JSON.stringify([...standardWatchActions].sort()) !== JSON.stringify([...currentWatchActions].sort())) {
      roleDiff.watchActionsChanged = true;
    }

    // Only add to modifiedRoles if there are actual changes
    if (
      roleDiff.addedActions.length > 0 ||
      roleDiff.removedActions.length > 0 ||
      roleDiff.reorderedActions ||
      roleDiff.watchActionsChanged
    ) {
      diff.modifiedRoles.push(roleDiff);
    }
  });

  return diff;
}

/**
 * Update workflow config to match standard config, preserving custom fields
 */
function updateWorkflowConfig(standard: WorkflowConfig, current: WorkflowConfig): WorkflowConfig {
  const updatedRoles: WorkflowRole[] = [];

  // Sort standard roles by order
  const standardRoles = [...standard.roles].sort((a, b) => a.order - b.order);

  // Create map of current roles for preserving custom fields
  const currentRoleMap = new Map<string, WorkflowRole>();
  (current.roles || []).forEach((r) => currentRoleMap.set(r.profile, r));

  // Build updated roles based on standard config
  standardRoles.forEach((standardRole) => {
    const currentRole = currentRoleMap.get(standardRole.profile);
    const updatedRole: WorkflowRole = {
      profile: standardRole.profile,
      order: standardRole.order,
      actions: [...standardRole.actions], // Use standard actions
      watch_actions: standardRole.watch_actions ? [...standardRole.watch_actions] : undefined,
    };

    // Preserve custom fields from current config
    if (currentRole) {
      if (currentRole.config) {
        updatedRole.config = currentRole.config;
      }
      if (currentRole.input) {
        updatedRole.input = currentRole.input;
      }
      if (currentRole.output) {
        updatedRole.output = currentRole.output;
      }
      // Preserve name if it's different from standard (custom name)
      if (currentRole.name && currentRole.name !== standardRole.name) {
        updatedRole.name = currentRole.name;
      }
    }

    updatedRoles.push(updatedRole);
  });

  return { roles: updatedRoles };
}

/**
 * Build role and action index maps for efficient lookup
 */
function buildIndexMaps(config: WorkflowConfig): {
  roleIndexMap: Map<string, number>;
  actionIndexMap: Map<string, Map<string, number>>;
} {
  const roleIndexMap = new Map<string, number>();
  const actionIndexMap = new Map<string, Map<string, number>>();

  const sortedRoles = [...config.roles].sort((a, b) => a.order - b.order);

  sortedRoles.forEach((role, roleIndex) => {
    roleIndexMap.set(role.profile, roleIndex);

    const actionMap = new Map<string, number>();
    role.actions.forEach((action, actionIndex) => {
      actionMap.set(action, actionIndex);
    });
    actionIndexMap.set(role.profile, actionMap);
  });

  return { roleIndexMap, actionIndexMap };
}

/**
 * Intelligently map steps based on config changes
 */
function mapSteps(
  oldSteps: StepStatus[],
  oldConfig: WorkflowConfig,
  newConfig: WorkflowConfig
): StepStatus[] {
  const newSteps: StepStatus[] = [];

  // Build index maps
  const oldIndexMaps = buildIndexMaps(oldConfig);
  const newIndexMaps = buildIndexMaps(newConfig);

  // Create mapping: old role+action -> new role+action
  const actionMapping = new Map<string, { role: string; action: string }>();

  // Build role and action mappings
  const oldRoleMap = new Map<string, WorkflowRole>();
  oldConfig.roles.forEach((r) => oldRoleMap.set(r.profile, r));

  const newRoleMap = new Map<string, WorkflowRole>();
  newConfig.roles.forEach((r) => newRoleMap.set(r.profile, r));

  // Process each old step
  for (const oldStep of oldSteps) {
    const oldRole = oldRoleMap.get(oldStep.role);
    const newRole = newRoleMap.get(oldStep.role);

    // If role was removed, skip the step
    if (!newRole) {
      continue;
    }

    // Check if action still exists in new config
    const newActionIndex = newRole.actions.indexOf(oldStep.action);

    if (newActionIndex >= 0) {
      // Action still exists, update indices
      const newRoleIndex = newIndexMaps.roleIndexMap.get(oldStep.role) ?? oldStep.roleIndex;
      newSteps.push({
        ...oldStep,
        roleIndex: newRoleIndex,
        actionIndex: newActionIndex,
      });
    } else {
      // Action was removed
      // If completed or running, map to first action of the role
      if (oldStep.state === StepState.COMPLETED || oldStep.state === StepState.RUNNING) {
        const newRoleIndex = newIndexMaps.roleIndexMap.get(oldStep.role) ?? oldStep.roleIndex;
        if (newRole.actions.length > 0) {
          newSteps.push({
            role: oldStep.role,
            action: newRole.actions[0],
            roleIndex: newRoleIndex,
            actionIndex: 0,
            state: oldStep.state,
            retryCount: oldStep.retryCount,
            startedAt: oldStep.startedAt,
            completedAt: oldStep.completedAt,
            error: oldStep.error,
          });
        }
      }
      // If pending or failed, skip (delete the step)
    }
  }

  // Add new actions as pending steps
  // Build a set of all step keys that we've already processed
  const existingStepKeys = new Set(newSteps.map((s) => `${s.role}:${s.action}`));

  // Now add any steps from new config that don't exist yet
  const sortedNewRoles = [...newConfig.roles].sort((a, b) => a.order - b.order);
  sortedNewRoles.forEach((role, roleIndex) => {
    role.actions.forEach((action, actionIndex) => {
      const stepKey = `${role.profile}:${action}`;
      if (!existingStepKeys.has(stepKey)) {
        // This is a new action that doesn't exist in old steps
        // Add it as a pending step
        newSteps.push({
          role: role.profile,
          action,
          roleIndex,
          actionIndex,
          state: StepState.PENDING,
          retryCount: 0,
        });
      }
    });
  });

  // Sort steps by roleIndex and actionIndex
  newSteps.sort((a, b) => {
    if (a.roleIndex !== b.roleIndex) {
      return a.roleIndex - b.roleIndex;
    }
    return a.actionIndex - b.actionIndex;
  });

  return newSteps;
}

/**
 * Update current position based on config changes
 */
function updateCurrentPosition(
  currentPosition: CurrentPosition | null,
  oldConfig: WorkflowConfig,
  newConfig: WorkflowConfig,
  newSteps: StepStatus[]
): CurrentPosition | null {
  if (!currentPosition) {
    return null;
  }

  const oldIndexMaps = buildIndexMaps(oldConfig);
  const newIndexMaps = buildIndexMaps(newConfig);

  // Find the step that currentPosition points to in old config
  const oldSortedRoles = [...oldConfig.roles].sort((a, b) => a.order - b.order);
  const oldRole = oldSortedRoles[currentPosition.roleIndex];
  if (!oldRole) {
    // Invalid position, find first pending step
    const firstPending = newSteps.find((s) => s.state === StepState.PENDING);
    if (firstPending) {
      return {
        roleIndex: firstPending.roleIndex,
        actionIndex: firstPending.actionIndex,
      };
    }
    return null;
  }

  const oldAction = oldRole.actions[currentPosition.actionIndex];
  if (!oldAction) {
    // Invalid position, find first pending step
    const firstPending = newSteps.find((s) => s.state === StepState.PENDING);
    if (firstPending) {
      return {
        roleIndex: firstPending.roleIndex,
        actionIndex: firstPending.actionIndex,
      };
    }
    return null;
  }

  // Check if this role+action still exists in new config
  const newRoleIndex = newIndexMaps.roleIndexMap.get(oldRole.profile);
  if (newRoleIndex === undefined) {
    // Role was removed, find first pending step
    const firstPending = newSteps.find((s) => s.state === StepState.PENDING);
    if (firstPending) {
      return {
        roleIndex: firstPending.roleIndex,
        actionIndex: firstPending.actionIndex,
      };
    }
    return null;
  }

  const newActionMap = newIndexMaps.actionIndexMap.get(oldRole.profile);
  const newActionIndex = newActionMap?.get(oldAction);

  if (newActionIndex !== undefined) {
    // Action still exists, update position
    return {
      roleIndex: newRoleIndex,
      actionIndex: newActionIndex,
    };
  } else {
    // Action was removed, find next valid step
    // First try to find a step with the same role
    const sameRoleStep = newSteps.find(
      (s) => s.role === oldRole.profile && s.state === StepState.PENDING
    );
    if (sameRoleStep) {
      return {
        roleIndex: sameRoleStep.roleIndex,
        actionIndex: sameRoleStep.actionIndex,
      };
    }

    // Otherwise find first pending step
    const firstPending = newSteps.find((s) => s.state === StepState.PENDING);
    if (firstPending) {
      return {
        roleIndex: firstPending.roleIndex,
        actionIndex: firstPending.actionIndex,
      };
    }

    return null;
  }
}

/**
 * Main migration function
 * Can be called from API or CLI
 */
export async function migrateWorkflowConfigs(): Promise<MigrationResult> {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  // Initialize variables for error handling
  let workflows: Array<{ id: string; application_id: string; name: string; workflow_config: WorkflowConfig }> = [];
  let executions: WorkflowExecutionRow[] = [];
  let updatedWorkflowsCount = 0;
  let updatedExecutionsCount = 0;
  let snapshotUpdatedCount = 0;
  let stepsUpdatedCount = 0;
  let positionUpdatedCount = 0;
  const workflowDiffs: Array<{ id: string; name: string; diff: ConfigDiff }> = [];

  console.log('🚀 Starting Migration: Migrate workflow configs from defaultWorkflowConfig.ts...');
  console.log(`📍 Database: ${process.env.DATABASE_URL?.split('@')[1] || 'unknown'}`);

  try {
    // Start transaction
    await pool.query('BEGIN');

    // Step 1: Load standard config
    console.log('\n📦 Step 1: Loading standard configuration...');
    const standardConfig = defaultWorkflowConfig;
    console.log(`✅ Loaded standard config with ${standardConfig.roles.length} roles`);

    // Step 2: Query all workflows
    console.log('\n📦 Step 2: Querying application_workflows...');
    const workflowsResult = await pool.query<{
      id: string;
      application_id: string;
      name: string;
      workflow_config: WorkflowConfig;
    }>('SELECT id, application_id, name, workflow_config FROM application_workflows');

    workflows = workflowsResult.rows;
    console.log(`✅ Found ${workflows.length} workflow(s)`);

    // Step 3: Process workflows
    console.log('\n📦 Step 3: Processing workflows...');

    for (const workflow of workflows) {
      const config = workflow.workflow_config;
      if (!config || !config.roles || !Array.isArray(config.roles)) {
        console.log(`⚠️  Skipping workflow ${workflow.id} (${workflow.name}): invalid config structure`);
        continue;
      }

      // Compare configs
      const diff = compareConfigs(standardConfig, config);

      // Check if there are any changes
      const hasChanges =
        diff.addedRoles.length > 0 ||
        diff.removedRoles.length > 0 ||
        diff.modifiedRoles.length > 0 ||
        diff.roleOrderChanged;

      if (hasChanges) {
        workflowDiffs.push({ id: workflow.id, name: workflow.name, diff });

        // Update workflow config
        const updatedConfig = updateWorkflowConfig(standardConfig, config);
        await pool.query(
          `UPDATE application_workflows 
           SET workflow_config = $1, updated_at = NOW() 
           WHERE id = $2`,
          [JSON.stringify(updatedConfig), workflow.id]
        );
        updatedWorkflowsCount++;
        console.log(`   ✅ Updated workflow: ${workflow.name} (${workflow.id})`);
      }
    }

    console.log(`✅ Updated ${updatedWorkflowsCount} workflow(s) in application_workflows`);

    // Step 4: Query all workflow executions
    console.log('\n📦 Step 4: Querying workflow_executions...');
    const executionsResult = await pool.query<WorkflowExecutionRow>(
      `SELECT id, project_id, version_id, workflow_snapshot, state, current_position, steps, version
       FROM workflow_executions`
    );

    const executions = executionsResult.rows;
    console.log(`✅ Found ${executions.length} execution(s)`);

    // Step 5: Process workflow executions
    console.log('\n📦 Step 5: Processing workflow_executions...');

    for (const execution of executions) {
      const snapshot = execution.workflow_snapshot;
      if (!snapshot || !snapshot.roles || !Array.isArray(snapshot.roles)) {
        console.log(`⚠️  Skipping execution ${execution.id}: invalid snapshot structure`);
        continue;
      }

      let needsUpdate = false;
      const updates: string[] = [];

      // Compare snapshot with standard config
      const diff = compareConfigs(standardConfig, snapshot);
      const hasChanges =
        diff.addedRoles.length > 0 ||
        diff.removedRoles.length > 0 ||
        diff.modifiedRoles.length > 0 ||
        diff.roleOrderChanged;

      // Clone snapshot for updates
      const updatedSnapshot = hasChanges
        ? updateWorkflowConfig(standardConfig, snapshot)
        : snapshot;

      if (hasChanges) {
        needsUpdate = true;
        snapshotUpdatedCount++;
        updates.push('snapshot');
      }

      // Update steps if config changed
      let updatedSteps = execution.steps;
      if (hasChanges) {
        updatedSteps = mapSteps(execution.steps, snapshot, updatedSnapshot);
        if (JSON.stringify(updatedSteps) !== JSON.stringify(execution.steps)) {
          needsUpdate = true;
          stepsUpdatedCount++;
          updates.push('steps');
        }
      }

      // Update current position if needed
      let updatedPosition = execution.current_position;
      if (hasChanges) {
        const newPosition = updateCurrentPosition(
          execution.current_position,
          snapshot,
          updatedSnapshot,
          updatedSteps
        );
        if (JSON.stringify(newPosition) !== JSON.stringify(execution.current_position)) {
          needsUpdate = true;
          positionUpdatedCount++;
          updates.push('currentPosition');
        }
        updatedPosition = newPosition;
      }

      // Save updated execution if changes were made
      if (needsUpdate) {
        await pool.query(
          `UPDATE workflow_executions 
           SET workflow_snapshot = $1, steps = $2, current_position = $3, version = version + 1, updated_at = NOW()
           WHERE id = $4`,
          [
            JSON.stringify(updatedSnapshot),
            JSON.stringify(updatedSteps),
            updatedPosition ? JSON.stringify(updatedPosition) : null,
            execution.id,
          ]
        );
        updatedExecutionsCount++;
        console.log(`   ✅ Updated execution: ${execution.id} [${updates.join(', ')}]`);
      }
    }

    // Commit transaction
    await pool.query('COMMIT');

    console.log(`\n✅ Migration completed successfully!`);
    console.log(`   - Total workflows checked: ${workflows.length}`);
    console.log(`   - Workflows updated: ${updatedWorkflowsCount}`);
    console.log(`   - Total executions checked: ${executions.length}`);
    console.log(`   - Executions updated: ${updatedExecutionsCount}`);
    console.log(`   - Snapshots updated: ${snapshotUpdatedCount}`);
    console.log(`   - Steps arrays updated: ${stepsUpdatedCount}`);
    console.log(`   - Current positions updated: ${positionUpdatedCount}`);

    // Step 6: Show summary of changes
    if (workflowDiffs.length > 0) {
      console.log('\n📋 Summary of changes detected:');
      workflowDiffs.forEach(({ name, diff }) => {
        console.log(`   - ${name}:`);
        if (diff.addedRoles.length > 0) {
          console.log(`     Added roles: ${diff.addedRoles.join(', ')}`);
        }
        if (diff.removedRoles.length > 0) {
          console.log(`     Removed roles: ${diff.removedRoles.join(', ')}`);
        }
        if (diff.modifiedRoles.length > 0) {
          diff.modifiedRoles.forEach((mod) => {
            console.log(`     Modified ${mod.profile}:`);
            if (mod.addedActions.length > 0) {
              console.log(`       Added actions: ${mod.addedActions.join(', ')}`);
            }
            if (mod.removedActions.length > 0) {
              console.log(`       Removed actions: ${mod.removedActions.join(', ')}`);
            }
            if (mod.reorderedActions) {
              console.log(`       Actions reordered`);
            }
            if (mod.watchActionsChanged) {
              console.log(`       Watch actions changed`);
            }
          });
        }
        if (diff.roleOrderChanged) {
          console.log(`     Role order changed`);
        }
      });
    }

    // Step 7: Verify migration
    console.log('\n📦 Step 7: Verifying migration...');
    const verifyWorkflowsResult = await pool.query<{
      id: string;
      name: string;
      workflow_config: WorkflowConfig;
    }>('SELECT id, name, workflow_config FROM application_workflows LIMIT 5');

    console.log('\n📋 Sample workflows after migration:');
    for (const wf of verifyWorkflowsResult.rows) {
      const roles = wf.workflow_config.roles || [];
      const sortedRoles = [...roles].sort((a, b) => a.order - b.order);
      console.log(`   - ${wf.name} (${wf.id}):`);
      console.log(`     Roles: ${sortedRoles.map((r) => r.profile).join(', ')}`);
      sortedRoles.forEach((role) => {
        console.log(`       ${role.profile}: [${role.actions.join(', ')}]`);
      });
    }

    // Return structured result
    return {
      success: true,
      workflowsChecked: workflows.length,
      workflowsUpdated: updatedWorkflowsCount,
      executionsChecked: executions.length,
      executionsUpdated: updatedExecutionsCount,
      snapshotsUpdated: snapshotUpdatedCount,
      stepsUpdated: stepsUpdatedCount,
      positionsUpdated: positionUpdatedCount,
      workflowDiffs,
    };
  } catch (error: any) {
    // Rollback on error
    await pool.query('ROLLBACK');
    const errorMessage = error.message || 'Unknown error';
    console.error('\n❌ Migration failed:', errorMessage);
    if (error.position) {
      console.error(`   Position: ${error.position}`);
    }
    if (error.detail) {
      console.error(`   Detail: ${error.detail}`);
    }
    if (error.stack) {
      console.error(`   Stack: ${error.stack}`);
    }
    
    // Return error result
    return {
      success: false,
      workflowsChecked: workflows.length,
      workflowsUpdated: updatedWorkflowsCount,
      executionsChecked: executions.length,
      executionsUpdated: updatedExecutionsCount,
      snapshotsUpdated: snapshotUpdatedCount,
      stepsUpdated: stepsUpdatedCount,
      positionsUpdated: positionUpdatedCount,
      workflowDiffs,
      error: errorMessage,
    };
  } finally {
    await pool.end();
  }
}

// CLI entry point - only execute if run directly
if (require.main === module) {
  migrateWorkflowConfigs()
    .then((result) => {
      if (!result.success) {
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}
