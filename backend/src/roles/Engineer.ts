/**
 * Engineer Role
 * Implements code based on design documents and executes subtasks
 */

import { IRoleConfig, ACTION_WRITE_DESIGN, ACTION_WRITE_PRD, ACTION_BREAKDOWN_TASKS } from '@mind2build/shared';
import { Role } from './Role';
import { Context } from '../core/context/Context';
import { WriteCode } from '../actions/WriteCode';
import { ExecuteSubtask } from '../actions/ExecuteSubtask';
import { RunCode } from '../actions/RunCode';
import { FixBug } from '../actions/FixBug';
import { Message } from '../core/message/Message';
import { logger, SubtaskManager, loadPrompt, createWorkspaceZip, createCodeZip } from '../utils';
import {
  buildCodePromptWithStandardDocs,
  buildTaskDescriptionPrompt,
  checkCodeCompleteness,
  checkFrontendBackendCompleteness,
  buildCodeCompletenessCheckPrompt,
  buildCodeCompletionPrompt,
  CODE_COMPLETENESS_CHECK_SYSTEM_PROMPT,
  parseCodeFiles,
} from '../prompts/code';

export class Engineer extends Role {
  constructor(context: Context, name: string = 'Engineer') {
    // Priority: database config (role-specific LLM) > default (context.llm)
    // No explicit config.llm - rely on database configuration or default model
    const config: IRoleConfig = {
      name,
      profile: 'Engineer',
      goal: 'Implement high-quality code based on ProductManager and Architect outputs, executing subtasks according to task breakdown',
      constraints: 'Follow coding standards, write clean and maintainable code',
      description: 'Skilled engineer who brings designs to life through code and executes subtasks based on task breakdown',
      // No explicit llm config - will use database config if available, otherwise default context.llm
    };

    super(config, context);

    // Watch for ProductManager output (WritePRD), Architect output (WriteDesign, BreakdownTasks)
    this.watch([ACTION_WRITE_PRD, ACTION_WRITE_DESIGN, ACTION_BREAKDOWN_TASKS]);

    // Set actions - WriteCode, ExecuteSubtask, RunCode, and FixBug
    this.setActions([new WriteCode(), new ExecuteSubtask(), new RunCode(), new FixBug()]);
  }

  /**
   * Override think to manage action coordination
   * 通过think方法管理action之间的协作，而不是在act方法中直接切换
   */
  async think(): Promise<boolean> {
    // 先调用基类的think方法
    const hasTodo = await super.think();
    
    if (hasTodo && this.rc.todo) {
      const action = this.rc.todo;
      
      // 如果当前action是ExecuteSubtask，检查是否需要先准备设计文档
      if (action.name === 'ExecuteSubtask') {
        // ExecuteSubtask需要从任务拆分中获取任务信息
        // 这个逻辑在executeSubtask方法中处理
        return true;
      }
      
      // 如果当前action是WriteCode，检查是否有任务拆分需要处理
      if (action.name === 'WriteCode') {
        // WriteCode的处理逻辑在writeCodeWithTaskBreakdown方法中
        // 如果需要执行子任务，会在那里切换到ExecuteSubtask
        return true;
      }
    }
    
    return hasTodo;
  }

  /**
   * Override act to handle action execution
   * 移除action切换逻辑，改为通过think方法管理
   */
  async act(): Promise<Message | null> {
    if (!this.rc.todo) {
      return null;
    }

    const action = this.rc.todo;

    // 如果是ExecuteSubtask，需要从任务拆分中获取任务信息
    if (action.name === 'ExecuteSubtask') {
      return await this.executeSubtask();
    }

    // 如果是WriteCode，检查是否有任务拆分，如果有则拆解为多个子任务
    if (action.name === 'WriteCode') {
      return await this.writeCodeWithTaskBreakdown();
    }

    // 否则使用基类的act方法
    return await super.act();
  }

  /**
   * Check if auto code generation is enabled
   */
  private isAutoCodeEnabled(): boolean {
    const autoCode = process.env.ENGINEER_AUTO_CODE;
    // Default to false if not set or set to 'false'
    return autoCode === 'true' || autoCode === '1';
  }

