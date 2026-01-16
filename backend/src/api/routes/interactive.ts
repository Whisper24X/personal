/**
 * Interactive Session API Routes
 */

import { Router } from 'express';
import { InteractiveController } from '../controllers/InteractiveController';

const router: Router = Router();

// List all interactive sessions
router.get('/interactive', InteractiveController.list);

// Create a new interactive session
router.post('/interactive', InteractiveController.create);

// Get manager stats
router.get('/interactive-stats', InteractiveController.getStats);

// Poll for new messages (for polling mechanism)
router.get('/interactive/:projectId/poll', InteractiveController.poll);

// Send user action (for polling mechanism)
router.post('/interactive/:projectId/action', InteractiveController.action);

// Get workflow information (all roles and their actions)
router.get('/interactive/:projectId/workflow', InteractiveController.getWorkflow);

// Get current running role and action
router.get('/interactive/:projectId/running', InteractiveController.getRunning);

// Confirm role completion and allow proceeding to next role
router.post('/interactive/:projectId/confirm', InteractiveController.confirm);

// Reset workflow from a specific role
router.post('/interactive/:projectId/reset-workflow', InteractiveController.resetWorkflow);

// Recover from stale or failed actions
router.post('/interactive/:projectId/recover', InteractiveController.recoverFromStaleActions);

// Get session info
router.get('/interactive/:projectId', InteractiveController.getSession);

// Delete session
router.delete('/interactive/:projectId', InteractiveController.delete);

export default router;

