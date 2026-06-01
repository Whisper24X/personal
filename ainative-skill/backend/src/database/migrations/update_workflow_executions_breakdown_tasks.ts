/**
 * Migration Script: Update existing workflow_executions to replace BreakdownTasks with new OpenSpec actions
 *
 * This script updates all existing workflow execution records:
 * - Updates workflow_snapshot: Replaces BreakdownTasks in ProjectManager.actions with 5 new actions
 * - Updates workflow_snapshot: Replaces BreakdownTasks in Engineer.watch_actions with ValidateStoryPointEstimates
 * - Updates steps array: Intelligently handles BreakdownTasks steps in different states
 * - Updates currentPosition: Adjusts position if it points to BreakdownTasks
 *
 * NOTE: This is a historical migration. The individual OpenSpec actions mentioned here
 * (FillProjectContext, CreateOpenSpecProposal, etc.) have since been consolidated into
 * a single ExecuteProjectManagement action that uses the project-management skill.
 * This migration file is kept for historical record only.
 *
 * Usage: pnpm exec tsx src/database/migrations/update_workflow_executions_breakdown_tasks.ts
 */

import { Pool } from 'pg';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

interface WorkflowRole {
  profile: string;
  name?: string;
  order: number;
  actions: string[];
  watch_actions?: string[];
  config?: Record<string, any>;
}

interface WorkflowConfig {
  roles: WorkflowRole[];
}

interface StepStatus {
  role: string;
  action: string;
  roleIndex: number;
  actionIndex: number;
  state: string;
  retryCount: number;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

interface CurrentPosition {
  roleIndex: number;
  actionIndex: number;
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

const NEW_ACTIONS = [
  'FillProjectContext',
  'CreateOpenSpecProposal',
  'ValidateOpenSpecProposal',
  'EstimateStoryPoints',
  'ValidateStoryPointEstimates',
];

/**
 * Update workflow_snapshot: Replace BreakdownTasks with new actions
 */
function updateWorkflowSnapshot(config: WorkflowConfig): { updated: boolean; pmUpdated: boolean; engUpdated: boolean } {
  let updated = false;
  let pmUpdated = false;
  let engUpdated = false;

  // Update ProjectManager role
  const pmRole = config.roles.find((r: WorkflowRole) => r.profile === 'ProjectManager');
  if (pmRole && Array.isArray(pmRole.actions)) {
    if (pmRole.actions.includes('BreakdownTasks')) {
      // Replace BreakdownTasks with new actions
      if (pmRole.actions.length === 1 && pmRole.actions[0] === 'BreakdownTasks') {
        pmRole.actions = [...NEW_ACTIONS];
      } else {
        // Find BreakdownTasks index and replace with new actions
        const breakdownIndex = pmRole.actions.indexOf('BreakdownTasks');
        if (breakdownIndex !== -1) {
          pmRole.actions.splice(breakdownIndex, 1, ...NEW_ACTIONS);
        }
      }
      updated = true;
      pmUpdated = true;
    }
  }

  // Update Engineer role watch_actions
  const engRole = config.roles.find((r: WorkflowRole) => r.profile === 'Engineer');
  if (engRole && Array.isArray(engRole.watch_actions)) {
    if (engRole.watch_actions.includes('BreakdownTasks')) {
      engRole.watch_actions = engRole.watch_actions.map((action: string) => (action === 'BreakdownTasks' ? 'ValidateStoryPointEstimates' : action));
      // Remove duplicates
      engRole.watch_actions = Array.from(new Set(engRole.watch_actions));
      updated = true;
      engUpdated = true;
    }
  }

  return { updated, pmUpdated, engUpdated };
}

/**
 * Update steps array: Intelligently handle BreakdownTasks step
 */
function updateSteps(
  steps: StepStatus[],
  pmRoleIndex: number,
  breakdownActionIndex: number
): { newSteps: StepStatus[]; breakdownStepState: string | null; breakdownStepIndex: number | null } {
  const newSteps: StepStatus[] = [];
  let breakdownStepState: string | null = null;
  let breakdownStepIndex: number | null = null;

  // Find the BreakdownTasks step
  const breakdownStep = steps.find((s) => s.role === 'ProjectManager' && s.action === 'BreakdownTasks');

  if (breakdownStep) {
    breakdownStepState = breakdownStep.state;
    breakdownStepIndex = steps.indexOf(breakdownStep);
    // Use the actual actionIndex from the step if breakdownActionIndex is invalid
    if (breakdownActionIndex < 0) {
      breakdownActionIndex = breakdownStep.actionIndex;
    }
  } else if (breakdownActionIndex < 0) {
    // No BreakdownTasks step found and no valid index - cannot update
    return { newSteps: steps, breakdownStepState: null, breakdownStepIndex: null };
  }

  // Rebuild steps array
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];

