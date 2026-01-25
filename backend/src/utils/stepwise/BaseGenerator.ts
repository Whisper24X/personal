/**
 * BaseGenerator
 * 文档生成器基类，包含共享逻辑和 Workspace 操作
 */

import { BaseAction } from '../../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import { logger } from '../logger';
import * as fs from 'fs/promises';
import * as path from 'path';
import { StepState, StepwiseGenerationConfig, LogContext } from './types';

/**
 * Abstract base class for document generators
 * Contains shared logic for workspace operations, cancellation control, and logging
 */
export abstract class BaseGenerator {
  protected action: BaseAction;
  protected config: StepwiseGenerationConfig;
  protected abortController?: AbortController;
  protected isCancelled: boolean = false;

  constructor(action: BaseAction, config: StepwiseGenerationConfig) {
    this.action = action;
    this.config = config;
    this.abortController = new AbortController();
  }

  /**
   * Abstract method to be implemented by subclasses
   * Main entry point for document generation
   */
  abstract generate(input: string): Promise<IActionOutput>;

  /**
   * 获取日志上下文信息（角色和action名称）
   */
  protected getLogContext(): LogContext {
    return {
      role: this.config.role,
      actionName: this.action.name,
    };
  }

  /**
   * Reset generator state
   * Called during rollback to stop ongoing operations
   */
  async reset(abortSignal?: AbortSignal): Promise<void> {
    const logContext = this.getLogContext();
    logger.info('BaseGenerator: Resetting generator', {
      ...logContext,
      documentType: this.config.documentType,
      projectId: this.config.projectId,
    });

    // Set cancellation flag
    this.isCancelled = true;

    // Abort ongoing operations
    if (this.abortController) {
      this.abortController.abort();
    }

    if (abortSignal?.aborted) {
      logger.info('BaseGenerator: Already aborted via signal', logContext);
      return;
    }

    // Create new AbortController for future operations
    this.abortController = new AbortController();
    // Keep isCancelled = true until generate() is called again
    // This ensures checkCancellation() will throw if called after reset

    logger.info('BaseGenerator: Reset completed', logContext);
  }

  /**
   * Check if operation should be cancelled
   */
  protected async checkCancellation(): Promise<void> {
    const logContext = this.getLogContext();
    
    // Check local cancellation flag
    if (this.isCancelled) {
      logger.info('BaseGenerator: Operation cancelled (local flag)', logContext);
      throw new Error('BaseGenerator: Operation cancelled');
    }
    
    // Check local abortController
    if (this.abortController?.signal.aborted) {
      logger.info('BaseGenerator: Operation cancelled (local abortController)', logContext);
      throw new Error('BaseGenerator: Operation cancelled');
    }
    
    // Check Action's abortSignal (from StateManager)
    // This is the critical check - when reset-workflow is called, StateManager aborts its controller
    // and the Action's abortSignal is set from that controller
    const actionAbortSignal = (this.action as any).abortSignal;
    if (actionAbortSignal?.aborted) {
      logger.info('BaseGenerator: Operation cancelled via Action abortSignal', {
        ...logContext,
        actionAbortSignalAborted: true,
      });
      throw new Error('BaseGenerator: Operation cancelled via Action abortSignal');
    }
  }

  /**
   * Set step state (for logging purposes)
   */
  protected async setStepState(stepId: string, status: StepState): Promise<void> {
    const logContext = this.getLogContext();
    logger.debug('BaseGenerator: Step state changed', {
      ...logContext,
      stepId,
      status,
    });
  }

  /**
   * Ensure workspace directory exists
   * Note: Workspace initialization (clone/pull) is done during version creation,
   * here we only ensure the output directory exists
   */
  protected async initWorkspace(): Promise<void> {
    if (this.config.workspaceDir) {
      const logContext = this.getLogContext();
      logger.info('BaseGenerator: Ensuring workspace directory exists', {
        ...logContext,
        workspaceDir: this.config.workspaceDir,
      });
      await fs.mkdir(this.config.workspaceDir, { recursive: true });
      logger.info('BaseGenerator: Workspace directory ready', logContext);
    }
  }

