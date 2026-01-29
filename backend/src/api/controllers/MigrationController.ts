/**
 * Migration Controller
 * Handles workflow configuration migration requests
 */

import { Request, Response } from 'express';
import { logger } from '../../utils';
import { migrateWorkflowConfigs, MigrationResult } from '../../database/migrations/migrate_workflow_config_from_default';

export class MigrationController {
  /**
   * Execute workflow configuration migration
   * POST /api/config/migrate-workflow
   */
  static async migrate(_req: Request, res: Response) {
    try {
      logger.info('MigrationController: Starting workflow configuration migration');

      // Execute migration
      const result: MigrationResult = await migrateWorkflowConfigs();

      if (!result.success) {
        logger.error('MigrationController: Migration failed', { error: result.error });
        return res.status(500).json({
          success: false,
          message: 'Migration failed',
          error: result.error,
          data: {
            workflowsUpdated: result.workflowsUpdated,
            executionsUpdated: result.executionsUpdated,
            snapshotsUpdated: result.snapshotsUpdated,
            stepsUpdated: result.stepsUpdated,
            positionsUpdated: result.positionsUpdated,
            changes: result.workflowDiffs,
          },
        });
      }

      logger.info('MigrationController: Migration completed successfully', {
        workflowsUpdated: result.workflowsUpdated,
        executionsUpdated: result.executionsUpdated,
      });

      return res.json({
        success: true,
        message: 'Migration completed successfully',
        data: {
          workflowsChecked: result.workflowsChecked,
          workflowsUpdated: result.workflowsUpdated,
          executionsChecked: result.executionsChecked,
          executionsUpdated: result.executionsUpdated,
          snapshotsUpdated: result.snapshotsUpdated,
          stepsUpdated: result.stepsUpdated,
          positionsUpdated: result.positionsUpdated,
          changes: result.workflowDiffs,
        },
      });
    } catch (error: any) {
      logger.error('MigrationController: Migration error', { error: error.message, stack: error.stack });
      return res.status(500).json({
        success: false,
        message: 'Migration failed',
        error: error.message || 'Unknown error',
      });
    }
  }
}