    if (step.role === 'ProjectManager' && step.action === 'BreakdownTasks') {
      // Replace BreakdownTasks with new actions
      if (breakdownStepState === 'completed' || breakdownStepState === 'running') {
        // Map BreakdownTasks to FillProjectContext (first new action)
        // Preserve state and timestamps
        newSteps.push({
          role: 'ProjectManager',
          action: 'FillProjectContext',
          roleIndex: pmRoleIndex,
          actionIndex: breakdownActionIndex,
          state: breakdownStepState,
          retryCount: step.retryCount,
          startedAt: step.startedAt,
          completedAt: step.completedAt,
          error: step.error,
        });

        // Add remaining 4 actions as pending
        for (let j = 1; j < NEW_ACTIONS.length; j++) {
          newSteps.push({
            role: 'ProjectManager',
            action: NEW_ACTIONS[j],
            roleIndex: pmRoleIndex,
            actionIndex: breakdownActionIndex + j,
            state: 'pending',
            retryCount: 0,
          });
        }
      } else {
        // BreakdownTasks is pending or failed - replace with all 5 new actions as pending
        for (let j = 0; j < NEW_ACTIONS.length; j++) {
          newSteps.push({
            role: 'ProjectManager',
            action: NEW_ACTIONS[j],
            roleIndex: pmRoleIndex,
            actionIndex: breakdownActionIndex + j,
            state: 'pending', // Reset failed to pending
            retryCount: 0,
          });
        }
      }
    } else if (step.role === 'ProjectManager' && step.roleIndex === pmRoleIndex) {
      // Other ProjectManager actions - adjust actionIndex if needed
      // Since we're replacing 1 action with 5, we need to shift actionIndex
      if (breakdownActionIndex >= 0 && step.actionIndex > breakdownActionIndex) {
        // This action comes after BreakdownTasks, shift by +4 (5 new - 1 old)
        newSteps.push({
          ...step,
          actionIndex: step.actionIndex + 4,
        });
      } else {
        // This action comes before BreakdownTasks, no change
        newSteps.push(step);
      }
    } else {
      // Other roles - no change needed
      newSteps.push(step);
    }
  }

  return { newSteps, breakdownStepState, breakdownStepIndex };
}

/**
 * Update currentPosition if it points to BreakdownTasks
 */
function updateCurrentPosition(currentPosition: CurrentPosition | null, pmRoleIndex: number, breakdownActionIndex: number): CurrentPosition | null {
  if (!currentPosition) {
    return null;
  }

  // If currentPosition points to BreakdownTasks
  if (currentPosition.roleIndex === pmRoleIndex && currentPosition.actionIndex === breakdownActionIndex) {
    // Update to point to FillProjectContext (first new action)
    return {
      roleIndex: pmRoleIndex,
      actionIndex: breakdownActionIndex,
    };
  }

  // If currentPosition points to a ProjectManager action after BreakdownTasks
  if (currentPosition.roleIndex === pmRoleIndex && currentPosition.actionIndex > breakdownActionIndex) {
    // Shift actionIndex by +4 (5 new - 1 old)
    return {
      roleIndex: currentPosition.roleIndex,
      actionIndex: currentPosition.actionIndex + 4,
    };
  }

  // No change needed
  return currentPosition;
}

