/**
 * Project API Routes
 */

import { Router } from 'express';
import { ProjectController } from '../controllers/ProjectController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// All routes require authentication (in real app)
// For MVP, auth is optional

router.post('/', ProjectController.create);
router.post('/:id/start', ProjectController.start);
router.get('/:id', ProjectController.getStatus);
router.get('/:id/messages', ProjectController.getMessages);
router.get('/:id/documents', ProjectController.getDocuments);
router.get('/', ProjectController.list);

export default router;

