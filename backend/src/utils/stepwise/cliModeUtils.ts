/**
 * CLI Mode Utility Functions
 * CLI 模式通用工具函数
 * 
 * 提供 CLI 模式下的通用处理逻辑，包括：
 * - 检测 CLI 输出是否为操作总结
 * - 从 workspace 读取 CLI 实际生成的文档
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../logger';

/**
 * CLI 总结输出的特征关键词
 */
const CLI_SUMMARY_KEYWORDS = [
  '已完成',
  '主要变更如下',
  '改进如下',
  '审查结果',
  '文档已保存',
  '保存至',
  '已生成',
  '生成完成',
  '改进完成',
  '审核完成',
  '已更新',
  '更新完成',
];

/**
 * 默认排除的文件模式
 */
const DEFAULT_EXCLUDE_PATTERNS = ['review', 'Review', 'REVIEW', 'outline', 'OUTLINE'];

/**
 * 检查 CLI 输出是否为操作总结（而非实际文档内容）
 * CLI 工具通常返回操作总结，而不是实际的文档内容
 * 
 * @param output CLI 输出内容
 * @returns 是否为操作总结
 */
export function isCLISummaryOutput(output: string): boolean {
  if (!output || output.trim().length === 0) return false;
  
  const trimmed = output.trim();
  
  // 检查是否包含总结关键词
  const hasSummaryKeyword = CLI_SUMMARY_KEYWORDS.some(keyword => trimmed.includes(keyword));
  
  // 检查是否不像一个正式文档（正式文档通常以 # 标题开头）
  const startsWithTitle = /^#\s+/.test(trimmed);
  
  // 检查内容长度（总结通常较短，文档通常较长）
  const isShort = trimmed.length < 1000;
  
  // 如果包含总结关键词，且要么不以标题开头，要么内容很短，则认为是总结
  if (hasSummaryKeyword && (!startsWithTitle || isShort)) {
    return true;
  }
  
  return false;
}

/**
 * tryReadActualDocumentFromWorkspace 的配置选项
 */
export interface TryReadDocumentOptions {
  /** 主文件名，如 'MRD.md' */
  mainFileName: string;
  /** 文件名匹配模式（小写），如 'mrd'，用于在父目录中查找 */
  filePattern?: string;
  /** 排除模式列表，默认排除 review、outline 等 */
  excludePatterns?: string[];
  /** 最小有效文档长度，默认 500 */
  minDocumentLength?: number;
}

/**
 * 尝试从 workspace 读取 CLI 实际生成/改进的文档
 * CLI 可能将文件保存到不同位置，需要查找最合适的文件
 * 
 * @param workspaceDir workspace 目录路径
 * @param options 配置选项
 * @returns 实际文档内容，如果找不到则返回 null
 */
export async function tryReadActualDocumentFromWorkspace(
  workspaceDir: string,
  options: TryReadDocumentOptions
): Promise<string | null> {
  const {
    mainFileName,
    filePattern,
    excludePatterns = DEFAULT_EXCLUDE_PATTERNS,
    minDocumentLength = 500,
  } = options;

  try {
    // 检查 workspace 目录是否存在
    try {
      await fs.access(workspaceDir);
    } catch {
      logger.warn('cliModeUtils: Workspace directory does not exist', {
        workspaceDir,
      });
      return null;
    }

    // 读取目录中的所有 md 文件
    const entries = await fs.readdir(workspaceDir, { withFileTypes: true });
    
    // 筛选 md 文件，排除指定模式的文件
    const documentFiles = entries
      .filter(entry => {
        if (!entry.isFile() || !entry.name.endsWith('.md')) return false;
        // 排除指定模式的文件
        for (const pattern of excludePatterns) {
          if (entry.name.includes(pattern)) return false;
        }
        // 排除 section 文件
        if (/^\d+-section-/.test(entry.name)) return false;
        return true;
      })
      .map(entry => entry.name);

    logger.info('cliModeUtils: Found document files in workspace', {
      workspaceDir,
      files: documentFiles,
      mainFileName,
    });

    // 优先读取主文件
    if (documentFiles.includes(mainFileName)) {
      const mainFilePath = path.join(workspaceDir, mainFileName);
      const content = await fs.readFile(mainFilePath, 'utf-8');
      
      // 检查主文件内容是否为有效文档（不是 CLI 总结）
      if (content && !isCLISummaryOutput(content)) {
        logger.info('cliModeUtils: Found valid content in main file', {
          mainFileName,
          contentLength: content.length,
        });
        return content;
      }
      
      // 主文件是摘要或无效，返回null（不应该读取其他文件）
      logger.warn('cliModeUtils: Main file exists but content is invalid (summary or empty)', {
        mainFileName,
        contentLength: content?.length || 0,
        isSummary: content ? isCLISummaryOutput(content) : false,
      });
      return null;
    }

    // 主文件不存在，返回null（不读取其他文件，避免误读）
    logger.warn('cliModeUtils: Main file not found in workspace', {
      workspaceDir,
      mainFileName,
      availableFiles: documentFiles,
    });
    return null;
  } catch (error: any) {
    logger.error('cliModeUtils: Failed to read actual document from workspace', {
      workspaceDir,
      error: error.message,
    });
    return null;
  }
}

