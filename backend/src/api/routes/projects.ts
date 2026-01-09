/**
 * Project API Routes
 */

import { Router } from 'express';
import { ProjectController } from '../controllers/ProjectController';
import { PRDController } from '../controllers/PRDController';
import { MRDController } from '../controllers/MRDController';
import { KnowledgeBaseController } from '../controllers/KnowledgeBaseController';
// import { authMiddleware } from '../middleware/auth'; // Unused

const router: Router = Router();

// All routes require authentication (in real app)
// For MVP, auth is optional

// Project routes
// List and create routes (no ID)
router.get('/', ProjectController.list);
router.post('/', ProjectController.create);

// More specific routes with additional path segments (must come before generic /:id)
router.post('/:id/start', ProjectController.start);
router.get('/:id/messages', ProjectController.getMessages);
router.get('/:id/documents', ProjectController.getDocuments);
router.get('/:id/download/:zipPath(*)', ProjectController.downloadZip);

// Generic project routes (must come after more specific routes)
router.get('/:id', ProjectController.getStatus);

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
router.get('/:id/sections/:sectionNumber/conversation', PRDController.getSectionConversation);
router.post('/:id/prds/:prdId/improve', PRDController.improvePRD);

// MRD management routes
router.post('/:id/mrd', MRDController.generateMRD);
router.get('/:id/mrds', MRDController.listMRDs);
router.get('/:id/mrds/:mrdId', MRDController.getMRD);
router.post('/:id/mrds/:mrdId/adjust-section', MRDController.adjustSection);
router.post('/:id/mrds/:mrdId/improve', MRDController.improveMRD);

// Knowledge Base routes
router.post('/:id/knowledge-base', KnowledgeBaseController.create);
router.get('/:id/knowledge-base', KnowledgeBaseController.list);
router.get('/:id/knowledge-base/:docId', KnowledgeBaseController.getById);
router.put('/:id/knowledge-base/:docId', KnowledgeBaseController.update);
router.delete('/:id/knowledge-base/:docId', KnowledgeBaseController.delete);
router.post('/:id/knowledge-base/search', KnowledgeBaseController.search);

export default router;

