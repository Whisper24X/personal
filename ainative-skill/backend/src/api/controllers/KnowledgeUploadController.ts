/**
 * Knowledge Upload Controller
 * Handles file upload for business knowledge documents
 * 
 * 业务方可以通过此接口上传 Markdown 文档到 workspace 的知识库目录
 * 这些文档会被 CLI 在生成 MRD/PRD 时自动引用作为知识输入
 */

import { Request, Response } from 'express';
import { ProjectRepository } from '../../database/repositories/ProjectRepository';
import { WorkspaceManager } from '../../utils/WorkspaceManager';
import { logger } from '../../utils';
import * as fs from 'fs/promises';
import * as path from 'path';

const projectRepo = new ProjectRepository();

// 知识库存储目录（相对于 ainative-workspace/docs/）
const KNOWLEDGE_DIR = 'business-knowledge';

/**
 * 修复 multer 上传文件时中文文件名乱码问题
 * multer 默认将 UTF-8 编码的文件名按 Latin-1 解析，导致中文乱码
 * 此函数将 Latin-1 字符串转换回 UTF-8
 */
function decodeFilename(filename: string): string {
  try {
    // 尝试将 Latin-1 编码的字符串转换为 UTF-8
    const decoded = Buffer.from(filename, 'latin1').toString('utf8');
    // 验证转换是否成功（如果原本就是 ASCII，则保持不变）
    if (decoded !== filename && /[\u4e00-\u9fa5]/.test(decoded)) {
      return decoded;
    }
    return filename;
  } catch {
    return filename;
  }
}

