/**
 * Deploy Action
 * 使用 Cursor CLI 命令行执行部署
 *
 * 编排三个独立的 Cursor Skills（无状态执行工具）：
 * - deploy-prepare  → skills/deploy-prepare/SKILL.md   （准备部署）
 * - deploy-execute  → skills/deploy-execute/SKILL.md   （执行部署）
 * - deploy-verify   → skills/deploy-verify/SKILL.md    （验证部署）
 *
 * 循环控制由此编排层负责，符合 Tool Design 最佳实践
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import { logger, WorkspaceOptions, WorkspaceManager } from '../utils';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface DeployOptions extends WorkspaceOptions {
  // 继承WorkspaceOptions的所有选项
  /** 是否跳过准备阶段（默认 false） */
  skipPrepare?: boolean;
}

export class Deploy extends BaseAction {
  // Skill 引用（Cursor CLI 会自动匹配 skills/ 目录下对应的 SKILL.md）
  private static readonly PREPARE_COMMAND = '使用 deploy-prepare 技能准备部署环境'; // Skill: deploy-prepare
  private static readonly EXECUTE_COMMAND = '使用 deploy-execute 技能执行部署'; // Skill: deploy-execute
  private static readonly VERIFY_COMMAND = '使用 deploy-verify 技能验证部署结果'; // Skill: deploy-verify

  // 结果文件路径（相对于 workDir）
  private static readonly PREPARE_RESULT_FILE = 'docs/deploy/prepareResult.md';
  private static readonly DEPLOY_RESULT_FILE = 'docs/deploy/deployResult.md';
  private static readonly VERIFY_RESULT_FILE = 'docs/deploy/verifyResult.md';

  constructor() {
    super('Deploy', 'Deploy application using Cursor CLI');
  }

