/**
 * WorkspaceManager
 * 统一管理文件写入workspace的逻辑
 *
 * 目录结构（带版本）：workspace/{applicationId}/{projectId}/versions/{versionId}/ainative-workspace
 * 目录结构（无版本）：workspace/{applicationId}/{projectId}/ainative-workspace
 * - ainative-workspace 是通过 git clone 的模板项目
 * - 所有文档都写在 ainative-workspace/docs 目录中
 */

import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { logger } from './logger';
import { GitService } from '../services/GitService';

// 模板仓库地址
const TEMPLATE_REPO = 'git@gitlab.yc345.tv:frontend/ainative-workspace.git';
const WORKSPACE_DIR_NAME = 'ainative-workspace';
const VERSIONS_DIR_NAME = 'versions';

export interface WorkspaceOptions {
  applicationId?: string;
  projectId?: string;
  versionId?: string; // 版本ID，用于创建版本化的工作空间目录
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
      if (fsSync.existsSync(path.join(root, 'pnpm-workspace.yaml')) || fsSync.existsSync(path.join(root, 'package.json'))) {
        projectRoot = root;
        break;
      }
    }
    return projectRoot;
  }

  /**
   * 获取项目根目录（公开方法）
   */
  static getProjectRootPath(): string {
    return this.getProjectRoot();
  }

  /**
   * 获取 workspace 根目录（绝对路径）
   * 统一的 workspace 根目录获取方法，所有需要获取 workspace 路径的地方都应该调用此方法
   * 始终返回绝对路径，避免 CLI 执行时路径解析错误
   */
  static getWorkspaceRoot(): string {
    const workspacePath = process.env.WORKSPACE_PATH;
    if (workspacePath) {
      // 如果设置了 WORKSPACE_PATH，使用 path.resolve 确保是绝对路径
      // 相对路径会相对于项目根目录解析
      return path.resolve(this.getProjectRoot(), workspacePath);
    }
    return path.join(this.getProjectRoot(), 'workspace');
  }

  // ============================================
  // 环境检测方法
  // ============================================

  /**
   * 判断是否在容器环境中
   * 通过检查 CONTAINER_WORKSPACE_ROOT 环境变量判断
   */
  static isContainerEnvironment(): boolean {
    return !!process.env.CONTAINER_WORKSPACE_ROOT;
  }

  /**
   * 判断是否为本地开发模式
   */
  static isLocalDevelopmentMode(): boolean {
    return process.env.NODE_ENV === 'development' || process.env.LOCAL_DEV === 'true' || !this.isContainerEnvironment();
  }

  /**
   * 获取容器内 workspace 路径
   * 用于容器化部署场景
   */
  static getContainerWorkspacePath(options: WorkspaceOptions): string {
    const containerWorkspaceRoot = process.env.CONTAINER_WORKSPACE_ROOT || '/workspace';
    return path.join(containerWorkspaceRoot, options.applicationId || 'default', options.projectId || 'default');
  }

  /**
   * 获取 workspace 路径（自动判断环境）
   * 容器环境使用容器路径，本地环境使用本地路径
   */
  static getWorkspacePath(options: WorkspaceOptions): string {
    if (this.isContainerEnvironment()) {
      return this.getContainerWorkspacePath(options);
    }
    return this.getProjectWorkspacePath(options);
  }

  /**
   * 获取本地开发 workspace 路径
   */
  static getLocalWorkspacePath(options: WorkspaceOptions): string {
    const projectRoot = this.getProjectRoot();
    return path.join(projectRoot, 'workspace', options.applicationId || 'default', options.projectId || 'default');
  }

  /**
   * 初始化容器 workspace
   * 确保所有必要的目录结构存在
   */
  static async initializeContainerWorkspace(options: WorkspaceOptions): Promise<void> {
    const workspacePath = this.getContainerWorkspacePath(options);
    const directories = ['MRD', 'PRD', 'DESIGN', 'CODE', 'TEST', 'docs'];

    for (const dir of directories) {
      await fs.mkdir(path.join(workspacePath, dir), { recursive: true });
    }

    logger.info('WorkspaceManager: Container workspace initialized', {
      workspacePath,
      directories,
    });
  }

  /**
   * 获取项目工作目录路径（包含 ainative-workspace）
   * 目录结构（带版本）：workspace/{applicationId}/{projectId}/versions/{versionId}/ainative-workspace
   * 目录结构（无版本）：workspace/{applicationId}/{projectId}/ainative-workspace
   */
  static getProjectWorkspacePath(options: WorkspaceOptions): string {
    if (!options?.applicationId) {
      throw new Error('applicationId is required for workspace directory.');
    }
    if (!options?.projectId) {
      throw new Error('projectId is required for workspace directory.');
    }

    const workspaceRoot = this.getWorkspaceRoot();

    // 如果指定了版本ID，则使用版本化的目录结构
    if (options.versionId) {
      return path.join(workspaceRoot, options.applicationId, options.projectId, VERSIONS_DIR_NAME, options.versionId, WORKSPACE_DIR_NAME);
    }

    // 兼容旧的目录结构（无版本）
    return path.join(workspaceRoot, options.applicationId, options.projectId, WORKSPACE_DIR_NAME);
  }

  /**
   * 从 workspace 路径解析出 WorkspaceOptions
   * 统一的路径解析方法，供各处调用
   *
   * 支持的路径格式：
   * - 带版本: workspace/{applicationId}/{projectId}/versions/{versionId}/ainative-workspace/docs/{documentType}
   * - 无版本: workspace/{applicationId}/{projectId}/ainative-workspace/docs/{documentType}
   *
   * @param workspacePath 要解析的路径
   * @param defaultDocumentType 默认文档类型（如果路径中没有）
   * @returns 解析出的 WorkspaceOptions，如果无法解析则返回 undefined
   */
  static parseWorkspacePath(workspacePath: string, defaultDocumentType?: string): WorkspaceOptions | undefined {
    if (!workspacePath) return undefined;

    const pathParts = workspacePath.split(path.sep).filter((p) => p);

    // 查找关键目录标识
    const workspaceRootIndex = pathParts.findIndex((p) => p === 'workspace');
    const versionsIndex = pathParts.findIndex((p) => p === VERSIONS_DIR_NAME);
    const docsIndex = pathParts.findIndex((p) => p === 'docs');

    if (workspaceRootIndex === -1) {
      return undefined;
    }

    // 提取 applicationId 和 projectId
    const applicationId = pathParts[workspaceRootIndex + 1];
    const projectId = pathParts[workspaceRootIndex + 2];

    if (!applicationId || !projectId) {
      return undefined;
    }

    // 提取 versionId（如果存在 versions 目录）
    let versionId: string | undefined;
    if (versionsIndex !== -1 && versionsIndex === workspaceRootIndex + 3) {
      versionId = pathParts[versionsIndex + 1];
    }

    // 提取 documentType（从 docs 目录后面）
    let documentType: string | undefined;
    if (docsIndex !== -1 && docsIndex < pathParts.length - 1) {
      documentType = pathParts[docsIndex + 1];
    }

    return {
      applicationId,
      projectId,
      versionId,
      documentType: documentType || defaultDocumentType,
    };
  }

  /**
   * 获取版本目录的父目录路径
   * 目录结构：workspace/{applicationId}/{projectId}/versions
   */
  static getVersionsDir(options: WorkspaceOptions): string {
    if (!options?.applicationId) {
      throw new Error('applicationId is required for versions directory.');
    }
    if (!options?.projectId) {
      throw new Error('projectId is required for versions directory.');
    }

    const workspaceRoot = this.getWorkspaceRoot();
    return path.join(workspaceRoot, options.applicationId, options.projectId, VERSIONS_DIR_NAME);
  }

  /**
   * 列出项目的所有版本目录
   */
  static async listVersionDirs(options: WorkspaceOptions): Promise<string[]> {
    const versionsDir = this.getVersionsDir(options);

    try {
      await fs.access(versionsDir);
      const entries = await fs.readdir(versionsDir, { withFileTypes: true });
      return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
    } catch {
      return [];
    }
  }

  /**
   * 检查版本工作空间是否存在
   */
  static versionWorkspaceExists(options: WorkspaceOptions): boolean {
    if (!options.versionId) {
      return false;
    }
    const workspacePath = this.getProjectWorkspacePath(options);
    return fsSync.existsSync(workspacePath);
  }

  /**
   * 检查workspace目录是否为空（排除.git、.cursor等隐藏文件/目录）
   * @param options workspace选项
   * @returns 如果目录不存在、为空或只包含隐藏文件/目录，返回true；否则返回false
   */
  static async isWorkspaceEmpty(options: WorkspaceOptions): Promise<boolean> {
    const workspacePath = this.getProjectWorkspacePath(options);

    // 如果目录不存在，视为空
    if (!fsSync.existsSync(workspacePath)) {
      return true;
    }

    try {
      // 读取目录内容
      const entries = await fs.readdir(workspacePath, { withFileTypes: true });

      // 需要排除的隐藏目录/文件（以.开头）
      const hiddenPatterns = ['.git', '.cursor', '.DS_Store', '.vscode', '.idea'];

      // 检查是否有任何可见的文件/目录
      for (const entry of entries) {
        const name = entry.name;

        // 如果文件名以.开头，检查是否在排除列表中
        if (name.startsWith('.')) {
          // 如果不在排除列表中，或者不是常见的隐藏文件，视为可见内容
          if (!hiddenPatterns.includes(name)) {
            // 有些隐藏文件可能是用户创建的，视为非空
            return false;
          }
          // 如果在排除列表中，继续检查下一个
          continue;
        }

        // 如果文件名不以.开头，肯定是可见内容
        return false;
      }

      // 如果所有条目都是隐藏文件/目录，视为空
      return true;
    } catch (error: any) {
      logger.warn('WorkspaceManager: Failed to check if workspace is empty', {
        workspacePath,
        error: error.message,
      });
      // 如果读取失败，保守地返回false（视为非空）
      return false;
    }
  }

  /**
   * 从源目录复制工作空间到目标版本目录
   * 用于从主工作空间或其他版本创建新版本
   */
  static async copyWorkspaceToVersion(sourceOptions: WorkspaceOptions, targetVersionId: string): Promise<string> {
    const sourcePath = this.getProjectWorkspacePath(sourceOptions);
    const targetOptions = { ...sourceOptions, versionId: targetVersionId };
    const targetPath = this.getProjectWorkspacePath(targetOptions);
    const targetParent = path.dirname(targetPath);

    // 确保源目录存在
    if (!fsSync.existsSync(sourcePath)) {
      throw new Error(`Source workspace does not exist: ${sourcePath}`);
    }

    // 确保目标父目录存在
    await fs.mkdir(targetParent, { recursive: true });

    // 如果目标已存在，删除它
    if (fsSync.existsSync(targetPath)) {
      await fs.rm(targetPath, { recursive: true, force: true });
    }

    // 复制目录
    await this.copyDirectory(sourcePath, targetPath);

    logger.info('WorkspaceManager: Copied workspace to version', {
      sourcePath,
      targetPath,
      versionId: targetVersionId,
    });

    return targetPath;
  }

  /**
   * 递归复制目录
   */
  private static async copyDirectory(src: string, dest: string): Promise<void> {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }

  /**
   * 删除版本工作空间
   */
  static async deleteVersionWorkspace(options: WorkspaceOptions): Promise<boolean> {
    if (!options.versionId) {
      throw new Error('versionId is required to delete version workspace.');
    }

    const workspacePath = this.getProjectWorkspacePath(options);

    try {
      if (fsSync.existsSync(workspacePath)) {
        await fs.rm(workspacePath, { recursive: true, force: true });
        logger.info('WorkspaceManager: Deleted version workspace', {
          workspacePath,
          versionId: options.versionId,
        });
      }
      return true;
    } catch (error: any) {
      logger.error('WorkspaceManager: Failed to delete version workspace', {
        workspacePath,
        error: error.message,
      });
      return false;
    }
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
   * 检查是否是用户自定义的Git仓库（非模板仓库）
   * 通过检查远程URL来判断
   */
  static isUserRepository(options: WorkspaceOptions): boolean {
    const projectWorkspace = this.getProjectWorkspacePath(options);
    const gitDir = path.join(projectWorkspace, '.git');

    if (!fsSync.existsSync(gitDir)) {
      return false;
    }

    try {
      // 获取远程URL
      const remoteUrl = execSync('git remote get-url origin', {
        cwd: projectWorkspace,
        stdio: 'pipe',
        encoding: 'utf-8',
      }).trim();

      // 如果远程URL不是模板仓库，则认为是用户仓库
      const isTemplate = remoteUrl.includes('ainative-workspace');
      return !isTemplate;
    } catch {
      // 如果无法获取远程URL，假设不是用户仓库
      return false;
    }
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

      // 执行 git clone（指定 master 分支）
      logger.info('WorkspaceManager: Cloning template repository', {
        repo: TEMPLATE_REPO,
        targetDir: projectWorkspace,
        branch: 'master',
      });

      execSync(`git clone -b master ${TEMPLATE_REPO} ${WORKSPACE_DIR_NAME}`, {
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
   * 如果是用户自定义仓库，则跳过此操作
   */
  static async pullTemplate(options: WorkspaceOptions): Promise<void> {
    const projectWorkspace = this.getProjectWorkspacePath(options);

    // 如果是用户仓库，跳过模板操作
    if (this.isUserRepository(options)) {
      logger.info('WorkspaceManager: Skipping template pull for user repository', { projectWorkspace });
      return;
    }

    if (!this.isTemplateCloned(options)) {
      // 如果没有克隆，先克隆
      await this.cloneTemplate(options);
      return;
    }

    try {
      logger.info('WorkspaceManager: Pulling latest template updates', {
        projectWorkspace,
        branch: 'master',
      });

      execSync('git pull origin master', {
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
   * 如果是用户自定义的Git仓库，则跳过模板操作
   */
  static async initWorkspace(options: WorkspaceOptions): Promise<string> {
    // 检查是否是用户自定义的Git仓库
    if (this.isUserRepository(options)) {
      logger.info('WorkspaceManager: User repository detected, skipping template operations', {
        projectWorkspace: this.getProjectWorkspacePath(options),
      });
    } else {
      // 克隆或拉取最新模板项目（pullTemplate 内部会处理：未克隆则克隆，已克隆则 pull）
      await this.pullTemplate(options);
    }

    // 清理 CLI 误创建的无效文件（包含中文、Mermaid 语法等）
    await this.cleanInvalidFiles(options);

    // 确保 docs 目录存在
    const docsDir = this.getDocsDir(options);
    await fs.mkdir(docsDir, { recursive: true });

    logger.info('WorkspaceManager: Workspace initialized', {
      projectWorkspace: this.getProjectWorkspacePath(options),
      docsDir,
      isUserRepository: this.isUserRepository(options),
    });

    return docsDir;
  }

  /**
   * 重新初始化workspace（通用方法）
   * 删除现有workspace目录并重新初始化，支持用户自定义git仓库和模板仓库两种场景
   * @param options workspace选项
   * @param gitRepoUrl 可选的git仓库URL（如果提供，将使用用户仓库；否则使用模板）
   * @param branchName 可选的分支名称（如果提供，将切换到该分支）
   * @returns 初始化结果
   */
  static async reinitializeWorkspace(
    options: WorkspaceOptions,
    gitRepoUrl?: string,
    branchName?: string
  ): Promise<{ success: boolean; message: string }> {
    const workspacePath = this.getProjectWorkspacePath(options);

    logger.info('WorkspaceManager: Reinitializing workspace', {
      workspacePath,
      hasGitRepo: !!gitRepoUrl,
      branchName,
    });

    try {
      // 1. 删除现有workspace目录（如果存在）
      if (fsSync.existsSync(workspacePath)) {
        logger.info('WorkspaceManager: Deleting existing workspace', { workspacePath });
        await fs.rm(workspacePath, { recursive: true, force: true });
      }

      // 2. 根据是否有gitRepoUrl选择初始化方式
      if (gitRepoUrl) {
        // 使用用户自定义git仓库
        const gitService = new GitService();
        const prepareResult = await gitService.prepareRepository({
          gitRepoUrl,
          workspacePath,
          projectId: options.projectId || 'unknown',
        });

        if (!prepareResult.success) {
          logger.warn('WorkspaceManager: Failed to clone user repository, falling back to template', {
            workspacePath,
            gitRepoUrl,
            error: prepareResult.message,
          });
          // 如果克隆失败，回退到模板初始化
          await this.initWorkspace(options);
        } else {
          logger.info('WorkspaceManager: Successfully cloned user repository', {
            workspacePath,
            gitRepoUrl,
          });

          // 3. 如果有branchName，切换到对应分支
          if (branchName && gitService.isGitRepository(workspacePath)) {
            // 检查分支是否存在
            const localExists = await gitService.branchExistsLocally(workspacePath, branchName);
            const remoteExists = await gitService.branchExistsRemotely(workspacePath, branchName);

            if (localExists || remoteExists) {
              // 分支存在，切换到该分支
              const checkoutResult = await gitService.checkoutBranch(workspacePath, branchName);
              if (checkoutResult.success) {
                logger.info('WorkspaceManager: Successfully checked out branch', {
                  workspacePath,
                  branchName,
                });
              } else {
                logger.warn('WorkspaceManager: Failed to checkout branch', {
                  workspacePath,
                  branchName,
                  error: checkoutResult.message,
                });
              }
            } else {
              // 分支不存在，创建新分支
              const branchResult = await gitService.createBranch(workspacePath, branchName, true);
              if (branchResult.success) {
                logger.info('WorkspaceManager: Successfully created branch', {
                  workspacePath,
                  branchName,
                });

                // 推送分支到远程
                const pushResult = await gitService.pushChanges(workspacePath, branchName);
                if (pushResult.success) {
                  logger.info('WorkspaceManager: Successfully pushed branch to remote', {
                    workspacePath,
                    branchName,
                  });
                } else {
                  logger.warn('WorkspaceManager: Failed to push branch to remote', {
                    workspacePath,
                    branchName,
                    error: pushResult.message,
                  });
                }
              } else {
                logger.warn('WorkspaceManager: Failed to create branch', {
                  workspacePath,
                  branchName,
                  error: branchResult.message,
                });
              }
            }
          }

          // 确保docs目录存在
          const docsDir = this.getDocsDir(options);
          await fs.mkdir(docsDir, { recursive: true });
        }
      } else {
        // 使用模板初始化
        await this.initWorkspace(options);
        logger.info('WorkspaceManager: Successfully initialized workspace with template', {
          workspacePath,
        });
      }

      return {
        success: true,
        message: 'Workspace reinitialized successfully',
      };
    } catch (error: any) {
      logger.error('WorkspaceManager: Failed to reinitialize workspace', {
        workspacePath,
        error: error.message,
      });
      return {
        success: false,
        message: `Failed to reinitialize workspace: ${error.message}`,
      };
    }
  }

  /**
   * 保存文件到 workspace 的 docs 目录
   * @param filePath 相对路径（相对于 docs 目录）
   * @param content 文件内容
   * @param options workspace选项
   */
  static async saveToWorkspace(filePath: string, content: string, options?: WorkspaceOptions): Promise<void> {
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
  static async saveFilesToWorkspace(files: Array<{ path: string; content: string }>, options?: WorkspaceOptions): Promise<void> {
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
  static async readAllFromWorkspace(options?: WorkspaceOptions, filter?: (filename: string) => boolean): Promise<string> {
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
      const sortedEntries = filteredEntries.sort((a, b) => a.name.localeCompare(b.name));

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
  static async fileExists(filePath: string, options?: WorkspaceOptions): Promise<boolean> {
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
  static async readFile(filePath: string, options?: WorkspaceOptions): Promise<string | null> {
    if (!options) {
      throw new Error('WorkspaceOptions is required for readFile.');
    }
    try {
      const docsDir = this.getDocsDir(options);
      const fullPath = path.join(docsDir, filePath);
      const content = await fs.readFile(fullPath, 'utf-8');
      return content;
    } catch (error: any) {
      // 文件不存在是正常情况，使用 debug 级别日志
      if (error.code === 'ENOENT') {
        logger.debug('WorkspaceManager: File does not exist', {
          filePath,
        });
      } else {
        logger.error('WorkspaceManager: Failed to read file', {
          filePath,
          error: error.message,
        });
      }
      return null;
    }
  }

  /**
   * 删除 workspace docs 目录中的文件
   * @param filePath 相对路径（相对于 docs 目录）
   * @param options workspace选项
   * @returns 是否成功删除
   */
  static async deleteFile(filePath: string, options?: WorkspaceOptions): Promise<boolean> {
    if (!options) {
      throw new Error('WorkspaceOptions is required for deleteFile.');
    }
    try {
      const docsDir = this.getDocsDir(options);
      const fullPath = path.join(docsDir, filePath);
      await fs.unlink(fullPath);
      logger.info('WorkspaceManager: Deleted file from workspace', {
        filePath: fullPath,
      });
      return true;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // 文件不存在，视为成功
        logger.debug('WorkspaceManager: File does not exist, skip delete', {
          filePath,
        });
        return true;
      }
      logger.error('WorkspaceManager: Failed to delete file', {
        filePath,
        error: error.message,
      });
      return false;
    }
  }

  /**
   * 删除匹配模式的多个文件
   * @param pattern 文件名匹配模式（正则表达式）
   * @param options workspace选项
   * @returns 删除的文件数量
   */
  static async deleteFilesByPattern(pattern: RegExp, options?: WorkspaceOptions): Promise<number> {
    if (!options) {
      throw new Error('WorkspaceOptions is required for deleteFilesByPattern.');
    }
    try {
      const docsDir = this.getDocsDir(options);

      // 检查目录是否存在
      try {
        await fs.access(docsDir);
      } catch {
        logger.debug('WorkspaceManager: Docs directory does not exist', { docsDir });
        return 0;
      }

      const entries = await fs.readdir(docsDir, { withFileTypes: true });
      const filesToDelete = entries.filter((entry) => entry.isFile() && pattern.test(entry.name));

      let deletedCount = 0;
      for (const entry of filesToDelete) {
        const success = await this.deleteFile(entry.name, options);
        if (success) {
          deletedCount++;
        }
      }

      logger.info('WorkspaceManager: Deleted files by pattern', {
        pattern: pattern.toString(),
        deletedCount,
        totalMatched: filesToDelete.length,
        docsDir,
      });

      return deletedCount;
    } catch (error: any) {
      logger.error('WorkspaceManager: Failed to delete files by pattern', {
        pattern: pattern.toString(),
        error: error.message,
      });
      return 0;
    }
  }

  /**
   * 列出 workspace docs 目录中的文件
   * @param options workspace选项
   * @param filter 可选的文件过滤函数
   * @returns 文件名数组
   */
  static async listFiles(options?: WorkspaceOptions, filter?: (filename: string) => boolean): Promise<string[]> {
    if (!options) {
      throw new Error('WorkspaceOptions is required for listFiles.');
    }
    try {
      const docsDir = this.getDocsDir(options);

      // 检查目录是否存在
      try {
        await fs.access(docsDir);
      } catch {
        return [];
      }

      const entries = await fs.readdir(docsDir, { withFileTypes: true });
      const files = entries.filter((entry) => entry.isFile()).map((entry) => entry.name);

      if (filter) {
        return files.filter(filter);
      }

      return files;
    } catch (error: any) {
      logger.error('WorkspaceManager: Failed to list files', {
        error: error.message,
      });
      return [];
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
  static async saveToSrc(filePath: string, content: string, options: WorkspaceOptions): Promise<void> {
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

  // ============================================
  // 清理无效文件方法
  // ============================================

  /**
   * 清理 workspace 根目录下的无效文件
   * CLI 可能误创建包含中文、特殊字符的文件，需要定期清理
   * @param options workspace选项
   * @returns 删除的文件数量
   */
  static async cleanInvalidFiles(options: WorkspaceOptions): Promise<number> {
    const projectWorkspace = this.getProjectWorkspacePath(options);

    try {
      // 检查目录是否存在
      try {
        await fs.access(projectWorkspace);
      } catch {
        return 0;
      }

      const entries = await fs.readdir(projectWorkspace, { withFileTypes: true });
      let cleanedCount = 0;

      for (const entry of entries) {
        // 只处理文件，不处理目录
        if (!entry.isFile()) continue;

        // 检查文件名是否无效
        if (this.isInvalidFileName(entry.name)) {
          const filePath = path.join(projectWorkspace, entry.name);
          await fs.unlink(filePath);
          cleanedCount++;
          logger.info('WorkspaceManager: Cleaned invalid file', {
            filename: entry.name,
            projectWorkspace,
          });
        }
      }

      if (cleanedCount > 0) {
        logger.info('WorkspaceManager: Cleaned invalid files', {
          cleanedCount,
          projectWorkspace,
        });
      }

      return cleanedCount;
    } catch (error: any) {
      logger.warn('WorkspaceManager: Failed to clean invalid files', {
        error: error.message,
        projectWorkspace,
      });
      return 0;
    }
  }

  /**
   * 检查文件名是否无效（应该被清理）
   * @param filename 文件名
   * @returns 是否是无效文件名
   */
  private static isInvalidFileName(filename: string): boolean {
    // 白名单：合法的文件名模式
    const validPatterns = [
      /^\./, // 隐藏文件（.gitignore 等）
      /^[A-Za-z0-9_-]+\.(md|json|yaml|yml|toml|txt|sh|js|ts|cjs|mjs)$/, // 常规文件
      /^Makefile$/, // Makefile
      /^README/, // README 文件
      /^AGENTS/, // AGENTS 文件
      /^LICENSE/, // LICENSE 文件
      /^CHANGELOG/, // CHANGELOG 文件
    ];

    // 如果匹配任何白名单模式，则是合法文件
    if (validPatterns.some((pattern) => pattern.test(filename))) {
      return false;
    }

    // 无效文件特征
    const invalidPatterns = [
      /[\u4e00-\u9fa5]/, // 包含中文字符
      /：/, // 包含全角冒号
      /[[\]{}()]/, // 包含 Mermaid 语法括号
      // eslint-disable-next-line no-useless-escape
      /-->/, // 包含 Mermaid 箭头
    ];

    // 如果匹配任何无效模式，则需要清理
    return invalidPatterns.some((pattern) => pattern.test(filename));
  }
}
