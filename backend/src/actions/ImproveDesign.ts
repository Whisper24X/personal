/**
 * ImproveDesign Action
 * Improves System Design Document based on review reports
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import {
  DESIGN_IMPROVE_SYSTEM_PROMPT,
  buildDesignImprovePrompt,
} from '../prompts/design';
import { logger, loadPrompt, WorkspaceOptions } from '../utils';
import {
  buildCLISaveInstruction,
  isCLISummaryOutput,
  tryReadActualDocumentFromWorkspace,
} from '../utils/stepwise';

export interface ImproveDesignOptions extends WorkspaceOptions {
  reviewReport?: string; // 审查报告内容，如果不提供则从workspace读取
}

export class ImproveDesign extends BaseAction {
  constructor() {
    super('ImproveDesign', 'Improve System Design Document based on review reports');
  }

  async run(
    input: string, // 审查报告内容或Design内容
    options?: ImproveDesignOptions
  ): Promise<IActionOutput> {
    // 尝试从 options 或 context 中获取 applicationId
    let applicationId = options?.applicationId;
    if (!applicationId) {
      // 尝试从 context 中获取
      applicationId = this.context?.get('applicationId') as string | undefined;
    }
    
    if (!applicationId) {
      throw new Error('applicationId is required for ImproveDesign action. Please provide it in options or context.');
    }
    
    // 尝试从 options 或 context 中获取 projectId
    const projectId = options?.projectId || (this.context?.get('projectId') as string | undefined);
    const version = options?.version || (this.context?.get('version') as number | undefined) || 1;

    logger.info('ImproveDesign: Starting design improvement', {
      applicationId,
      projectId,
      version,
      hasReviewReport: !!options?.reviewReport,
      inputLength: input.length,
    });

    try {
      // Step 1: 读取当前Design文档
      const currentDesign = await this.readWorkspaceFile('DESIGN.md', {
        applicationId,
        projectId,
        version,
        documentType: 'DESIGN',
        workspacePath: options?.workspacePath,
      });

      if (!currentDesign) {
        throw new Error(
          'Cannot find Design document in workspace. Please generate it first.'
        );
      }

      // Step 2: 读取审查报告
      // 如果输入本身就是审查报告内容，优先使用输入
      let reviewReport = options?.reviewReport;
      
      // 如果没有提供审查报告，尝试从workspace读取
      if (!reviewReport) {
        // 检查输入是否看起来像审查报告（包含"审查报告"关键字）
        if (input && (input.includes('审查报告') || input.includes('改进建议'))) {
          reviewReport = input;
          logger.info('ImproveDesign: Using input as review report', {
            inputLength: input.length,
          });
        } else {
          // 从workspace读取审查报告
          reviewReport = await this.readReviewReport({
            applicationId,
            projectId,
            version,
            documentType: 'DESIGN',
            workspacePath: options?.workspacePath,
          });
        }
      }

      if (!reviewReport) {
        throw new Error(
          'Cannot find review report for Design. Please provide review report as input or run DesignReview first.'
        );
      }

      logger.info('ImproveDesign: Loaded documents', {
        designLength: currentDesign.length,
        reviewReportLength: reviewReport.length,
      });

      // Step 3: 从当前文档中移除审查报告部分（如果存在），只保留原始文档内容
      const cleanDesign = this.removeReviewReport(currentDesign);
      
      // Step 4: 根据审查报告改进文档
      const workspaceOpts: WorkspaceOptions = {
        applicationId,
        projectId,
        version,
        documentType: 'DESIGN',
        workspacePath: options?.workspacePath,
      };
      let improvedDesign = await this.improveDesign(
        cleanDesign,
        reviewReport,
        workspaceOpts
      );

      // Step 5: 确保改进后的文档不包含审查报告部分（再次移除，以防LLM在改进时添加了审查报告）
      improvedDesign = this.removeReviewReport(improvedDesign);

      // Step 6: 保存改进后的文档（只有当内容不是CLI总结时才保存）
      if (!isCLISummaryOutput(improvedDesign)) {
        await this.saveToWorkspace('DESIGN.md', improvedDesign, workspaceOpts);
      }

      logger.info('ImproveDesign: Design improved and saved', {
        improvedLength: improvedDesign.length,
      });

      return {
        content: improvedDesign,
        data: {
          type: 'design_improved',
          documentType: 'DESIGN',
          timestamp: new Date().toISOString(),
          originalLength: currentDesign.length,
          improvedLength: improvedDesign.length,
        },
      };
    } catch (error: any) {
      logger.error('ImproveDesign: Failed to improve design', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * 读取审查报告
   */
  private async readReviewReport(
    options: any
  ): Promise<string | null> {
    // 尝试读取审查报告文件
    let reviewReport = await this.readWorkspaceFile('DESIGN_REVIEW.md', options);
    
    // 如果找不到审查报告文件，尝试从主文档末尾提取（有些审查报告会附加在文档末尾）
    if (!reviewReport) {
      const mainDocument = await this.readWorkspaceFile('DESIGN.md', options);
      if (mainDocument) {
        // 尝试提取审查报告部分（通常在文档末尾，以"---"分隔，然后以审查报告标题开头）
        const reviewPattern = /---\s*\n\s*#\s*系统设计文档\s*审查报告[\s\S]*$/;
        const simplePattern = /#\s*系统设计文档\s*审查报告[\s\S]*$/;
        
        const reviewMatch = mainDocument.match(reviewPattern);
        if (reviewMatch) {
          // 移除开头的 "---" 分隔符
          reviewReport = reviewMatch[0].replace(/^---\s*\n\s*/, '');
        } else {
          // 如果没有找到分隔符，尝试直接匹配审查报告标题
          const simpleMatch = mainDocument.match(simplePattern);
          if (simpleMatch) {
            reviewReport = simpleMatch[0];
          }
        }
      }
    }
    
    return reviewReport;
  }

  /**
   * 改进Design文档
   */
  private async improveDesign(
    currentDesign: string,
    reviewReport: string,
    workspaceOptions?: WorkspaceOptions
  ): Promise<string> {
    // Load system prompt from database or use default
    const userId = this.context?.get('userId');
    const systemPrompt = await loadPrompt(
      userId,
      'design',
      'improve_system_prompt',
      DESIGN_IMPROVE_SYSTEM_PROMPT
    );

    // 构建改进提示词
    let prompt = buildDesignImprovePrompt(currentDesign, reviewReport);

    // CLI 模式处理
    const isCLIMode = this.isCLIMode();

    // CLI 模式下，在 prompt 中指定文件保存路径和限制指令
    if (isCLIMode && workspaceOptions?.applicationId) {
      const savePath = `${this.getWorkspaceDir(workspaceOptions)}/DESIGN.md`;
      const saveInstruction = buildCLISaveInstruction(savePath, '改进后的设计文档');
      prompt += saveInstruction;
      
      logger.info('ImproveDesign: Added CLI save path instruction', { savePath });
    }

    // 调用LLM/CLI改进文档
    const cliOutput = await this.aask(prompt, [systemPrompt]);
    
    if (isCLIMode && isCLISummaryOutput(cliOutput)) {
      logger.info('ImproveDesign: CLI output appears to be a summary, reading actual file from workspace', {
        cliOutputLength: cliOutput.length,
        cliOutputPreview: cliOutput.substring(0, 200),
      });
      
      // 尝试从workspace读取CLI实际改进的文件
      if (workspaceOptions) {
        const workspaceDir = this.getWorkspaceDir(workspaceOptions);
        const actualContent = await tryReadActualDocumentFromWorkspace(workspaceDir, {
          mainFileName: 'DESIGN.md',
          filePattern: 'design',
        });
        
        if (actualContent) {
          logger.info('ImproveDesign: Successfully read actual improved document from workspace', {
            actualContentLength: actualContent.length,
          });
          return actualContent;
        }
      }
      
      // 如果找不到实际文件，返回原设计内容
      logger.warn('ImproveDesign: Could not find actual improved document in workspace, keeping original', {
        originalLength: currentDesign.length,
      });
      return currentDesign;
    }

    logger.info('ImproveDesign: Design improved by LLM', {
      improvedLength: cliOutput.length,
    });

    return cliOutput;
  }

  /**
   * 从文档中移除审查报告部分
   * 注意：只移除审查报告标题及其之后的内容，保留文档中其他的 --- 分隔符
   */
  private removeReviewReport(document: string): string {
    // 定义审查报告的标题模式（匹配 # 系统设计文档 审查报告 或 # 系统设计文档审查报告）
    const reviewTitlePattern = /#\s*系统设计文档\s*审查报告/;
    
    // 查找审查报告标题的位置
    const titleMatchIndex = document.search(reviewTitlePattern);
    
    if (titleMatchIndex === -1) {
      // 如果没有找到审查报告标题，返回原文档
      return document;
    }
    
    // 获取审查报告标题之前的内容
    let beforeTitle = document.substring(0, titleMatchIndex);
    
    // 只移除紧邻审查报告标题之前的 "---" 分隔符（如果存在）
    // 不要移除文档中其他位置的 --- 分隔符，因为它们可能是章节之间的分隔
    // 只检查最后几行是否是 --- 分隔符
    const lines = beforeTitle.split('\n');
    
    // 从后往前检查，只移除紧邻标题的空行和 --- 分隔符
    let trimEnd = lines.length;
    for (let i = lines.length - 1; i >= 0 && i >= lines.length - 5; i--) {
      const line = lines[i].trim();
      if (line === '') {
        // 空行，继续检查
        trimEnd = i;
      } else if (line === '---') {
        // 找到紧邻的分隔符，移除它和之后的空行
        trimEnd = i;
        break;
      } else {
        // 遇到非空、非分隔符的行，停止检查
        break;
      }
    }
    
    // 返回处理后的内容
    const result = lines.slice(0, trimEnd).join('\n').trim();
    
    logger.info('ImproveDesign: Removed review report from document', {
      originalLength: document.length,
      resultLength: result.length,
      removedFromIndex: titleMatchIndex,
    });
    
    return result;
  }
}

export default ImproveDesign;