  async run(design: string, options?: DeployOptions): Promise<IActionOutput> {
    logger.info('Deploy: Starting deployment using Cursor CLI', {
      designLength: design?.length || 0,
      applicationId: options?.applicationId,
      projectId: options?.projectId,
      version: options?.version,
    });

    try {
      // 验证必需参数
      if (!options?.applicationId) {
        throw new Error('Deploy: applicationId is required in options');
      }
      if (!options?.projectId) {
        throw new Error('Deploy: projectId is required in options');
      }

      // 获取工作空间根目录
      const workDir = WorkspaceManager.getProjectWorkspacePath(options);

      // 确保工作目录存在
      await fs.mkdir(workDir, { recursive: true });

      logger.info('Deploy: Workspace directory prepared', {
        workDir,
      });

      // 调试模式检查
      const isDebugMode = process.env.DEPLOY_DEBUG === 'true';
      if (isDebugMode) {
        logger.info('Deploy: Debug mode enabled, executing debug command', {
          workDir,
        });

        const debugPrompt = '在 docs/deploy 目录下创建 deployTest.txt文档，内容为 我是部署调试';
        const debugResult = await this.runCLICommand(debugPrompt, workDir, {
          timeout: 300000, // 5分钟超时
        });

        if (debugResult.exitCode !== 0) {
          logger.error('Deploy: Debug command failed', {
            exitCode: debugResult.exitCode,
            stderr: debugResult.stderr,
          });
          throw new Error(`Debug command failed with exit code ${debugResult.exitCode}`);
        }

        logger.info('Deploy: Debug command completed', {
          outputLength: debugResult.output.length,
        });

        return {
          content: `# Deploy Debug Mode\n\n## Debug Prompt\n\`\`\`\n${debugPrompt}\n\`\`\`\n\n## Output:\n\`\`\`\n${debugResult.output}\n\`\`\``,
          data: {
            type: 'debug',
            workspaceDir: workDir,
            debugOutput: debugResult.output,
            isCompleted: true, // 调试模式视为成功
            timestamp: new Date().toISOString(),
          },
        };
      }

      // 模拟部署失败的调试模式
      const isDebugFailMode = process.env.DEPLOY_DEBUG_FAIL === 'true';
      if (isDebugFailMode) {
        logger.info('Deploy: Debug FAIL mode enabled, simulating deployment failure', {
          workDir,
        });

        return {
          content: `# Deploy Debug FAIL Mode\n\n## Status: ❌ Simulated deployment failure\n\n模拟部署失败，用于测试部署失败后的确认按钮禁用逻辑。\n\n设置 \`DEPLOY_DEBUG_FAIL=false\` 或移除该环境变量以恢复正常部署。`,
          data: {
            type: 'deploy',
            workspaceDir: workDir,
            cursorOutput: 'Simulated deployment failure for testing',
            isCompleted: false, // 关键：模拟部署失败
            totalIterations: 1,
            timestamp: new Date().toISOString(),
          },
        };
      }

      const allOutputs: string[] = [];

      // ============================================================
      // Phase 1: 准备部署（deploy-prepare）
      // ============================================================
      if (!options?.skipPrepare) {
        const prepareReady = await this.runPreparePhase(workDir, allOutputs);
        if (!prepareReady) {
          logger.warn('Deploy: Prepare phase reported not ready, continuing with deployment anyway');
        }
      } else {
        logger.info('Deploy: Skipping prepare phase (skipPrepare=true)');
        allOutputs.push('=== Phase 1 - Prepare (skipped) ===');
      }

      // ============================================================
      // Phase 2 & 3: 执行部署 + 验证部署（循环直到完成）
      // ============================================================
      const maxRetries = 10;
      let isCompleted = false;
      let retryCount = 0;

      logger.info('Deploy: Starting deploy-verify loop', {
        cwd: workDir,
        maxRetries,
      });

      while (!isCompleted && retryCount < maxRetries) {
        // 检查是否被取消
        this.checkCancellation();
        retryCount++;

        // Phase 2: 执行部署
        await this.runExecutePhase(workDir, retryCount, maxRetries, allOutputs);

        // Phase 3: 验证部署
        isCompleted = await this.runVerifyPhase(workDir, retryCount, maxRetries, allOutputs);
      }

      // 汇总输出
      const stdout = allOutputs.join('\n\n');

      if (!isCompleted) {
        logger.error('Deploy: Max retries reached, deployment still not completed', {
          maxRetries,
          totalIterations: retryCount,
        });
      }

      logger.info('Deploy: Deployment loop completed', {
        isCompleted,
        totalIterations: retryCount,
        workDir,
      });

      return {
        content: `# Deployment ${isCompleted ? 'Completed' : 'Incomplete'}\n\n## Status: ${isCompleted ? '✅ Deployment successful and services verified' : '❌ Max retries reached'}\n\n## Total Iterations: ${retryCount}\n\n## Cursor CLI Output:\n\n${stdout}`,
        data: {
          type: 'deploy',
          workspaceDir: workDir,
          cursorOutput: stdout,
          isCompleted,
          totalIterations: retryCount,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      logger.error('Deploy: Failed to deploy using Cursor CLI', {
        message: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  // ============================================================
  // Phase 1: 准备部署
  // ============================================================

  /**
   * 执行准备阶段：检查代码完整性、验证构建配置、准备部署环境
   * @returns true 如果准备就绪，false 如果未就绪（但不阻塞部署）
   */
  private async runPreparePhase(workDir: string, allOutputs: string[]): Promise<boolean> {
    logger.info('Deploy: Phase 1 - Running deploy-prepare skill');

    const prepareResult = await this.runCLICommand(Deploy.PREPARE_COMMAND, workDir, {
      timeout: 300000, // 5分钟超时
      abortSignal: this.abortSignal,
    });

    const prepareOutput = prepareResult.output;
    if (prepareResult.exitCode === 0) {
      logger.info('Deploy: Prepare command completed', {
        outputLength: prepareOutput.length,
      });
    } else {
      logger.warn('Deploy: Prepare command failed', {
        exitCode: prepareResult.exitCode,
        stderr: prepareResult.stderr || '(empty)',
      });
    }

    allOutputs.push(`=== Phase 1 - Prepare ===\n${prepareOutput}`);

    // 读取结果文件 docs/deploy/prepareResult.md
    const resultFilePath = path.join(workDir, Deploy.PREPARE_RESULT_FILE);
    try {
      const resultContent = await fs.readFile(resultFilePath, 'utf-8');
      const lines = resultContent.split('\n').map((l) => l.trim());
      const statusLine = lines[0] || '';
      const reasonLine = lines[1] || '';

      logger.info('Deploy: Prepare result', {
        status: statusLine,
        reason: reasonLine,
      });

      if (statusLine === '已就绪') {
        return true;
      } else {
        logger.warn('Deploy: Prepare phase not ready', {
          status: statusLine,
          reason: reasonLine,
        });
        return false;
      }
    } catch (readError) {
      // 文件不存在时，回退到输出解析
      logger.warn('Deploy: Prepare result file not found, falling back to output parsing', {
        resultFilePath,
      });

      if (prepareOutput.includes('已就绪')) {
        return true;
      }
      return false;
    }
  }

  // ============================================================
  // Phase 2: 执行部署
  // ============================================================

  /**
   * 执行部署阶段：运行部署命令、监控进度、记录日志
   */
  private async runExecutePhase(workDir: string, iteration: number, maxRetries: number, allOutputs: string[]): Promise<void> {
    logger.info(`Deploy: Phase 2 - Iteration ${iteration}/${maxRetries} - Running deploy-execute skill`);

    const executeResult = await this.runCLICommand(Deploy.EXECUTE_COMMAND, workDir, {
      timeout: 600000, // 10分钟超时（部署可能需要较长时间）
      abortSignal: this.abortSignal,
    });

    const executeOutput = executeResult.output;
    if (executeResult.exitCode === 0) {
      logger.info(`Deploy: Execute command completed (iteration ${iteration})`, {
        outputLength: executeOutput.length,
        output: executeOutput.length > 0 ? executeOutput.substring(0, 200) : '(empty output)',
      });
    } else {
      logger.warn(`Deploy: Execute command failed (iteration ${iteration})`, {
        exitCode: executeResult.exitCode,
        stdout: executeOutput || '(empty)',
        stderr: executeResult.stderr || '(empty)',
      });
    }

    allOutputs.push(`=== Phase 2 - Execute (iteration ${iteration}) ===\n${executeOutput}`);

    // 读取结果文件 docs/deploy/deployResult.md（仅用于日志，不影响流程）
    const resultFilePath = path.join(workDir, Deploy.DEPLOY_RESULT_FILE);
    try {
      const resultContent = await fs.readFile(resultFilePath, 'utf-8');
      const lines = resultContent.split('\n').map((l) => l.trim());
      const statusLine = lines[0] || '';
      const reasonLine = lines[1] || '';

      logger.info(`Deploy: Execute result (iteration ${iteration})`, {
        status: statusLine,
        reason: reasonLine,
      });
    } catch {
      logger.warn(`Deploy: Execute result file not found (iteration ${iteration})`, {
        resultFilePath,
      });
    }
  }

  // ============================================================
  // Phase 3: 验证部署
  // ============================================================

  /**
   * 执行验证阶段：检查服务状态、验证可访问性、生成部署文档
   * @returns true 如果部署验证通过
   */
  private async runVerifyPhase(workDir: string, iteration: number, maxRetries: number, allOutputs: string[]): Promise<boolean> {
    logger.info(`Deploy: Phase 3 - Iteration ${iteration}/${maxRetries} - Running deploy-verify skill`);

    const verifyResult = await this.runCLICommand(Deploy.VERIFY_COMMAND, workDir, {
      timeout: 300000, // 5分钟超时
      abortSignal: this.abortSignal,
    });

    const verifyOutput = verifyResult.output;
    if (verifyResult.exitCode === 0) {
      logger.info(`Deploy: Verify command completed (iteration ${iteration})`, {
        outputLength: verifyOutput.length,
        output: verifyOutput.substring(0, 200),
      });
    } else {
      logger.warn(`Deploy: Verify command failed (iteration ${iteration})`, {
        exitCode: verifyResult.exitCode,
        stdout: verifyOutput || '(empty)',
        stderr: verifyResult.stderr || '(empty)',
      });
    }

    allOutputs.push(`=== Phase 3 - Verify (iteration ${iteration}) ===\n${verifyOutput}`);

    // 读取结果文件 docs/deploy/verifyResult.md（JSON 格式）
    const resultFilePath = path.join(workDir, Deploy.VERIFY_RESULT_FILE);

    try {
      const resultContent = await fs.readFile(resultFilePath, 'utf-8');

      // 解析 JSON 格式的验证结果
      const jsonMatch = resultContent.match(/\{[\s\S]*"result"[\s\S]*\}/);
      if (jsonMatch) {
        const resultObj = JSON.parse(jsonMatch[0]);
        const result = resultObj.result;
        const reason = resultObj.reason || '';
        const details = resultObj.details || null;

        logger.info(`Deploy: Verify result parsed (iteration ${iteration})`, {
          result,
          reason,
          details,
        });

        if (result === '已完成') {
          logger.info(`Deploy: Deployment verified successfully (iteration ${iteration})`, {
            totalIterations: iteration,
            reason,
            details,
          });
          return true;
        } else if (result === '未找到') {
          logger.warn(`Deploy: Deploy document not found (iteration ${iteration})`, {
            result,
            reason,
            willRetry: iteration < maxRetries,
          });
        } else {
          // "未完成" 或其他状态
          logger.warn(`Deploy: Deployment not verified yet (iteration ${iteration})`, {
            result,
            reason,
            details,
            errorLogs: resultObj.error_logs || null,
            willRetry: iteration < maxRetries,
          });
        }

        return false;
      }

      // JSON 解析失败，回退到文本匹配
      logger.warn(`Deploy: Unable to parse JSON from verify result file (iteration ${iteration})`, {
        contentPreview: resultContent.substring(0, 200),
      });

      return this.fallbackParseVerifyOutput(resultContent, iteration, maxRetries);
    } catch (readError) {
      // 文件不存在，回退到 CLI 输出解析
      logger.warn(`Deploy: Verify result file not found, falling back to output parsing (iteration ${iteration})`, {
        resultFilePath,
      });

      return this.fallbackParseVerifyOutput(verifyOutput, iteration, maxRetries);
    }
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

        logger.info(`Deploy: Verify result parsed from output (fallback, iteration ${iteration})`, {
          result,
          reason,
        });

        if (result === '已完成') {
          return true;
        }
        return false;
      }
    } catch (parseError: any) {
      logger.warn(`Deploy: Failed to parse JSON from verify output (iteration ${iteration})`, {
        error: parseError.message,
      });
    }

    // 最终回退：文本包含检查
    if (output.includes('未找到')) {
      logger.warn(`Deploy: Deploy document not found (text fallback, iteration ${iteration}/${maxRetries})`);
      return false;
    } else if (output.includes('已完成')) {
      logger.info(`Deploy: Deployment verified (text fallback, iteration ${iteration})`);
      return true;
    }

    return false;
  }
}

export default Deploy;
