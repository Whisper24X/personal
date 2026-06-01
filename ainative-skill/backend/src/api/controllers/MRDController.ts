/**
 * MRD Controller
 * Handles MRD-related HTTP requests including generation, versioning, and deletion
 */

import { Request, Response } from 'express';
import { DocumentRepository } from '../../database/repositories/DocumentRepository';
import { ProjectRepository } from '../../database/repositories/ProjectRepository';
import { WriteMRD } from '../../actions/WriteMRD';
import { ImproveMRD } from '../../actions/ImproveMRD';
import { MRDReview } from '../../actions/MRDReview';
import { Context } from '../../core/context/Context';
import { SectionAdjustService } from '../../services/SectionAdjustService';
import { WorkspaceManager } from '../../utils/WorkspaceManager';
import { logger } from '../../utils';

const documentRepo = new DocumentRepository();
const projectRepo = new ProjectRepository();

export class MRDController {
  /**
   * Generate MRD (new or update)
   * POST /api/projects/:id/mrd
   */
  static async generateMRD(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { requirements, mode = 'new' } = req.body;

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

      logger.info(`MRDController: Generating MRD for project ${id}`, {
        mode,
        applicationId: project.application_id,
        requirementsLength: requirements.length,
      });

      // Create context and WriteMRD action
      const ctx = new Context();
      // Note: req.user would be set by auth middleware if authentication is enabled
      // For now, we'll get userId from request body or headers if available
      const userId = (req as any).user?.id || (req as any).userId || req.headers['x-user-id'];
      if (userId) {
        ctx.set('userId', userId as string);
      }
      const writeMRDAction = new WriteMRD();
      // Set LLM from context
      writeMRDAction.setLLM(ctx.llm);
      writeMRDAction.setContext(ctx);

      // Get application ID for workspace directory
      const applicationId = project.application_id || project.id;
      let mrdContent: string;
      let parentId: string | undefined;

      if (mode === 'update') {
        // Update mode: retrieve history MRD and generate updated version
        const latestMRD = await documentRepo.findLatestMRD(id);

        if (!latestMRD) {
          return res.status(404).json({
            error: 'No existing MRD found. Use mode="new" to create the first MRD.',
          });
        }

        parentId = latestMRD.id;

        // Standard update mode
        const result = await writeMRDAction.run(requirements, {
          mode: 'update',
          historyMRD: latestMRD.content,
          applicationId,
          // version property deprecated, using versionId in WorkspaceOptions
        });
        mrdContent = result.content;
      } else {
        // New mode: generate new MRD
        // Standard new mode
        const result = await writeMRDAction.run(requirements, {
          mode: 'new',
          applicationId,
          // version property deprecated, using versionId in WorkspaceOptions
        });
        mrdContent = result.content;
      }

      // Get version number for metadata
      let versionNumber: number | undefined;
      if (parentId) {
        const parentDoc = await documentRepo.findById(parentId);
        versionNumber = parentDoc?.version || 1;
      }

      // Save MRD to database
      const savedDoc = await documentRepo.create({
        projectId: id,
        filename: 'MRD.md',
        docType: 'mrd' as any,
        content: mrdContent,
        metadata: {
          mode,
          applicationId,
          version: versionNumber,
        },
      });

      // If update mode, set parent relationship
      if (parentId) {
        await documentRepo.updateParent(savedDoc.id, parentId);
      }

      logger.info(`MRDController: MRD generated and saved for project ${id}`, {
        documentId: savedDoc.id,
        version: savedDoc.version,
        contentLength: mrdContent.length,
      });

      return res.status(200).json({
        success: true,
        document: {
          id: savedDoc.id,
          filename: savedDoc.filename,
          docType: savedDoc.doc_type,
          version: savedDoc.version,
          createdAt: savedDoc.created_at,
        },
        content: mrdContent,
      });
    } catch (error: any) {
      logger.error(`MRDController: Failed to generate MRD for project ${req.params.id}:`, error);
      return res.status(500).json({
        error: 'Failed to generate MRD',
        message: error.message,
      });
    }
  }

  /**
   * List all MRDs for a project
   * GET /api/projects/:id/mrds
   */
  static async listMRDs(req: Request, res: Response) {
    try {
      const { id } = req.params;

      // Verify project exists
      const project = await projectRepo.findById(id);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const mrds = await documentRepo.findMRDsByProject(id, false);

      logger.info(`MRDController: Listed ${mrds.length} MRDs for project ${id}`);

      // 为每个 MRD 尝试从 workspace 读取内容
      const documents = await Promise.all(
        mrds.map(async (mrd) => {
          let content = mrd.content;

          // 优先从 workspace 读取 MRD.md 文件
          try {
            const metadata = mrd.metadata as any;
            const applicationId = metadata?.applicationId || project.application_id || project.id;
            const projectId = project.id;

            const workspaceContent = await WorkspaceManager.readFile('MRD.md', {
              applicationId,
              projectId,
              documentType: 'MRD',
            });

            if (workspaceContent) {
              content = workspaceContent;
            }
          } catch (error: any) {
            // 如果读取失败，使用数据库中的内容
            logger.debug(`MRDController: Failed to read MRD.md from workspace for MRD ${mrd.id}, using database content`);
          }

          return {
            id: mrd.id,
            version: mrd.version || 1,
            filename: mrd.filename,
            content: content,
            docType: mrd.doc_type,
            createdAt: mrd.created_at,
            parentId: mrd.parent_id,
          };
        })
      );

      return res.status(200).json({
        success: true,
        documents: documents,
      });
    } catch (error: any) {
      logger.error(`MRDController: Failed to list MRDs for project ${req.params.id}:`, error);
      return res.status(500).json({
        error: 'Failed to list MRDs',
        message: error.message,
      });
    }
  }

  /**
   * Get a specific MRD by ID
   * GET /api/projects/:id/mrds/:mrdId
   */
  static async getMRD(req: Request, res: Response) {
    try {
      const { id, mrdId } = req.params;

      // Verify project exists
      const project = await projectRepo.findById(id);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const mrd = await documentRepo.findById(mrdId);

      if (!mrd || mrd.project_id !== id || mrd.doc_type !== 'mrd') {
        return res.status(404).json({ error: 'MRD not found' });
      }

      // 优先从 workspace 读取 MRD.md 文件
      let content = mrd.content;
      try {
        const metadata = mrd.metadata as any;
        const applicationId = metadata?.applicationId || project.application_id || project.id;
        const projectId = project.id;

        // 尝试从 workspace 读取 MRD.md 文件
        const workspaceContent = await WorkspaceManager.readFile('MRD.md', {
          applicationId,
          projectId,
          documentType: 'MRD',
        });

        if (workspaceContent) {
          content = workspaceContent;
          logger.info(`MRDController: Loaded MRD content from workspace for MRD ${mrdId}`, {
            applicationId,
            projectId,
          });
        } else {
          logger.debug(`MRDController: MRD.md not found in workspace, using database content for MRD ${mrdId}`);
        }
      } catch (error: any) {
        logger.warn(`MRDController: Failed to read MRD.md from workspace, using database content:`, {
          error: error.message,
          mrdId,
        });
        // 如果读取失败，使用数据库中的内容
      }

      return res.status(200).json({
        success: true,
        document: {
          id: mrd.id,
          filename: mrd.filename,
          docType: mrd.doc_type,
          version: mrd.version,
          content: content,
          createdAt: mrd.created_at,
        },
      });
    } catch (error: any) {
      logger.error(`MRDController: Failed to get MRD ${req.params.mrdId}:`, error);
      return res.status(500).json({
        error: 'Failed to get MRD',
        message: error.message,
      });
    }
  }

  /**
   * Adjust a section of MRD
   * POST /api/projects/:id/mrds/:mrdId/adjust-section
   */
  static async adjustSection(req: Request, res: Response) {
    try {
      const { id, mrdId } = req.params;
      const { sectionNumber, userRequest, applicationId, version } = req.body;

      if (!sectionNumber || typeof sectionNumber !== 'number') {
        return res.status(400).json({
          error: 'Missing or invalid sectionNumber field',
        });
      }

      if (!userRequest || typeof userRequest !== 'string') {
        return res.status(400).json({
          error: 'Missing or invalid userRequest field',
        });
      }

      // Verify project exists
      const project = await projectRepo.findById(id);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Verify MRD exists
      const mrd = await documentRepo.findById(mrdId);
      if (!mrd || mrd.project_id !== id || mrd.doc_type !== 'mrd') {
        return res.status(404).json({ error: 'MRD not found' });
      }

      logger.info(`MRDController: Adjusting section ${sectionNumber} of MRD ${mrdId}`);

      const sectionAdjustService = new SectionAdjustService();
      const result = await sectionAdjustService.adjustSection({
        projectId: id,
        prdId: mrdId,
        sectionNumber,
        userRequest,
        applicationId: applicationId || project.application_id || project.id,
        projectIdForWorkspace: project.id,
        version: version || mrd.version || 1,
        documentType: 'MRD',
      });

      if (!result.success) {
        return res.status(500).json({
          error: 'Failed to adjust section',
          message: 'Unknown error',
        });
      }

      return res.status(200).json({
        success: true,
        updatedContent: result.updatedContent,
        sectionContent: result.sectionContent,
      });
    } catch (error: any) {
      logger.error(`MRDController: Failed to adjust section of MRD ${req.params.mrdId}:`, error);
      return res.status(500).json({
        error: 'Failed to adjust section',
        message: error.message,
      });
    }
  }

  /**
   * Review MRD document
   * POST /api/projects/:id/mrds/:mrdId/review
   */
  static async reviewMRD(req: Request, res: Response) {
    try {
      const { id, mrdId } = req.params;
      const { applicationId, version, mrdContent } = req.body;

      // Verify project exists
      const project = await projectRepo.findById(id);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Verify MRD exists
      const mrd = await documentRepo.findById(mrdId);
      if (!mrd || mrd.project_id !== id || mrd.doc_type !== 'mrd') {
        return res.status(404).json({ error: 'MRD not found' });
      }

      logger.info(`MRDController: Reviewing MRD ${mrdId}`, {
        projectId: id,
        hasContent: !!mrdContent,
      });

      // Create context and MRDReview action
      const ctx = new Context();
      // Note: req.user would be set by auth middleware if authentication is enabled
      const userId = (req as any).user?.id || (req as any).userId || req.headers['x-user-id'];
      if (userId) {
        ctx.set('userId', userId as string);
      }
      const reviewAction = new MRDReview();
      reviewAction.setLLM(ctx.llm);
      reviewAction.setContext(ctx);

      // Determine application ID and version
      const appId = applicationId || project.application_id || project.id;
      const projId = project.id;
      const ver = version || mrd.version || 1;

      // Get MRD content - prefer provided content, then workspace, then database
      let contentToReview = mrdContent;
      if (!contentToReview) {
        // Try to read from workspace first
        try {
          const workspaceContent = await WorkspaceManager.readFile('MRD.md', {
            applicationId: appId,
            projectId: projId,
            version: ver,
            documentType: 'MRD',
          });
          if (workspaceContent) {
            contentToReview = workspaceContent;
            logger.info(`MRDController: Loaded MRD content from workspace for review`, {
              applicationId: appId,
              version: ver,
            });
          }
        } catch (error: any) {
          logger.debug(`MRDController: Failed to read MRD.md from workspace, using database content`);
        }
      }

      // Fallback to database content if workspace read failed
      if (!contentToReview) {
        contentToReview = mrd.content;
      }

      // Run review action
      const result = await reviewAction.run(contentToReview, {
        applicationId: appId,
        projectId: projId,
        version: ver,
      });

      logger.info(`MRDController: MRD review completed successfully`, {
        projectId: id,
        mrdId,
        reviewLength: result.content.length,
      });

      return res.status(200).json({
        success: true,
        review: {
          content: result.content,
          filename: result.data?.filename || 'MRD_REVIEW.md',
          type: result.data?.type || 'mrd_review',
          timestamp: result.data?.timestamp || new Date().toISOString(),
          workspaceDir: result.data?.workspaceDir,
        },
      });
    } catch (error: any) {
      logger.error('MRDController: Failed to review MRD:', error);
      return res.status(500).json({
        error: 'Failed to review MRD',
        message: error.message,
      });
    }
  }

  /**
   * Improve MRD based on review report
   * POST /api/projects/:id/mrds/:mrdId/improve
   */
  static async improveMRD(req: Request, res: Response) {
    try {
      const { id, mrdId } = req.params;
      const { reviewReport, applicationId, version } = req.body;

      // Verify project exists
      const project = await projectRepo.findById(id);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Verify MRD exists
      const mrd = await documentRepo.findById(mrdId);
      if (!mrd || mrd.project_id !== id || mrd.doc_type !== 'mrd') {
        return res.status(404).json({ error: 'MRD not found' });
      }

      logger.info(`MRDController: Improving MRD ${mrdId}`, {
        projectId: id,
        hasReviewReport: !!reviewReport,
      });

      // Create context and ImproveMRD action
      const ctx = new Context();
      const improveAction = new ImproveMRD();
      improveAction.setLLM(ctx.llm);
      improveAction.setContext(ctx);

      // Determine application ID and version
      const appId = applicationId || project.application_id || project.id;
      const projId = project.id;
      const ver = version || mrd.version || 1;

      // Run improve action
      // If reviewReport is provided, use it; otherwise, the action will try to read from workspace
      const input = reviewReport || '';
      const result = await improveAction.run(input, {
        reviewReport: reviewReport,
        applicationId: appId,
        projectId: projId,
        version: ver,
      });

      // Create a new MRD version with improved content
      // Save improved MRD to database
      const savedDoc = await documentRepo.create({
        projectId: id,
        filename: 'MRD.md',
        docType: 'mrd' as any,
        content: result.content,
        metadata: {
          applicationId: appId,
          // version property deprecated, using versionId in WorkspaceOptions
          improved: true,
          originalLength: result.data?.originalLength,
          improvedLength: result.content.length,
        },
      });

      // Set parent relationship to maintain version history
      await documentRepo.updateParent(savedDoc.id, mrdId);

      logger.info(`MRDController: MRD improved successfully`, {
        projectId: id,
        documentId: savedDoc.id,
        parentId: mrdId,
        version: savedDoc.version,
        improvedLength: result.content.length,
      });

      return res.json({
        success: true,
        document: {
          id: savedDoc.id,
          version: savedDoc.version,
          content: result.content,
          filename: savedDoc.filename,
          docType: savedDoc.doc_type,
          createdAt: savedDoc.created_at,
          parentId: savedDoc.parent_id,
          improvedLength: result.content.length,
          originalLength: result.data?.originalLength,
        },
      });
    } catch (error: any) {
      logger.error('MRDController: Failed to improve MRD:', error);
      return res.status(500).json({
        error: 'Failed to improve MRD',
        message: error.message,
      });
    }
  }
}

export default MRDController;