async function updateWorkflowExecutions() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  console.log('🚀 Starting Migration: Update workflow_executions to replace BreakdownTasks...');
  console.log(`📍 Database: ${process.env.DATABASE_URL?.split('@')[1] || 'unknown'}`);

  try {
    // Start transaction
    await pool.query('BEGIN');

    // Step 1: Query all workflow executions containing BreakdownTasks
    console.log('\n📦 Step 1: Querying workflow executions...');
    const executionsResult = await pool.query<WorkflowExecutionRow>(
      `SELECT id, project_id, version_id, workflow_snapshot, state, current_position, steps, version
       FROM workflow_executions
       WHERE workflow_snapshot::text LIKE '%BreakdownTasks%' OR steps::text LIKE '%BreakdownTasks%'`
    );

    const executions = executionsResult.rows;
    console.log(`✅ Found ${executions.length} workflow executions to check`);

    if (executions.length === 0) {
      console.log('ℹ️  No workflow executions found, nothing to update');
      await pool.query('COMMIT');
      return;
    }

    // Step 2: Update each workflow execution
    console.log('\n📦 Step 2: Updating workflow executions...');
    let updatedCount = 0;
    let snapshotUpdatedCount = 0;
    let stepsUpdatedCount = 0;
    let positionUpdatedCount = 0;

    for (const execution of executions) {
      let needsUpdate = false;
      const updates: string[] = [];

      // Clone workflow snapshot
      const workflowSnapshot = JSON.parse(JSON.stringify(execution.workflow_snapshot)) as WorkflowConfig;

      // Update workflow_snapshot
      const { updated: snapshotUpdated, pmUpdated, engUpdated } = updateWorkflowSnapshot(workflowSnapshot);
      if (snapshotUpdated) {
        needsUpdate = true;
        snapshotUpdatedCount++;
        if (pmUpdated) updates.push('PM actions');
        if (engUpdated) updates.push('ENG watch_actions');
      }

      // Find ProjectManager role index and BreakdownTasks action index
      const pmRole = workflowSnapshot.roles.find((r: WorkflowRole) => r.profile === 'ProjectManager');
      if (!pmRole) {
        console.log(`⚠️  Skipping execution ${execution.id}: ProjectManager role not found`);
        continue;
      }

      // Sort roles by order to get correct roleIndex
      const sortedRoles = [...workflowSnapshot.roles].sort((a, b) => a.order - b.order);
      const pmRoleIndex = sortedRoles.findIndex((r) => r.profile === 'ProjectManager');

      // Find BreakdownTasks action index in old config
      const oldPmRole = execution.workflow_snapshot.roles.find((r: WorkflowRole) => r.profile === 'ProjectManager');
      const breakdownActionIndex = oldPmRole?.actions.indexOf('BreakdownTasks') ?? -1;

      if (breakdownActionIndex === -1 && !execution.steps.some((s) => s.action === 'BreakdownTasks')) {
        // No BreakdownTasks found in this execution
        if (snapshotUpdated) {
          // Only snapshot needs update
          await pool.query(
            `UPDATE workflow_executions 
             SET workflow_snapshot = $1, version = version + 1, updated_at = NOW()
             WHERE id = $2`,
            [JSON.stringify(workflowSnapshot), execution.id]
          );
          updatedCount++;
          console.log(`   ✅ Updated snapshot: ${execution.id} [${updates.join(', ')}]`);
        }
        continue;
      }

      // Update steps array
      const { newSteps } = updateSteps(execution.steps, pmRoleIndex, breakdownActionIndex);
      if (JSON.stringify(newSteps) !== JSON.stringify(execution.steps)) {
        needsUpdate = true;
        stepsUpdatedCount++;
        updates.push('steps');
      }

      // Update currentPosition
      const newCurrentPosition = updateCurrentPosition(execution.current_position, pmRoleIndex, breakdownActionIndex);
      if (JSON.stringify(newCurrentPosition) !== JSON.stringify(execution.current_position)) {
        needsUpdate = true;
        positionUpdatedCount++;
        updates.push('currentPosition');
      }

      // Save updated execution if changes were made
      if (needsUpdate) {
        await pool.query(
          `UPDATE workflow_executions 
           SET workflow_snapshot = $1, steps = $2, current_position = $3, version = version + 1, updated_at = NOW()
           WHERE id = $4`,
          [JSON.stringify(workflowSnapshot), JSON.stringify(newSteps), newCurrentPosition ? JSON.stringify(newCurrentPosition) : null, execution.id]
        );
        updatedCount++;
        console.log(`   ✅ Updated execution: ${execution.id} [${updates.join(', ')}]`);
      }
    }

    // Commit transaction
    await pool.query('COMMIT');

    console.log(`\n✅ Migration completed successfully!`);
    console.log(`   - Total executions checked: ${executions.length}`);
    console.log(`   - Executions updated: ${updatedCount}`);
    console.log(`   - Snapshots updated: ${snapshotUpdatedCount}`);
    console.log(`   - Steps arrays updated: ${stepsUpdatedCount}`);
    console.log(`   - Current positions updated: ${positionUpdatedCount}`);
    console.log(`   - Executions unchanged: ${executions.length - updatedCount}`);

    // Step 3: Verify updates
    console.log('\n📦 Step 3: Verifying updates...');
    const verifyResult = await pool.query<{
      id: string;
      project_id: string;
    }>(
      `SELECT id, project_id
       FROM workflow_executions
       WHERE workflow_snapshot::text LIKE '%BreakdownTasks%' OR steps::text LIKE '%BreakdownTasks%'`
    );

    if (verifyResult.rows.length > 0) {
      console.log(`⚠️  Warning: Found ${verifyResult.rows.length} executions still containing 'BreakdownTasks':`);
      for (const exec of verifyResult.rows) {
        console.log(`   - ${exec.id} (project: ${exec.project_id})`);
      }
    } else {
      console.log('✅ Verification passed: No executions contain "BreakdownTasks"');
    }

    // Show sample of updated executions
    if (updatedCount > 0) {
      console.log('\n📋 Sample of updated executions:');
      const sampleResult = await pool.query<{
        id: string;
        project_id: string;
        workflow_snapshot: WorkflowConfig;
        steps: StepStatus[];
      }>(
        `SELECT id, project_id, workflow_snapshot, steps
         FROM workflow_executions
         WHERE workflow_snapshot::text LIKE '%FillProjectContext%'
         LIMIT 3`
      );
      for (const exec of sampleResult.rows) {
        const pmRole = exec.workflow_snapshot.roles.find((r: WorkflowRole) => r.profile === 'ProjectManager');
        const pmSteps = exec.steps.filter((s) => s.role === 'ProjectManager');
        console.log(`   - Execution ${exec.id} (project: ${exec.project_id}):`);
        if (pmRole) {
          console.log(`     ProjectManager.actions: [${pmRole.actions.join(', ')}]`);
        }
        console.log(`     ProjectManager steps: ${pmSteps.length} steps`);
        pmSteps.forEach((step) => {
          console.log(`       - ${step.action}: ${step.state} (index: ${step.actionIndex})`);
        });
      }
    }
  } catch (error: any) {
    // Rollback on error
    await pool.query('ROLLBACK');
    console.error('\n❌ Migration failed:', error.message);
    if (error.position) {
      console.error(`   Position: ${error.position}`);
    }
    if (error.detail) {
      console.error(`   Detail: ${error.detail}`);
    }
    if (error.stack) {
      console.error(`   Stack: ${error.stack}`);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

updateWorkflowExecutions();
