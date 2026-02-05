/**
 * WriteCode Action
 * 使用Cursor CLI命令行执行代码生成
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import { logger, WorkspaceOptions, WorkspaceManager } from '../utils';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface WriteCodeOptions extends WorkspaceOptions {
  // 继承WorkspaceOptions的所有选项
}

export class WriteCode extends BaseAction {
  constructor() {
    super('WriteCode', 'Generate source code using Cursor CLI');
  }

  async run(design: string, options?: WriteCodeOptions): Promise<IActionOutput> {
    logger.info('WriteCode: Starting code generation using Cursor CLI', {
      designLength: design?.length || 0,
      applicationId: options?.applicationId,
      projectId: options?.projectId,
      version: options?.version,
    });

    try {
      // 验证必需参数
      if (!options?.applicationId) {
        throw new Error('WriteCode: applicationId is required in options');
      }
      if (!options?.projectId) {
        throw new Error('WriteCode: projectId is required in options');
      }

      // 直接获取工作空间根目录 (ainative-workspace) - 代码将在此目录下生成
      const workDir = WorkspaceManager.getProjectWorkspacePath(options);

      // 确保工作目录存在
      await fs.mkdir(workDir, { recursive: true });

      logger.info('WriteCode: Workspace directory prepared', {
        workDir,
      });

      // 调试模式检查
      const isDebugMode = process.env.WRITE_CODE_DEBUG === 'true';
      if (isDebugMode) {
        logger.info('WriteCode: Debug mode enabled, executing debug command', {
          workDir,
        });

        const debugPrompt = '在当前目录下生成一个writeCodeTest.txt文档，内容为 我是编写代码调试';
        const debugResult = await this.runCLICommand(debugPrompt, workDir, {
          timeout: 300000, // 5分钟超时
        });

        if (debugResult.exitCode !== 0) {
          logger.error('WriteCode: Debug command failed', {
            exitCode: debugResult.exitCode,
            stderr: debugResult.stderr,
          });
          throw new Error(`Debug command failed with exit code ${debugResult.exitCode}`);
        }

        logger.info('WriteCode: Debug command completed', {
          outputLength: debugResult.output.length,
        });

        return {
          content: `# WriteCode Debug Mode\n\n## Debug Prompt\n\`\`\`\n${debugPrompt}\n\`\`\`\n\n## Output:\n\`\`\`\n${debugResult.output}\n\`\`\``,
          data: {
            type: 'debug',
            workspaceDir: workDir,
            debugOutput: debugResult.output,
            timestamp: new Date().toISOString(),
          },
        };
      }

      // 检查是否存在改进文件，如果存在则跳过 WriteCode（进入代码改进流程）
      const improveFilePath = path.join(workDir, 'docs/code/ImproveCode.md');
      const improveFileExists = await this.checkFileExists(improveFilePath);
      if (improveFileExists) {
        logger.info('WriteCode: ImproveCode.md exists, skipping WriteCode execution', {
          improveFilePath,
        });
        return {
          content: `# 代码生成 - 已跳过\n\n检测到改进文件 \`docs/code/ImproveCode.md\` 存在，跳过代码生成，直接进入代码改进阶段。\n\n这是正常现象，表示需要先执行代码改进。`,
          data: {
            type: 'skipped',
            reason: 'improve_file_exists',
            filePath: improveFilePath,
            workspaceDir: workDir,
            timestamp: new Date().toISOString(),
          },
        };
      }

      // 从 prompts/code.ts 获取命令提示词
      // 这些提示词对应于独立的 Cursor Skills（无状态执行工具）：
      // - getApplyCommand() → skills/code-task-apply/SKILL.md
      // - getCheckCommand() → skills/code-task-check/SKILL.md
      // 循环控制由此编排层（WriteCode.ts）负责，符合 Tool Design 最佳实践
      const applyCommand = '使用 code-task-apply 技能生成代码'; // Skill: code-task-apply
      const checkCommand = '使用 code-task-check 技能检查任务状态'; // Skill: code-task-check

      // 循环执行，直到任务完成
      const maxRetries = 10; // 最大重试次数
      let isCompleted = false;
      let retryCount = 0;
      const allOutputs: string[] = [];

      logger.info('WriteCode: Starting code generation loop', {
        cwd: workDir,
        maxRetries,
      });

      while (!isCompleted && retryCount < maxRetries) {
        // 检查是否被取消
        this.checkCancellation();
        retryCount++;

        logger.info(`WriteCode: Iteration ${retryCount}/${maxRetries} - Executing apply command`, {
          command: applyCommand,
        });

        // 1. 执行 apply 命令
        const applyResult = await this.runCLICommand(applyCommand, workDir, {
          timeout: 3600000, // 60分钟超时
          abortSignal: this.abortSignal,
        });

        const applyOutput = applyResult.output;
        if (applyResult.exitCode === 0) {
          logger.info(`WriteCode: Apply command completed (iteration ${retryCount})`, {
            outputLength: applyOutput.length,
            output: applyOutput.length > 0 ? applyOutput : '(empty output)',
          });
        } else {
          logger.warn(`WriteCode: Apply command failed (iteration ${retryCount})`, {
            exitCode: applyResult.exitCode,
            stdout: applyOutput || '(empty)',
            stderr: applyResult.stderr || '(empty)',
          });
        }

        allOutputs.push(`=== Iteration ${retryCount} - Apply ===\n${applyOutput}`);

        // 2. 执行 check 命令
        logger.info(`WriteCode: Iteration ${retryCount}/${maxRetries} - Executing check command`, {
          command: checkCommand,
        });

        const checkResult = await this.runCLICommand(checkCommand, workDir, {
          timeout: 300000, // 5分钟超时（检查命令应该很快）
          abortSignal: this.abortSignal,
        });

        const checkOutput = checkResult.output;
        if (checkResult.exitCode === 0) {
          logger.info(`WriteCode: Check command completed (iteration ${retryCount})`, {
            outputLength: checkOutput.length,
            output: checkOutput.substring(0, 200), // 记录前200字符
          });
        } else {
          logger.warn(`WriteCode: Check command failed (iteration ${retryCount})`, {
            exitCode: checkResult.exitCode,
            stdout: checkOutput || '(empty)',
            stderr: checkResult.stderr || '(empty)',
          });
        }

        allOutputs.push(`=== Iteration ${retryCount} - Check ===\n${checkOutput}`);

        // 3. 判断是否完成 - 读取结果文件 docs/code/taskResult.md
        const resultFilePath = path.join(workDir, 'docs/code/taskResult.md');

        try {
          // 尝试读取结果文件
          const resultContent = await fs.readFile(resultFilePath, 'utf-8');
          const lines = resultContent.split('\n').map((l) => l.trim());
          const statusLine = lines[0] || '';
          const reasonLine = lines[1] || '';

          logger.info(`WriteCode: Read result file (iteration ${retryCount})`, {
            resultFilePath,
            status: statusLine,
            reason: reasonLine,
          });

          // 根据状态判断
          if (statusLine === '未找到') {
            const errorMessage = `WriteCode: Task file not found. Reason: ${reasonLine}`;
            logger.error(errorMessage, {
              iteration: retryCount,
              status: statusLine,
              reason: reasonLine,
            });
            throw new Error(errorMessage);
          } else if (statusLine === '已完成') {
            isCompleted = true;
            logger.info(`WriteCode: Tasks completed successfully (iteration ${retryCount})`, {
              totalIterations: retryCount,
              reason: reasonLine,
            });
          } else if (statusLine === '未完成') {
            logger.warn(`WriteCode: Tasks not completed yet (iteration ${retryCount})`, {
              status: statusLine,
              reason: reasonLine,
              willRetry: retryCount < maxRetries,
            });
          } else {
            // 状态不符合预期，记录警告但继续
            logger.warn(`WriteCode: Unexpected status in result file (iteration ${retryCount})`, {
              status: statusLine,
              reason: reasonLine,
              willRetry: retryCount < maxRetries,
            });
          }
        } catch (readError) {
          // 文件不存在或读取失败，回退到输出解析
          const readErrorMessage = readError instanceof Error ? readError.message : String(readError);

          // 检查是否是文件不存在错误
          const isFileNotFound = readError instanceof Error && 'code' in readError && (readError as NodeJS.ErrnoException).code === 'ENOENT';

          if (isFileNotFound) {
            logger.warn(`WriteCode: Result file not found, falling back to output parsing (iteration ${retryCount})`, {
              resultFilePath,
            });
          } else {
            logger.warn(`WriteCode: Failed to read result file, falling back to output parsing (iteration ${retryCount})`, {
              resultFilePath,
              error: readErrorMessage,
            });
          }

          // 回退到输出解析（兼容旧逻辑）
          const outputLines = checkOutput.split('\n');
          let foundStatus = false;

          for (let i = 0; i < outputLines.length; i++) {
            const line = outputLines[i].trim();
            if (line === '已完成' || line === '未完成' || line === '未找到') {
              const statusLine = line;
              const reasonLine = i + 1 < outputLines.length ? outputLines[i + 1].trim() : '';
              foundStatus = true;

              if (statusLine === '未找到') {
                throw new Error(`WriteCode: Task file not found. Reason: ${reasonLine}`);
              } else if (statusLine === '已完成') {
                isCompleted = true;
                logger.info(`WriteCode: Tasks completed (fallback parsing) (iteration ${retryCount})`);
              }
              break;
            }
          }

          if (!foundStatus) {
            // 最后回退：文本包含检查
            if (checkOutput.includes('未找到')) {
              throw new Error(`WriteCode: Task file not found. Output: ${checkOutput.substring(0, 500)}`);
            } else if (checkOutput.includes('已完成')) {
              isCompleted = true;
              logger.info(`WriteCode: Tasks completed (text search fallback) (iteration ${retryCount})`);
            }
          }
        }
      }

      // 汇总输出
      const stdout = allOutputs.join('\n\n');

      if (!isCompleted) {
        logger.error('WriteCode: Max retries reached, tasks still not completed', {
          maxRetries,
          totalIterations: retryCount,
        });
      }

      logger.info('WriteCode: Code generation loop completed', {
        isCompleted,
        totalIterations: retryCount,
        workDir,
      });

      return {
        content: `# Code Generation ${isCompleted ? 'Completed' : 'Incomplete'}\n\n## Status: ${isCompleted ? '✅ All tasks completed' : '❌ Max retries reached'}\n\n## Total Iterations: ${retryCount}\n\n## Cursor CLI Output:\n\n${stdout}`,
        data: {
          type: 'code',
          workspaceDir: workDir,
          cursorOutput: stdout,
          isCompleted,
          totalIterations: retryCount,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      // 避免循环引用导致JSON序列化失败
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      logger.error('WriteCode: Failed to generate code using Cursor CLI', {
        message: errorMessage,
        stack: errorStack,
      });
      throw error;
    }
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

export default WriteCode;