  /**
   * Write code based on ProductManager and Architect outputs, with task breakdown if available
   */
  private async writeCodeWithTaskBreakdown(): Promise<Message | null> {
    const action = this.rc.todo!;
    logger.info(`${this.profile} WriteCode: Starting code generation with task breakdown check`);

    try {
      // 获取workspace选项
      const workspaceOptions = this.extractWorkspaceOptions();
      
      // applicationId 必须提供，不能使用 'default'
      if (!workspaceOptions?.applicationId) {
        logger.error(`${this.profile} WriteCode: applicationId is required in workspaceOptions. Cannot use "default" to prevent file conflicts between different applications.`);
        this.rc.todo = null;
        return null;
      }
      const applicationId = workspaceOptions.applicationId;
      const version = workspaceOptions?.version || 1;

      // 检查是否启用自动编码
      const autoCodeEnabled = this.isAutoCodeEnabled();

      if (!autoCodeEnabled) {
        // 不启用自动编码：直接返回workspace压缩包
        logger.info(`${this.profile} WriteCode: Auto code generation disabled, returning workspace zip`);

        if (!workspaceOptions) {
          logger.error(`${this.profile} WriteCode: Workspace options are required but not provided`);
          this.rc.todo = null;
          return null;
        }

        try {
          const zipPath = await createWorkspaceZip(workspaceOptions);

          // 创建消息，包含压缩包路径信息
          const message = new Message({
            content: `# Workspace Archive\n\n自动编码未启用，已生成workspace压缩包。\n\n压缩包路径: ${zipPath}`,
            role: this.profile,
            causeBy: action.constructor.name,
            sentFrom: this.name,
            instructContent: {
              type: 'workspace_zip',
              zipPath: zipPath,
              autoCodeEnabled: false,
            },
          });

          logger.info(`${this.profile} WriteCode: Workspace zip created`, { zipPath });

          // Clear current action
          this.rc.todo = null;

          return message;
        } catch (error: any) {
          logger.error(`${this.profile} WriteCode: Failed to create workspace zip`, error);
          // 如果压缩包创建失败，返回错误消息，不继续执行代码生成
          this.rc.todo = null;
          throw new Error(`Failed to create workspace zip: ${error.message}`);
        }
      }

      // 必须从workspace读取标准文档：PRD、DESIGN、TASKS
      const { WorkspaceManager } = await import('../utils/WorkspaceManager');

      // 从workspace读取PRD文档
      const prdFromWorkspace = await WorkspaceManager.readAllFromWorkspace({
        applicationId,
        version,
        documentType: 'PRD',
        workspacePath: workspaceOptions?.workspacePath,
      });

      // 从workspace读取DESIGN文档
      const designFromWorkspace = await WorkspaceManager.readAllFromWorkspace({
        applicationId,
        version,
        documentType: 'DESIGN',
        workspacePath: workspaceOptions?.workspacePath,
      });

      // 从workspace读取TASKS文档
      const taskBreakdownFromWorkspace = await WorkspaceManager.readAllFromWorkspace({
        applicationId,
        version,
        documentType: 'TASKS',
        workspacePath: workspaceOptions?.workspacePath,
      });

      // 优先使用workspace中的文档，如果没有则使用memory中的文档
      const prdMessages = this.rc.memory.getByAction('WritePRD');
      const prd = prdFromWorkspace || (prdMessages.length > 0 ? prdMessages[prdMessages.length - 1].content : '');

      const designMessages = this.rc.memory.getByAction('WriteDesign');
      const design = designFromWorkspace || (designMessages.length > 0 ? designMessages[designMessages.length - 1].content : '');

      const breakdownMessages = this.rc.memory.getByAction('BreakdownTasks');
      const taskBreakdown = taskBreakdownFromWorkspace || (breakdownMessages.length > 0 ? breakdownMessages[breakdownMessages.length - 1].content : '');

      // 验证必需文档：DESIGN是必需的
      if (!design) {
        logger.warn(`${this.profile} WriteCode: No Design document found in workspace or memory, Design is required for code generation`);
        return null;
      }

      // 记录从workspace读取的文档状态
      logger.info(`${this.profile} WriteCode: Loaded documents from workspace`, {
        applicationId,
        version,
        hasPRD: !!prd,
        hasDesign: !!design,
        hasTaskBreakdown: !!taskBreakdown,
        prdFromWorkspace: !!prdFromWorkspace,
        designFromWorkspace: !!designFromWorkspace,
        taskBreakdownFromWorkspace: !!taskBreakdownFromWorkspace,
      });

      // 如果有任务拆分，则根据任务拆分拆解出多个子任务完成代码编写
      // 但只有在启用自动编码时才执行子任务
      if (autoCodeEnabled && taskBreakdown && workspaceOptions?.applicationId && workspaceOptions?.version) {
        logger.info(`${this.profile} WriteCode: Found task breakdown, will execute subtasks`);

        // 解析任务拆分
        const subtaskManager = new SubtaskManager();
        subtaskManager.parseTaskBreakdown(taskBreakdown);

        // 保存任务拆分到workspace（如果还没有保存）
        await subtaskManager.saveToWorkspace({
          ...workspaceOptions,
          documentType: 'TASKS',
        });

        // 获取待执行的任务
        const pendingTasks = subtaskManager.getPendingTasks();

        if (pendingTasks.length > 0) {
          // 有任务需要执行，设置下一个action为ExecuteSubtask
          // 通过think方法管理action之间的协作，而不是直接切换
          const executeSubtaskAction = this.actions.find(a => a.name === 'ExecuteSubtask');
          if (executeSubtaskAction) {
            logger.info(`${this.profile} WriteCode: Found ${pendingTasks.length} pending tasks, will execute ExecuteSubtask next`);
            // 保存状态，让think方法决定下一个action
            this.rc.state = -1; // 重置状态，让think方法重新选择action
            // 将ExecuteSubtask设置为下一个待执行的action
            // 注意：这里不直接切换，而是通过think方法管理
            // 为了保持向后兼容，暂时直接设置，但应该通过think方法管理
            this.rc.todo = executeSubtaskAction;
            return await this.executeSubtask();
          }
        } else {
          logger.info(`${this.profile} WriteCode: All tasks completed, proceeding with WriteCode`);
        }
      } else if (!autoCodeEnabled && taskBreakdown) {
        logger.info(`${this.profile} WriteCode: Task breakdown found but auto code generation is disabled, skipping subtask execution`);
      }

      // 使用提示词函数构建完整的输入：必须包含PRD、DESIGN和TASKS三个标准文档
      let designInput = buildCodePromptWithStandardDocs(design, prd, taskBreakdown);

      // 循环检测代码完整性，不限制最大尝试次数
      let attempt = 0;
      let result: any = null;
      let isComplete = false;
      let lastIssues: string[] = [];
      let accumulatedFiles: Array<{ path: string; content: string }> = [];
      let accumulatedContent = '';
      let frontendBackendCheck: {
        isComplete: boolean;
        issues: string[];
        frontendMissing: string[];
        backendMissing: string[];
        configMissing: string[];
      } = {
        isComplete: true,
        issues: [],
        frontendMissing: [],
        backendMissing: [],
        configMissing: [],
      };

      while (!isComplete) {
        attempt++;
        logger.info(`${this.profile} WriteCode: Code generation attempt ${attempt}`);

        // 生成代码
        result = await action.run(designInput, workspaceOptions);

        // 解析生成的代码文件
        const codeOutput = result.content || '';
        const files = parseCodeFiles(codeOutput);

        if (files.length === 0) {
          logger.warn(`${this.profile} WriteCode: No files generated in attempt ${attempt}`);
          lastIssues = ['未生成任何代码文件'];
          continue;
        }

        // 合并已生成的代码文件（保留最新版本）
        const fileMap = new Map<string, string>();
        // 先添加已累积的文件
        accumulatedFiles.forEach(f => fileMap.set(f.path, f.content));
        // 用新生成的文件覆盖
        files.forEach(f => fileMap.set(f.path, f.content));
        // 更新累积文件列表
        accumulatedFiles = Array.from(fileMap.entries()).map(([path, content]) => ({ path, content }));

        // 检测代码完整性（包括前后端完整性检查）
        const allCodeContent = accumulatedFiles.map(f => f.content).join('\n\n');
        const completenessCheck = checkCodeCompleteness(allCodeContent);

        // 检测前后端代码完整性
        frontendBackendCheck = checkFrontendBackendCompleteness(accumulatedFiles, design);

        // 合并所有问题
        const allIssues = [...completenessCheck.issues, ...frontendBackendCheck.issues];
        const isStructurallyComplete = frontendBackendCheck.isComplete;

        // 如果使用LLM进行更详细的检测
        if (completenessCheck.isComplete && isStructurallyComplete && this.context.llm) {
          try {
            // Get abortSignal from StateManager if available
            let abortSignal: AbortSignal | undefined;
            try {
              const stateManager = this.context.get?.('stateManager');
              if (stateManager && typeof stateManager.getAbortSignal === 'function') {
                abortSignal = stateManager.getAbortSignal();
              }
            } catch (error: any) {
              logger.warn(`${this.profile} WriteCode: Failed to get abortSignal`, { error: error.message });
            }
            
            // Check cancellation before LLM call
            if (abortSignal?.aborted) {
              throw new Error('LLM call was cancelled');
            }
            
            const checkPrompt = buildCodeCompletenessCheckPrompt(accumulatedFiles, design);
            const userId = this.context.get('userId');
            const systemPrompt = await loadPrompt(userId, 'code', 'completeness_check_system_prompt', CODE_COMPLETENESS_CHECK_SYSTEM_PROMPT);
            const llmCheckResult = await this.context.llm.aask(checkPrompt, [systemPrompt], abortSignal);
            
            // Check cancellation after LLM call
            if (abortSignal?.aborted) {
              throw new Error('LLM call was cancelled');
            }

            if (llmCheckResult.includes('INCOMPLETE')) {
              const match = llmCheckResult.match(/INCOMPLETE:\s*(.+)/i);
              lastIssues = match ? [match[1]] : ['LLM检测到代码不完整'];
              isComplete = false;
              logger.warn(`${this.profile} WriteCode: LLM检测到代码不完整: ${lastIssues.join(', ')}`);
            } else if (llmCheckResult.includes('COMPLETE')) {
              isComplete = true;
              logger.info(`${this.profile} WriteCode: LLM确认代码完整`);
            } else {
              // 如果LLM检测结果不明确，使用本地检测结果
              isComplete = completenessCheck.isComplete && isStructurallyComplete;
              if (!isComplete) {
                lastIssues = allIssues;
              }
            }
          } catch (error: any) {
            logger.warn(`${this.profile} WriteCode: LLM完整性检测失败，使用本地检测结果`, error);
            isComplete = completenessCheck.isComplete && isStructurallyComplete;
            if (!isComplete) {
              lastIssues = allIssues;
            }
          }
        } else {
          isComplete = completenessCheck.isComplete && isStructurallyComplete;
          if (!isComplete) {
            lastIssues = allIssues;
          }
        }

        // 记录前后端完整性检查结果
        if (!isStructurallyComplete) {
          logger.warn(`${this.profile} WriteCode: 前后端代码结构不完整`, {
            frontendMissing: frontendBackendCheck.frontendMissing.length,
            backendMissing: frontendBackendCheck.backendMissing.length,
            configMissing: frontendBackendCheck.configMissing.length,
          });
        }

        // 如果代码不完整，进行多轮对话补充
        if (!isComplete) {
          logger.warn(`${this.profile} WriteCode: 代码不完整，准备进行多轮对话补充`, {
            attempt,
            issues: lastIssues,
            filesCount: accumulatedFiles.length,
          });

          // 构建代码补充提示词（多轮对话）
          designInput = buildCodeCompletionPrompt(
            accumulatedFiles,
            lastIssues,
            design,
            prd,
            taskBreakdown
          );

          // 如果检测到占位符问题，特别强调
          const hasPlaceholderIssues = lastIssues.some(issue =>
            issue.includes('占位符') ||
            issue.includes('...') ||
            issue.includes('不完整标记')
          );

          if (hasPlaceholderIssues && attempt > 5) {
            designInput += `\n\n**🚨 严重警告：已尝试 ${attempt} 次，但仍有占位符问题！**\n`;
            designInput += `你必须彻底修复所有占位符问题：\n`;
            designInput += `1. 找到所有包含 "..." 的地方（包括注释中的 "// ..."）\n`;
            designInput += `2. 将这些占位符替换为完整的代码实现\n`;
            designInput += `3. 不要使用任何形式的占位符、省略号或未完成的代码\n`;
            designInput += `4. 确保所有代码都是完整可运行的\n`;
            designInput += `5. 如果某个地方需要省略，请直接删除该注释或代码，不要使用 "..." 占位符\n\n`;
          }

          // 如果后端代码缺失，在提示词中明确强调
          if (frontendBackendCheck.backendMissing.length > 0) {
            const backendMissingList = frontendBackendCheck.backendMissing.slice(0, 10).join(', ');
            designInput += `\n\n**⚠️ 紧急：后端代码缺失！**\n`;
            designInput += `检测到缺失 ${frontendBackendCheck.backendMissing.length} 个后端文件，包括：${backendMissingList}\n`;
            designInput += `你必须立即生成所有缺失的后端代码文件！\n`;
          }

          // 如果前端代码缺失，在提示词中明确强调
          if (frontendBackendCheck.frontendMissing.length > 0) {
            const frontendMissingList = frontendBackendCheck.frontendMissing.slice(0, 10).join(', ');
            designInput += `\n\n**⚠️ 紧急：前端代码缺失！**\n`;
            designInput += `检测到缺失 ${frontendBackendCheck.frontendMissing.length} 个前端文件，包括：${frontendMissingList}\n`;
            designInput += `你必须立即生成所有缺失的前端代码文件！\n`;
          }
        } else if (isComplete) {
          // 代码完整，更新最终结果
          accumulatedContent = accumulatedFiles.map(f =>
            `===== FILE: ${f.path} =====\n${f.content}\n===== END FILE =====`
          ).join('\n\n');
        }
      }

      // 如果最终仍然不完整，使用累积的代码
      if (!isComplete && accumulatedFiles.length > 0) {
        accumulatedContent = accumulatedFiles.map(f =>
          `===== FILE: ${f.path} =====\n${f.content}\n===== END FILE =====`
        ).join('\n\n');

        logger.warn(`${this.profile} WriteCode: 代码生成完成，但检测到不完整问题`, {
          attempts: attempt,
          issues: lastIssues,
          filesCount: accumulatedFiles.length,
        });
      } else if (isComplete) {
        logger.info(`${this.profile} WriteCode: 代码生成完成且通过完整性检测`, {
          attempts: attempt,
          filesCount: accumulatedFiles.length,
        });
      }

      // 如果有累积的代码内容，更新result
      if (accumulatedContent) {
        result = {
          ...result,
          content: `# Generated Code\n\n## Files Created:\n${accumulatedFiles.map(f => `- ${f.path}`).join('\n')}\n\n## Full Code:\n\n${accumulatedContent}`,
          data: {
            ...result.data,
            files: accumulatedFiles,
            filesCount: accumulatedFiles.length,
            completenessCheck: {
              isComplete,
              attempts: attempt,
              issues: lastIssues,
            },
          },
        };
      }

      logger.info(`${this.profile} WriteCode: 代码生成完成`, {
        attempts: attempt,
        isComplete,
      });

      // 如果启用了自动编码，创建代码压缩包
      let zipPath: string | undefined;
      if (autoCodeEnabled && accumulatedFiles.length > 0 && workspaceOptions) {
        try {
          zipPath = await createCodeZip(accumulatedFiles, workspaceOptions);
          logger.info(`${this.profile} WriteCode: Code zip created`, { zipPath });
        } catch (error: any) {
          logger.error(`${this.profile} WriteCode: Failed to create code zip`, error);
        }
      }

      // 创建消息
      const message = new Message({
        content: result.content,
        role: this.profile,
        causeBy: action.constructor.name,
        sentFrom: this.name,
        instructContent: {
          ...result.data,
          completenessCheck: {
            isComplete,
            attempts: attempt,
            issues: lastIssues,
          },
          ...(zipPath && {
            zipPath: zipPath,
            autoCodeEnabled: true,
          }),
        },
      });

      logger.info(`${this.profile} WriteCode: Code generation completed`);

      // Clear current action
      this.rc.todo = null;

      return message;
    } catch (error: any) {
      logger.error(`${this.profile} WriteCode failed:`, error);
      this.rc.todo = null;
      throw error;
    }
  }

