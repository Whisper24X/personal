/**
 * Knowledge Base Controller
 * Handles knowledge base document CRUD operations
 */

import { Request, Response } from 'express';
import { KnowledgeBaseRepository } from '../../database/repositories/KnowledgeBaseRepository';
import { ProjectRepository } from '../../database/repositories/ProjectRepository';
import { WorkspaceManager } from '../../utils/WorkspaceManager';
import { CLIKnowledgeSearchService } from '../../services/CLIKnowledgeSearchService';
import { logger } from '../../utils';

const knowledgeBaseRepo = new KnowledgeBaseRepository();
const projectRepo = new ProjectRepository();
const cliSearchService = new CLIKnowledgeSearchService();

export class KnowledgeBaseController {
  /**
   * Create a knowledge base document
   * POST /api/projects/:id/knowledge-base
   */
  static async create(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { title, content, description, tags, metadata } = req.body;

      if (!title || !content) {
        return res.status(400).json({
          error: 'Missing required fields: title and content are required',
        });
      }

      // Verify project exists
      const project = await projectRepo.findById(id);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Create knowledge base document
      const document = await knowledgeBaseRepo.create({
        projectId: id,
        title,
        content,
        description,
        tags: Array.isArray(tags) ? tags : [],
        metadata,
        createdBy: (req as any).userId || undefined,
      });

      logger.info('KnowledgeBaseController: Knowledge base document created', {
        projectId: id,
        documentId: document.id,
        title: document.title,
      });

      return res.status(201).json({
        success: true,
        document: {
          id: document.id,
          title: document.title,
          content: document.content,
          description: document.description,
          tags: document.tags,
          metadata: document.metadata,
          isActive: document.is_active,
          createdAt: document.created_at,
          updatedAt: document.updated_at,
        },
      });
    } catch (error: any) {
      logger.error('KnowledgeBaseController: Failed to create document', error);
      return res.status(500).json({
        error: 'Failed to create knowledge base document',
        message: error.message,
      });
    }
  }

  /**
   * Get all knowledge base documents for a project
   * GET /api/projects/:id/knowledge-base
   */
  static async list(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { includeInactive } = req.query;

      // Verify project exists
      const project = await projectRepo.findById(id);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const documents = await knowledgeBaseRepo.findByProjectId(id, includeInactive === 'true');

      return res.json({
        success: true,
        documents: documents.map((doc) => ({
          id: doc.id,
          title: doc.title,
          content: doc.content,
          description: doc.description,
          tags: doc.tags,
          metadata: doc.metadata,
          isActive: doc.is_active,
          createdAt: doc.created_at,
          updatedAt: doc.updated_at,
        })),
      });
    } catch (error: any) {
      logger.error('KnowledgeBaseController: Failed to list documents', error);
      return res.status(500).json({
        error: 'Failed to list knowledge base documents',
        message: error.message,
      });
    }
  }

  /**
   * Get a knowledge base document by ID
   * GET /api/projects/:id/knowledge-base/:docId
   */
  static async getById(req: Request, res: Response) {
    try {
      const { id, docId } = req.params;

      // Verify project exists
      const project = await projectRepo.findById(id);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const document = await knowledgeBaseRepo.findById(docId);
      if (!document) {
        return res.status(404).json({ error: 'Knowledge base document not found' });
      }

      // Verify document belongs to project
      if (document.project_id !== id) {
        return res.status(403).json({ error: 'Document does not belong to this project' });
      }

      return res.json({
        success: true,
        document: {
          id: document.id,
          title: document.title,
          content: document.content,
          description: document.description,
          tags: document.tags,
          metadata: document.metadata,
          isActive: document.is_active,
          createdAt: document.created_at,
          updatedAt: document.updated_at,
        },
      });
    } catch (error: any) {
      logger.error('KnowledgeBaseController: Failed to get document', error);
      return res.status(500).json({
        error: 'Failed to get knowledge base document',
        message: error.message,
      });
    }
  }

  /**
   * Update a knowledge base document
   * PUT /api/projects/:id/knowledge-base/:docId
   */
  static async update(req: Request, res: Response) {
    try {
      const { id, docId } = req.params;
      const { title, content, description, tags, metadata, isActive } = req.body;

      // Verify project exists
      const project = await projectRepo.findById(id);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Verify document exists and belongs to project
      const existingDoc = await knowledgeBaseRepo.findById(docId);
      if (!existingDoc || existingDoc.project_id !== id) {
        return res.status(404).json({ error: 'Knowledge base document not found' });
      }

      // Update document
      const document = await knowledgeBaseRepo.update(docId, {
        title,
        content,
        description,
        tags: Array.isArray(tags) ? tags : undefined,
        metadata,
        isActive,
      });

      logger.info('KnowledgeBaseController: Knowledge base document updated', {
        projectId: id,
        documentId: document.id,
      });

      return res.json({
        success: true,
        document: {
          id: document.id,
          title: document.title,
          content: document.content,
          description: document.description,
          tags: document.tags,
          metadata: document.metadata,
          isActive: document.is_active,
          createdAt: document.created_at,
          updatedAt: document.updated_at,
        },
      });
    } catch (error: any) {
      logger.error('KnowledgeBaseController: Failed to update document', error);
      return res.status(500).json({
        error: 'Failed to update knowledge base document',
        message: error.message,
      });
    }
  }

  /**
   * Delete a knowledge base document
   * DELETE /api/projects/:id/knowledge-base/:docId
   */
  static async delete(req: Request, res: Response) {
    try {
      const { id, docId } = req.params;

      // Verify project exists
      const project = await projectRepo.findById(id);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Verify document exists and belongs to project
      const document = await knowledgeBaseRepo.findById(docId);
      if (!document || document.project_id !== id) {
        return res.status(404).json({ error: 'Knowledge base document not found' });
      }

      // Delete document
      await knowledgeBaseRepo.delete(docId);

      // For now, we'll just mark it as deleted in the database

      logger.info('KnowledgeBaseController: Knowledge base document deleted', {
        projectId: id,
        documentId: docId,
      });

      return res.json({
        success: true,
        message: 'Knowledge base document deleted successfully',
      });
    } catch (error: any) {
      logger.error('KnowledgeBaseController: Failed to delete document', error);
      return res.status(500).json({
        error: 'Failed to delete knowledge base document',
        message: error.message,
      });
    }
  }

  /**
   * Search knowledge base documents
   * POST /api/projects/:id/knowledge-base/search
   *
   * Supports both CLI mode (file system search) and database mode (legacy)
   * @param useCLI - If true, use CLI mode to search file system; if false, use database search (default: true)
   */
  static async search(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { query, limit = 5, useCLI = true } = req.body;

      if (!query || typeof query !== 'string') {
        return res.status(400).json({
          error: 'Missing or invalid query field',
        });
      }

      // Verify project exists
      const project = await projectRepo.findById(id);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const limitNumber = Number(limit) || 5;

      // CLI mode: search file system
      if (useCLI) {
        try {
          // Get workspace path (already includes ainative-workspace)
          const workspacePath = WorkspaceManager.getProjectWorkspacePath({
            applicationId: project.application_id,
            projectId: id,
          });

          // Search using CLI
          const cliResults = await cliSearchService.search({
            workspacePath,
            query,
            limit: limitNumber,
            directories: ['docs/business-knowledge/'],
          });

          // Convert CLI results to API response format
          return res.json({
            success: true,
            query,
            mode: 'CLI',
            results: cliResults.map((result) => ({
              file: result.file,
              title: result.metadata?.title || result.file.split('/').pop()?.replace('.md', '') || 'Untitled',
              description: result.metadata?.tags?.join(', ') || '',
              preview: result.content.slice(0, 240),
              tags: result.metadata?.tags || [],
              relevance: result.relevance,
            })),
          });
        } catch (cliError: any) {
          logger.warn('KnowledgeBaseController: CLI search failed, falling back to database search', {
            error: cliError.message,
            projectId: id,
          });
          // Fallback to database search if CLI search fails
        }
      }

      // Database mode: legacy search (fallback or explicit request)
      const results = await knowledgeBaseRepo.searchByQuery(id, query, limitNumber);

      return res.json({
        success: true,
        query,
        mode: 'database',
        results: results.map((doc) => ({
          id: doc.id,
          title: doc.title,
          description: doc.description,
          preview: doc.content ? doc.content.slice(0, 240) : '',
          tags: doc.tags,
          createdAt: doc.created_at,
          updatedAt: doc.updated_at,
        })),
      });
    } catch (error: any) {
      logger.error('KnowledgeBaseController: Failed to search documents', error);
      return res.status(500).json({
        error: 'Failed to search knowledge base documents',
        message: error.message,
      });
    }
  }
}
