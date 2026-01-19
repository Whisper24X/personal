/**
 * PRD Controller
 * Handles PRD-related HTTP requests including generation, versioning, and deletion
 */

import { Request, Response } from 'express';
import { DocumentRepository } from '../../database/repositories/DocumentRepository';
import { ProjectRepository } from '../../database/repositories/ProjectRepository';
import { WritePRD } from '../../actions/WritePRD';
import { ImprovePRD } from '../../actions/ImprovePRD';
import { Context } from '../../core/context/Context';
import { RAGService } from '../../services/RAGService';
import { SectionAdjustService } from '../../services/SectionAdjustService';
import { WorkspaceManager } from '../../utils/WorkspaceManager';
import { logger } from '../../utils';

const documentRepo = new DocumentRepository();
const projectRepo = new ProjectRepository();
const ragService = new RAGService();

// Initialize RAG service (lazy initialization)
let ragServiceInitialized = false;
async function ensureRAGServiceInitialized() {
  if (!ragServiceInitialized) {
    try {
      await ragService.initialize();
      ragServiceInitialized = true;
    } catch (error: any) {
      logger.warn('PRDController: Failed to initialize RAG service', {
        error: error.message,
      });
    }
  }
}

export class PRDController {
  /**
   * Generate PRD (new or update)
   * POST /api/projects/:id/prd
   */
  static async generatePRD(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { requirements, mode = 'new', useRAG = false } = req.body;

      if (!requirements || typeof requirements !== 'string') {
        return res.status(400).json({
          error: 'Missing or invalid requirements field',
        });
      }

      // Verify project exists
      const project = await projectRepo.findById(id);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      logger.info(`PRDController: Generating PRD for project ${id}`, {
        mode,
        useRAG,
        applicationId: project.application_id,
        requirementsLength: requirements.length,
      });

      // Create context and WritePRD action
      const ctx = new Context();
      const writePRDAction = new WritePRD();
      // Set LLM from context
      writePRDAction.setLLM(ctx.llm);

      // Get application ID and project ID for workspace directory
      // 使用应用ID，如果没有则使用项目ID，防止不同应用/项目互相覆盖文件
      const applicationId = project.application_id || project.id;
      const projectId = project.id;
      let prdContent: string;
      let parentId: string | undefined;

      if (mode === 'update') {
        // Update mode: retrieve history PRD and generate updated version
        const latestPRD = await documentRepo.findLatestPRD(id);

        if (!latestPRD) {
          return res.status(404).json({
            error: 'No existing PRD found. Use mode="new" to create the first PRD.',
          });
        }

        parentId = latestPRD.id;

        if (useRAG) {
          // Ensure RAG service is initialized
          await ensureRAGServiceInitialized();

          // RAG mode: search for similar PRDs and extract relevant chunks
          // If project belongs to an application, search across all projects in the application
          let searchResults: any[] = [];

          if (project.application_id) {
            // Search across all projects in the application
            searchResults = await ragService.searchSimilarPRDsByApplication(
              project.application_id,
              requirements,
              5
            );
          }

          // If no results from application search, try project-level search
          if (searchResults.length === 0) {
            searchResults = await ragService.searchSimilarPRDs(id, requirements, 3);
          }

          if (searchResults.length > 0) {
            const relevantChunks = ragService.combinePRDResults(searchResults);
            // Get next version number
            const nextVersion = (latestPRD.version || 1) + 1;
            const result = await writePRDAction.run(requirements, {
              mode: 'update',
              useRAG: true,
              relevantChunks,
              historyPRD: latestPRD.content,
              applicationId,
              projectId,
              version: nextVersion,
            });
            prdContent = result.content;
          } else {
            // Fallback to standard update mode if no similar PRDs found
            const nextVersion = (latestPRD.version || 1) + 1;
            const result = await writePRDAction.run(requirements, {
              mode: 'update',
              historyPRD: latestPRD.content,
              applicationId,
              projectId,
              version: nextVersion,
            });
            prdContent = result.content;
          }
        } else {
          // Standard update mode: use latest PRD directly
          const nextVersion = (latestPRD.version || 1) + 1;
          const result = await writePRDAction.run(requirements, {
            mode: 'update',
            historyPRD: latestPRD.content,
            applicationId,
            version: nextVersion,
          });
          prdContent = result.content;
        }
      } else {
        // New mode: generate new PRD
        if (useRAG) {
          // Ensure RAG service is initialized
          await ensureRAGServiceInitialized();

          // RAG mode: search for similar PRDs even in new mode
          // If project belongs to an application, search across all projects in the application
          let searchResults: any[] = [];

          if (project.application_id) {
            // Search across all projects in the application
            searchResults = await ragService.searchSimilarPRDsByApplication(
              project.application_id,
              requirements,
              5
            );
          }

          // If no results from application search, try project-level search
          if (searchResults.length === 0) {
            searchResults = await ragService.searchSimilarPRDs(id, requirements, 3);
          }

          if (searchResults.length > 0) {
            const relevantChunks = ragService.combinePRDResults(searchResults);
            // Get next version number (will be created in createPRDVersion)
            const latestPRD = await documentRepo.findLatestPRD(id);
            const nextVersion = latestPRD ? (latestPRD.version || 1) + 1 : 1;
            const result = await writePRDAction.run(requirements, {
              mode: 'new',
              useRAG: true,
              relevantChunks,
              applicationId,
              projectId,
              version: nextVersion,
            });
            prdContent = result.content;
          } else {
            // Standard new mode
            const latestPRD = await documentRepo.findLatestPRD(id);
            const nextVersion = latestPRD ? (latestPRD.version || 1) + 1 : 1;
            const result = await writePRDAction.run(requirements, {
              mode: 'new',
              applicationId,
              projectId,
              version: nextVersion,
            });
            prdContent = result.content;
          }
        } else {
          // Standard new mode
          const latestPRD = await documentRepo.findLatestPRD(id);
          const nextVersion = latestPRD ? (latestPRD.version || 1) + 1 : 1;
          const result = await writePRDAction.run(requirements, {
            mode: 'new',
            applicationId,
            version: nextVersion,
          });
          prdContent = result.content;
        }
      }

      // Save as new PRD version
      const newPRD = await documentRepo.createPRDVersion(id, prdContent, parentId);

      // Index document to Qdrant for vector search
      try {
        await ensureRAGServiceInitialized();
        await ragService.indexDocuments([{
          id: newPRD.id,
          content: prdContent,
          type: 'PRD',
          projectId: id,
          version: newPRD.version,
        }]);
      } catch (error: any) {
        logger.warn('PRDController: Failed to index document to Qdrant', {
          error: error.message,
          documentId: newPRD.id,
        });
      }

      // Read all content from workspace (if stepwise generation was used)
      // The content from WritePRD already includes all files merged
      const finalContent = prdContent; // This already contains all merged content from workspace

      logger.info(`PRDController: PRD generated successfully`, {
        projectId: id,
        documentId: newPRD.id,
        version: newPRD.version,
        applicationId,
        contentLength: finalContent.length,
      });

      return res.status(201).json({
        success: true,
        prd: {
          id: newPRD.id,
          version: newPRD.version,
          content: finalContent, // Return merged content from workspace
          filename: newPRD.filename,
          createdAt: newPRD.created_at,
          parentId: newPRD.parent_id,
          workspaceDir: `workspace/${applicationId}/${projectId}/v${newPRD.version}`,
        },
      });
    } catch (error: any) {
      logger.error('PRDController: Failed to generate PRD:', error);
      return res.status(500).json({
        error: 'Failed to generate PRD',
        message: error.message,
      });
    }
  }

  /**
   * List all PRDs for a project
   * GET /api/projects/:id/prds
   */
  static async listPRDs(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const includeDeleted = req.query.includeDeleted === 'true';

      // Verify project exists
      const project = await projectRepo.findById(id);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const prds = await documentRepo.findPRDsByProject(id, includeDeleted);

      // 为每个 PRD 尝试从 workspace 读取 PRD.md 文件
      const prdList = await Promise.all(
        prds.map(async (prd) => {
          let content = prd.content;

          // 优先从 workspace 读取 PRD.md 文件
          try {
            const metadata = prd.metadata as any;
            const applicationId = metadata?.applicationId || project.application_id || project.id;
            const projectId = project.id;

            const workspaceContent = await WorkspaceManager.readFile('PRD.md', {
              applicationId,
              projectId,
              documentType: 'PRD',
            });

            if (workspaceContent) {
              content = workspaceContent;
            }
          } catch (error: any) {
            // 如果读取失败，使用数据库中的内容
            logger.debug(`PRDController: Failed to read PRD.md from workspace for PRD ${prd.id}, using database content`);
          }

          return {
            id: prd.id,
            version: prd.version || 1,
            filename: prd.filename,
            content: content,
            isDeleted: prd.is_deleted || false,
            deletedAt: prd.deleted_at,
            parentId: prd.parent_id,
            createdAt: prd.created_at,
          };
        })
      );

      return res.json({
        success: true,
        prds: prdList,
      });
    } catch (error: any) {
      logger.error('PRDController: Failed to list PRDs:', error);
      return res.status(500).json({
        error: 'Failed to list PRDs',
        message: error.message,
      });
    }
  }

  /**
   * Get specific PRD by ID
   * GET /api/projects/:id/prds/:prdId
   */
  static async getPRD(req: Request, res: Response) {
    try {
      const { id, prdId } = req.params;

      // Verify project exists
      const project = await projectRepo.findById(id);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const prd = await documentRepo.findPRDById(prdId);

      if (!prd) {
        return res.status(404).json({ error: 'PRD not found' });
      }

      // Verify PRD belongs to the project
      if (prd.project_id !== id) {
        return res.status(403).json({ error: 'PRD does not belong to this project' });
      }

      // 优先从 workspace 读取 PRD.md 文件
      let content = prd.content;
      try {
        const metadata = prd.metadata as any;
        const applicationId = metadata?.applicationId || project.application_id || project.id;
        const projectId = project.id;

        // 尝试从 workspace 读取 PRD.md 文件
        const workspaceContent = await WorkspaceManager.readFile('PRD.md', {
          applicationId,
          projectId,
          documentType: 'PRD',
        });

        if (workspaceContent) {
          content = workspaceContent;
          logger.info(`PRDController: Loaded PRD content from workspace for PRD ${prdId}`, {
            applicationId,
            projectId,
          });
        } else {
          logger.debug(`PRDController: PRD.md not found in workspace, using database content for PRD ${prdId}`);
        }
      } catch (error: any) {
        logger.warn(`PRDController: Failed to read PRD.md from workspace, using database content:`, {
          error: error.message,
          prdId,
        });
        // 如果读取失败，使用数据库中的内容
      }

      return res.json({
        success: true,
        prd: {
          id: prd.id,
          version: prd.version || 1,
          filename: prd.filename,
          content: content,
          isDeleted: prd.is_deleted || false,
          deletedAt: prd.deleted_at,
          parentId: prd.parent_id,
          createdAt: prd.created_at,
        },
      });
    } catch (error: any) {
      logger.error('PRDController: Failed to get PRD:', error);
      return res.status(500).json({
        error: 'Failed to get PRD',
        message: error.message,
      });
    }
  }

  /**
   * Get PRD version history
   * GET /api/projects/:id/prds/versions
   */
  static async getPRDVersions(req: Request, res: Response) {
    try {
      const { id } = req.params;

      // Verify project exists
      const project = await projectRepo.findById(id);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const versions = await documentRepo.getPRDVersions(id);

      return res.json({
        success: true,
        versions: versions.map((prd) => ({
          id: prd.id,
          version: prd.version || 1,
          filename: prd.filename,
          isDeleted: prd.is_deleted || false,
          deletedAt: prd.deleted_at,
          parentId: prd.parent_id,
          createdAt: prd.created_at,
        })),
      });
    } catch (error: any) {
      logger.error('PRDController: Failed to get PRD versions:', error);
      return res.status(500).json({
        error: 'Failed to get PRD versions',
        message: error.message,
      });
    }
  }

  /**
   * Soft delete PRD
   * DELETE /api/projects/:id/prds/:prdId
   */
  static async deletePRD(req: Request, res: Response) {
    try {
      const { id, prdId } = req.params;

      // Verify project exists
      const project = await projectRepo.findById(id);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const prd = await documentRepo.findPRDById(prdId);

      if (!prd) {
        return res.status(404).json({ error: 'PRD not found' });
      }

      // Verify PRD belongs to the project
      if (prd.project_id !== id) {
        return res.status(403).json({ error: 'PRD does not belong to this project' });
      }

      // Check if already deleted
      if (prd.is_deleted) {
        return res.status(400).json({ error: 'PRD is already deleted' });
      }

      const deletedPRD = await documentRepo.softDeletePRD(prdId);

      logger.info(`PRDController: PRD soft deleted`, {
        projectId: id,
        documentId: prdId,
        version: deletedPRD.version,
      });

      return res.json({
        success: true,
        message: 'PRD deleted successfully',
        prd: {
          id: deletedPRD.id,
          version: deletedPRD.version,
          deletedAt: deletedPRD.deleted_at,
        },
      });
    } catch (error: any) {
      logger.error('PRDController: Failed to delete PRD:', error);
      return res.status(500).json({
        error: 'Failed to delete PRD',
        message: error.message,
      });
    }
  }

  /**
   * Restore soft-deleted PRD
   * POST /api/projects/:id/prds/:prdId/restore
   */
  static async restorePRD(req: Request, res: Response) {
    try {
      const { id, prdId } = req.params;

      // Verify project exists
      const project = await projectRepo.findById(id);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const prd = await documentRepo.findPRDById(prdId);

      if (!prd) {
        return res.status(404).json({ error: 'PRD not found' });
      }

      // Verify PRD belongs to the project
      if (prd.project_id !== id) {
        return res.status(403).json({ error: 'PRD does not belong to this project' });
      }

      // Check if not deleted
      if (!prd.is_deleted) {
        return res.status(400).json({ error: 'PRD is not deleted' });
      }

      const restoredPRD = await documentRepo.restorePRD(prdId);

      logger.info(`PRDController: PRD restored`, {
        projectId: id,
        documentId: prdId,
        version: restoredPRD.version,
      });

      return res.json({
        success: true,
        message: 'PRD restored successfully',
        prd: {
          id: restoredPRD.id,
          version: restoredPRD.version,
          isDeleted: restoredPRD.is_deleted,
        },
      });
    } catch (error: any) {
      logger.error('PRDController: Failed to restore PRD:', error);
      return res.status(500).json({
        error: 'Failed to restore PRD',
        message: error.message,
      });
    }
  }

  /**
   * Get sections from PRD
   * GET /api/projects/:id/prds/:prdId/sections
   */
  static async getPRDSections(req: Request, res: Response) {
    try {
      const { id, prdId } = req.params;

      // Verify project exists
      const project = await projectRepo.findById(id);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const prd = await documentRepo.findPRDById(prdId);

      if (!prd) {
        return res.status(404).json({ error: 'PRD not found' });
      }

      // Verify PRD belongs to the project
      if (prd.project_id !== id) {
        return res.status(403).json({ error: 'PRD does not belong to this project' });
      }

      // Get workspace directory
      const applicationId = project.application_id || project.id;
      const projectId = project.id;
      const version = prd.version || 1;
      const { getWorkspaceDir } = await import('../../utils/StepwiseDocumentGenerator');
      const workspaceDir = getWorkspaceDir('PRD', {
        applicationId,
        projectId,
        version,
      });

      // Get sections
      const sectionAdjustService = new SectionAdjustService();
      const sections = await sectionAdjustService.getSections(prd.content, workspaceDir);

      return res.json({
        success: true,
        sections: sections.map(s => ({
          number: s.number,
          title: s.title,
          contentPreview: s.content?.substring(0, 200) || '',
        })),
      });
    } catch (error: any) {
      logger.error('PRDController: Failed to get PRD sections:', error);
      return res.status(500).json({
        error: 'Failed to get PRD sections',
        message: error.message,
      });
    }
  }

  /**
   * Adjust a specific section of PRD
   * POST /api/projects/:id/prds/:prdId/sections/:sectionNumber/adjust
   */
  static async adjustPRDSection(req: Request, res: Response) {
    try {
      const { id, prdId, sectionNumber } = req.params;
      const { userRequest } = req.body;

      if (!userRequest || typeof userRequest !== 'string') {
        return res.status(400).json({
          error: 'Missing or invalid userRequest field',
        });
      }

      const sectionNum = parseInt(sectionNumber);
      if (isNaN(sectionNum) || sectionNum < 0) {
        return res.status(400).json({
          error: 'Invalid section number',
        });
      }

      // Verify project exists
      const project = await projectRepo.findById(id);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const prd = await documentRepo.findPRDById(prdId);

      if (!prd) {
        return res.status(404).json({ error: 'PRD not found' });
      }

      // Verify PRD belongs to the project
      if (prd.project_id !== id) {
        return res.status(403).json({ error: 'PRD does not belong to this project' });
      }

      logger.info(`PRDController: Adjusting section ${sectionNum} of PRD ${prdId}`, {
        projectId: id,
        userRequestLength: userRequest.length,
      });

      // Adjust section
      const sectionAdjustService = new SectionAdjustService();
      const applicationId = project.application_id || project.id;
      const version = prd.version || 1;

      const result = await sectionAdjustService.adjustSection({
        projectId: id,
        prdId,
        sectionNumber: sectionNum,
        userRequest,
        applicationId,
        version,
      });

      // Update PRD in database if needed
      // Note: We might want to update the full PRD content in the database
      // For now, we'll just return the updated content
      // The workspace files are already updated

      logger.info(`PRDController: Section ${sectionNum} adjusted successfully`, {
        projectId: id,
        prdId,
        sectionNumber: sectionNum,
      });

      return res.json({
        success: true,
        section: {
          number: sectionNum,
          content: result.sectionContent,
        },
        updatedPRD: result.updatedContent,
        conversationHistory: result.conversationHistory,
      });
    } catch (error: any) {
      logger.error('PRDController: Failed to adjust PRD section:', error);
      return res.status(500).json({
        error: 'Failed to adjust PRD section',
        message: error.message,
      });
    }
  }

  /**
   * Adjust a section directly from workspace (for interactive sessions)
   * POST /api/projects/:id/sections/:sectionNumber/adjust
   */
  static async adjustSectionFromWorkspace(req: Request, res: Response) {
    try {
      const { id, sectionNumber } = req.params;
      const { userRequest, documentType = 'PRD', applicationId, version } = req.body;

      if (!userRequest || typeof userRequest !== 'string') {
        return res.status(400).json({
          error: 'Missing or invalid userRequest field',
        });
      }

      const sectionNum = parseInt(sectionNumber);
      if (isNaN(sectionNum) || sectionNum < 0) {
        return res.status(400).json({
          error: 'Invalid section number',
        });
      }

      // Verify project exists (or use sessionId as projectId for interactive sessions)
      let project;
      try {
        project = await projectRepo.findById(id);
      } catch {
        // If project not found, might be a sessionId - continue with workspace-only mode
        project = null;
      }

      logger.info(`PRDController: Adjusting section ${sectionNum} from workspace`, {
        projectId: id,
        documentType,
        userRequestLength: userRequest.length,
        hasProject: !!project,
      });

      // Adjust section directly from workspace
      const sectionAdjustService = new SectionAdjustService();
      
      // Determine applicationId: use provided, project's application_id, or fallback to projectId/sessionId
      // Note: 'default' is not allowed, so we use projectId/sessionId as fallback for interactive sessions
      let appId = applicationId;
      if (!appId || appId === 'default') {
        appId = project?.application_id || project?.id || id;
      }
      
      const ver = version || 1;

      // Determine document type for workspace directory
      const docType = documentType === 'MRD' ? 'MRD' : 'PRD';

      logger.info(`PRDController: Workspace directory parameters`, {
        applicationId: appId,
        projectId: id,
        projectIdForWorkspace: project?.id,
        version: ver,
        documentType: docType,
      });

      const result = await sectionAdjustService.adjustSection({
        projectId: id,
        prdId: id, // Use projectId/sessionId as prdId for workspace lookup
        sectionNumber: sectionNum,
        userRequest,
        applicationId: appId,
        projectIdForWorkspace: project?.id,
        version: ver,
        documentType: docType as 'PRD' | 'MRD',
      });

      logger.info(`PRDController: Section ${sectionNum} adjusted from workspace successfully`, {
        projectId: id,
        sectionNumber: sectionNum,
      });

      return res.json({
        success: true,
        section: {
          number: sectionNum,
          content: result.sectionContent,
        },
        updatedPRD: result.updatedContent,
        conversationHistory: result.conversationHistory,
      });
    } catch (error: any) {
      logger.error('PRDController: Failed to adjust section from workspace:', error);
      return res.status(500).json({
        error: 'Failed to adjust section',
        message: error.message,
      });
    }
  }

  /**
   * Get conversation history for a section
   * GET /api/projects/:id/sections/:sectionNumber/conversation
   */
  static async getSectionConversation(req: Request, res: Response) {
    try {
      const { id, sectionNumber } = req.params;
      const { documentType = 'PRD', applicationId, version } = req.query;

      const sectionNum = parseInt(sectionNumber);
      if (isNaN(sectionNum) || sectionNum < 0) {
        return res.status(400).json({
          error: 'Invalid section number',
        });
      }

      // Verify project exists (or use sessionId as projectId for interactive sessions)
      let project;
      try {
        project = await projectRepo.findById(id);
      } catch {
        project = null;
      }

      const { SectionAdjustService } = await import('../../services/SectionAdjustService');
      const sectionAdjustService = new SectionAdjustService();
      
      // Determine applicationId
      let appId = applicationId as string | undefined;
      if (!appId || appId === 'default') {
        appId = project?.application_id || project?.id || id;
      }
      
      const ver = version ? parseInt(version as string) : 1;
      const docType = (documentType === 'MRD' ? 'MRD' : 'PRD') as 'PRD' | 'MRD';

      // Load conversation history from database
      const { loadSectionConversationHistory } = await import('../../utils/sectionConversationHistory');
      const history = await loadSectionConversationHistory(
        id,
        sectionNum,
        docType,
        ver
      );

      return res.json({
        success: true,
        conversationHistory: history || { sectionNumber: sectionNum, messages: [], lastUpdated: new Date().toISOString() },
      });
    } catch (error: any) {
      logger.error('PRDController: Failed to get section conversation:', error);
      return res.status(500).json({
        error: 'Failed to get section conversation',
        message: error.message,
      });
    }
  }

  /**
   * Improve PRD based on review report
   * POST /api/projects/:id/prds/:prdId/improve
   */
  static async improvePRD(req: Request, res: Response) {
    try {
      const { id, prdId } = req.params;
      const { reviewReport, applicationId, version } = req.body;

      // Verify project exists
      const project = await projectRepo.findById(id);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Verify PRD exists
      const prd = await documentRepo.findPRDById(prdId);
      if (!prd) {
        return res.status(404).json({ error: 'PRD not found' });
      }

      // Verify PRD belongs to the project
      if (prd.project_id !== id) {
        return res.status(403).json({ error: 'PRD does not belong to this project' });
      }

      logger.info(`PRDController: Improving PRD ${prdId}`, {
        projectId: id,
        hasReviewReport: !!reviewReport,
      });

      // Create context and ImprovePRD action
      const ctx = new Context();
      const improveAction = new ImprovePRD();
      improveAction.setLLM(ctx.llm);
      improveAction.setContext(ctx);

      // Determine application ID and version
      const appId = applicationId || project.application_id || project.id;
      const projId = project.id;
      const ver = version || prd.version || 1;

      // Run improve action
      // If reviewReport is provided, use it; otherwise, the action will try to read from workspace
      const input = reviewReport || '';
      const result = await improveAction.run(input, {
        reviewReport: reviewReport,
        applicationId: appId,
        projectId: projId,
        version: ver,
      });

      // Create a new PRD version with improved content
      // Use the current PRD as parent to maintain version history
      const newPRD = await documentRepo.createPRDVersion(id, result.content, prdId);

      logger.info(`PRDController: PRD improved successfully`, {
        projectId: id,
        documentId: newPRD.id,
        parentId: prdId,
        version: newPRD.version,
        improvedLength: result.content.length,
      });

      return res.json({
        success: true,
        prd: {
          id: newPRD.id,
          version: newPRD.version,
          content: result.content,
          filename: newPRD.filename,
          createdAt: newPRD.created_at,
          parentId: newPRD.parent_id,
          improvedLength: result.content.length,
          originalLength: result.data?.originalLength,
        },
      });
    } catch (error: any) {
      logger.error('PRDController: Failed to improve PRD:', error);
      return res.status(500).json({
        error: 'Failed to improve PRD',
        message: error.message,
      });
    }
  }
}

export default PRDController;
