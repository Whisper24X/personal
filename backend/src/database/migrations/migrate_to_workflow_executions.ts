/**
 * Migration Script: Migrate to workflow_executions table
 * 
 * This script migrates data from the old state management tables to the new
 * unified workflow_executions table.
 * 
 * Old tables:
 * - interactive_session_workflows
 * - interactive_session_running_state
 * - interactive_session_step_state
 * 
 * New table:
 * - workflow_executions
 * 
 * Usage:
 *   npx ts-node src/database/migrations/migrate_to_workflow_executions.ts
 */

import { query, connectDatabase, disconnectDatabase, getClient } from '../client';
import { logger } from '../../utils';
import { WorkflowState, StepState, StepStatus } from '../../workflow/types';

// Type definitions for old tables
interface OldWorkflowItem {
  id: string;
  project_id: string;
  role: string;
  action: string | null;
  status: string;
  role_order: number | null;
  action_order: number | null;
  retry_count: number | null;
  created_at: Date;
  updated_at: Date;
}

interface OldRunningState {
  id: string;
  project_id: string;
  current_role: string | null;
  current_action: string | null;
  requires_confirmation: boolean;
  confirmation_role: string | null;
  role_state: number | null;
  role_todo_action: string | null;
  updated_at: Date;
  created_at: Date;
}

interface ProjectWithWorkflow {
  project_id: string;
  workflow_id: string | null;
  workflow_config: any;
}

/**
 * Map old status to new StepState
 */
function mapStatus(oldStatus: string): StepState {
  switch (oldStatus.toLowerCase()) {
    case 'completed':
      return StepState.COMPLETED;
    case 'running':
      return StepState.RUNNING;
    case 'failed':
      return StepState.FAILED;
    case 'pending':
    default:
      return StepState.PENDING;
  }
}

/**
 * Determine WorkflowState from old data
 */
function determineWorkflowState(
  items: OldWorkflowItem[],
  runningState: OldRunningState | null
): WorkflowState {
  // Check if requires confirmation
  if (runningState?.requires_confirmation) {
    return WorkflowState.WAITING_CONFIRMATION;
  }

  // Check if any step is running
  const hasRunning = items.some(item => item.status === 'running');
  if (hasRunning) {
    return WorkflowState.RUNNING;
  }

  // Check if any step is failed
  const hasFailed = items.some(item => item.status === 'failed');
  if (hasFailed) {
    return WorkflowState.FAILED;
  }

  // Check if all steps are completed
  const allCompleted = items.every(item => item.status === 'completed');
  if (allCompleted && items.length > 0) {
    return WorkflowState.COMPLETED;
  }

  // Check if any step has been started
  const hasStarted = items.some(item => 
    item.status === 'completed' || item.status === 'running'
  );
  if (hasStarted) {
    return WorkflowState.RUNNING;
  }

  // Default to initialized
  return WorkflowState.INITIALIZED;
}

/**
 * Convert old workflow items to new steps array
 */
function convertToSteps(items: OldWorkflowItem[]): StepStatus[] {
  // Sort by role_order, then action_order
  const sorted = [...items].sort((a, b) => {
    const roleOrderA = a.role_order ?? 999;
    const roleOrderB = b.role_order ?? 999;
    if (roleOrderA !== roleOrderB) {
      return roleOrderA - roleOrderB;
    }
    const actionOrderA = a.action_order ?? 999;
    const actionOrderB = b.action_order ?? 999;
    return actionOrderA - actionOrderB;
  });

  return sorted.map(item => ({
    role: item.role,
    action: item.action || '',
    roleIndex: item.role_order ?? 0,
    actionIndex: item.action_order ?? 0,
    state: mapStatus(item.status),
    retryCount: item.retry_count ?? 0,
    startedAt: item.status === 'running' || item.status === 'completed' 
      ? item.updated_at.toISOString() 
      : undefined,
    completedAt: item.status === 'completed' 
      ? item.updated_at.toISOString() 
      : undefined,
  }));
}

/**
 * Get current position from running state
 */
