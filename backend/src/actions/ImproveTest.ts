/**
 * ImproveTest Action
 * Improves test cases document based on review reports
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import {
  TEST_IMPROVE_SYSTEM_PROMPT,
  buildTestImprovePrompt,
} from '../prompts/test';
import { logger, loadPrompt, WorkspaceOptions } from '../utils';
import { WorkspaceManager } from '../utils/WorkspaceManager';
import {
  buildCLISaveInstruction,
  isCLISummaryOutput,
  tryReadActualDocumentFromWorkspace,
} from '../utils/stepwise';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface ImproveTestOptions extends WorkspaceOptions {
  reviewReport?: string; // 审查报告内容，如果不提供则从workspace读取
}

export class ImproveTest extends BaseAction {
  constructor() {
    super('ImproveTest', 'Improve test cases document based on review reports');
  }

  async run(
    input: string, // 审查报告内容或测试用例内容
    options?: ImproveTestOptions
  ): Promise<IActionOutput> {
    // 尝试从 options 或 context 中获取 applicationId
    let applicationId = options?.applicationId;
    if (!applicationId) {
      // 尝试从 context 中获取
      applicationId = this.context?.get('applicationId') as string | undefined;
    }
    
    if (!applicationId) {
      throw new Error('applicationId is required for ImproveTest action. Please provide it in options or context.');
    }
    
    // 尝试从 options 或 context 中获取 projectId
    const projectId = options?.projectId || (this.context?.get('projectId') as string | undefined);
    const version = options?.version || (this.context?.get('version') as number | undefined) || 1;
    if (!projectId) {
      throw new Error('projectId is required for ImproveTest action. Please provide it in options or context.');
    }

    const workspaceOptions: WorkspaceOptions = {
      applicationId,
      projectId,
      version,
      documentType: 'TEST',
      workspacePath: options?.workspacePath,
    };

    logger.info('ImproveTest: Starting test cases improvement', {
      applicationId,
      projectId,
      version,
      hasReviewReport: !!options?.reviewReport,
      inputLength: input.length,
    });

    try {
      const inputIsReviewReport = this.looksLikeReviewReport(input);

      // Step 1: 读取当前测试用例文档（优先workspace，缺失时可回退到输入）
      let currentTestCases = await this.readWorkspaceFile('TEST.md', workspaceOptions);
      if (!currentTestCases && !inputIsReviewReport && input.trim().length > 0) {
        currentTestCases = input;
        logger.info('ImproveTest: Using input as test cases content', {
          inputLength: input.length,
        });
      }

      if (!currentTestCases) {
        throw new Error(
          'Cannot find test cases document in workspace. Please generate it first.'
        );
      }

      // Step 2: 读取审查报告
      // 如果输入本身就是审查报告内容，优先使用输入
      let reviewReport = options?.reviewReport;
      
      // 如果没有提供审查报告，尝试从workspace读取
      if (!reviewReport) {
        // 检查输入是否看起来像审查报告（包含"审查报告"关键字）
        if (inputIsReviewReport) {
          reviewReport = input;
          logger.info('ImproveTest: Using input as review report', {
            inputLength: input.length,
          });
        } else {
          // 从workspace读取审查报告
          reviewReport = await this.readReviewReport(workspaceOptions, currentTestCases);
        }
      }

      if (!reviewReport) {
        throw new Error(
          'Cannot find review report for test cases. Please provide review report as input or run TestReview first.'
        );
      }

      // Step 3: 读取 PRD 和代码作为参考（可选）
      let prd = '';
      let code = '';

      try {
        const prdFromWorkspace = await WorkspaceManager.readFile('PRD.md', {
          applicationId,
          projectId,
          version,
          documentType: 'PRD',
          workspacePath: options?.workspacePath,
        });

        if (prdFromWorkspace) {
          prd = prdFromWorkspace;
          logger.info('ImproveTest: Loaded PRD from workspace', {
            prdLength: prd.length,
          });
        }
      } catch (error: any) {
        logger.warn('ImproveTest: Failed to read PRD from workspace', {
          error: error.message,
        });
      }

      try {
        const codeFromWorkspace = await this.readCodeFromWorkspace({
          applicationId,
          projectId,
          version,
          documentType: 'CODE',
          workspacePath: options?.workspacePath,
        });

        if (codeFromWorkspace) {
          code = codeFromWorkspace;
          logger.info('ImproveTest: Loaded code from workspace', {
            codeLength: code.length,
          });
        }
      } catch (error: any) {
        logger.warn('ImproveTest: Failed to read code from workspace', {
          error: error.message,
        });
      }

      logger.info('ImproveTest: Loaded documents', {
        testCasesLength: currentTestCases.length,
        reviewReportLength: reviewReport.length,
        hasPRD: !!prd,
        hasCode: !!code,
      });

      // Step 4: 从当前文档中移除审查报告部分（如果存在），只保留原始文档内容
      const cleanTestCases = this.removeReviewReport(currentTestCases);
      
      // Step 5: 根据审查报告改进文档
      let improvedTestCases = await this.improveTestCases(
        cleanTestCases,
        reviewReport,
        prd,
        code,
        workspaceOptions
      );

      // Step 6: 确保改进后的文档不包含审查报告部分（再次移除，以防LLM在改进时添加了审查报告）
      improvedTestCases = this.removeReviewReport(improvedTestCases);

      // Step 7: 保存改进后的文档（只有当内容不是CLI总结时才保存）
      if (!isCLISummaryOutput(improvedTestCases)) {
        await this.saveToWorkspace('TEST.md', improvedTestCases, workspaceOptions);
      }

      logger.info('ImproveTest: Test cases improved and saved', {
        improvedLength: improvedTestCases.length,
      });

      return {
        content: improvedTestCases,
        data: {
          type: 'test_improved',
          documentType: 'TEST',
          timestamp: new Date().toISOString(),
          originalLength: currentTestCases.length,
          improvedLength: improvedTestCases.length,
        },
      };
    } catch (error: any) {
      logger.error('ImproveTest: Failed to improve test cases', {
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
    options: WorkspaceOptions,
    currentTestCases?: string
  ): Promise<string | null> {
    // 尝试读取审查报告文件
    let reviewReport = await this.readWorkspaceFile('TEST_REVIEW.md', options);
    if (!reviewReport) {
      reviewReport = await this.readWorkspaceFile('TEST-review.md', options);
    }
    
    // 如果找不到审查报告文件，尝试从主文档末尾提取（有些审查报告会附加在文档末尾）
    if (!reviewReport) {
      const mainDocument = currentTestCases || await this.readWorkspaceFile('TEST.md', options);
      if (mainDocument) {
        // 尝试提取审查报告部分（通常在文档末尾，以"---"分隔，然后以审查报告标题开头）
        const reviewPattern = /---\s*\n\s*#\s*测试用例\s*审查报告[\s\S]*$/;
        const simplePattern = /#\s*测试用例\s*审查报告[\s\S]*$/;
        
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
   * 检查输入是否更像审查报告
   */
  private looksLikeReviewReport(input: string): boolean {
    if (!input) return false;
    return input.includes('审查报告') || input.includes('改进建议') || input.includes('测试用例审查');
  }

  /**
   * 改进测试用例文档
   */
  private async improveTestCases(
    currentTestCases: string,
    reviewReport: string,
    prd?: string,
    code?: string,
    workspaceOptions?: WorkspaceOptions
  ): Promise<string> {
    // Load system prompt from database or use default
    const userId = this.context?.get('userId');
    const systemPrompt = await loadPrompt(
      userId,
      'test',
      'improve_system_prompt',
      TEST_IMPROVE_SYSTEM_PROMPT
    );

    // 构建改进提示词
    let prompt = buildTestImprovePrompt(currentTestCases, reviewReport, prd, code);

    // CLI 模式处理
    const isCLIMode = this.isCLIMode();

    // CLI 模式下，在 prompt 中指定文件保存路径和限制指令
    if (isCLIMode && workspaceOptions?.applicationId) {
      const savePath = `${this.getWorkspaceDir(workspaceOptions)}/TEST.md`;
      const saveInstruction = buildCLISaveInstruction(savePath, '改进后的测试用例文档');
      prompt += saveInstruction;
      
      logger.info('ImproveTest: Added CLI save path instruction', { savePath });
    }

    // 调用LLM/CLI改进文档
    const cliOutput = await this.aask(prompt, [systemPrompt]);
    
    if (isCLIMode && isCLISummaryOutput(cliOutput)) {
      logger.info('ImproveTest: CLI output appears to be a summary, reading actual file from workspace', {
        cliOutputLength: cliOutput.length,
        cliOutputPreview: cliOutput.substring(0, 200),
      });
      
      // 尝试从workspace读取CLI实际改进的文件
      if (workspaceOptions) {
        const workspaceDir = this.getWorkspaceDir(workspaceOptions);
        const actualContent = await tryReadActualDocumentFromWorkspace(workspaceDir, {
          mainFileName: 'TEST.md',
          filePattern: 'test',
        });
        
        if (actualContent) {
          logger.info('ImproveTest: Successfully read actual improved document from workspace', {
            actualContentLength: actualContent.length,
          });
          return actualContent;
        }
      }
      
      // 如果找不到实际文件，返回原测试用例内容
      logger.warn('ImproveTest: Could not find actual improved document in workspace, keeping original', {
        originalLength: currentTestCases.length,
      });
      return currentTestCases;
    }

    logger.info('ImproveTest: Test cases improved by LLM', {
      improvedLength: cliOutput.length,
    });

    return cliOutput;
  }

  /**
   * 从文档中移除审查报告部分
   */
  private removeReviewReport(document: string): string {
    // 定义审查报告的标题模式
    const reviewTitlePattern = /#\s*测试用例\s*审查报告/;
    
    // 查找审查报告标题的位置
    const titleMatchIndex = document.search(reviewTitlePattern);
    
    if (titleMatchIndex === -1) {
      // 如果没有找到审查报告标题，返回原文档
      return document;
    }
    
    // 获取审查报告标题之前的内容
    const beforeTitle = document.substring(0, titleMatchIndex);
    
    // 查找最后一个 "---" 分隔符（审查报告通常用 "---" 分隔）
    // 从后往前查找，找到最后一个独立的 "---" 行
    const lines = beforeTitle.split('\n');
    let lastSeparatorIndex = -1;
    
    // 从后往前查找最后一个 "---" 分隔符
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line === '---') {
        lastSeparatorIndex = i;
        break;
      }
    }
    
    if (lastSeparatorIndex >= 0) {
      // 如果找到了分隔符，返回分隔符之前的内容（移除分隔符本身）
      const result = lines.slice(0, lastSeparatorIndex).join('\n').trim();
      return result;
    } else {
      // 如果没有找到分隔符，返回审查报告标题之前的内容
      return beforeTitle.trim();
    }
  }

  /**
   * 从 workspace 读取代码文件
   */
  private async readCodeFromWorkspace(options: WorkspaceOptions): Promise<string> {
    try {
      const workspaceDir = this.getWorkspaceDir({
        ...options,
        documentType: 'CODE',
      });

      // 检查目录是否存在
      try {
        await fs.access(workspaceDir);
      } catch {
        logger.warn('ImproveTest: Code workspace directory does not exist', {
          workspaceDir,
        });
        return '';
      }

      const codeFiles: string[] = [];
      const entries = await fs.readdir(workspaceDir, { withFileTypes: true });

      // 过滤代码文件
      const codeFileExtensions = ['.ts', '.js', '.tsx', '.jsx', '.py', '.java', '.go', '.rs', '.cpp', '.c'];
      const codeEntries = entries.filter(entry => {
        if (!entry.isFile()) return false;
        return codeFileExtensions.some(ext => entry.name.endsWith(ext));
      });

      // 按文件名排序
      codeEntries.sort((a, b) => a.name.localeCompare(b.name));

      for (const entry of codeEntries) {
        const filePath = path.join(workspaceDir, entry.name);
        const content = await fs.readFile(filePath, 'utf-8');
        codeFiles.push(`// File: ${entry.name}\n${content}`);
      }

      const mergedCode = codeFiles.join('\n\n---\n\n');

      logger.info('ImproveTest: Read code files from workspace', {
        workspaceDir,
        fileCount: codeEntries.length,
        totalLength: mergedCode.length,
      });

      return mergedCode;
    } catch (error: any) {
      logger.error('ImproveTest: Failed to read code files from workspace', {
        error: error.message,
      });
      return '';
    }
  }
}

export default ImproveTest;