export class KnowledgeUploadController {
  /**
   * Upload a knowledge file
   * POST /api/projects/:id/knowledge/upload
   * 
   * Request: multipart/form-data with 'file' field
   * Response: { success: true, file: { name, path, size, uploadTime } }
   */
  static async uploadFile(req: Request, res: Response) {
    try {
      const { id: projectId } = req.params;
      const file = req.file;

      if (!file) {
        return res.status(400).json({
          error: 'No file uploaded',
          message: 'Please provide a .md file',
        });
      }

      // Verify project exists
      const project = await projectRepo.findById(projectId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Validate file type
      if (!file.originalname.endsWith('.md')) {
        return res.status(400).json({
          error: 'Invalid file type',
          message: 'Only .md (Markdown) files are allowed',
        });
      }

      // Get workspace path
      const workspacePath = WorkspaceManager.getProjectWorkspacePath({
        applicationId: project.application_id,
        projectId: projectId,
      });
      const ainativeWorkspacePath = path.join(workspacePath, 'ainative-workspace');
      const knowledgeDir = path.join(ainativeWorkspacePath, 'docs', KNOWLEDGE_DIR);

      // Ensure knowledge directory exists
      await fs.mkdir(knowledgeDir, { recursive: true });

      // Generate unique filename if file already exists
      // 解码文件名，修复中文乱码问题
      let filename = decodeFilename(file.originalname);
      let filePath = path.join(knowledgeDir, filename);
      let counter = 1;

      while (await fileExists(filePath)) {
        const ext = path.extname(filename);
        const base = path.basename(filename, ext);
        filename = `${base}_${counter}${ext}`;
        filePath = path.join(knowledgeDir, filename);
        counter++;
      }

      // Save file
      await fs.writeFile(filePath, file.buffer, 'utf-8');

      logger.info('KnowledgeUploadController: File uploaded', {
        projectId,
        filename,
        size: file.size,
      });

      return res.status(201).json({
        success: true,
        file: {
          name: filename,
          originalName: decodeFilename(file.originalname),
          path: `docs/${KNOWLEDGE_DIR}/${filename}`,
          size: file.size,
          uploadTime: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      logger.error('KnowledgeUploadController: Upload failed', {
        error: error.message,
        projectId: req.params.id,
      });
      return res.status(500).json({
        error: 'Upload failed',
        message: error.message,
      });
    }
  }

  /**
   * List all knowledge files
   * GET /api/projects/:id/knowledge/files
   * 
   * Response: { files: [{ name, path, size, modifiedTime }] }
   */
  static async listFiles(req: Request, res: Response) {
    try {
      const { id: projectId } = req.params;

      // Verify project exists
      const project = await projectRepo.findById(projectId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Get workspace path
      const workspacePath = WorkspaceManager.getProjectWorkspacePath({
        applicationId: project.application_id,
        projectId: projectId,
      });
      const knowledgeDir = path.join(workspacePath, 'ainative-workspace', 'docs', KNOWLEDGE_DIR);

      // Check if directory exists
      if (!await fileExists(knowledgeDir)) {
        return res.json({ files: [] });
      }

      // List files
      const entries = await fs.readdir(knowledgeDir, { withFileTypes: true });
      const files = [];

      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.md')) {
          const filePath = path.join(knowledgeDir, entry.name);
          const stats = await fs.stat(filePath);
          files.push({
            name: entry.name,
            path: `docs/${KNOWLEDGE_DIR}/${entry.name}`,
            size: stats.size,
            modifiedTime: stats.mtime.toISOString(),
          });
        }
      }

      // Sort by modified time (newest first)
      files.sort((a, b) => new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime());

      return res.json({ files });
    } catch (error: any) {
      logger.error('KnowledgeUploadController: List files failed', {
        error: error.message,
        projectId: req.params.id,
      });
      return res.status(500).json({
        error: 'Failed to list files',
        message: error.message,
      });
    }
  }

  /**
   * Get a knowledge file content
   * GET /api/projects/:id/knowledge/files/:filename
   * 
   * Response: { file: { name, path, content, size, modifiedTime } }
   */
  static async getFile(req: Request, res: Response) {
    try {
      const { id: projectId, filename } = req.params;

      // Verify project exists
      const project = await projectRepo.findById(projectId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Validate filename (prevent path traversal)
      if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
        return res.status(400).json({ error: 'Invalid filename' });
      }

      // Get file path
      const workspacePath = WorkspaceManager.getProjectWorkspacePath({
        applicationId: project.application_id,
        projectId: projectId,
      });
      const filePath = path.join(workspacePath, 'ainative-workspace', 'docs', KNOWLEDGE_DIR, filename);

      // Check if file exists
      if (!await fileExists(filePath)) {
        return res.status(404).json({ error: 'File not found' });
      }

      // Read file content
      const content = await fs.readFile(filePath, 'utf-8');
      const stats = await fs.stat(filePath);

      return res.json({
        file: {
          name: filename,
          path: `docs/${KNOWLEDGE_DIR}/${filename}`,
          content,
          size: stats.size,
          modifiedTime: stats.mtime.toISOString(),
        },
      });
    } catch (error: any) {
      logger.error('KnowledgeUploadController: Get file failed', {
        error: error.message,
        projectId: req.params.id,
        filename: req.params.filename,
      });
      return res.status(500).json({
        error: 'Failed to get file',
        message: error.message,
      });
    }
  }

  /**
   * Delete a knowledge file
   * DELETE /api/projects/:id/knowledge/files/:filename
   * 
   * Response: { success: true, message: 'File deleted' }
   */
  static async deleteFile(req: Request, res: Response) {
    try {
      const { id: projectId, filename } = req.params;

      // Verify project exists
      const project = await projectRepo.findById(projectId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Validate filename (prevent path traversal)
      if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
        return res.status(400).json({ error: 'Invalid filename' });
      }

      // Get file path
      const workspacePath = WorkspaceManager.getProjectWorkspacePath({
        applicationId: project.application_id,
        projectId: projectId,
      });
      const filePath = path.join(workspacePath, 'ainative-workspace', 'docs', KNOWLEDGE_DIR, filename);

      // Check if file exists
      if (!await fileExists(filePath)) {
        return res.status(404).json({ error: 'File not found' });
      }

      // Delete file
      await fs.unlink(filePath);

      logger.info('KnowledgeUploadController: File deleted', {
        projectId,
        filename,
      });

      return res.json({
        success: true,
        message: 'File deleted successfully',
      });
    } catch (error: any) {
      logger.error('KnowledgeUploadController: Delete file failed', {
        error: error.message,
        projectId: req.params.id,
        filename: req.params.filename,
      });
      return res.status(500).json({
        error: 'Failed to delete file',
        message: error.message,
      });
    }
  }
}

/**
 * Helper function to check if file/directory exists
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
