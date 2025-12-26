/**
 * PRD Controller
 * Handles PRD-related HTTP requests including generation, versioning, and deletion
 */

import { Request, Response } from 'express';
import { DocumentRepository } from '../../database/repositories/DocumentRepository';
import { ProjectRepository } from '../../database/repositories/ProjectRepository';
import { WritePRD } from '../../actions/WritePRD';
import { Context } from '../../core/context/Context';
import { RAGService } from '../../services/RAGService';
import { logger } from '../../utils';

const documentRepo = new DocumentRepository();
const projectRepo = new ProjectRepository();
const ragService = new RAGService();

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
            const result = await writePRDAction.run(requirements, {
              mode: 'update',
              useRAG: true,
              relevantChunks,
              historyPRD: latestPRD.content,
            });
            prdContent = result.content;
          } else {
            // Fallback to standard update mode if no similar PRDs found
            const result = await writePRDAction.run(requirements, {
              mode: 'update',
              historyPRD: latestPRD.content,
            });
            prdContent = result.content;
          }
        } else {
          // Standard update mode: use latest PRD directly
          const result = await writePRDAction.run(requirements, {
            mode: 'update',
            historyPRD: latestPRD.content,
          });
          prdContent = result.content;
        }
      } else {
        // New mode: generate new PRD
        if (useRAG) {
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
            const result = await writePRDAction.run(requirements, {
              mode: 'new',
              useRAG: true,
              relevantChunks,
            });
            prdContent = result.content;
          } else {
            // Standard new mode
            const result = await writePRDAction.run(requirements, { mode: 'new' });
            prdContent = result.content;
          }
        } else {
          // Standard new mode
          const result = await writePRDAction.run(requirements, { mode: 'new' });
          prdContent = result.content;
        }
      }

      // Save as new PRD version
      const newPRD = await documentRepo.createPRDVersion(id, prdContent, parentId);

      logger.info(`PRDController: PRD generated successfully`, {
        projectId: id,
        documentId: newPRD.id,
        version: newPRD.version,
      });

      return res.status(201).json({
        success: true,
        prd: {
          id: newPRD.id,
          version: newPRD.version,
          content: newPRD.content,
          filename: newPRD.filename,
          createdAt: newPRD.created_at,
          parentId: newPRD.parent_id,
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

      return res.json({
        success: true,
        prds: prds.map((prd) => ({
          id: prd.id,
          version: prd.version || 1,
          filename: prd.filename,
          content: prd.content,
          isDeleted: prd.is_deleted || false,
          deletedAt: prd.deleted_at,
          parentId: prd.parent_id,
          createdAt: prd.created_at,
        })),
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

      return res.json({
        success: true,
        prd: {
          id: prd.id,
          version: prd.version || 1,
          filename: prd.filename,
          content: prd.content,
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
}

export default PRDController;

