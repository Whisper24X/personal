/**
 * WorkspaceManager
 * 统一管理文件写入workspace的逻辑
 * 
 * 目录结构：workspace/{applicationId}/{projectId}/ainative-workspace
 * - ainative-workspace 是通过 git clone 的模板项目
 * - 所有文档都写在 ainative-workspace/docs 目录中
 */

import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { logger } from './logger';

// 模板仓库地址
const TEMPLATE_REPO = 'git@gitlab.yc345.tv:frontend/ainative-workspace.git';
const WORKSPACE_DIR_NAME = 'ainative-workspace';

export interface WorkspaceOptions {
  applicationId?: string;
  projectId?: string;
  documentType?: string; // MRD, PRD, DESIGN 等，用于在 docs 目录下创建子目录
  /** @deprecated 版本控制已改用 git，此参数被忽略 */
  version?: number;
  /** @deprecated 使用环境变量 WORKSPACE_PATH 代替 */
  workspacePath?: string;
}

export class WorkspaceManager {
  /**
   * 获取项目根目录
   */
  private static getProjectRoot(): string {
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
    return projectRoot;
  }

  /**
   * 获取 workspace 根目录
   */
  private static getWorkspaceRoot(): string {
    return process.env.WORKSPACE_PATH || path.join(this.getProjectRoot(), 'workspace');
  }

  /**
   * 获取项目工作目录路径（包含 ainative-workspace）
   * 目录结构：workspace/{applicationId}/{projectId}/ainative-workspace
   */
  static getProjectWorkspacePath(options: WorkspaceOptions): string {
    if (!options?.applicationId) {
      throw new Error('applicationId is required for workspace directory.');
    }
    if (!options?.projectId) {
      throw new Error('projectId is required for workspace directory.');
    }

    const workspaceRoot = this.getWorkspaceRoot();
    return path.join(workspaceRoot, options.applicationId, options.projectId, WORKSPACE_DIR_NAME);
  }

  /**
   * 获取文档目录路径
   * 目录结构：workspace/{applicationId}/{projectId}/ainative-workspace/docs/{documentType}
   */
  static getDocsDir(options: WorkspaceOptions): string {
    const projectWorkspace = this.getProjectWorkspacePath(options);
    const docsPath = path.join(projectWorkspace, 'docs');
    
    // 如果指定了文档类型，则在 docs 下创建子目录
    if (options.documentType) {
      return path.join(docsPath, options.documentType.toLowerCase());
    }
    
    return docsPath;
  }

  /**
   * 获取工作目录路径（兼容旧接口）
   * @deprecated 请使用 getDocsDir 或 getProjectWorkspacePath
   */
  static getWorkspaceDir(options?: WorkspaceOptions): string {
    if (!options) {
      throw new Error('WorkspaceOptions is required.');
    }
    return this.getDocsDir(options);
  }

  /**
   * 检查模板项目是否已经克隆
   */
  static isTemplateCloned(options: WorkspaceOptions): boolean {
    const projectWorkspace = this.getProjectWorkspacePath(options);
    const gitDir = path.join(projectWorkspace, '.git');
    return fsSync.existsSync(gitDir);
  }

  /**
   * 克隆模板项目到工作目录
   * 如果目录已存在且包含 .git，则跳过克隆
   */
  static async cloneTemplate(options: WorkspaceOptions): Promise<void> {
    const projectWorkspace = this.getProjectWorkspacePath(options);
    const parentDir = path.dirname(projectWorkspace);

    // 如果模板已经克隆，直接返回
    if (this.isTemplateCloned(options)) {
      logger.info('WorkspaceManager: Template already cloned', { projectWorkspace });
      return;
    }

    try {
      // 确保父目录存在
      await fs.mkdir(parentDir, { recursive: true });

      // 如果目录存在但不是 git 仓库，先删除
      if (fsSync.existsSync(projectWorkspace)) {
        await fs.rm(projectWorkspace, { recursive: true, force: true });
      }

      // 执行 git clone
      logger.info('WorkspaceManager: Cloning template repository', {
        repo: TEMPLATE_REPO,
        targetDir: projectWorkspace,
      });

      execSync(`git clone ${TEMPLATE_REPO} ${WORKSPACE_DIR_NAME}`, {
        cwd: parentDir,
        stdio: 'pipe',
      });

      logger.info('WorkspaceManager: Template cloned successfully', { projectWorkspace });
    } catch (error: any) {
      logger.error('WorkspaceManager: Failed to clone template', {
        error: error.message,
        projectWorkspace,
      });
      throw new Error(`Failed to clone template repository: ${error.message}`);
    }
  }

  /**
   * 拉取最新的模板更新
   */
  static async pullTemplate(options: WorkspaceOptions): Promise<void> {
    const projectWorkspace = this.getProjectWorkspacePath(options);

    if (!this.isTemplateCloned(options)) {
      // 如果没有克隆，先克隆
      await this.cloneTemplate(options);
      return;
    }

    try {
      logger.info('WorkspaceManager: Pulling latest template updates', { projectWorkspace });

      execSync('git pull origin main', {
        cwd: projectWorkspace,
        stdio: 'pipe',
      });

      logger.info('WorkspaceManager: Template updated successfully', { projectWorkspace });
    } catch (error: any) {
      // git pull 失败不应该阻止流程，只记录警告
      logger.warn('WorkspaceManager: Failed to pull template updates', {
        error: error.message,
        projectWorkspace,
      });
    }
  }

