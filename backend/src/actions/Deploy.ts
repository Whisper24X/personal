/**
 * Deploy Action
 * 使用Cursor CLI命令行执行部署
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import { logger, WorkspaceOptions, WorkspaceManager } from '../utils';
import { getDeployCommand, getDeployCheckCommand } from '../prompts/code';
import * as fs from 'fs/promises';

export interface DeployOptions extends WorkspaceOptions {
  // 继承WorkspaceOptions的所有选项
}

export class Deploy extends BaseAction {
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
      
      // 调试模式检查（共用 WRITE_CODE_DEBUG）
      const isDebugMode = process.env.WRITE_CODE_DEBUG === 'true';
      if (isDebugMode) {
        logger.info('Deploy: Debug mode enabled, executing debug command', {
          workDir,
        });
        
        const debugPrompt = '在当前目录下生成一个deployTest.txt文档，内容为 我是部署调试';
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
            timestamp: new Date().toISOString(),
          },
        };
      }
      
      // 从 prompts/code.ts 获取命令提示词
      const deployCommand = getDeployCommand();
      const checkCommand = getDeployCheckCommand();
      
      // 循环执行，直到部署完成并验证可访问
      const maxRetries = 10; // 最大重试次数
      let isCompleted = false;
      let retryCount = 0;
      let allOutputs: string[] = [];
      
      logger.info('Deploy: Starting deployment loop', { 
        cwd: workDir,
        maxRetries,
      });
      
      while (!isCompleted && retryCount < maxRetries) {
        // 检查是否被取消
        this.checkCancellation();
        retryCount++;
        
        logger.info(`Deploy: Iteration ${retryCount}/${maxRetries} - Executing deploy command`, {
          command: deployCommand,
        });
        
        // 1. 执行部署命令
        const deployResult = await this.runCLICommand(deployCommand, workDir, {
          timeout: 600000, // 10分钟超时（部署可能需要较长时间）
          abortSignal: this.abortSignal,
        });
        
        const deployOutput = deployResult.output;
        if (deployResult.exitCode === 0) {
          logger.info(`Deploy: Deploy command completed (iteration ${retryCount})`, {
            outputLength: deployOutput.length,
            output: deployOutput.length > 0 ? deployOutput : '(empty output)',
          });
        } else {
          logger.warn(`Deploy: Deploy command failed (iteration ${retryCount})`, { 
            exitCode: deployResult.exitCode,
            stdout: deployOutput || '(empty)',
            stderr: deployResult.stderr || '(empty)',
          });
        }
        
        allOutputs.push(`=== Iteration ${retryCount} - Deploy ===\n${deployOutput}`);
        
        // 2. 执行检查命令
        logger.info(`Deploy: Iteration ${retryCount}/${maxRetries} - Executing check command`, {
          command: checkCommand,
        });
        
        const checkResult = await this.runCLICommand(checkCommand, workDir, {
          timeout: 300000, // 5分钟超时
          abortSignal: this.abortSignal,
        });
        
        const checkOutput = checkResult.output;
        if (checkResult.exitCode === 0) {
          logger.info(`Deploy: Check command completed (iteration ${retryCount})`, {
            outputLength: checkOutput.length,
            output: checkOutput.substring(0, 200), // 记录前200字符
          });
        } else {
          logger.warn(`Deploy: Check command failed (iteration ${retryCount})`, { 
            exitCode: checkResult.exitCode,
            stdout: checkOutput || '(empty)',
            stderr: checkResult.stderr || '(empty)',
          });
        }
        
        allOutputs.push(`=== Iteration ${retryCount} - Check ===\n${checkOutput}`);
        
        // 3. 判断是否完成 - 解析JSON响应
        try {
          // 尝试从输出中提取JSON
          const jsonMatch = checkOutput.match(/\{[\s\S]*"result"[\s\S]*\}/);
          if (!jsonMatch) {
            logger.warn(`Deploy: Unable to parse JSON from check output (iteration ${retryCount})`, {
              checkOutput: checkOutput.substring(0, 200),
            });
            // 回退到旧的文本匹配方式
            if (checkOutput.includes('未找到')) {
              const errorMessage = `Deploy: Deploy file not found. Check command returned "未找到". Output: ${checkOutput.substring(0, 500)}`;
              logger.error(errorMessage, {
                iteration: retryCount,
                checkOutput: checkOutput.substring(0, 500),
              });
              // 不要直接抛出错误，继续重试
              logger.warn(`Deploy: Will retry (iteration ${retryCount}/${maxRetries})`);
            } else if (checkOutput.includes('已完成')) {
              isCompleted = true;
            }
          } else {
            const checkResultObj = JSON.parse(jsonMatch[0]);
            const result = checkResultObj.result;
            const reason = checkResultObj.reason || '';
            const details = checkResultObj.details || null;
            
            logger.info(`Deploy: Check result parsed (iteration ${retryCount})`, {
              result,
              reason,
              details,
            });
            
            if (result === '未找到') {
              logger.warn(`Deploy: Deploy file not found (iteration ${retryCount})`, {
                result,
                reason,
                willRetry: retryCount < maxRetries,
              });
              // 不要直接抛出错误，继续重试
            } else if (result === '已完成') {
              isCompleted = true;
              logger.info(`Deploy: Deployment completed successfully (iteration ${retryCount})`, {
                totalIterations: retryCount,
                reason,
                details,
              });
            } else {
              logger.warn(`Deploy: Deployment not completed yet (iteration ${retryCount})`, {
                result,
                reason,
                details,
                willRetry: retryCount < maxRetries,
              });
            }
          }
        } catch (parseError: any) {
          logger.warn(`Deploy: Failed to parse check output as JSON (iteration ${retryCount})`, {
            error: parseError.message,
            checkOutput: checkOutput.substring(0, 200),
          });
          // 回退到旧的文本匹配方式
          if (checkOutput.includes('未找到')) {
            logger.warn(`Deploy: Deploy file not found, will retry (iteration ${retryCount}/${maxRetries})`);
            // 不要直接抛出错误，继续重试
          } else if (checkOutput.includes('已完成')) {
            isCompleted = true;
          }
        }
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

}

export default Deploy;
