/**
 * Workflow Execution Routes
 * API routes for the new unified workflow state management system
 */

import { Router, type Router as RouterType } from 'express';
import { WorkflowExecutionController } from '../controllers/WorkflowExecutionController';

const router: RouterType = Router();

/**
 * Workflow Execution Routes
 *
 * GET    /api/workflow/active                    - Get all active workflows (admin)
 * GET    /api/workflow/:projectId/state          - Get current workflow state
 * GET    /api/workflow/:projectId/execution      - Get full workflow execution record
 * GET    /api/workflow/:projectId/recovery-status - Check if recovery is needed
 * POST   /api/workflow/:projectId/start          - Start workflow execution
 * POST   /api/workflow/:projectId/confirm        - Confirm and proceed
 * POST   /api/workflow/:projectId/reset          - Reset to specific role
 * POST   /api/workflow/:projectId/pause          - Pause workflow
 * POST   /api/workflow/:projectId/resume         - Resume workflow
 * POST   /api/workflow/:projectId/retry          - Retry failed workflow
 * POST   /api/workflow/:projectId/recover        - Trigger recovery
 * DELETE /api/workflow/:projectId                - Delete workflow execution
 */

// Admin routes (no projectId)
router.get('/active', WorkflowExecutionController.getActiveWorkflows);

// State query routes
router.get('/:projectId/state', WorkflowExecutionController.getState);
router.get('/:projectId/execution', WorkflowExecutionController.getExecution);
router.get('/:projectId/recovery-status', WorkflowExecutionController.getRecoveryStatus);
router.get('/:projectId/cli-logs/stream', WorkflowExecutionController.cliLogStream);

// Lifecycle routes
router.post('/:projectId/start', WorkflowExecutionController.start);
router.post('/:projectId/confirm', WorkflowExecutionController.confirm);
router.post('/:projectId/pending-confirmation/cli-edit', WorkflowExecutionController.cliEditPendingConfirmation);
router.post('/:projectId/reset', WorkflowExecutionController.reset);
router.post('/:projectId/pause', WorkflowExecutionController.pause);
router.post('/:projectId/resume', WorkflowExecutionController.resume);
router.post('/:projectId/retry', WorkflowExecutionController.retry);
router.post('/:projectId/recover', WorkflowExecutionController.recover);

// Delete route
router.delete('/:projectId', WorkflowExecutionController.delete);

export default router;
