/**
 * Application API Routes
 */

import { Router } from 'express';
import { ApplicationController } from '../controllers/ApplicationController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// All routes require authentication (in real app)
// For MVP, auth is optional

// Application routes
router.post('/', ApplicationController.create);
router.get('/', ApplicationController.list);
router.get('/:id', ApplicationController.getById);
router.put('/:id', ApplicationController.update);
router.delete('/:id', ApplicationController.delete);
router.get('/:id/projects', ApplicationController.getProjects);

export default router;

