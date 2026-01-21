/**
 * Application API Routes
 */

import { Router } from 'express';
import { ApplicationController } from '../controllers/ApplicationController';
import { ApplicationWorkflowController } from '../controllers/ApplicationWorkflowController';
// import { authMiddleware } from '../middleware/auth'; // Unused

const router: Router = Router();

// All routes require authentication (in real app)
// For MVP, auth is optional

// Application routes
router.post('/', ApplicationController.create);
router.get('/', ApplicationController.list);
router.get('/:id', ApplicationController.getById);
router.put('/:id', ApplicationController.update);
router.delete('/:id', ApplicationController.delete);
router.get('/:id/projects', ApplicationController.getProjects);

// Application workflow routes
router.get('/:applicationId/workflows', ApplicationWorkflowController.getWorkflows);
router.get('/:applicationId/workflows/default', ApplicationWorkflowController.getDefaultWorkflow);
router.post('/:applicationId/workflows', ApplicationWorkflowController.createWorkflow);
router.put('/:applicationId/workflows/:workflowId', ApplicationWorkflowController.updateWorkflow);
router.delete('/:applicationId/workflows/:workflowId', ApplicationWorkflowController.deleteWorkflow);
router.post('/:applicationId/workflows/:workflowId/set-default', ApplicationWorkflowController.setDefaultWorkflow);

export default router;

