/**
 * DocumentArchiveService
 * 文档归档服务
 * 
 * 将当前文档归档到 docs-archive/ 目录，形成历史文档
 * 归档只在整个工作流完全执行完成后执行
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../utils';

/**
 * 支持的文档类型
 */
export type ArchiveDocumentType = 'mrd' | 'prd' | 'design';

/**
 * 归档结果
 */
export interface ArchiveResult {
  /** 文档类型 */
  docType: ArchiveDocumentType;
  /** 版本目录名 */
  versionDir: string;
  /** 归档目标路径 */
  targetPath: string;
  /** 归档时间 */
  archivedAt: Date;
  /** 归档的文件列表 */
  files: string[];
}

/**
 * 文档归档服务
 */
export class DocumentArchiveService {
  /**
   * 归档当前文档
   * @param workspacePath ainative-workspace 路径
   * @param docType 文档类型 ('mrd' | 'prd' | 'design')
   * @param version 版本号（可选，默认自动生成）
   * @returns 归档结果
   */
  async archiveDocument(
    workspacePath: string,
    docType: ArchiveDocumentType,
    version?: string
  ): Promise<ArchiveResult> {
    const archiveDir = path.join(workspacePath, 'docs-archive', docType);
    const sourceDir = path.join(workspacePath, 'docs', docType);

    // 检查源目录是否存在
    try {
      await fs.access(sourceDir);
    } catch {
      logger.warn('DocumentArchiveService: Source directory does not exist', {
        sourceDir,
        docType,
      });
      throw new Error(`Source directory does not exist: ${sourceDir}`);
    }

    // 生成版本目录名：v{n}-{date}
    const versionDir = version || await this.generateVersionDir(archiveDir);
    const targetDir = path.join(archiveDir, versionDir);

    // 创建归档目录
    await fs.mkdir(targetDir, { recursive: true });

    // 获取要归档的文件列表
    const files = await this.getFilesToArchive(sourceDir, docType);

    if (files.length === 0) {
      logger.warn('DocumentArchiveService: No files to archive', {
        sourceDir,
        docType,
      });
      throw new Error(`No files to archive in: ${sourceDir}`);
    }

    // 复制文件到归档目录
    const archivedFiles: string[] = [];
    for (const file of files) {
      const sourcePath = path.join(sourceDir, file);
      const targetPath = path.join(targetDir, file);
      
      // 确保目标子目录存在
      const targetFileDir = path.dirname(targetPath);
      await fs.mkdir(targetFileDir, { recursive: true });
      
      await fs.copyFile(sourcePath, targetPath);
      archivedFiles.push(file);
    }

    const result: ArchiveResult = {
      docType,
      versionDir,
      targetPath: targetDir,
      archivedAt: new Date(),
      files: archivedFiles,
    };

    logger.info('DocumentArchiveService: Document archived', {
      docType,
      versionDir,
      targetPath: targetDir,
      fileCount: archivedFiles.length,
    });

    return result;
  }

  /**
   * 归档所有文档（工作流完成后调用）
   * @param workspacePath ainative-workspace 路径
   * @returns 所有归档结果
   */
  async archiveAllDocuments(workspacePath: string): Promise<ArchiveResult[]> {
    const results: ArchiveResult[] = [];
    const docTypes: ArchiveDocumentType[] = ['mrd', 'prd', 'design'];

    for (const docType of docTypes) {
      try {
        // 检查文档是否存在
        if (await this.hasDocument(workspacePath, docType)) {
          const result = await this.archiveDocument(workspacePath, docType);
          results.push(result);
        } else {
          logger.info('DocumentArchiveService: Document not found, skipping', {
            docType,
          });
        }
      } catch (error: any) {
        logger.warn('DocumentArchiveService: Failed to archive document', {
          docType,
          error: error.message,
        });
        // 继续归档其他文档
      }
    }

    logger.info('DocumentArchiveService: All documents archived', {
      archivedCount: results.length,
      docTypes: results.map(r => r.docType),
    });

    return results;
  }

  /**
   * 检查文档是否存在
   * @param workspacePath ainative-workspace 路径
   * @param docType 文档类型
   * @returns 是否存在
   */
  async hasDocument(
    workspacePath: string,
    docType: ArchiveDocumentType
  ): Promise<boolean> {
    const sourceDir = path.join(workspacePath, 'docs', docType);
    const mainFile = path.join(sourceDir, `${docType.toUpperCase()}.md`);

    try {
      await fs.access(mainFile);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取历史文档版本列表
   * @param workspacePath ainative-workspace 路径
   * @param docType 文档类型
   * @returns 版本目录名数组（最新版本在前）
   */
  async getArchivedVersions(
    workspacePath: string,
    docType: ArchiveDocumentType
  ): Promise<string[]> {
    const archiveDir = path.join(workspacePath, 'docs-archive', docType);

    try {
      const entries = await fs.readdir(archiveDir, { withFileTypes: true });
      return entries
        .filter(e => e.isDirectory())
        .map(e => e.name)
        .sort()
        .reverse(); // 最新版本在前
    } catch {
      return [];
    }
  }

  /**
   * 获取最新归档版本的路径
   * @param workspacePath ainative-workspace 路径
   * @param docType 文档类型
   * @returns 最新版本路径，如果没有归档则返回 null
   */
  async getLatestArchivedVersion(
    workspacePath: string,
    docType: ArchiveDocumentType
  ): Promise<string | null> {
    const versions = await this.getArchivedVersions(workspacePath, docType);
    if (versions.length === 0) {
      return null;
    }
    return path.join(workspacePath, 'docs-archive', docType, versions[0]);
  }

  /**
   * 获取要归档的文件列表
   */
  private async getFilesToArchive(
    sourceDir: string,
    _docType: ArchiveDocumentType
  ): Promise<string[]> {
    const files: string[] = [];

    try {
      const entries = await fs.readdir(sourceDir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.md')) {
          // 排除 review 文件，只归档主要文档
          if (!entry.name.includes('review') && !entry.name.includes('Review')) {
            files.push(entry.name);
          }
        }
      }
    } catch (error: any) {
      logger.error('DocumentArchiveService: Failed to list files', {
        sourceDir,
        error: error.message,
      });
    }

    return files;
  }

  /**
   * 生成版本目录名
   */
  private async generateVersionDir(archiveDir: string): Promise<string> {
    const date = new Date().toISOString().slice(0, 10);
    const versionCount = await this.getVersionCount(archiveDir);
    return `v${versionCount + 1}-${date}`;
  }

  /**
   * 获取当前版本数量
   */
  private async getVersionCount(archiveDir: string): Promise<number> {
    try {
      const entries = await fs.readdir(archiveDir, { withFileTypes: true });
      return entries.filter(e => e.isDirectory()).length;
    } catch {
      return 0;
    }
  }
}

// 单例实例
export const documentArchiveService = new DocumentArchiveService();
