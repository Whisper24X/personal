/**
 * Zip Utilities
 * Utilities for creating zip archives from directories or files
 */

import archiver from 'archiver';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';
import { WorkspaceOptions } from './WorkspaceManager';

/**
 * Create a zip archive from a directory
 * @param sourceDir Directory to zip
 * @param outputPath Output zip file path
 * @param options Optional zip options
 */
export async function createZipFromDirectory(
  sourceDir: string,
  outputPath: string,
  options?: {
    includeRoot?: boolean; // Whether to include the root directory name in the zip
  }
): Promise<string> {
  return new Promise((resolve, reject) => {
    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', {
      zlib: { level: 9 }, // Maximum compression
    });

    output.on('close', () => {
      logger.info('Zip archive created', {
        sourceDir,
        outputPath,
        size: archive.pointer(),
      });
      resolve(outputPath);
    });

    archive.on('error', (err) => {
      logger.error('Failed to create zip archive', {
        sourceDir,
        outputPath,
        error: err.message,
      });
      reject(err);
    });

    archive.pipe(output);

    // Add directory to archive
    if (options?.includeRoot) {
      archive.directory(sourceDir, path.basename(sourceDir));
    } else {
      archive.directory(sourceDir, false);
    }

    archive.finalize();
  });
}

/**
 * Create a zip archive from multiple files
 * @param files Array of files with path and content
 * @param outputPath Output zip file path
 */
export async function createZipFromFiles(
  files: Array<{ path: string; content: string }>,
  outputPath: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', {
      zlib: { level: 9 }, // Maximum compression
    });

    output.on('close', () => {
      logger.info('Zip archive created from files', {
        fileCount: files.length,
        outputPath,
        size: archive.pointer(),
      });
      resolve(outputPath);
    });

    archive.on('error', (err) => {
      logger.error('Failed to create zip archive from files', {
        outputPath,
        error: err.message,
      });
      reject(err);
    });

    archive.pipe(output);

    // Add files to archive
    for (const file of files) {
      archive.append(file.content, { name: file.path });
    }

    archive.finalize();
  });
}

/**
 * Create a zip archive from workspace directory
 * @param options Workspace options
 * @param outputPath Optional output path (defaults to temp directory)
 */