  /**
   * 保存文件到 workspace
   */
  protected async saveToWorkspace(filePath: string, content: string): Promise<void> {
    try {
      const fullPath = path.join(this.config.workspaceDir, filePath);
      const dir = path.dirname(fullPath);
      const logContext = this.getLogContext();

      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(fullPath, content, 'utf-8');

      logger.info('BaseGenerator: Saved file to workspace', {
        ...logContext,
        filePath: fullPath,
        contentLength: content.length,
      });
    } catch (error: any) {
      const logContext = this.getLogContext();
      logger.error('BaseGenerator: Failed to save file to workspace', {
        ...logContext,
        filePath,
        error: error.message,
      });
    }
  }

  /**
   * 读取 workspace 中的主文件内容（PRD.md）
   */
  protected async readMainFileFromWorkspace(): Promise<string> {
    try {
      const logContext = this.getLogContext();
      // 检查目录是否存在
      try {
        await fs.access(this.config.workspaceDir);
      } catch {
        logger.warn('BaseGenerator: Workspace directory does not exist', {
          ...logContext,
          workspaceDir: this.config.workspaceDir,
        });
        return '';
      }

      // 直接读取主文件（PRD.md）
      // 确保返回的是完整的PRD内容，而不是监控检测信息或其他文件
      const mainFilePath = path.join(this.config.workspaceDir, this.config.mainFileName);
      try {
        const content = await fs.readFile(mainFilePath, 'utf-8');
        logger.info('BaseGenerator: Read main file from workspace', {
          ...logContext,
          mainFileName: this.config.mainFileName,
          contentLength: content.length,
          isCompletePRD: true,
        });
        // 确保返回的是完整的PRD内容
        return content;
      } catch (error: any) {
        logger.warn('BaseGenerator: Main file not found, trying to read all files', {
          ...logContext,
          mainFileName: this.config.mainFileName,
          error: error.message,
        });
        // 如果主文件不存在，尝试读取所有文件（向后兼容）
        // 注意：readAllFromWorkspace会排除review文件，只返回PRD相关文件
        return await this.readAllFromWorkspace();
      }
    } catch (error: any) {
      const logContext = this.getLogContext();
      logger.error('BaseGenerator: Failed to read main file from workspace', {
        ...logContext,
        error: error.message,
        workspaceDir: this.config.workspaceDir,
        mainFileName: this.config.mainFileName,
      });
      return '';
    }
  }

  /**
   * 读取 workspace 中的所有文件内容（向后兼容方法）
   */
  protected async readAllFromWorkspace(): Promise<string> {
    try {
      const logContext = this.getLogContext();
      // 检查目录是否存在
      try {
        await fs.access(this.config.workspaceDir);
      } catch {
        logger.warn('BaseGenerator: Workspace directory does not exist', {
          ...logContext,
          workspaceDir: this.config.workspaceDir,
        });
        return '';
      }

      const files: string[] = [];
      const entries = await fs.readdir(this.config.workspaceDir, { withFileTypes: true });

      // 按文件名排序（确保顺序：outline -> sections -> main）
      // 排除review文件和其他非PRD文件，确保只返回完整的PRD内容，而不是监控检测信息
      const sortedEntries = entries
        .filter(entry => {
          // 只包含PRD相关文件，排除review文件和其他非PRD文件
          if (!entry.isFile() || !entry.name.endsWith('.md')) return false;
          // 排除review文件
          if (entry.name.includes('review') || entry.name.includes('Review')) return false;
          // 排除final文件
          if (entry.name.endsWith('-final.md')) return false;
          return true;
        })
        .sort((a, b) => {
          if (a.name === '00-outline.md') return -1;
          if (b.name === '00-outline.md') return 1;
          // 主文件优先
          if (a.name === this.config.mainFileName) return -1;
          if (b.name === this.config.mainFileName) return 1;
          return a.name.localeCompare(b.name);
        });

      for (const entry of sortedEntries) {
        const filePath = path.join(this.config.workspaceDir, entry.name);
        const content = await fs.readFile(filePath, 'utf-8');
        if (content.startsWith('#')) {
          files.push(content);
        } else {
          files.push(`# ${entry.name.replace('.md', '')}\n\n${content}`);
        }
      }

      return files.join('\n\n---\n\n');
    } catch (error: any) {
      const logContext = this.getLogContext();
      logger.error('BaseGenerator: Failed to read files from workspace', {
        ...logContext,
        error: error.message,
        workspaceDir: this.config.workspaceDir,
      });
      return '';
    }
  }
}
