/**
 * Skill Loader
 * 工具函数：读取skill文件内容
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from './logger';
import { WorkspaceManager } from './WorkspaceManager';

/**
 * 读取skill文件内容
 * @param skillName skill名称（如 'version-review'）
 * @param fileName 文件名（默认为 'SKILL.md'）
 * @returns skill文件内容，如果文件不存在则返回空字符串
 */
export async function loadSkillContent(skillName: string, fileName: string = 'SKILL.md'): Promise<string> {
  try {
    // 优先从项目根目录的skills目录读取
    const projectRoot = WorkspaceManager.getProjectRootPath();
    const skillPath = path.join(projectRoot, 'skills', skillName, fileName);

    const content = await fs.readFile(skillPath, 'utf-8');
    logger.debug('SkillLoader: Loaded skill content', {
      skillName,
      fileName,
      path: skillPath,
      contentLength: content.length,
    });

    return content;
  } catch (error: any) {
    logger.warn('SkillLoader: Failed to load skill content', {
      skillName,
      fileName,
      error: error.message,
    });
    return '';
  }
}

/**
 * 读取skill的参考文件内容
 * @param skillName skill名称
 * @param referenceFileName 参考文件名（如 'examples.md'）
 * @returns 参考文件内容，如果文件不存在则返回空字符串
 */
export async function loadSkillReference(skillName: string, referenceFileName: string): Promise<string> {
  try {
    const projectRoot = WorkspaceManager.getProjectRootPath();
    const referencePath = path.join(projectRoot, 'skills', skillName, referenceFileName);

    const content = await fs.readFile(referencePath, 'utf-8');
    logger.debug('SkillLoader: Loaded skill reference', {
      skillName,
      referenceFileName,
      path: referencePath,
      contentLength: content.length,
    });

    return content;
  } catch (error: any) {
    logger.warn('SkillLoader: Failed to load skill reference', {
      skillName,
      referenceFileName,
      error: error.message,
    });
    return '';
  }
}

/**
 * 从skill内容中提取特定章节
 * @param skillContent skill文件内容
 * @param sectionTitle 章节标题（如 '#### Round 1: Business Rules Conflict Check'）
 * @returns 章节内容，如果未找到则返回空字符串
 */
export function extractSkillSection(skillContent: string, sectionTitle: string): string {
  // 转义特殊字符
  const escapedTitle = sectionTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // 匹配章节标题及其后的内容，直到下一个####或更高层级的标题或文件结束
  // 使用非贪婪匹配，匹配到下一个####或###或##或#标题
  const regex = new RegExp(`${escapedTitle}([\\s\\S]*?)(?=\\n####|\\n###|\\n##|\\n#|$)`, 'i');

  const match = skillContent.match(regex);
  if (match && match[1]) {
    return match[1].trim();
  }

  return '';
}
