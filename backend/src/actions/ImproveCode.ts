/**
 * ImproveCode Action
 * 基于QA反馈、用户建议和 Code Review 扫描改进代码
 *
 * 编排四个独立的 Cursor Skills（无状态执行工具）：
 * - improve-review   → skills/improve-review/SKILL.md   （Code Review 扫描，发现 SOLID/安全/质量/移除候选）
 * - improve-analyze  → skills/improve-analyze/SKILL.md   （分析改进需求，合并用户问题与 review 结果）
 * - improve-execute  → skills/improve-execute/SKILL.md   （执行代码改进）
 * - improve-verify   → skills/improve-verify/SKILL.md    （验证改进效果）
 *
 * 流程：review（始终执行）→ analyze → execute → verify（循环）
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import { logger, WorkspaceOptions, WorkspaceManager } from '../utils';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface ImproveCodeOptions extends WorkspaceOptions {
  // 继承WorkspaceOptions的所有选项
}

export class ImproveCode extends BaseAction {
  // Skill 引用（Cursor CLI 会自动匹配 skills/ 目录下对应的 SKILL.md）
  private static readonly REVIEW_COMMAND = '使用 improve-review 技能执行代码审查扫描'; // Skill: improve-review
  private static readonly ANALYZE_COMMAND = '使用 improve-analyze 技能分析改进需求'; // Skill: improve-analyze
  private static readonly EXECUTE_COMMAND = '使用 improve-execute 技能执行代码改进'; // Skill: improve-execute
  private static readonly VERIFY_COMMAND = '使用 improve-verify 技能验证改进效果'; // Skill: improve-verify

  // 文件路径（相对于 workDir）
  private static readonly IMPROVE_FILE = 'docs/code/ImproveCode.md';
  private static readonly REVIEW_RESULT_FILE = 'docs/code/improveReviewResult.md';
  private static readonly ANALYZE_RESULT_FILE = 'docs/code/improveAnalyzeResult.md';
  private static readonly EXECUTE_RESULT_FILE = 'docs/code/improveExecuteResult.md';
  private static readonly VERIFY_RESULT_FILE = 'docs/code/improveVerifyResult.md';

  constructor() {
    super('ImproveCode', 'Improve code based on QA feedback and user suggestions');
  }

  async run(design: string, options?: ImproveCodeOptions): Promise<IActionOutput> {
    logger.info('ImproveCode: Starting code improvement using Cursor CLI', {
      designLength: design?.length || 0,
      applicationId: options?.applicationId,
      projectId: options?.projectId,
      version: options?.version,
    });

    try {
      // 验证必需参数
      if (!options?.applicationId) {
        throw new Error('ImproveCode: applicationId is required in options');
      }
      if (!options?.projectId) {
        throw new Error('ImproveCode: projectId is required in options');
      }

      // 获取工作空间根目录
      const workDir = WorkspaceManager.getProjectWorkspacePath(options);
      const improveFilePath = path.join(workDir, ImproveCode.IMPROVE_FILE);

      // 确保工作目录存在
      await fs.mkdir(workDir, { recursive: true });

      logger.info('ImproveCode: Workspace directory prepared', {
        workDir,
        improveFilePath,
      });

      // 调试模式检查
      const isDebugMode = process.env.IMPROVE_CODE_DEBUG === 'true';
      if (isDebugMode) {
        logger.info('ImproveCode: Debug mode enabled, executing debug command', {
          workDir,
        });

        const debugPrompt = '在 docs/code 目录下创建 improveTest.txt 文档，内容为：ImproveCode 调试测试成功';
        const debugResult = await this.runCLICommand(debugPrompt, workDir, {
          timeout: 300000, // 5分钟超时
        });

        if (debugResult.exitCode !== 0) {
          logger.error('ImproveCode: Debug command failed', {
            exitCode: debugResult.exitCode,
            stderr: debugResult.stderr,
          });
          throw new Error(`Debug command failed with exit code ${debugResult.exitCode}`);
        }

        logger.info('ImproveCode: Debug command completed', {
          outputLength: debugResult.output.length,
        });

        return {
          content: `# ImproveCode 调试模式\n\n## 调试提示词\n\`\`\`\n${debugPrompt}\n\`\`\`\n\n## 输出结果:\n\`\`\`\n${debugResult.output}\n\`\`\``,
          data: {
            type: 'debug',
            workspaceDir: workDir,
            debugOutput: debugResult.output,
            timestamp: new Date().toISOString(),
          },
        };
      }

      // ============================================================
      // Phase 0: Code Review 扫描（始终执行，发现 SOLID/安全/质量/移除候选）
      // ============================================================
      const allOutputs: string[] = [];
      await this.runReviewPhase(workDir, allOutputs);

      // ============================================================
      // 三阶段改进循环：analyze -> execute -> verify
      // ============================================================
      const maxRetries = 10;
      let isCompleted = false;
      let retryCount = 0;

      logger.info('ImproveCode: Starting improvement loop', {
        cwd: workDir,
        maxRetries,
      });

      let fileExists: boolean;
      while (!isCompleted && retryCount < maxRetries) {
        // 检查是否被取消
        this.checkCancellation();
        retryCount++;

        // Phase 1: 分析改进需求（合并 ImproveCode.md + improveReviewResult.md）
        const hasIssues = await this.runAnalyzePhase(workDir, retryCount, maxRetries, allOutputs);
        if (!hasIssues) {
          // 分析阶段判定无需改进，检查文件是否仍存在
          fileExists = await this.checkFileExists(improveFilePath);
          if (!fileExists) {
            isCompleted = true;
            logger.info(`ImproveCode: Analyze phase reported no issues and file deleted (iteration ${retryCount})`);
          } else {
            // 文件存在但分析显示无需改进，可能是标记状态不一致，继续执行验证
            logger.info(`ImproveCode: Analyze phase reported no issues but file still exists, running verify (iteration ${retryCount})`);
          }
          if (isCompleted) break;
        }

        // Phase 2: 执行代码改进
        await this.runExecutePhase(workDir, retryCount, maxRetries, allOutputs);

        // Phase 3: 验证改进效果
        isCompleted = await this.runVerifyPhase(workDir, retryCount, maxRetries, allOutputs);

        // 双重检查：即使 verify result 文件解析失败，也通过文件存在性判断
        if (!isCompleted) {
          fileExists = await this.checkFileExists(improveFilePath);
          if (!fileExists) {
            isCompleted = true;
            logger.info(`ImproveCode: File deleted (detected via file check), improvement completed (iteration ${retryCount})`);
          }
        }
      }

      // 汇总输出
      const stdout = allOutputs.join('\n\n');

      if (!isCompleted) {
        logger.error('ImproveCode: Max retries reached, improvement still not completed', {
          maxRetries,
          totalIterations: retryCount,
          improveFilePath,
        });
      }

      logger.info('ImproveCode: Improvement loop completed', {
        isCompleted,
        totalIterations: retryCount,
        workDir,
      });

      return {
        content: `# 代码改进${isCompleted ? '已完成' : '未完成'}\n\n## 状态: ${isCompleted ? '✅ 所有改进已成功完成' : '❌ 已达最大重试次数，可能仍有未解决的问题'}\n\n## 执行次数: ${retryCount}\n\n## Cursor CLI 输出:\n\n${stdout}`,
        data: {
          type: 'improve_code',
          workspaceDir: workDir,
          cursorOutput: stdout,
          isCompleted,
          totalIterations: retryCount,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      logger.error('ImproveCode: Failed to improve code using Cursor CLI', {
        message: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  // ============================================================
  // Phase 0: Code Review 扫描
  // ============================================================

  /**
   * 执行 Code Review 阶段：扫描代码库，发现 SOLID/安全/质量/移除候选，输出 improveReviewResult.md
   */
  private async runReviewPhase(workDir: string, allOutputs: string[]): Promise<void> {
    logger.info('ImproveCode: Phase 0 - Running improve-review skill (Code Review scan)');

    const reviewResult = await this.runCLICommand(ImproveCode.REVIEW_COMMAND, workDir, {
      timeout: 300000, // 5分钟超时
      abortSignal: this.abortSignal,
    });

    const reviewOutput = reviewResult.output;
    if (reviewResult.exitCode === 0) {
      logger.info('ImproveCode: Review command completed', {
        outputLength: reviewOutput.length,
      });
    } else {
      logger.warn('ImproveCode: Review command failed', {
        exitCode: reviewResult.exitCode,
        stderr: reviewResult.stderr || '(empty)',
      });
    }

    allOutputs.push(`=== Phase 0 - Code Review ===\n${reviewOutput}`);
  }

  // ============================================================
  // Phase 1: 分析改进需求
  // ============================================================

  /**
   * 执行分析阶段：读取 ImproveCode.md + improveReviewResult.md，合并排序，输出分析结果
   * @returns true 如果有待解决的问题，false 如果无需改进
   */
  private async runAnalyzePhase(workDir: string, iteration: number, maxRetries: number, allOutputs: string[]): Promise<boolean> {
    logger.info(`ImproveCode: Phase 1 - Iteration ${iteration}/${maxRetries} - Running improve-analyze skill`);

    const analyzeResult = await this.runCLICommand(ImproveCode.ANALYZE_COMMAND, workDir, {
      timeout: 300000, // 5分钟超时
      abortSignal: this.abortSignal,
    });

    const analyzeOutput = analyzeResult.output;
    if (analyzeResult.exitCode === 0) {
      logger.info(`ImproveCode: Analyze command completed (iteration ${iteration})`, {
        outputLength: analyzeOutput.length,
      });
    } else {
      logger.warn(`ImproveCode: Analyze command failed (iteration ${iteration})`, {
        exitCode: analyzeResult.exitCode,
        stderr: analyzeResult.stderr || '(empty)',
      });
    }

    allOutputs.push(`=== Phase 1 - Analyze (iteration ${iteration}) ===\n${analyzeOutput}`);

    // 读取结果文件 docs/code/improveAnalyzeResult.md（JSON 格式）
    const resultFilePath = path.join(workDir, ImproveCode.ANALYZE_RESULT_FILE);
    try {
      const resultContent = await fs.readFile(resultFilePath, 'utf-8');

      // 解析 JSON 格式的分析结果
      const jsonMatch = resultContent.match(/\{[\s\S]*"result"[\s\S]*\}/);
      if (jsonMatch) {
        const resultObj = JSON.parse(jsonMatch[0]);
        const result = resultObj.result;
        const reason = resultObj.reason || '';
        const issues = resultObj.issues || [];

        logger.info(`ImproveCode: Analyze result parsed (iteration ${iteration})`, {
          result,
          reason,
          totalIssues: issues.length,
          pendingIssues: issues.filter((i: { status: string }) => i.status === 'pending').length,
        });

        if (result === '有待改进') {
          return true;
        } else if (result === '无需改进') {
          logger.info(`ImproveCode: No issues to improve (iteration ${iteration})`, {
            reason,
          });
          return false;
        } else {
          // "分析失败" 或其他状态
          logger.warn(`ImproveCode: Analyze phase reported failure (iteration ${iteration})`, {
            result,
            reason,
          });
          // 分析失败时仍然尝试继续执行，让 execute 阶段自行读取 ImproveCode.md
          return true;
        }
      }

      // JSON 解析失败，回退到文本匹配
      logger.warn(`ImproveCode: Unable to parse JSON from analyze result file (iteration ${iteration})`, {
        contentPreview: resultContent.substring(0, 200),
      });

      return this.fallbackParseAnalyzeOutput(resultContent, iteration);
    } catch (readError) {
      // 文件不存在，回退到 CLI 输出解析
      logger.warn(`ImproveCode: Analyze result file not found, falling back to output parsing (iteration ${iteration})`, {
        resultFilePath,
      });

      return this.fallbackParseAnalyzeOutput(analyzeOutput, iteration);
    }
  }

  // ============================================================
  // Phase 2: 执行代码改进
  // ============================================================

  /**
   * 执行改进阶段：修复问题并标记已解决
   */
  private async runExecutePhase(workDir: string, iteration: number, maxRetries: number, allOutputs: string[]): Promise<void> {
    logger.info(`ImproveCode: Phase 2 - Iteration ${iteration}/${maxRetries} - Running improve-execute skill`);

    const executeResult = await this.runCLICommand(ImproveCode.EXECUTE_COMMAND, workDir, {
      timeout: 600000, // 10分钟超时（代码改进可能需要较长时间）
      abortSignal: this.abortSignal,
    });

    const executeOutput = executeResult.output;
    if (executeResult.exitCode === 0) {
      logger.info(`ImproveCode: Execute command completed (iteration ${iteration})`, {
        outputLength: executeOutput.length,
        output: executeOutput.length > 0 ? executeOutput.substring(0, 200) : '(empty output)',
      });
    } else {
      logger.warn(`ImproveCode: Execute command failed (iteration ${iteration})`, {
        exitCode: executeResult.exitCode,
        stdout: executeOutput || '(empty)',
        stderr: executeResult.stderr || '(empty)',
      });
    }

    allOutputs.push(`=== Phase 2 - Execute (iteration ${iteration}) ===\n${executeOutput}`);

    // 读取结果文件 docs/code/improveExecuteResult.md（仅用于日志，不影响流程）
    const resultFilePath = path.join(workDir, ImproveCode.EXECUTE_RESULT_FILE);
    try {
      const resultContent = await fs.readFile(resultFilePath, 'utf-8');
      const lines = resultContent.split('\n').map((l) => l.trim());
      const statusLine = lines[0] || '';
      const reasonLine = lines[1] || '';

      logger.info(`ImproveCode: Execute result (iteration ${iteration})`, {
        status: statusLine,
        reason: reasonLine,
      });
    } catch {
      logger.warn(`ImproveCode: Execute result file not found (iteration ${iteration})`, {
        resultFilePath,
      });
    }
  }

  // ============================================================
  // Phase 3: 验证改进效果
  // ============================================================

  /**
   * 执行验证阶段：检查问题解决状态、验证代码质量、判定是否完成
   * @returns true 如果所有改进已完成
   */
  private async runVerifyPhase(workDir: string, iteration: number, maxRetries: number, allOutputs: string[]): Promise<boolean> {
    logger.info(`ImproveCode: Phase 3 - Iteration ${iteration}/${maxRetries} - Running improve-verify skill`);

    const verifyResult = await this.runCLICommand(ImproveCode.VERIFY_COMMAND, workDir, {
      timeout: 300000, // 5分钟超时
      abortSignal: this.abortSignal,
    });

    const verifyOutput = verifyResult.output;
    if (verifyResult.exitCode === 0) {
      logger.info(`ImproveCode: Verify command completed (iteration ${iteration})`, {
        outputLength: verifyOutput.length,
        output: verifyOutput.substring(0, 200),
      });
    } else {
      logger.warn(`ImproveCode: Verify command failed (iteration ${iteration})`, {
        exitCode: verifyResult.exitCode,
        stdout: verifyOutput || '(empty)',
        stderr: verifyResult.stderr || '(empty)',
      });
    }

    allOutputs.push(`=== Phase 3 - Verify (iteration ${iteration}) ===\n${verifyOutput}`);

    // 读取结果文件 docs/code/improveVerifyResult.md（JSON 格式）
    const resultFilePath = path.join(workDir, ImproveCode.VERIFY_RESULT_FILE);

    try {
      const resultContent = await fs.readFile(resultFilePath, 'utf-8');

      // 解析 JSON 格式的验证结果
      const jsonMatch = resultContent.match(/\{[\s\S]*"result"[\s\S]*\}/);
      if (jsonMatch) {
        const resultObj = JSON.parse(jsonMatch[0]);
        const result = resultObj.result;
        const reason = resultObj.reason || '';
        const details = resultObj.details || null;

        logger.info(`ImproveCode: Verify result parsed (iteration ${iteration})`, {
          result,
          reason,
          details,
        });

        if (result === '已完成') {
          logger.info(`ImproveCode: Improvement verified successfully (iteration ${iteration})`, {
            totalIterations: iteration,
            reason,
            details,
          });
          return true;
        } else if (result === '验证失败') {
          logger.warn(`ImproveCode: Verify phase failed (iteration ${iteration})`, {
            result,
            reason,
            willRetry: iteration < maxRetries,
          });
        } else {
          // "未完成" 或其他状态
          logger.warn(`ImproveCode: Improvement not verified yet (iteration ${iteration})`, {
            result,
            reason,
            details,
            willRetry: iteration < maxRetries,
          });
        }

        return false;
      }

      // JSON 解析失败，回退到文本匹配
      logger.warn(`ImproveCode: Unable to parse JSON from verify result file (iteration ${iteration})`, {
        contentPreview: resultContent.substring(0, 200),
      });

      return this.fallbackParseVerifyOutput(resultContent, iteration, maxRetries);
    } catch (readError) {
      // 文件不存在，回退到 CLI 输出解析
      logger.warn(`ImproveCode: Verify result file not found, falling back to output parsing (iteration ${iteration})`, {
        resultFilePath,
      });

      return this.fallbackParseVerifyOutput(verifyOutput, iteration, maxRetries);
    }
  }

  // ============================================================
  // 辅助方法
  // ============================================================

  /**
   * 回退解析分析输出（兼容 Skill 未正确写入文件的情况）
   */
  private fallbackParseAnalyzeOutput(output: string, iteration: number): boolean {
    // 尝试从输出中提取 JSON
    try {
      const jsonMatch = output.match(/\{[\s\S]*"result"[\s\S]*\}/);
      if (jsonMatch) {
        const resultObj = JSON.parse(jsonMatch[0]);
        const result = resultObj.result;

        logger.info(`ImproveCode: Analyze result parsed from output (fallback, iteration ${iteration})`, {
          result,
        });

        if (result === '无需改进') {
          return false;
        }
        return true;
      }
    } catch (parseError: any) {
      logger.warn(`ImproveCode: Failed to parse JSON from analyze output (iteration ${iteration})`, {
        error: parseError.message,
      });
    }

    // 最终回退：文本包含检查
    if (output.includes('无需改进')) {
      logger.info(`ImproveCode: No improvement needed (text fallback, iteration ${iteration})`);
      return false;
    }

    // 默认认为有待改进（安全策略：继续执行总比跳过好）
    return true;
  }

  /**
   * 回退解析验证输出（兼容 Skill 未正确写入文件的情况）
   */
  private fallbackParseVerifyOutput(output: string, iteration: number, maxRetries: number): boolean {
    // 尝试从输出中提取 JSON
    try {
      const jsonMatch = output.match(/\{[\s\S]*"result"[\s\S]*\}/);
      if (jsonMatch) {
        const resultObj = JSON.parse(jsonMatch[0]);
        const result = resultObj.result;
        const reason = resultObj.reason || '';

        logger.info(`ImproveCode: Verify result parsed from output (fallback, iteration ${iteration})`, {
          result,
          reason,
        });

        if (result === '已完成') {
          return true;
        }
        return false;
      }
    } catch (parseError: any) {
      logger.warn(`ImproveCode: Failed to parse JSON from verify output (iteration ${iteration})`, {
        error: parseError.message,
      });
    }

    // 最终回退：文本包含检查
    if (output.includes('已完成')) {
      logger.info(`ImproveCode: Improvement verified (text fallback, iteration ${iteration})`);
      return true;
    } else if (output.includes('验证失败')) {
      logger.warn(`ImproveCode: Verify failed (text fallback, iteration ${iteration}/${maxRetries})`);
      return false;
    }

    return false;
  }

  /**
   * 检查文件是否存在
   */
  private async checkFileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

export default ImproveCode;