  /**
   * 初始化工作空间
   * 确保模板项目已克隆并拉取最新更新，创建必要的目录结构
   */
  static async initWorkspace(options: WorkspaceOptions): Promise<string> {
    // 克隆或拉取最新模板项目（pullTemplate 内部会处理：未克隆则克隆，已克隆则 pull）
    await this.pullTemplate(options);

    // 确保 docs 目录存在
    const docsDir = this.getDocsDir(options);
    await fs.mkdir(docsDir, { recursive: true });

    logger.info('WorkspaceManager: Workspace initialized', {
      projectWorkspace: this.getProjectWorkspacePath(options),
      docsDir,
    });

    return docsDir;
  }

  /**
   * 保存文件到 workspace 的 docs 目录
   * @param filePath 相对路径（相对于 docs 目录）
   * @param content 文件内容
   * @param options workspace选项
   */
  static async saveToWorkspace(
    filePath: string,
    content: string,
    options?: WorkspaceOptions
  ): Promise<void> {
    if (!options) {
      throw new Error('WorkspaceOptions is required for saveToWorkspace.');
    }
    try {
      // 确保工作空间已初始化
      await this.initWorkspace(options);

      const docsDir = this.getDocsDir(options);
      const fullPath = path.join(docsDir, filePath);
      const dir = path.dirname(fullPath);

      // 确保目录存在
      await fs.mkdir(dir, { recursive: true });

      // 写入文件
      await fs.writeFile(fullPath, content, 'utf-8');

      logger.info('WorkspaceManager: Saved file to workspace', {
        filePath: fullPath,
        contentLength: content.length,
        docsDir,
      });
    } catch (error: any) {
      logger.error('WorkspaceManager: Failed to save file to workspace', {
        filePath,
        error: error.message,
      });
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
    if (!options) {
      throw new Error('WorkspaceOptions is required for saveFilesToWorkspace.');
    }
    // 先初始化工作空间
    await this.initWorkspace(options);

    const docsDir = this.getDocsDir(options);
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
      docsDir,
    });
  }

  /**
   * 读取 workspace docs 目录中的所有文件内容
   * @param options workspace选项
   * @param filter 可选的文件过滤函数
   */
  static async readAllFromWorkspace(
    options?: WorkspaceOptions,
    filter?: (filename: string) => boolean
  ): Promise<string> {
    if (!options) {
      throw new Error('WorkspaceOptions is required for readAllFromWorkspace.');
    }
    try {
      const docsDir = this.getDocsDir(options);

      // 检查目录是否存在
      try {
        await fs.access(docsDir);
      } catch {
        logger.debug('WorkspaceManager: Docs directory does not exist', { docsDir });
        return '';
      }

      const files: string[] = [];

      // 读取目录中的所有文件
      const entries = await fs.readdir(docsDir, { withFileTypes: true });

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
        const filePath = path.join(docsDir, entry.name);
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
        docsDir,
        fileCount: sortedEntries.length,
        totalLength: mergedContent.length,
      });

      return mergedContent;
    } catch (error: any) {
      logger.error('WorkspaceManager: Failed to read files from workspace', {
        error: error.message,
      });
      return '';
    }
  }

  /**
   * 检查文件是否存在
   * @param filePath 相对路径（相对于 docs 目录）
   * @param options workspace选项
   */
  static async fileExists(
    filePath: string,
    options?: WorkspaceOptions
  ): Promise<boolean> {
    if (!options) {
      throw new Error('WorkspaceOptions is required for fileExists.');
    }
    try {
      const docsDir = this.getDocsDir(options);
      const fullPath = path.join(docsDir, filePath);
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 读取单个文件
   * @param filePath 相对路径（相对于 docs 目录）
   * @param options workspace选项
   */
  static async readFile(
    filePath: string,
    options?: WorkspaceOptions
  ): Promise<string | null> {
    if (!options) {
      throw new Error('WorkspaceOptions is required for readFile.');
    }
    try {
      const docsDir = this.getDocsDir(options);
      const fullPath = path.join(docsDir, filePath);
      const content = await fs.readFile(fullPath, 'utf-8');
      return content;
    } catch (error: any) {
      logger.error('WorkspaceManager: Failed to read file', {
        filePath,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * 获取项目 ainative-workspace 中的源代码目录
   * 用于代码生成等场景
   */
  static getSrcDir(options: WorkspaceOptions): string {
    const projectWorkspace = this.getProjectWorkspacePath(options);
    return path.join(projectWorkspace, 'src');
  }

  /**
   * 保存代码文件到 src 目录
   * @param filePath 相对路径（相对于 src 目录）
   * @param content 文件内容
   * @param options workspace选项
   */
  static async saveToSrc(
    filePath: string,
    content: string,
    options: WorkspaceOptions
  ): Promise<void> {
    try {
      // 确保工作空间已初始化
      await this.initWorkspace(options);

      const srcDir = this.getSrcDir(options);
      const fullPath = path.join(srcDir, filePath);
      const dir = path.dirname(fullPath);

      // 确保目录存在
      await fs.mkdir(dir, { recursive: true });

      // 写入文件
      await fs.writeFile(fullPath, content, 'utf-8');

      logger.info('WorkspaceManager: Saved code file to src', {
        filePath: fullPath,
        contentLength: content.length,
        srcDir,
      });
    } catch (error: any) {
      logger.error('WorkspaceManager: Failed to save code file to src', {
        filePath,
        error: error.message,
      });
      throw error;
    }
  }
}