export async function createWorkspaceZip(
  options: WorkspaceOptions,
  outputPath?: string
): Promise<string> {
  const applicationId = options.applicationId || 'default';
  const version = options.version || 1;
  
  // Calculate workspace root
  const possibleRoots = [
    path.resolve(__dirname, '../../../'),
    path.resolve(__dirname, '../../../../'),
    process.cwd(),
  ];
  
  let projectRoot = possibleRoots[0];
  for (const root of possibleRoots) {
    if (
      fs.existsSync(path.join(root, 'pnpm-workspace.yaml')) ||
      fs.existsSync(path.join(root, 'package.json'))
    ) {
      projectRoot = root;
      break;
    }
  }
  
  const workspaceRoot =
    options?.workspacePath ||
    process.env.WORKSPACE_PATH ||
    path.join(projectRoot, 'workspace');

  // Generate output path if not provided
  if (!outputPath) {
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    outputPath = path.join(tempDir, `${applicationId}-v${version}-workspace.zip`);
  }

  // Check if workspace root exists
  if (!fs.existsSync(workspaceRoot)) {
    logger.warn('ZipUtils: Workspace root does not exist, creating empty workspace', {
      workspaceRoot,
    });
    fs.mkdirSync(workspaceRoot, { recursive: true });
  }

  // Find all workspace directories for this application and version
  // 新的目录结构：workspace/{applicationId}/v{version}/{documentType}/
  const workspaceDirs: Array<{ name: string; path: string }> = [];
  const documentTypes = ['PRD', 'DESIGN', 'TASKS', 'CODE', 'REQUIREMENT', 'DOCS'];
  
  try {
    // 检查应用目录是否存在：workspace/{applicationId}/
    const applicationDir = path.join(workspaceRoot, applicationId);
    if (fs.existsSync(applicationDir)) {
      // 检查版本目录是否存在：workspace/{applicationId}/v{version}/
      const versionDir = path.join(applicationDir, `v${version}`);
      if (fs.existsSync(versionDir)) {
        // 遍历版本目录下的所有文档类型目录
        const entries = fs.readdirSync(versionDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory() && documentTypes.includes(entry.name)) {
            const dirPath = path.join(versionDir, entry.name);
            // Check if directory has files
            try {
              const files = fs.readdirSync(dirPath);
              if (files.length > 0) {
                // 使用相对路径作为名称，保持目录结构
                const relativePath = path.join(applicationId, `v${version}`, entry.name);
                workspaceDirs.push({
                  name: relativePath,
                  path: dirPath,
                });
              }
            } catch {
              // Skip directories we can't read
            }
          }
        }
      }
    }
  } catch (error: any) {
    logger.warn('ZipUtils: Failed to search for workspace directories', {
      error: error.message,
    });
  }

  // If no workspace directories found, create an empty one
  if (workspaceDirs.length === 0) {
    logger.info('ZipUtils: No workspace directories found, creating empty workspace archive', {
      applicationId,
      version,
    });
    
    // Create a temporary directory structure for the zip
    const tempWorkspaceDir = path.join(process.cwd(), 'temp', `workspace-${Date.now()}`);
    fs.mkdirSync(tempWorkspaceDir, { recursive: true });
    
    // Create a README file
    const readmePath = path.join(tempWorkspaceDir, 'README.md');
    fs.writeFileSync(
      readmePath,
      `# Workspace Archive\n\nThis workspace was created automatically.\n\nApplication ID: ${applicationId}\nVersion: ${version}\n\nNo files have been generated yet.\n\nTo enable code generation, set ENGINEER_AUTO_CODE=true in your .env file.\n`
    );
    
    // Create zip from temporary directory
    const zipPath = await createZipFromDirectory(tempWorkspaceDir, outputPath, { includeRoot: false });
    
    // Clean up temporary directory
    try {
      fs.rmSync(tempWorkspaceDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    
    return zipPath;
  }

  // If we have workspace directories, create a zip containing all of them
  // We'll create a temporary directory structure
  const tempWorkspaceDir = path.join(process.cwd(), 'temp', `workspace-${Date.now()}`);
  fs.mkdirSync(tempWorkspaceDir, { recursive: true });

  try {
    // Copy all workspace directories to temp directory
    for (const dir of workspaceDirs) {
      const destDir = path.join(tempWorkspaceDir, dir.name);
      // Copy directory recursively
      copyDirectoryRecursive(dir.path, destDir);
    }

    // Create zip from temporary directory
    const zipPath = await createZipFromDirectory(tempWorkspaceDir, outputPath, { includeRoot: false });
    
    logger.info('ZipUtils: Created workspace zip from multiple directories', {
      directories: workspaceDirs.map(d => d.name),
      zipPath,
    });
    
    return zipPath;
  } finally {
    // Clean up temporary directory
    try {
      fs.rmSync(tempWorkspaceDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Copy directory recursively
 */
function copyDirectoryRecursive(src: string, dest: string): void {
  if (!fs.existsSync(src)) {
    return;
  }

  fs.mkdirSync(dest, { recursive: true });
  
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDirectoryRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Create a zip archive from generated code files
 * @param files Array of code files
 * @param options Workspace options
 * @param outputPath Optional output path (defaults to temp directory)
 */
export async function createCodeZip(
  files: Array<{ path: string; content: string }>,
  options: WorkspaceOptions,
  outputPath?: string
): Promise<string> {
  // Generate output path if not provided
  if (!outputPath) {
    const applicationId = options.applicationId || 'default';
    const version = options.version || 1;
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    outputPath = path.join(tempDir, `${applicationId}-v${version}-code.zip`);
  }

  return await createZipFromFiles(files, outputPath);
}

