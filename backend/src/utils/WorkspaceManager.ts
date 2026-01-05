/**
 * WorkspaceManager
 * 统一管理文件写入workspace的逻辑
 */

import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { logger } from './logger';

export interface WorkspaceOptions {
  applicationId?: string;
  version?: number;
  workspacePath?: string;
  documentType?: string; // PRD, CODE, DESIGN等
}

export class WorkspaceManager {
  /**
   * 获取工作目录路径
   * 新的目录结构：workspace/{applicationId}/v{version}/{documentType}/
   * 例如：workspace/default/v1/PRD/
   */
  static getWorkspaceDir(options?: WorkspaceOptions): string {
    // 计算项目根目录：从 backend/src/utils 或 backend/dist/utils 到项目根目录
    const possibleRoots = [
      path.resolve(__dirname, '../../../'), // backend/src/utils 或 backend/dist/utils
      path.resolve(__dirname, '../../../../'), // 如果编译后结构不同
      process.cwd(), // 当前工作目录（通常是项目根目录）
    ];

    // 查找包含 pnpm-workspace.yaml 或 package.json 的目录作为项目根目录
    let projectRoot = possibleRoots[0]; // 默认使用第一个
    for (const root of possibleRoots) {
      if (
        fsSync.existsSync(path.join(root, 'pnpm-workspace.yaml')) ||
        fsSync.existsSync(path.join(root, 'package.json'))
      ) {
        projectRoot = root;
        break;
      }
    }

    const workspaceRoot =
      options?.workspacePath ||
      process.env.WORKSPACE_PATH ||
      path.join(projectRoot, 'workspace');
    const applicationId = options?.applicationId || 'default';
    const version = options?.version || 1;
    const type = options?.documentType || 'DOCS'; // 默认类型

    // 新的目录结构：workspace/{applicationId}/v{version}/{documentType}/
    return path.join(workspaceRoot, applicationId, `v${version}`, type);
  }

  /**
   * 保存文件到 workspace
   * @param filePath 相对路径（相对于workspace目录）
   * @param content 文件内容
   * @param options workspace选项
   */
  static async saveToWorkspace(
    filePath: string,
    content: string,
    options?: WorkspaceOptions
  ): Promise<void> {
    try {
      const workspaceDir = this.getWorkspaceDir(options);
      const fullPath = path.join(workspaceDir, filePath);
      const dir = path.dirname(fullPath);

      // 确保目录存在
      await fs.mkdir(dir, { recursive: true });

      // 写入文件
      await fs.writeFile(fullPath, content, 'utf-8');

      logger.info('WorkspaceManager: Saved file to workspace', {
        filePath: fullPath,
        contentLength: content.length,
        workspaceDir,
      });
    } catch (error: any) {
      logger.error('WorkspaceManager: Failed to save file to workspace', {
        filePath,
        error: error.message,
        workspaceDir: this.getWorkspaceDir(options),
      });
      // 不抛出错误，允许调用者决定如何处理
      throw error;
    }
  }

  /**
   * 批量保存文件到 workspace
   * @param files 文件数组，每个文件包含path和content
   * @param options workspace选项
   */
  static async saveFilesToWorkspace(
    files: Array<{ path: string; content: string }>,
    options?: WorkspaceOptions
  ): Promise<void> {
    const workspaceDir = this.getWorkspaceDir(options);
    const errors: Array<{ path: string; error: string }> = [];

    for (const file of files) {
      try {
        await this.saveToWorkspace(file.path, file.content, options);
      } catch (error: any) {
        errors.push({
          path: file.path,
          error: error.message,
        });
        logger.error('WorkspaceManager: Failed to save file', {
          path: file.path,
          error: error.message,
        });
        // 继续保存其他文件
      }
    }

    if (errors.length > 0) {
      logger.warn('WorkspaceManager: Some files failed to save', {
        failedCount: errors.length,
        totalCount: files.length,
        errors,
      });
    }

    logger.info('WorkspaceManager: Batch save completed', {
      successCount: files.length - errors.length,
      failedCount: errors.length,
      totalCount: files.length,
      workspaceDir,
    });
  }

  /**
   * 读取 workspace 中的所有文件内容
   * @param options workspace选项
   * @param filter 可选的文件过滤函数
   */
  static async readAllFromWorkspace(
    options?: WorkspaceOptions,
    filter?: (filename: string) => boolean
  ): Promise<string> {
    try {
      const workspaceDir = this.getWorkspaceDir(options);

      // 检查目录是否存在
      try {
        await fs.access(workspaceDir);
      } catch {
        // 目录不存在是正常情况（特别是在测试环境中），使用 debug 级别而不是 warn
        logger.debug('WorkspaceManager: Workspace directory does not exist', {
          workspaceDir,
        });
        return ''; // 如果目录不存在，返回空字符串
      }

      const files: string[] = [];

      // 读取目录中的所有文件
      const entries = await fs.readdir(workspaceDir, { withFileTypes: true });

      // 过滤文件
      const filteredEntries = entries.filter((entry) => {
        if (!entry.isFile()) return false;
        if (filter && !filter(entry.name)) return false;
        return true;
      });

      // 按文件名排序
      const sortedEntries = filteredEntries.sort((a, b) =>
        a.name.localeCompare(b.name)
      );

      for (const entry of sortedEntries) {
        const filePath = path.join(workspaceDir, entry.name);
        const content = await fs.readFile(filePath, 'utf-8');
        // 如果文件已经有标题，不重复添加
        if (content.startsWith('#')) {
          files.push(content);
        } else {
          files.push(`# ${entry.name.replace('.md', '')}\n\n${content}`);
        }
      }

      const mergedContent = files.join('\n\n---\n\n');

      logger.info('WorkspaceManager: Read all files from workspace', {
        workspaceDir,
        fileCount: sortedEntries.length,
        totalLength: mergedContent.length,
      });

      return mergedContent;
    } catch (error: any) {
      logger.error('WorkspaceManager: Failed to read files from workspace', {
        error: error.message,
        workspaceDir: this.getWorkspaceDir(options),
      });
      // 如果读取失败，返回空字符串而不是抛出错误
      return '';
    }
  }

  /**
   * 检查文件是否存在
   * @param filePath 相对路径
   * @param options workspace选项
   */
  static async fileExists(
    filePath: string,
    options?: WorkspaceOptions
  ): Promise<boolean> {
    try {
      const workspaceDir = this.getWorkspaceDir(options);
      const fullPath = path.join(workspaceDir, filePath);
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 读取单个文件
   * @param filePath 相对路径
   * @param options workspace选项
   */
  static async readFile(
    filePath: string,
    options?: WorkspaceOptions
  ): Promise<string | null> {
    try {
      const workspaceDir = this.getWorkspaceDir(options);
      const fullPath = path.join(workspaceDir, filePath);
      const content = await fs.readFile(fullPath, 'utf-8');
      return content;
    } catch (error: any) {
      logger.error('WorkspaceManager: Failed to read file', {
        filePath,
        error: error.message,
        workspaceDir: this.getWorkspaceDir(options),
      });
      return null;
    }
  }
}

