/**
 * Engineer Role
 * Implements code based on design documents and executes subtasks
 */

import { IRoleConfig, ACTION_WRITE_DESIGN, ACTION_WRITE_PRD, ACTION_BREAKDOWN_TASKS } from '@mind2build/shared';
import { Role } from './Role';
import { Context } from '../core/context/Context';
import { WriteCode } from '../actions/WriteCode';
import { ExecuteSubtask } from '../actions/ExecuteSubtask';
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

    // Set actions - WriteCode and ExecuteSubtask
    this.setActions([new WriteCode(), new ExecuteSubtask()]);
  }

  /**
   * Override act to handle subtask execution based on ProductManager and Architect outputs
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
      const applicationId = workspaceOptions?.applicationId || 'default';
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
          // 有任务需要执行，切换到ExecuteSubtask
          const executeSubtaskAction = this.actions.find(a => a.name === 'ExecuteSubtask');
          if (executeSubtaskAction) {
            logger.info(`${this.profile} WriteCode: Found ${pendingTasks.length} pending tasks, switching to ExecuteSubtask`);
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
            const checkPrompt = buildCodeCompletenessCheckPrompt(accumulatedFiles, design);
            const userId = this.context.get('userId');
            const systemPrompt = await loadPrompt(userId, 'code', 'completeness_check_system_prompt', CODE_COMPLETENESS_CHECK_SYSTEM_PROMPT);
            const llmCheckResult = await this.context.llm.aask(checkPrompt, [systemPrompt]);

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
        logger.warn(`${this.profile} ExecuteSubtask: Missing workspace options, falling back to WriteCode`);
        // 如果没有workspace选项，使用WriteCode
        const writeCodeAction = this.actions.find(a => a.name === 'WriteCode');
        if (writeCodeAction) {
          this.rc.todo = writeCodeAction;
          return await super.act();
        }
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
        logger.warn(`${this.profile} ExecuteSubtask: Failed to load task breakdown, falling back to WriteCode`);
        const writeCodeAction = this.actions.find(a => a.name === 'WriteCode');
        if (writeCodeAction) {
          this.rc.todo = writeCodeAction;
          return await super.act();
        }
        return null;
      }

      // 获取待执行的任务
      const pendingTasks = subtaskManager.getPendingTasks();
      if (pendingTasks.length === 0) {
        logger.info(`${this.profile} ExecuteSubtask: No pending tasks, all tasks completed`);
        // 所有任务已完成，使用WriteCode处理设计文档
        const writeCodeAction = this.actions.find(a => a.name === 'WriteCode');
        if (writeCodeAction) {
          this.rc.todo = writeCodeAction;
          return await super.act();
        }
        return null;
      }

      // 执行第一个待执行的任务
      const task = pendingTasks[0];
      logger.info(`${this.profile} ExecuteSubtask: Executing task ${task.id}: ${task.name}`);

      // 标记任务为进行中
      subtaskManager.markTaskInProgress(task.id);

      // 必须从workspace读取标准文档：PRD、DESIGN、TASKS
      const { WorkspaceManager } = await import('../utils/WorkspaceManager');

      // 从workspace读取PRD文档
      const prdFromWorkspace = await WorkspaceManager.readAllFromWorkspace({
        applicationId: workspaceOptions.applicationId,
        version: workspaceOptions.version,
        documentType: 'PRD',
        workspacePath: workspaceOptions.workspacePath,
      });

      // 从workspace读取DESIGN文档
      const designFromWorkspace = await WorkspaceManager.readAllFromWorkspace({
        applicationId: workspaceOptions.applicationId,
        version: workspaceOptions.version,
        documentType: 'DESIGN',
        workspacePath: workspaceOptions.workspacePath,
      });

      // 从workspace读取TASKS文档（完整内容）
      const taskBreakdownFromWorkspace = await WorkspaceManager.readAllFromWorkspace({
        applicationId: workspaceOptions.applicationId,
        version: workspaceOptions.version,
        documentType: 'TASKS',
        workspacePath: workspaceOptions.workspacePath,
      });

      // 优先使用workspace中的文档，如果没有则使用memory中的文档
      const prdMessages = this.rc.memory.getByAction('WritePRD');
      const prd = prdFromWorkspace || (prdMessages.length > 0 ? prdMessages[prdMessages.length - 1].content : '');

      const designMessages = this.rc.memory.getByAction('WriteDesign');
      const design = designFromWorkspace || (designMessages.length > 0 ? designMessages[designMessages.length - 1].content : '');

      // 任务拆分文档优先使用workspace中的完整内容
      const breakdownMessages = this.rc.memory.getByAction('BreakdownTasks');
      const taskBreakdownContent = taskBreakdownFromWorkspace || (breakdownMessages.length > 0 ? breakdownMessages[breakdownMessages.length - 1].content : '');

      // 验证必需文档：DESIGN是必需的
      if (!design) {
        logger.warn(`${this.profile} ExecuteSubtask: No Design document found in workspace or memory, Design is required for code generation`);
        // 回退到WriteCode
        const writeCodeAction = this.actions.find(a => a.name === 'WriteCode');
        if (writeCodeAction) {
          this.rc.todo = writeCodeAction;
          return await super.act();
        }
        return null;
      }

      // 记录从workspace读取的文档状态
      logger.info(`${this.profile} ExecuteSubtask: Loaded documents from workspace`, {
        applicationId: workspaceOptions.applicationId,
        version: workspaceOptions.version,
        taskId: task.id,
        hasPRD: !!prd,
        hasDesign: !!design,
        hasTaskBreakdown: !!taskBreakdownContent,
        prdFromWorkspace: !!prdFromWorkspace,
        designFromWorkspace: !!designFromWorkspace,
        taskBreakdownFromWorkspace: !!taskBreakdownFromWorkspace,
      });

      // 构建任务描述，强调任务来自 TASK_BREAKDOWN.md
      const taskDescription = this.buildTaskDescription(task, taskBreakdownContent);

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

        // 执行任务，传入PRD、Design和任务拆分文档信息
        result = await (action as any).run(currentTaskDescription, {
          ...workspaceOptions,
          taskId: task.id,
          taskDescription: currentTaskDescription,
          prd: prd,
          design: design,
          taskBreakdown: taskBreakdownContent,
        });

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

        // 检测前后端代码完整性
        const frontendBackendCheck = checkFrontendBackendCompleteness(accumulatedFiles, design);

        // 合并所有问题
        const allIssues = [...completenessCheck.issues, ...frontendBackendCheck.issues];
        const isStructurallyComplete = frontendBackendCheck.isComplete;

        // 如果使用LLM进行更详细的检测
        if (completenessCheck.isComplete && isStructurallyComplete && this.context.llm) {
          try {
            const checkPrompt = buildCodeCompletenessCheckPrompt(accumulatedFiles, design);
            const userId = this.context.get('userId');
            const systemPrompt = await loadPrompt(userId, 'code', 'completeness_check_system_prompt', CODE_COMPLETENESS_CHECK_SYSTEM_PROMPT);
            const llmCheckResult = await this.context.llm.aask(checkPrompt, [systemPrompt]);

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
            design,
            prd,
            taskBreakdownContent
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
}

export default Engineer;


