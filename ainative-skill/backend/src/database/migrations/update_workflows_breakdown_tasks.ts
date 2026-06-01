/**
 * Migration Script: Update existing workflows to replace BreakdownTasks with new OpenSpec actions
 *
 * This script updates all existing workflow configurations:
 * - Replaces BreakdownTasks in ProjectManager.actions with 5 new actions
 * - Replaces BreakdownTasks in Engineer.watch_actions with ValidateStoryPointEstimates
 *
 * NOTE: This is a historical migration. The individual OpenSpec actions mentioned here
 * (FillProjectContext, CreateOpenSpecProposal, etc.) have since been consolidated into
 * a single ExecuteProjectManagement action that uses the project-management skill.
 * This migration file is kept for historical record only.
 *
 * Usage: pnpm exec tsx src/database/migrations/update_workflows_breakdown_tasks.ts
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

async function updateWorkflows() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  console.log('🚀 Starting Migration: Update workflows to replace BreakdownTasks...');
  console.log(`📍 Database: ${process.env.DATABASE_URL?.split('@')[1] || 'unknown'}`);

  try {
    // Start transaction
    await pool.query('BEGIN');

    // Step 1: Query all workflows
    console.log('\n📦 Step 1: Querying all workflows...');
    const workflowsResult = await pool.query<{
      id: string;
      application_id: string;
      name: string;
      workflow_config: WorkflowConfig;
    }>('SELECT id, application_id, name, workflow_config FROM application_workflows');

    const workflows = workflowsResult.rows;
    console.log(`✅ Found ${workflows.length} workflows to check`);

    if (workflows.length === 0) {
      console.log('ℹ️  No workflows found, nothing to update');
      await pool.query('COMMIT');
      return;
    }

    // Step 2: Update each workflow
    console.log('\n📦 Step 2: Updating workflows...');
    let updatedCount = 0;
    const newActions = [
      'FillProjectContext',
      'CreateOpenSpecProposal',
      'ValidateOpenSpecProposal',
      'EstimateStoryPoints',
      'ValidateStoryPointEstimates',
    ];

    for (const workflow of workflows) {
      const config = workflow.workflow_config;
      let updated = false;
      let pmUpdated = false;
      let engUpdated = false;

      // Check if workflow has roles
      if (!config || !config.roles || !Array.isArray(config.roles)) {
        console.log(`⚠️  Skipping workflow ${workflow.id} (${workflow.name}): invalid config structure`);
        continue;
      }

      // Update ProjectManager role
      const pmRole = config.roles.find((r: WorkflowRole) => r.profile === 'ProjectManager');
      if (pmRole && Array.isArray(pmRole.actions)) {
        if (pmRole.actions.includes('BreakdownTasks')) {
          // Replace BreakdownTasks with new actions
          // If BreakdownTasks is the only action, replace it entirely
          // Otherwise, replace BreakdownTasks with the new actions
          if (pmRole.actions.length === 1 && pmRole.actions[0] === 'BreakdownTasks') {
            pmRole.actions = [...newActions];
          } else {
            // Remove BreakdownTasks and add new actions
            pmRole.actions = pmRole.actions.filter((action: string) => action !== 'BreakdownTasks');
            // Add new actions if not already present
            for (const newAction of newActions) {
              if (!pmRole.actions.includes(newAction)) {
                pmRole.actions.push(newAction);
              }
            }
            // Sort to maintain order (new actions should come after existing ones)
            // Actually, let's replace BreakdownTasks position with new actions
            const breakdownIndex = pmRole.actions.indexOf('BreakdownTasks');
            if (breakdownIndex !== -1) {
              pmRole.actions.splice(breakdownIndex, 1, ...newActions);
            }
          }
          updated = true;
          pmUpdated = true;
          console.log(`   ✓ Updated ProjectManager.actions in workflow: ${workflow.name} (${workflow.id})`);
        }
      }

      // Update Engineer role
      const engRole = config.roles.find((r: WorkflowRole) => r.profile === 'Engineer');
      if (engRole && Array.isArray(engRole.watch_actions)) {
        if (engRole.watch_actions.includes('BreakdownTasks')) {
          // Replace BreakdownTasks with ValidateStoryPointEstimates
          engRole.watch_actions = engRole.watch_actions.map((action: string) =>
            action === 'BreakdownTasks' ? 'ValidateStoryPointEstimates' : action
          );
          // Ensure ValidateStoryPointEstimates is not duplicated
          const uniqueWatchActions = Array.from(new Set(engRole.watch_actions));
          engRole.watch_actions = uniqueWatchActions;
          updated = true;
          engUpdated = true;
          console.log(`   ✓ Updated Engineer.watch_actions in workflow: ${workflow.name} (${workflow.id})`);
        }
      }

      // Save updated workflow if changes were made
      if (updated) {
        await pool.query(
          `UPDATE application_workflows 
           SET workflow_config = $1, updated_at = NOW() 
           WHERE id = $2`,
          [JSON.stringify(config), workflow.id]
        );
        updatedCount++;
        console.log(`   ✅ Updated workflow: ${workflow.name} (${workflow.id})${pmUpdated ? ' [PM]' : ''}${engUpdated ? ' [ENG]' : ''}`);
      }
    }

    // Commit transaction
    await pool.query('COMMIT');

    console.log(`\n✅ Migration completed successfully!`);
    console.log(`   - Total workflows checked: ${workflows.length}`);
    console.log(`   - Workflows updated: ${updatedCount}`);
    console.log(`   - Workflows unchanged: ${workflows.length - updatedCount}`);

    // Step 3: Verify updates
    console.log('\n📦 Step 3: Verifying updates...');
    const verifyResult = await pool.query<{
      id: string;
      name: string;
      workflow_config: WorkflowConfig;
    }>(
      `SELECT id, name, workflow_config 
       FROM application_workflows 
       WHERE workflow_config::text LIKE '%BreakdownTasks%'`
    );

    if (verifyResult.rows.length > 0) {
      console.log(`⚠️  Warning: Found ${verifyResult.rows.length} workflows still containing 'BreakdownTasks':`);
      for (const wf of verifyResult.rows) {
        console.log(`   - ${wf.name} (${wf.id})`);
      }
    } else {
      console.log('✅ Verification passed: No workflows contain "BreakdownTasks"');
    }

    // Show sample of updated workflows
    if (updatedCount > 0) {
      console.log('\n📋 Sample of updated workflows:');
      const sampleResult = await pool.query<{
        id: string;
        name: string;
        workflow_config: WorkflowConfig;
      }>(
        `SELECT id, name, workflow_config 
         FROM application_workflows 
         WHERE workflow_config::text LIKE '%FillProjectContext%'
         LIMIT 3`
      );
      for (const wf of sampleResult.rows) {
        const pmRole = wf.workflow_config.roles.find((r: WorkflowRole) => r.profile === 'ProjectManager');
        const engRole = wf.workflow_config.roles.find((r: WorkflowRole) => r.profile === 'Engineer');
        console.log(`   - ${wf.name}:`);
        if (pmRole) {
          console.log(`     ProjectManager.actions: [${pmRole.actions.join(', ')}]`);
        }
        if (engRole && engRole.watch_actions) {
          console.log(`     Engineer.watch_actions: [${engRole.watch_actions.join(', ')}]`);
        }
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

updateWorkflows();
