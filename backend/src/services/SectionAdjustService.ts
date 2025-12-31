/**
 * Section Adjust Service
 * 用于调整 PRD 章节内容的服务
 */

// import { BaseAction } from '../core/base/BaseAction'; // Unused
import { Context } from '../core/context/Context';
import { WritePRD } from '../actions/WritePRD';
import { buildPRDSectionAdjustPrompt, PRD_SYSTEM_PROMPT } from '../prompts/prd';
import { extractSectionContent, replaceSectionContent } from '../utils/sectionParser';
import { logger } from '../utils';
import * as fs from 'fs/promises';
import * as path from 'path';
import { getWorkspaceDir } from '../utils/StepwiseDocumentGenerator';

export interface SectionAdjustOptions {
  projectId: string;
  prdId: string;
  sectionNumber: number;
  userRequest: string;
  applicationId?: string;
  version?: number;
  workspacePath?: string;
  documentType?: 'PRD' | 'REQUIREMENT' | 'DESIGN';
}

export class SectionAdjustService {
  /**
   * 调整章节内容
   */
  async adjustSection(options: SectionAdjustOptions): Promise<{
    success: boolean;
    updatedContent: string;
    sectionContent: string;
  }> {
    const { projectId, prdId, sectionNumber, userRequest, applicationId, version, workspacePath, documentType = 'PRD' } = options;

    logger.info('SectionAdjustService: Starting section adjustment', {
      projectId,
      prdId,
      sectionNumber,
      documentType,
      userRequestLength: userRequest.length,
    });

    try {
      // 1. 获取 workspace 目录
      const workspaceDocType = documentType === 'REQUIREMENT' ? 'REQUIREMENT' : 'PRD';
      const workspaceDir = getWorkspaceDir(workspaceDocType, {
        applicationId,
        version,
        workspacePath,
      });

      // 2. 确定主文档文件名
      const mainFileName = documentType === 'REQUIREMENT' ? 'REQUIREMENT_SPEC.md' : 'PRD.md';

      // 3. 读取章节文件
      const sectionFileName = `${String(sectionNumber).padStart(2, '0')}-section-${sectionNumber}.md`;
      const sectionFilePath = path.join(workspaceDir, sectionFileName);

      let originalSectionContent: string;
      let fullPRDContent: string | undefined;

      try {
        // 尝试从 workspace 读取章节文件
        originalSectionContent = await fs.readFile(sectionFilePath, 'utf-8');
        logger.info('SectionAdjustService: Read section from workspace file', {
          filePath: sectionFilePath,
        });

        // 尝试读取完整文档作为上下文
        const mainFilePath = path.join(workspaceDir, mainFileName);
        try {
          fullPRDContent = await fs.readFile(mainFilePath, 'utf-8');
        } catch {
          // 如果读取失败，忽略
          logger.warn('SectionAdjustService: Could not read full document for context', {
            filePath: mainFilePath,
          });
        }
      } catch (error: any) {
        // 如果文件不存在，尝试从数据库读取 PRD 并解析章节
        logger.warn('SectionAdjustService: Section file not found, trying database', {
          error: error.message,
          workspaceDir,
        });

        try {
          const { DocumentRepository } = await import('../database/repositories/DocumentRepository');
          const documentRepo = new DocumentRepository();
          const prd = await documentRepo.findPRDById(prdId);

          if (prd) {
            fullPRDContent = prd.content;
            const extractedContent = extractSectionContent(prd.content, sectionNumber);
            
            if (extractedContent) {
              originalSectionContent = extractedContent;
            } else {
              throw new Error(`Section ${sectionNumber} not found in PRD`);
            }
          } else {
            // 如果数据库中没有，尝试从 workspace 的主文档文件读取
            const mainFilePath = path.join(workspaceDir, mainFileName);
            try {
              fullPRDContent = await fs.readFile(mainFilePath, 'utf-8');
              const extractedContent = extractSectionContent(fullPRDContent, sectionNumber);
              if (extractedContent) {
                originalSectionContent = extractedContent;
              } else {
                throw new Error(`Section ${sectionNumber} not found in workspace ${mainFileName}`);
              }
            } catch (workspaceError: any) {
              throw new Error(`Section ${sectionNumber} not found. Please ensure the document has been generated.`);
            }
          }
        } catch (dbError: any) {
          // 如果数据库读取也失败，尝试从 workspace 的主文档文件读取
          const mainFilePath = path.join(workspaceDir, mainFileName);
          try {
            fullPRDContent = await fs.readFile(mainFilePath, 'utf-8');
            const extractedContent = extractSectionContent(fullPRDContent, sectionNumber);
            if (extractedContent) {
              originalSectionContent = extractedContent;
            } else {
              throw new Error(`Section ${sectionNumber} not found in workspace ${mainFileName}`);
            }
          } catch (workspaceError: any) {
            throw new Error(`Section ${sectionNumber} not found. Please ensure the document has been generated.`);
          }
        }
      }

      // 3. 解析章节标题
      const sectionTitleMatch = originalSectionContent.match(/^##\s+\d+\.\s+(.+)$/m);
      const sectionTitle = sectionTitleMatch 
        ? sectionTitleMatch[1].trim()
        : `章节 ${sectionNumber}`;

      // 4. 使用大模型调整章节
      const ctx = new Context();
      const writePRDAction = new WritePRD();
      writePRDAction.setLLM(ctx.llm);

      const adjustPrompt = buildPRDSectionAdjustPrompt(
        originalSectionContent,
        sectionNumber,
        sectionTitle,
        userRequest,
        fullPRDContent
      );

      const adjustedContent = await (writePRDAction as any).aask(adjustPrompt, [PRD_SYSTEM_PROMPT]);

      logger.info('SectionAdjustService: Section adjusted successfully', {
        sectionNumber,
        originalLength: originalSectionContent.length,
        adjustedLength: adjustedContent.length,
      });

      // 5. 保存调整后的章节到 workspace
      try {
        await fs.mkdir(workspaceDir, { recursive: true });
        await fs.writeFile(sectionFilePath, adjustedContent, 'utf-8');
        logger.info('SectionAdjustService: Saved adjusted section to workspace', {
          filePath: sectionFilePath,
        });
      } catch (error: any) {
        logger.warn('SectionAdjustService: Failed to save to workspace', {
          error: error.message,
        });
      }

      // 6. 如果存在完整 PRD，更新其中的章节
      let updatedPRDContent: string | undefined;
      if (fullPRDContent) {
        updatedPRDContent = replaceSectionContent(
          fullPRDContent,
          sectionNumber,
          adjustedContent
        );

        // 保存更新后的文档
        try {
          const mainFilePath = path.join(workspaceDir, mainFileName);
          await fs.writeFile(mainFilePath, updatedPRDContent, 'utf-8');
          logger.info(`SectionAdjustService: Updated ${mainFileName} in workspace`);
        } catch (error: any) {
          logger.warn(`SectionAdjustService: Failed to update ${mainFileName}`, {
            error: error.message,
          });
        }
      }

      return {
        success: true,
        updatedContent: updatedPRDContent || adjustedContent,
        sectionContent: adjustedContent,
      };
    } catch (error: any) {
      logger.error('SectionAdjustService: Failed to adjust section', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * 获取章节列表
   */
  async getSections(
    prdContent: string,
    workspaceDir?: string
  ): Promise<Array<{ number: number; title: string; content?: string }>> {
    try {
      // 尝试从 workspace 读取章节文件
      if (workspaceDir) {
        try {
          await fs.access(workspaceDir);
          const entries = await fs.readdir(workspaceDir, { withFileTypes: true });
          const sectionFiles = entries
            .filter(entry => 
              entry.isFile() && 
              entry.name.match(/^\d{2}-section-\d+\.md$/)
            )
            .sort((a, b) => a.name.localeCompare(b.name));

          const sections = [];
          for (const entry of sectionFiles) {
            const match = entry.name.match(/^(\d{2})-section-(\d+)\.md$/);
            if (match) {
              const sectionNumber = parseInt(match[2]);
              const filePath = path.join(workspaceDir, entry.name);
              const content = await fs.readFile(filePath, 'utf-8');
              const titleMatch = content.match(/^##\s+\d+\.\s+(.+)$/m);
              const title = titleMatch ? titleMatch[1].trim() : `章节 ${sectionNumber}`;
              
              sections.push({
                number: sectionNumber,
                title,
                content: content.trim(),
              });
            }
          }

          if (sections.length > 0) {
            return sections;
          }
        } catch {
          // 如果 workspace 不存在，继续从内容解析
        }
      }

      // 从 PRD 内容解析章节
      const { parseSectionsFromContent } = await import('../utils/sectionParser');
      const sections = parseSectionsFromContent(prdContent);
      return sections.map(s => ({
        number: s.number,
        title: s.title,
        content: s.content?.trim(),
      }));
    } catch (error: any) {
      logger.error('SectionAdjustService: Failed to get sections', {
        error: error.message,
      });
      return [];
    }
  }
}