/**
 * tryReadActualReviewFromWorkspace 的配置选项
 */
export interface TryReadReviewOptions {
  /** 审核报告文件名，如 'MRD_REVIEW.md' */
  reviewFileName: string;
  /** 文件名匹配模式（小写），如 'mrd_review'，用于在父目录中查找 */
  filePattern?: string;
  /** 最小有效文档长度，默认 100 */
  minDocumentLength?: number;
}

/**
 * 尝试从 workspace 读取 CLI 实际生成的审核报告
 * 
 * @param workspaceDir workspace 目录路径
 * @param options 配置选项
 * @returns 审核报告内容，如果找不到则返回 null
 */
export async function tryReadActualReviewFromWorkspace(
  workspaceDir: string,
  options: TryReadReviewOptions
): Promise<string | null> {
  const {
    reviewFileName,
    filePattern,
    minDocumentLength = 100,
  } = options;

  try {
    // 检查 workspace 目录是否存在
    try {
      await fs.access(workspaceDir);
    } catch {
      logger.warn('cliModeUtils: Workspace directory does not exist for review', {
        workspaceDir,
      });
      return null;
    }

    // 优先读取指定的审核报告文件
    const reviewFilePath = path.join(workspaceDir, reviewFileName);
    try {
      const content = await fs.readFile(reviewFilePath, 'utf-8');
      if (content && !isCLISummaryOutput(content) && content.length > minDocumentLength) {
        logger.info('cliModeUtils: Found valid review content', {
          reviewFileName,
          contentLength: content.length,
        });
        return content;
      }
    } catch {
      // 文件不存在，继续查找
    }

    // 读取目录中的所有 review 相关文件
    const entries = await fs.readdir(workspaceDir, { withFileTypes: true });
    
    const reviewFiles = entries
      .filter(entry => {
        if (!entry.isFile() || !entry.name.endsWith('.md')) return false;
        // 只查找 review 相关文件
        return entry.name.toLowerCase().includes('review');
      })
      .map(entry => entry.name);

    // 查找其他可能的审核报告文件（按修改时间排序）
    const fileStats = await Promise.all(
      reviewFiles
        .filter(name => name !== reviewFileName)
        .map(async (name) => {
          const filePath = path.join(workspaceDir, name);
          const stat = await fs.stat(filePath);
          return { name, filePath, mtime: stat.mtime };
        })
    );

    fileStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

    for (const fileStat of fileStats) {
      const content = await fs.readFile(fileStat.filePath, 'utf-8');
      if (content && !isCLISummaryOutput(content) && content.length > minDocumentLength) {
        logger.info('cliModeUtils: Found actual review in workspace', {
          filename: fileStat.name,
          contentLength: content.length,
        });
        return content;
      }
    }

    // 如果指定了文件模式，也检查父目录
    if (filePattern) {
      const parentDir = path.dirname(workspaceDir);
      try {
        await fs.access(parentDir);
        const parentEntries = await fs.readdir(parentDir, { withFileTypes: true });
        
        const parentReviewFiles = parentEntries
          .filter(entry => {
            if (!entry.isFile() || !entry.name.endsWith('.md')) return false;
            return entry.name.toLowerCase().includes(filePattern.toLowerCase());
          })
          .map(entry => entry.name);

        for (const fileName of parentReviewFiles) {
          const filePath = path.join(parentDir, fileName);
          const content = await fs.readFile(filePath, 'utf-8');
          
          if (content && !isCLISummaryOutput(content) && content.length > minDocumentLength) {
            logger.info('cliModeUtils: Found actual review in parent directory', {
              filename: fileName,
              contentLength: content.length,
            });
            return content;
          }
        }
      } catch {
        // 父目录不存在或无法访问，忽略
      }
    }

    return null;
  } catch (error: any) {
    logger.error('cliModeUtils: Failed to read actual review from workspace', {
      workspaceDir,
      error: error.message,
    });
    return null;
  }
}
