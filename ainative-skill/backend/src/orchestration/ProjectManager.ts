/**
 * Project Manager
 * Handles file system operations for generated projects
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../utils';

export class ProjectManager {
  private workspaceRoot: string;

  constructor(workspaceRoot: string = './workspace') {
    this.workspaceRoot = workspaceRoot;
  }

  /**
   * Create a new project directory
   */
  async createProject(projectName: string): Promise<string> {
    const projectPath = path.join(this.workspaceRoot, projectName);
    
    try {
      await fs.mkdir(projectPath, { recursive: true });
      logger.info(`ProjectManager: Created project directory at ${projectPath}`);
      return projectPath;
    } catch (error: any) {
      logger.error(`ProjectManager: Failed to create project directory`, error);
      throw error;
    }
  }

  /**
   * Write a file to the project
   */
  async writeFile(projectPath: string, filename: string, content: string): Promise<void> {
    const filePath = path.join(projectPath, filename);
    const dir = path.dirname(filePath);
    
    try {
      // Ensure directory exists
      await fs.mkdir(dir, { recursive: true });
      
      // Write file
      await fs.writeFile(filePath, content, 'utf-8');
      
      logger.info(`ProjectManager: Wrote file ${filename}`);
    } catch (error: any) {
      logger.error(`ProjectManager: Failed to write file ${filename}`, error);
      throw error;
    }
  }

  /**
   * Write multiple files to the project
   */
  async writeFiles(
    projectPath: string,
    files: Array<{ path: string; content: string }>
  ): Promise<void> {
    const writePromises = files.map((file) =>
      this.writeFile(projectPath, file.path, file.content)
    );
    
    await Promise.all(writePromises);
    logger.info(`ProjectManager: Wrote ${files.length} files`);
  }

  /**
   * Read a file from the project
   */
  async readFile(projectPath: string, filename: string): Promise<string> {
    const filePath = path.join(projectPath, filename);
    
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return content;
    } catch (error: any) {
      logger.error(`ProjectManager: Failed to read file ${filename}`, error);
      throw error;
    }
  }

  /**
   * Check if a file exists
   */
  async fileExists(projectPath: string, filename: string): Promise<boolean> {
    const filePath = path.join(projectPath, filename);
    
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * List files in project directory
   */
  async listFiles(projectPath: string): Promise<string[]> {
    try {
      const files = await fs.readdir(projectPath, { recursive: true });
      return files.map((f) => f.toString());
    } catch (error: any) {
      logger.error(`ProjectManager: Failed to list files`, error);
      return [];
    }
  }

  /**
   * Delete project directory
   */
  async deleteProject(projectPath: string): Promise<void> {
    try {
      await fs.rm(projectPath, { recursive: true, force: true });
      logger.info(`ProjectManager: Deleted project at ${projectPath}`);
    } catch (error: any) {
      logger.error(`ProjectManager: Failed to delete project`, error);
      throw error;
    }
  }

  /**
   * Get project path
   */
  getProjectPath(projectName: string): string {
    return path.join(this.workspaceRoot, projectName);
  }
}

export default ProjectManager;

