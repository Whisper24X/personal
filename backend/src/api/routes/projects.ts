/**
 * Project API Routes
 */

import { Router } from 'express';
import multer from 'multer';
import { ProjectController } from '../controllers/ProjectController';
import { ProjectVersionController } from '../controllers/ProjectVersionController';
import { PRDController } from '../controllers/PRDController';
import { MRDController } from '../controllers/MRDController';
import { KnowledgeBaseController } from '../controllers/KnowledgeBaseController';
import { KnowledgeUploadController } from '../controllers/KnowledgeUploadController';
import { RoleActionExecutionController } from '../controllers/RoleActionExecutionController';
// import { authMiddleware } from '../middleware/auth'; // Unused

const router: Router = Router();

// Configure multer for file upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (_req, file, cb) => {
    // Only allow .md files
    if (file.originalname.endsWith('.md')) {
      cb(null, true);
    } else {
      cb(new Error('Only .md files are allowed'));
    }
  },
});

// All routes require authentication (in real app)
// For MVP, auth is optional

// Project routes
// List and create routes (no ID)
router.get('/', ProjectController.list);
router.post('/', ProjectController.create);

// More specific routes with additional path segments (must come before generic /:id)
router.get('/:id/messages', ProjectController.getMessages);
router.get('/:id/documents', ProjectController.getDocuments);
router.get('/:id/download/code', ProjectController.downloadCode);
router.get('/:id/download/docs', ProjectController.downloadDocs);
router.get('/:id/download/:zipPath(*)', ProjectController.downloadZip);

// Version management routes (must come before generic /:id)
router.post('/:id/versions', ProjectVersionController.create);
router.get('/:id/versions', ProjectVersionController.list);
router.get('/:id/versions/active', ProjectVersionController.getActive);
router.get('/:id/versions/:versionId', ProjectVersionController.getById);
router.put('/:id/versions/:versionId', ProjectVersionController.update);
router.delete('/:id/versions/:versionId', ProjectVersionController.delete);
router.post('/:id/versions/:versionId/activate', ProjectVersionController.activate);
router.get('/:id/branches', ProjectVersionController.getBranches);
router.post('/:id/versions/:versionId/improve-suggestion', ProjectController.saveImproveSuggestion);
router.get('/:id/versions/:versionId/prototype/preview', PRDController.previewPrototypeByVersion);

// Version review routes (must come before generic /:id)
router.post('/:id/versions/:versionId/review/start', ProjectVersionController.startReview);
router.get('/:id/versions/:versionId/review/status', ProjectVersionController.getReviewStatus);
router.post('/:id/versions/:versionId/review/answer', ProjectVersionController.submitAnswer);
router.post('/:id/versions/:versionId/review/continue', ProjectVersionController.continueReview);

// Generic project routes (must come after more specific routes)
router.get('/:id', ProjectController.getStatus);
router.delete('/:id', ProjectController.delete);

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
router.get('/:id/prds/:prdId/prototype', PRDController.getPrototype);
router.get('/:id/prds/:prdId/prototype/preview', PRDController.previewPrototype);
router.get('/:id/prds/:prdId/prototype/:filename', PRDController.getPrototypeFile);
router.post('/:id/prds/:prdId/prototype/generate', PRDController.generatePrototype);

// MRD management routes
router.post('/:id/mrd', MRDController.generateMRD);
router.get('/:id/mrds', MRDController.listMRDs);
router.get('/:id/mrds/:mrdId', MRDController.getMRD);
router.post('/:id/mrds/:mrdId/adjust-section', MRDController.adjustSection);
router.post('/:id/mrds/:mrdId/review', MRDController.reviewMRD);
router.post('/:id/mrds/:mrdId/improve', MRDController.improveMRD);

// Knowledge Base routes (database-backed)
router.post('/:id/knowledge-base', KnowledgeBaseController.create);
router.get('/:id/knowledge-base', KnowledgeBaseController.list);
router.get('/:id/knowledge-base/:docId', KnowledgeBaseController.getById);
router.put('/:id/knowledge-base/:docId', KnowledgeBaseController.update);
router.delete('/:id/knowledge-base/:docId', KnowledgeBaseController.delete);
router.post('/:id/knowledge-base/search', KnowledgeBaseController.search);

// Knowledge File Upload routes (file-based, for CLI knowledge input)
router.post('/:id/knowledge/upload', upload.single('file'), KnowledgeUploadController.uploadFile);
router.get('/:id/knowledge/files', KnowledgeUploadController.listFiles);
router.get('/:id/knowledge/files/:filename', KnowledgeUploadController.getFile);
router.delete('/:id/knowledge/files/:filename', KnowledgeUploadController.deleteFile);

// Role Action Execution routes
router.post('/:projectId/roles/:roleProfile/actions/:actionName/execute', RoleActionExecutionController.execute);

export default router;