function getCurrentPosition(
  runningState: OldRunningState | null,
  steps: StepStatus[]
): { roleIndex: number; actionIndex: number } | null {
  if (!runningState?.current_role || !runningState?.current_action) {
    // Find first pending or running step
    const currentStep = steps.find(s => s.state === StepState.RUNNING || s.state === StepState.PENDING);
    if (currentStep) {
      return {
        roleIndex: currentStep.roleIndex,
        actionIndex: currentStep.actionIndex,
      };
    }
    return null;
  }

  const step = steps.find(
    s => s.role === runningState.current_role && s.action === runningState.current_action
  );

  if (step) {
    return {
      roleIndex: step.roleIndex,
      actionIndex: step.actionIndex,
    };
  }

  return null;
}

/**
 * Get pending confirmation from running state
 */
function getPendingConfirmation(
  runningState: OldRunningState | null
): any | null {
  if (!runningState?.requires_confirmation || !runningState?.confirmation_role) {
    return null;
  }

  return {
    role: runningState.confirmation_role,
    action: runningState.current_action || '',
    content: '',
    outputFiles: [],
    createdAt: runningState.updated_at.toISOString(),
  };
}

/**
 * Migrate a single project
 */
async function migrateProject(
  projectId: string,
  workflowConfig: any
): Promise<boolean> {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Check if already migrated
    const existingResult = await client.query(
      'SELECT id FROM workflow_executions WHERE project_id = $1',
      [projectId]
    );

    if (existingResult.rows.length > 0) {
      logger.info(`Project ${projectId} already migrated, skipping`);
      await client.query('ROLLBACK');
      return false;
    }

    // Get old workflow items
    const itemsResult = await client.query<OldWorkflowItem>(
      `SELECT * FROM interactive_session_workflows 
       WHERE project_id = $1 
       ORDER BY role_order ASC NULLS LAST, action_order ASC NULLS LAST`,
      [projectId]
    );

    // Get old running state
    const runningStateResult = await client.query<OldRunningState>(
      `SELECT * FROM interactive_session_running_state WHERE project_id = $1`,
      [projectId]
    );

    const items = itemsResult.rows;
    const runningState = runningStateResult.rows[0] || null;

    if (items.length === 0) {
      logger.info(`Project ${projectId} has no workflow items, skipping`);
      await client.query('ROLLBACK');
      return false;
    }

    // Convert to new format
    const steps = convertToSteps(items);
    const state = determineWorkflowState(items, runningState);
    const currentPosition = getCurrentPosition(runningState, steps);
    const pendingConfirmation = getPendingConfirmation(runningState);

    // Insert into new table
    await client.query(
      `INSERT INTO workflow_executions (
        project_id, workflow_snapshot, state, current_position,
        steps, pending_confirmation, last_error, execution_context, version
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        projectId,
        JSON.stringify(workflowConfig),
        state,
        currentPosition ? JSON.stringify(currentPosition) : null,
        JSON.stringify(steps),
        pendingConfirmation ? JSON.stringify(pendingConfirmation) : null,
        null,
        JSON.stringify({}),
        0,
      ]
    );

    await client.query('COMMIT');

    logger.info(`Migrated project ${projectId}`, {
      stepsCount: steps.length,
      state,
      hasPosition: !!currentPosition,
      hasConfirmation: !!pendingConfirmation,
    });

    return true;
  } catch (error: any) {
    await client.query('ROLLBACK');
    logger.error(`Failed to migrate project ${projectId}`, { error: error.message });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Main migration function
 */
async function migrate(): Promise<void> {
  logger.info('Starting migration to workflow_executions table');

  await connectDatabase();

  try {
    // First, ensure the new table exists
    const tableCheck = await query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'workflow_executions'
      )`
    );

    if (!tableCheck.rows[0].exists) {
      logger.error('workflow_executions table does not exist. Please run the SQL migration first.');
      logger.info('Run: psql -f src/database/migrations/011_workflow_executions.sql');
      return;
    }

    // Get all projects that have workflow data
    const projectsResult = await query<ProjectWithWorkflow>(`
      SELECT DISTINCT 
        isw.project_id,
        aw.id as workflow_id,
        aw.workflow_config
      FROM interactive_session_workflows isw
      LEFT JOIN projects p ON isw.project_id = p.id
      LEFT JOIN application_workflows aw ON p.application_id = aw.application_id AND aw.is_default = true
      WHERE p.deleted_at IS NULL
    `);

    logger.info(`Found ${projectsResult.rows.length} projects to migrate`);

    let migrated = 0;
    let skipped = 0;
    let failed = 0;

    // Default workflow config for projects without one
    const defaultWorkflowConfig = {
      roles: [
        { profile: 'Salesperson', order: 0, actions: ['WriteMRD', 'MRDReview', 'ImproveMRD'] },
        { profile: 'ProductManager', order: 1, actions: ['WritePRD', 'PRDReview', 'ImprovePRD'] },
        { profile: 'Architect', order: 2, actions: ['WriteDesign', 'DesignReview', 'ImproveDesign'] },
        { profile: 'ProjectManager', order: 3, actions: ['BreakdownTasks'] },
        { profile: 'Engineer', order: 4, actions: ['WriteCode'] },
        { profile: 'QAEngineer', order: 5, actions: ['TestabilityReview', 'WriteTestPlan', 'WriteTest', 'TestCaseReview', 'AutomationPlanning', 'AutomationExecution', 'CoverageQualityCheck', 'QAConclusion'] },
      ],
    };

    for (const project of projectsResult.rows) {
      try {
        const workflowConfig = project.workflow_config || defaultWorkflowConfig;
        const result = await migrateProject(project.project_id, workflowConfig);

        if (result) {
          migrated++;
        } else {
          skipped++;
        }
      } catch (error: any) {
        logger.error(`Failed to migrate project ${project.project_id}`, { error: error.message });
        failed++;
      }
    }

    logger.info('Migration completed', {
      total: projectsResult.rows.length,
      migrated,
      skipped,
      failed,
    });

  } catch (error: any) {
    logger.error('Migration failed', { error: error.message });
    throw error;
  } finally {
    await disconnectDatabase();
  }
}