  /**
   * Execute a subtask
   */
  private async executeSubtask(): Promise<Message | null> {
    const action = this.rc.todo!;
    logger.info(`${this.profile} executing subtask`);

    try {
      // 检查是否启用自动编码
      const autoCodeEnabled = this.isAutoCodeEnabled();

      if (!autoCodeEnabled) {
        // 不启用自动编码：直接返回workspace压缩包
        logger.info(`${this.profile} ExecuteSubtask: Auto code generation disabled, returning workspace zip`);

        const workspaceOptions = this.extractWorkspaceOptions();

        if (!workspaceOptions?.applicationId || !workspaceOptions?.version) {
          logger.error(`${this.profile} ExecuteSubtask: Workspace options are required but not provided`);
          this.rc.todo = null;
          return null;
        }

        try {
          const zipPath = await createWorkspaceZip(workspaceOptions);

          // 创建消息，包含压缩包路径信息
          const message = new Message({
            content: `# Workspace Archive\n\n自动编码未启用，已生成workspace压缩包。\n\n压缩包路径: ${zipPath}`,
            role: this.profile,
            causeBy: action.constructor.name,
            sentFrom: this.name,
            instructContent: {
              type: 'workspace_zip',
              zipPath: zipPath,
              autoCodeEnabled: false,
            },
          });

          logger.info(`${this.profile} ExecuteSubtask: Workspace zip created`, { zipPath });

          // Clear current action
          this.rc.todo = null;

          return message;
        } catch (error: any) {
          logger.error(`${this.profile} ExecuteSubtask: Failed to create workspace zip`, error);
          // 如果压缩包创建失败，返回错误消息，不继续执行代码生成
          this.rc.todo = null;
          throw new Error(`Failed to create workspace zip: ${error.message}`);
        }
      }

      // 获取workspace选项
      const workspaceOptions = this.extractWorkspaceOptions();

      if (!workspaceOptions?.applicationId || !workspaceOptions?.version) {
        logger.warn(`${this.profile} ExecuteSubtask: Missing workspace options`);
        this.rc.todo = null;
        return null;
      }

      // 加载任务管理器
      const subtaskManager = new SubtaskManager();
      const loaded = await subtaskManager.loadFromWorkspace({
        applicationId: workspaceOptions.applicationId,
        version: workspaceOptions.version,
        documentType: 'TASKS',
      });

      if (!loaded) {
        logger.warn(`${this.profile} ExecuteSubtask: Failed to load task breakdown`);
        this.rc.todo = null;
        return null;
      }

      // 获取待执行的任务
      const pendingTasks = subtaskManager.getPendingTasks();
      if (pendingTasks.length === 0) {
        logger.info(`${this.profile} ExecuteSubtask: No pending tasks, all tasks completed`);
        // 所有任务已完成，清除当前action，让think方法决定下一个action
        this.rc.todo = null;
        return null;
      }

      // 执行第一个待执行的任务
      const task = pendingTasks[0];
      logger.info(`${this.profile} ExecuteSubtask: Executing task ${task.id}: ${task.name}`);

      // 标记任务为进行中
      subtaskManager.markTaskInProgress(task.id);

      // 从workspace读取文档：PRD和TASK文件夹中的任务文件
      const { WorkspaceManager } = await import('../utils/WorkspaceManager');
      const fs = await import('fs/promises');
      const path = await import('path');

      // 从workspace读取PRD文档
      const prdFromWorkspace = await WorkspaceManager.readAllFromWorkspace({
        applicationId: workspaceOptions.applicationId,
        version: workspaceOptions.version,
        documentType: 'PRD',
        workspacePath: workspaceOptions.workspacePath,
      });

      // 从workspace读取TASK文件夹中的任务文件（按文件名顺序）
      const taskDir = WorkspaceManager.getWorkspaceDir({
        ...workspaceOptions,
        documentType: 'TASK',
      });

      let taskContent = '';
      try {
        // 读取TASK目录中的所有文件
        const files = await fs.readdir(taskDir);
        // 过滤出task_n.md文件并按文件名排序
        const taskFiles = files
          .filter(file => file.startsWith('task_') && file.endsWith('.md'))
          .sort((a, b) => {
            // 提取数字进行排序：task_1.md < task_2.md < ... < task_10.md
            const numA = parseInt(a.match(/task_(\d+)\.md/)?.[1] || '0');
            const numB = parseInt(b.match(/task_(\d+)\.md/)?.[1] || '0');
            return numA - numB;
          });

        // 找到当前任务对应的文件
        const taskNumber = parseInt(task.id.match(/\d+/)?.[0] || '0');
        const currentTaskFile = taskFiles.find(file => {
          const fileNum = parseInt(file.match(/task_(\d+)\.md/)?.[1] || '0');
          return fileNum === taskNumber;
        });

        if (currentTaskFile) {
          const taskFilePath = path.join(taskDir, currentTaskFile);
          taskContent = await fs.readFile(taskFilePath, 'utf-8');
          logger.info(`${this.profile} ExecuteSubtask: Loaded task file`, {
            taskId: task.id,
            fileName: currentTaskFile,
            contentLength: taskContent.length,
          });
        } else {
          logger.warn(`${this.profile} ExecuteSubtask: Task file not found`, {
            taskId: task.id,
            taskNumber,
            availableFiles: taskFiles,
          });
        }
      } catch (error: any) {
        logger.warn(`${this.profile} ExecuteSubtask: Failed to read task directory`, {
          taskDir,
          error: error.message,
        });
      }

      // 优先使用workspace中的文档，如果没有则使用memory中的文档
      const prdMessages = this.rc.memory.getByAction('WritePRD');
      const prd = prdFromWorkspace || (prdMessages.length > 0 ? prdMessages[prdMessages.length - 1].content : '');

      // 如果从文件系统读取失败，尝试从memory读取任务拆分文档
      if (!taskContent) {
        const breakdownMessages = this.rc.memory.getByAction('BreakdownTasks');
        if (breakdownMessages.length > 0) {
          // 从任务拆分文档中提取当前任务的内容
          const breakdownContent = breakdownMessages[breakdownMessages.length - 1].content;
          // 尝试提取当前任务的内容
          const taskMatch = breakdownContent.match(new RegExp(`###\\s*任务\\s*${task.id}[^#]*`, 's'));
          if (taskMatch) {
            taskContent = taskMatch[0];
          }
        }
      }

      // 验证必需文档：PRD和任务内容
      if (!prd) {
        logger.warn(`${this.profile} ExecuteSubtask: No PRD document found in workspace or memory`);
      }

      if (!taskContent) {
        logger.warn(`${this.profile} ExecuteSubtask: No task content found for task ${task.id}`);
        this.rc.todo = null;
        return null;
      }

      // 记录从workspace读取的文档状态
      logger.info(`${this.profile} ExecuteSubtask: Loaded documents from workspace`, {
        applicationId: workspaceOptions.applicationId,
        version: workspaceOptions.version,
        taskId: task.id,
        hasPRD: !!prd,
        hasTaskContent: !!taskContent,
        prdFromWorkspace: !!prdFromWorkspace,
      });

      // 构建任务描述，直接使用任务文件内容
      const taskDescription = this.buildTaskDescriptionFromFile(task, taskContent, prd);

      // 循环检测代码完整性，不限制最大尝试次数
      let attempt = 0;
      let result: any = null;
      let isComplete = false;
      let lastIssues: string[] = [];
      let accumulatedFiles: Array<{ path: string; content: string }> = [];
      let accumulatedContent = '';
      let currentTaskDescription = taskDescription;

      while (!isComplete) {
        attempt++;
        logger.info(`${this.profile} ExecuteSubtask: Code generation attempt ${attempt} for task ${task.id}`);

      // 先调用ExecuteSubtask action来准备设计文档
      const executeSubtaskResult = await (action as any).run(currentTaskDescription, {
        ...workspaceOptions,
        taskId: task.id,
        taskDescription: currentTaskDescription,
        prd: prd,
      });

      // ExecuteSubtask返回设计文档内容，现在需要调用WriteCode来生成代码
      const designContent = executeSubtaskResult.data?.designContent;
      if (!designContent) {
        logger.error(`${this.profile} ExecuteSubtask: No design content returned from ExecuteSubtask action`);
        throw new Error('ExecuteSubtask action did not return design content');
      }

      // 调用WriteCode action来生成代码
      const writeCodeAction = this.actions.find(a => a.name === 'WriteCode');
      if (!writeCodeAction) {
        logger.error(`${this.profile} ExecuteSubtask: WriteCode action not found`);
        throw new Error('WriteCode action not found');
      }

      // 调用WriteCode生成代码
      const codeResult = await (writeCodeAction as any).run(designContent, executeSubtaskResult.data?.workspaceOptions);

      // 更新子任务状态为已完成
      if (workspaceOptions?.applicationId && workspaceOptions?.version) {
        const subtaskManager = new SubtaskManager();
        const loaded = await subtaskManager.loadFromWorkspace({
          applicationId: workspaceOptions.applicationId,
          version: workspaceOptions.version,
          documentType: 'TASKS',
        });

        if (loaded) {
          subtaskManager.markTaskCompleted(task.id);
          await subtaskManager.saveToWorkspace({
            applicationId: workspaceOptions.applicationId,
            version: workspaceOptions.version,
            documentType: 'TASKS',
          });

          // 生成执行报告并保存
          const report = subtaskManager.getExecutionReport();
          const WorkspaceManager = (await import('../utils/WorkspaceManager')).WorkspaceManager;
          await WorkspaceManager.saveToWorkspace(
            'TASK_EXECUTION_REPORT.md',
            report,
            {
              applicationId: workspaceOptions.applicationId,
              version: workspaceOptions.version,
              documentType: 'TASKS',
            }
          );
        }
      }

      // 使用WriteCode的结果
      result = codeResult;

      // 解析生成的代码文件
      const codeOutput = result.content || '';
      const files = parseCodeFiles(codeOutput);

        if (files.length === 0) {
          logger.warn(`${this.profile} ExecuteSubtask: No files generated in attempt ${attempt}`);
          lastIssues = ['未生成任何代码文件'];
          continue;
        }

        // 合并已生成的代码文件（保留最新版本）
        const fileMap = new Map<string, string>();
        // 先添加已累积的文件
        accumulatedFiles.forEach(f => fileMap.set(f.path, f.content));
        // 用新生成的文件覆盖
        files.forEach(f => fileMap.set(f.path, f.content));
        // 更新累积文件列表
        accumulatedFiles = Array.from(fileMap.entries()).map(([path, content]) => ({ path, content }));

        // 检测代码完整性（包括前后端完整性检查）
        const allCodeContent = accumulatedFiles.map(f => f.content).join('\n\n');
        const completenessCheck = checkCodeCompleteness(allCodeContent);

        // 检测前后端代码完整性（传入空字符串作为design，因为不再需要design）
        const frontendBackendCheck = checkFrontendBackendCompleteness(accumulatedFiles, '');

        // 合并所有问题
        const allIssues = [...completenessCheck.issues, ...frontendBackendCheck.issues];
        const isStructurallyComplete = frontendBackendCheck.isComplete;

        // 如果使用LLM进行更详细的检测
        if (completenessCheck.isComplete && isStructurallyComplete && this.context.llm) {
          try {
            // Get abortSignal from StateManager if available
            let abortSignal: AbortSignal | undefined;
            try {
              const stateManager = this.context.get?.('stateManager');
              if (stateManager && typeof stateManager.getAbortSignal === 'function') {
                abortSignal = stateManager.getAbortSignal();
              }
            } catch (error: any) {
              logger.warn(`${this.profile} ExecuteSubtask: Failed to get abortSignal`, { error: error.message });
            }
            
            // Check cancellation before LLM call
            if (abortSignal?.aborted) {
              throw new Error('LLM call was cancelled');
            }
            
            const checkPrompt = buildCodeCompletenessCheckPrompt(accumulatedFiles, design);
            const userId = this.context.get('userId');
            const systemPrompt = await loadPrompt(userId, 'code', 'completeness_check_system_prompt', CODE_COMPLETENESS_CHECK_SYSTEM_PROMPT);
            const llmCheckResult = await this.context.llm.aask(checkPrompt, [systemPrompt], abortSignal);
            
            // Check cancellation after LLM call
            if (abortSignal?.aborted) {
              throw new Error('LLM call was cancelled');
            }

            if (llmCheckResult.includes('INCOMPLETE')) {
              const match = llmCheckResult.match(/INCOMPLETE:\s*(.+)/i);
              lastIssues = match ? [match[1]] : ['LLM检测到代码不完整'];
              isComplete = false;
              logger.warn(`${this.profile} ExecuteSubtask: LLM检测到代码不完整: ${lastIssues.join(', ')}`);
            } else if (llmCheckResult.includes('COMPLETE')) {
              isComplete = true;
              logger.info(`${this.profile} ExecuteSubtask: LLM确认代码完整`);
            } else {
              // 如果LLM检测结果不明确，使用本地检测结果
              isComplete = completenessCheck.isComplete && isStructurallyComplete;
              if (!isComplete) {
                lastIssues = allIssues;
              }
            }
          } catch (error: any) {
            logger.warn(`${this.profile} ExecuteSubtask: LLM完整性检测失败，使用本地检测结果`, error);
            isComplete = completenessCheck.isComplete && isStructurallyComplete;
            if (!isComplete) {
              lastIssues = allIssues;
            }
          }
        } else {
          isComplete = completenessCheck.isComplete && isStructurallyComplete;
          if (!isComplete) {
            lastIssues = allIssues;
          }
        }

        // 记录前后端完整性检查结果
        if (!isStructurallyComplete) {
          logger.warn(`${this.profile} ExecuteSubtask: 前后端代码结构不完整`, {
            taskId: task.id,
            frontendMissing: frontendBackendCheck.frontendMissing.length,
            backendMissing: frontendBackendCheck.backendMissing.length,
            configMissing: frontendBackendCheck.configMissing.length,
          });
        }

        // 如果代码不完整，进行多轮对话补充
        if (!isComplete) {
          logger.warn(`${this.profile} ExecuteSubtask: 代码不完整，准备进行多轮对话补充`, {
            taskId: task.id,
            attempt,
            issues: lastIssues,
            filesCount: accumulatedFiles.length,
            frontendMissing: frontendBackendCheck.frontendMissing.length,
            backendMissing: frontendBackendCheck.backendMissing.length,
          });

          // 构建代码补充提示词（多轮对话）
          currentTaskDescription = buildCodeCompletionPrompt(
            accumulatedFiles,
            lastIssues,
            '', // design (不再需要design，传入空字符串)
            prd,
            taskContent // taskBreakdown
          );

          // 如果检测到占位符问题，特别强调
          const hasPlaceholderIssues = lastIssues.some(issue =>
            issue.includes('占位符') ||
            issue.includes('...') ||
            issue.includes('不完整标记')
          );

          if (hasPlaceholderIssues && attempt > 5) {
            currentTaskDescription += `\n\n**🚨 严重警告：已尝试 ${attempt} 次，但仍有占位符问题！**\n`;
            currentTaskDescription += `你必须彻底修复所有占位符问题：\n`;
            currentTaskDescription += `1. 找到所有包含 "..." 的地方（包括注释中的 "// ..."）\n`;
            currentTaskDescription += `2. 将这些占位符替换为完整的代码实现\n`;
            currentTaskDescription += `3. 不要使用任何形式的占位符、省略号或未完成的代码\n`;
            currentTaskDescription += `4. 确保所有代码都是完整可运行的\n`;
            currentTaskDescription += `5. 如果某个地方需要省略，请直接删除该注释或代码，不要使用 "..." 占位符\n\n`;
          }

          // 如果后端代码缺失，在提示词中明确强调
          if (frontendBackendCheck.backendMissing.length > 0) {
            const backendMissingList = frontendBackendCheck.backendMissing.slice(0, 10).join(', ');
            currentTaskDescription += `\n\n**⚠️ 紧急：后端代码缺失！**\n`;
            currentTaskDescription += `检测到缺失 ${frontendBackendCheck.backendMissing.length} 个后端文件，包括：${backendMissingList}\n`;
            currentTaskDescription += `你必须立即生成所有缺失的后端代码文件！\n`;
          }

          // 如果前端代码缺失，在提示词中明确强调
          if (frontendBackendCheck.frontendMissing.length > 0) {
            const frontendMissingList = frontendBackendCheck.frontendMissing.slice(0, 10).join(', ');
            currentTaskDescription += `\n\n**⚠️ 紧急：前端代码缺失！**\n`;
            currentTaskDescription += `检测到缺失 ${frontendBackendCheck.frontendMissing.length} 个前端文件，包括：${frontendMissingList}\n`;
            currentTaskDescription += `你必须立即生成所有缺失的前端代码文件！\n`;
          }
        } else if (isComplete) {
          // 代码完整，更新最终结果
          accumulatedContent = accumulatedFiles.map(f =>
            `===== FILE: ${f.path} =====\n${f.content}\n===== END FILE =====`
          ).join('\n\n');
        }
      }

      // 如果最终仍然不完整，使用累积的代码
      if (!isComplete && accumulatedFiles.length > 0) {
        accumulatedContent = accumulatedFiles.map(f =>
          `===== FILE: ${f.path} =====\n${f.content}\n===== END FILE =====`
        ).join('\n\n');

        logger.warn(`${this.profile} ExecuteSubtask: 代码生成完成，但检测到不完整问题`, {
          taskId: task.id,
          attempts: attempt,
          issues: lastIssues,
          filesCount: accumulatedFiles.length,
        });
      } else if (isComplete) {
        logger.info(`${this.profile} ExecuteSubtask: 代码生成完成且通过完整性检测`, {
          taskId: task.id,
          attempts: attempt,
          filesCount: accumulatedFiles.length,
        });
      }

      // 如果有累积的代码内容，更新result
      if (accumulatedContent) {
        result = {
          ...result,
          content: `# 子任务执行完成\n\n任务ID: ${task.id}\n\n## Files Created:\n${accumulatedFiles.map(f => `- ${f.path}`).join('\n')}\n\n## Full Code:\n\n${accumulatedContent}`,
          data: {
            ...result.data,
            files: accumulatedFiles,
            filesCount: accumulatedFiles.length,
            completenessCheck: {
              isComplete,
              attempts: attempt,
              issues: lastIssues,
            },
          },
        };
      }

      // 如果最终仍然不完整，记录警告但返回结果
      if (!isComplete) {
        logger.warn(`${this.profile} ExecuteSubtask: 代码生成完成，但检测到不完整问题`, {
          taskId: task.id,
          attempts: attempt,
          issues: lastIssues,
        });
      } else {
        logger.info(`${this.profile} ExecuteSubtask: 代码生成完成且通过完整性检测`, {
          taskId: task.id,
          attempts: attempt,
        });
      }

      // 如果启用了自动编码，创建代码压缩包
      let zipPath: string | undefined;
      if (autoCodeEnabled && accumulatedFiles.length > 0 && workspaceOptions) {
        try {
          zipPath = await createCodeZip(accumulatedFiles, workspaceOptions);
          logger.info(`${this.profile} ExecuteSubtask: Code zip created`, { zipPath, taskId: task.id });
        } catch (error: any) {
          logger.error(`${this.profile} ExecuteSubtask: Failed to create code zip`, error);
        }
      }

      // 创建消息
      const message = new Message({
        content: result.content,
        role: this.profile,
        causeBy: action.constructor.name,
        sentFrom: this.name,
        instructContent: {
          ...result.data,
          completenessCheck: {
            isComplete,
            attempts: attempt,
            issues: lastIssues,
          },
          ...(zipPath && {
            zipPath: zipPath,
            autoCodeEnabled: true,
          }),
        },
      });

      logger.info(`${this.profile} completed subtask: ${task.id}`);

      // Clear current action
      this.rc.todo = null;

      return message;
    } catch (error: any) {
      logger.error(`${this.profile} subtask execution failed:`, error);
      this.rc.todo = null;
      throw error;
    }
  }

  /**
   * Build task description from subtask
   */
  private buildTaskDescription(task: any, taskBreakdownContent?: string): string {
    return buildTaskDescriptionPrompt(task, taskBreakdownContent);
  }

  /**
   * 从任务文件构建任务描述
   */
  private buildTaskDescriptionFromFile(task: any, taskContent: string, prd?: string): string {
    let description = `# 任务执行说明\n\n`;
    
    if (prd) {
      description += `## 产品需求文档（PRD）\n\n${prd}\n\n---\n\n`;
    }
    
    description += `## 任务详情\n\n${taskContent}\n\n`;
    
    description += `## 执行要求\n\n`;
    description += `1. 仔细阅读任务详情，理解任务的目标和要求\n`;
    description += `2. 根据任务类型（${task.type}）实现相应的代码\n`;
    description += `3. 确保代码符合验收标准\n`;
    description += `4. 生成完整、可运行的代码，不要使用占位符\n`;
    
    return description;
  }
}

export default Engineer;


