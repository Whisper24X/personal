/**
 * Project API Routes
 */

import { Router } from 'express';
import { ProjectController } from '../controllers/ProjectController';
import { PRDController } from '../controllers/PRDController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// All routes require authentication (in real app)
// For MVP, auth is optional

// Project routes
router.post('/', ProjectController.create);
router.post('/:id/start', ProjectController.start);
router.get('/:id', ProjectController.getStatus);
router.get('/:id/messages', ProjectController.getMessages);
router.get('/:id/documents', ProjectController.getDocuments);
router.get('/:id/download/:zipPath(*)', ProjectController.downloadZip);
router.get('/', ProjectController.list);

// PRD management routes
router.post('/:id/prd', PRDController.generatePRD);
router.get('/:id/prds', PRDController.listPRDs);
router.get('/:id/prds/versions', PRDController.getPRDVersions);
router.get('/:id/prds/:prdId', PRDController.getPRD);
router.delete('/:id/prds/:prdId', PRDController.deletePRD);
router.post('/:id/prds/:prdId/restore', PRDController.restorePRD);
router.get('/:id/prds/:prdId/sections', PRDController.getPRDSections);
router.post('/:id/prds/:prdId/sections/:sectionNumber/adjust', PRDController.adjustPRDSection);
router.post('/:id/sections/:sectionNumber/adjust', PRDController.adjustSectionFromWorkspace);

export default router;