/**
 * Verify migration
 */
async function verify(): Promise<void> {
  logger.info('Verifying migration');

  await connectDatabase();

  try {
    // Count records in old and new tables
    const oldCount = await query<{ count: number }>(
      'SELECT COUNT(DISTINCT project_id) as count FROM interactive_session_workflows'
    );

    const newCount = await query<{ count: number }>(
      'SELECT COUNT(*) as count FROM workflow_executions'
    );

    logger.info('Migration verification', {
      oldTableProjects: oldCount.rows[0].count,
      newTableRecords: newCount.rows[0].count,
    });

    // Check for any inconsistencies
    const inconsistent = await query(`
      SELECT project_id 
      FROM interactive_session_workflows 
      WHERE project_id NOT IN (SELECT project_id FROM workflow_executions)
      GROUP BY project_id
    `);

    if (inconsistent.rows.length > 0) {
      logger.warn('Found projects not migrated', {
        count: inconsistent.rows.length,
        projectIds: inconsistent.rows.map(r => r.project_id),
      });
    } else {
      logger.info('All projects migrated successfully');
    }

  } finally {
    await disconnectDatabase();
  }
}

/**
 * Rollback migration (if needed)
 */
async function rollback(): Promise<void> {
  logger.info('Rolling back migration');

  await connectDatabase();

  try {
    await query('DELETE FROM workflow_executions');
    logger.info('Rollback completed - workflow_executions table cleared');
  } finally {
    await disconnectDatabase();
  }
}

// CLI interface
const command = process.argv[2];

switch (command) {
  case 'migrate':
    migrate().catch(console.error);
    break;
  case 'verify':
    verify().catch(console.error);
    break;
  case 'rollback':
    rollback().catch(console.error);
    break;
  default:
    console.log('Usage: npx ts-node migrate_to_workflow_executions.ts [migrate|verify|rollback]');
    console.log('');
    console.log('Commands:');
    console.log('  migrate   - Migrate data from old tables to workflow_executions');
    console.log('  verify    - Verify the migration');
    console.log('  rollback  - Clear the workflow_executions table');
}
