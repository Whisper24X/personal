/**
 * TestReview Action
 * Reviews test cases document for completeness and quality
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import {
  TEST_REVIEW_SYSTEM_PROMPT,
  buildTestReviewPrompt,
} from '../prompts/test';
import { logger, loadPrompt, WorkspaceOptions } from '../utils';
import { WorkspaceManager } from '../utils/WorkspaceManager';
import {
  buildCLISaveInstruction,
  isCLISummaryOutput,
  tryReadActualReviewFromWorkspace,
} from '../utils/stepwise';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface TestReviewOptions extends WorkspaceOptions {
  // Inherits all options from WorkspaceOptions
}

export class TestReview extends BaseAction {
  constructor() {
    super('TestReview', 'Review test cases document for completeness and quality');
  }

  async run(testCasesContent: string, options?: TestReviewOptions): Promise<IActionOutput> {
    // 尝试从 options 或 context 中获取 workspace 参数
    const applicationId = options?.applicationId || (this.context?.get('applicationId') as string | undefined);
    const projectId = options?.projectId || (this.context?.get('projectId') as string | undefined);
    const version = options?.version || (this.context?.get('version') as number | undefined) || 1;

    // 如果输入内容为空或很短，尝试从 workspace 读取 TEST.md
    let actualTestCasesContent = testCasesContent;
    if ((!testCasesContent || testCasesContent.trim().length < 100) && applicationId && projectId) {
      try {
        const testCasesFromWorkspace = await this.readWorkspaceFile('TEST.md', {
          applicationId,
          projectId,
          version,
          documentType: 'TEST',
          workspacePath: options?.workspacePath,
        });

        if (testCasesFromWorkspace) {
          actualTestCasesContent = testCasesFromWorkspace;
          logger.info('TestReview: Loaded test cases content from workspace', {
            applicationId,
            projectId,
            version,
            contentLength: actualTestCasesContent.length,
          });
        }
      } catch (error: any) {
        logger.warn('TestReview: Failed to read TEST.md from workspace, using provided content', {
          error: error.message,
          contentLength: testCasesContent.length,
        });
      }
    }

    if (!actualTestCasesContent || actualTestCasesContent.trim().length === 0) {
      throw new Error('Cannot find test cases content for review. Please generate test cases first or provide test cases content.');
    }

    // 尝试读取 PRD 和代码作为参考
    let prd = '';
    let code = '';

    if (applicationId && projectId) {
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
          logger.info('TestReview: Loaded PRD from workspace', {
            prdLength: prd.length,
          });
        }
      } catch (error: any) {
        logger.warn('TestReview: Failed to read PRD from workspace', {
          error: error.message,
        });
      }

      // 尝试读取代码文件
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
          logger.info('TestReview: Loaded code from workspace', {
            codeLength: code.length,
          });
        }
      } catch (error: any) {
        logger.warn('TestReview: Failed to read code from workspace', {
          error: error.message,
        });
      }
    }

    logger.info('TestReview: Starting test cases review', {
      contentLength: actualTestCasesContent.length,
      hasPRD: !!prd,
      hasCode: !!code,
      applicationId,
      projectId,
      version,
    });

    try {
      let prompt = buildTestReviewPrompt(actualTestCasesContent, prd, code);

      // Load system prompt from database or use default
      const userId = this.context?.get('userId');
      const systemPrompt = await loadPrompt(userId, 'test', 'review_system_prompt', TEST_REVIEW_SYSTEM_PROMPT);

      // CLI 模式处理
      const isCLIMode = this.isCLIMode();
      const workspaceOptions: WorkspaceOptions = {
        applicationId: applicationId || '',
        projectId,
        version,
        documentType: 'TEST',
        workspacePath: options?.workspacePath,
      };

      // CLI 模式下，在 prompt 中指定文件保存路径和限制指令
      if (isCLIMode && applicationId && projectId) {
        const savePath = `${this.getWorkspaceDir(workspaceOptions)}/TEST_REVIEW.md`;
        const saveInstruction = buildCLISaveInstruction(savePath, '审核报告');
        prompt += saveInstruction;
        
        logger.info('TestReview: Added CLI save path instruction', { savePath });
      }

      // Call LLM/CLI with system message and prompt
      const cliOutput = await this.aask(prompt, [systemPrompt]);
      
      let reviewResult: string;
      
      if (isCLIMode && isCLISummaryOutput(cliOutput)) {
        logger.info('TestReview: CLI output appears to be a summary, reading actual review from workspace', {
          cliOutputLength: cliOutput.length,
          cliOutputPreview: cliOutput.substring(0, 200),
        });
        
        // 尝试从workspace读取CLI实际生成的审核报告
        const workspaceDir = this.getWorkspaceDir(workspaceOptions);
        const actualReview = await tryReadActualReviewFromWorkspace(workspaceDir, {
          reviewFileName: 'TEST_REVIEW.md',
          filePattern: 'test_review',
        });
        
        if (actualReview) {
          reviewResult = actualReview;
          logger.info('TestReview: Successfully read actual review report from workspace', {
            actualReviewLength: actualReview.length,
          });
        } else {
          logger.warn('TestReview: Could not find actual review in workspace, using CLI output', {
            cliOutputLength: cliOutput.length,
          });
          reviewResult = cliOutput;
        }
      } else {
        reviewResult = cliOutput;
      }

      logger.info('TestReview: Review completed', {
        reviewLength: reviewResult.length,
      });

      // Save review report to workspace if workspace options are provided
      // 只有当内容不是CLI总结时才保存
      if (applicationId && projectId && !isCLISummaryOutput(reviewResult)) {
        await this.saveToWorkspace('TEST_REVIEW.md', reviewResult, workspaceOptions);
        logger.info('TestReview: Saved review report to workspace', {
          filename: 'TEST_REVIEW.md',
          workspaceDir: this.getWorkspaceDir(workspaceOptions),
        });
      }

      return {
        content: reviewResult,
        data: {
          type: 'test_review',
          filename: 'TEST_REVIEW.md',
          timestamp: new Date().toISOString(),
          workspaceDir: applicationId && projectId ? this.getWorkspaceDir({
            applicationId,
            projectId,
            version,
            documentType: 'TEST',
            workspacePath: options?.workspacePath,
          }) : undefined,
        },
      };
    } catch (error: any) {
      logger.error('TestReview: Failed to review test cases', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
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
        logger.warn('TestReview: Code workspace directory does not exist', {
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

      logger.info('TestReview: Read code files from workspace', {
        workspaceDir,
        fileCount: codeEntries.length,
        totalLength: mergedCode.length,
      });

      return mergedCode;
    } catch (error: any) {
      logger.error('TestReview: Failed to read code files from workspace', {
        error: error.message,
      });
      return '';
    }
  }
}

export default TestReview;
