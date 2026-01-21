/**
 * Zip Utilities
 * Utilities for creating zip archives from directories or files
 */

import archiver from 'archiver';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';
import { WorkspaceManager, WorkspaceOptions } from './WorkspaceManager';

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
 * 新目录结构：workspace/{applicationId}/{projectId}/ainative-workspace
 * @param options Workspace options
 * @param outputPath Optional output path (defaults to temp directory)
 */
export async function createWorkspaceZip(
  options: WorkspaceOptions,
  outputPath?: string
): Promise<string> {
  // applicationId 和 projectId 必须提供
  if (!options.applicationId) {
    throw new Error('applicationId is required for createWorkspaceZip.');
  }
  if (!options.projectId) {
    throw new Error('projectId is required for createWorkspaceZip.');
  }
  
  const applicationId = options.applicationId;
  const projectId = options.projectId;
  
  // Get the project workspace path (ainative-workspace directory)
  const projectWorkspace = WorkspaceManager.getProjectWorkspacePath(options);

  // Generate output path if not provided
  if (!outputPath) {
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    outputPath = path.join(tempDir, `${applicationId}-${projectId}-workspace.zip`);
  }

  // Check if workspace exists
  if (!fs.existsSync(projectWorkspace)) {
    logger.info('ZipUtils: Workspace does not exist, creating empty workspace archive', {
      applicationId,
      projectId,
      projectWorkspace,
    });
    
    // Create a temporary directory structure for the zip
    const tempWorkspaceDir = path.join(process.cwd(), 'temp', `workspace-${Date.now()}`);
    fs.mkdirSync(tempWorkspaceDir, { recursive: true });
    
    // Create a README file
    const readmePath = path.join(tempWorkspaceDir, 'README.md');
    fs.writeFileSync(
      readmePath,
      `# Workspace Archive\n\nThis workspace was created automatically.\n\nApplication ID: ${applicationId}\nProject ID: ${projectId}\n\nNo files have been generated yet.\n\nTo enable code generation, set ENGINEER_AUTO_CODE=true in your .env file.\n`
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

  // Create zip from the ainative-workspace directory
  logger.info('ZipUtils: Creating workspace zip', {
    applicationId,
    projectId,
    projectWorkspace,
  });

  return await createZipFromDirectory(projectWorkspace, outputPath, { includeRoot: true });
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
    if (!options.applicationId) {
      throw new Error('applicationId is required for createCodeZip.');
    }
    if (!options.projectId) {
      throw new Error('projectId is required for createCodeZip.');
    }
    const applicationId = options.applicationId;
    const projectId = options.projectId;
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    outputPath = path.join(tempDir, `${applicationId}-${projectId}-code.zip`);
  }

  return await createZipFromFiles(files, outputPath);
}
