/**
 * Workflow Execution Controller
 * HTTP API for workflow execution management
 * Provides unified endpoints for workflow state management
 *
 * Default workflow configuration is loaded from database with fallback to migration config
 */

import { Request, Response } from 'express';
import * as path from 'path';
import * as fs from 'fs/promises';
import { WorkflowExecutionService, WorkflowRecoveryService, WorkflowState, WorkflowExecutor } from '../../workflow';
import { logger, WorkspaceManager } from '../../utils';
import { ProjectRepository } from '../../database/repositories/ProjectRepository';
import { MessageRepository } from '../../database/repositories/MessageRepository';
import { WorkflowService, getDefaultWorkflowConfig } from '../../services/WorkflowService';
import { WorkflowConfig } from '../../database/repositories/ApplicationWorkflowRepository';
import { CLIExecutor } from '../../executors/CLIExecutor';
import { Message } from '../../core/message/Message';

// Map to track running executors by projectId:versionId
const runningExecutors: Map<string, WorkflowExecutor> = new Map();
const cliLogStreams: Map<string, Set<Response>> = new Map();

/**
 * Get executor key from projectId and versionId
 */
function getExecutorKey(projectId: string, versionId: string): string {
  return `${projectId}:${versionId}`;
}

function getStreamKey(projectId: string, versionId: string): string {
  return `${projectId}:${versionId}`;
}

function pushCliLog(projectId: string, versionId: string, payload: { type: string; message: string; ts: string }) {
  const key = getStreamKey(projectId, versionId);
  const streams = cliLogStreams.get(key);
  if (!streams || streams.size === 0) return;
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  streams.forEach((res) => {
    res.write(data);
  });
}

function streamEventToText(event: {
  type?: string;
  message?: { content?: Array<{ text?: string }> };
  tool_call?: { writeToolCall?: { args: { path: string } }; readToolCall?: { args: { path: string } } };
  subtype?: string;
  model?: string;
}): string | null {
  if (event.type === 'assistant' && event.message?.content) {
    return event.message.content.map((c) => c.text || '').join('');
  }
  if (event.type === 'tool_call' && event.subtype === 'started') {
    if (event.tool_call?.writeToolCall) {
      return `🔧 写入: ${event.tool_call.writeToolCall.args.path}`;
    }
    if (event.tool_call?.readToolCall) {
      return `📖 读取: ${event.tool_call.readToolCall.args.path}`;
    }
  }
  if (event.type === 'tool_call' && event.subtype === 'completed') {
    return '✅ 工具调用完成';
  }
  if (event.type === 'system' && event.subtype === 'init' && event.model) {
    return `🤖 模型: ${event.model}`;
  }
  if (event.type === 'result') {
    return '✅ 执行完成';
  }
  return null;
}

export class WorkflowExecutionController {
  private static executionService = new WorkflowExecutionService();
  private static recoveryService = new WorkflowRecoveryService(WorkflowExecutionController.executionService);
  private static projectRepository = new ProjectRepository();
  private static workflowService = new WorkflowService();
  private static messageRepository = new MessageRepository();

  /**
   * Get workflow execution state
   * GET /api/workflow/:projectId/state
   * Query: versionId (required)
   */
  static async getState(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const { versionId } = req.query;

      if (!projectId) {
        return res.status(400).json({
          success: false,
          error: 'Project ID is required',
        });
      }

      if (!versionId || typeof versionId !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Version ID is required',
        });
      }

      const state = await WorkflowExecutionController.executionService.getCurrentState(projectId, versionId);

      if (!state) {
        return res.status(404).json({
          success: false,
          error: 'Workflow execution not found',
        });
      }

      return res.json({
        success: true,
        data: state,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('WorkflowExecutionController: Failed to get state', {
        error: errorMessage,
        projectId: req.params.projectId,
        versionId: req.query.versionId,
      });
      return res.status(500).json({
        success: false,
        error: 'Failed to get workflow state',
        message: errorMessage,
      });
    }
  }

  /**
   * Get workflow execution details (full record)
   * GET /api/workflow/:projectId/execution
   * Query: versionId (required)
   */
  static async getExecution(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const { versionId } = req.query;

      if (!projectId) {
        return res.status(400).json({
          success: false,
          error: 'Project ID is required',
        });
      }

      if (!versionId || typeof versionId !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Version ID is required',
        });
      }

      const execution = await WorkflowExecutionController.executionService.getExecution(projectId, versionId);

      if (!execution) {
        return res.status(404).json({
          success: false,
          error: 'Workflow execution not found',
        });
      }

      return res.json({
        success: true,
        data: execution,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('WorkflowExecutionController: Failed to get execution', {
        error: errorMessage,
        projectId: req.params.projectId,
        versionId: req.query.versionId,
      });
      return res.status(500).json({
        success: false,
        error: 'Failed to get workflow execution',
        message: errorMessage,
      });
    }
  }

  /**
   * Stream CLI logs (SSE)
   * GET /api/workflow/:projectId/cli-logs/stream?versionId=...
   */
  static async cliLogStream(req: Request, res: Response) {
    const { projectId } = req.params;
    const { versionId } = req.query;

    if (!projectId || !versionId || typeof versionId !== 'string') {
      return res.status(400).json({ success: false, error: 'Project ID and versionId are required' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const key = getStreamKey(projectId, versionId);
    if (!cliLogStreams.has(key)) {
      cliLogStreams.set(key, new Set());
    }
    cliLogStreams.get(key)!.add(res);

    const heartbeat = setInterval(() => {
      res.write(':\n\n');
    }, 15000);

    req.on('close', () => {
      clearInterval(heartbeat);
      const set = cliLogStreams.get(key);
      if (set) {
        set.delete(res);
        if (set.size === 0) {
          cliLogStreams.delete(key);
        }
      }
    });
  }

  /**
   * Start workflow execution
   * POST /api/workflow/:projectId/start
   * Body: { versionId: string, currentPosition?: { roleIndex: number, actionIndex: number } }
   * Automatically initializes workflow if not exists
   */
  static async start(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const { versionId, currentPosition } = req.body;

      if (!projectId) {
        return res.status(400).json({
          success: false,
          error: 'Project ID is required',
        });
      }

      if (!versionId) {
        return res.status(400).json({
          success: false,
          error: 'Version ID is required',
        });
      }

      // Stop any running executor first (important for reset + start flow)
      WorkflowExecutionController._stopBackgroundExecution(projectId, versionId);

      // Check if execution exists, if not, auto-initialize
      let execution = await WorkflowExecutionController.executionService.getExecution(projectId, versionId);

      if (!execution) {
        logger.info('WorkflowExecutionController: No execution found, auto-initializing', { projectId, versionId });

        // Get project to find application_id
        const project = await WorkflowExecutionController.projectRepository.findById(projectId);
        if (!project) {
          return res.status(404).json({
            success: false,
            error: 'Project not found',
          });
        }

        // Get workflow config from application or use default
        let workflowConfig: WorkflowConfig = getDefaultWorkflowConfig();

        if (project.application_id) {
          try {
            const appWorkflow = await WorkflowExecutionController.workflowService.getOrCreateDefaultWorkflow(project.application_id);
            if (appWorkflow && appWorkflow.workflow_config) {
              workflowConfig = appWorkflow.workflow_config;
              logger.info('WorkflowExecutionController: Using application workflow config', {
                projectId,
                versionId,
                applicationId: project.application_id,
                workflowId: appWorkflow.id,
              });
            }
          } catch (workflowError: unknown) {
            const errorMessage = workflowError instanceof Error ? workflowError.message : String(workflowError);
            logger.warn('WorkflowExecutionController: Failed to get application workflow, using default', {
              projectId,
              versionId,
              applicationId: project.application_id,
              error: errorMessage,
            });
          }
        }

        // Initialize execution
        execution = await WorkflowExecutionController.executionService.initialize(projectId, versionId, workflowConfig);
        logger.info('WorkflowExecutionController: Workflow initialized', {
          projectId,
          versionId,
          executionId: execution.id,
        });
      }

      // Now start the workflow (state transition), optionally from a specific position
      execution = await WorkflowExecutionController.executionService.start(projectId, versionId, currentPosition);

      logger.info('WorkflowExecutionController: Workflow started', {
        projectId,
        versionId,
        currentPosition: execution.currentPosition,
      });

      // Start execution in background (non-blocking)
      WorkflowExecutionController.startBackgroundExecution(projectId, versionId);

      return res.json({
        success: true,
        data: {
          id: execution.id,
          state: execution.state,
          currentPosition: execution.currentPosition,
          message: 'Workflow started',
        },
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('WorkflowExecutionController: Failed to start workflow', {
        error: errorMessage,
        projectId: req.params.projectId,
        versionId: req.body.versionId,
      });

      const statusCode = errorMessage.includes('Cannot start') ? 400 : 500;
      return res.status(statusCode).json({
        success: false,
        error: 'Failed to start workflow',
        message: errorMessage,
      });
    }
  }

  /**
   * Confirm and proceed to next step
   * POST /api/workflow/:projectId/confirm
   * Body: { versionId: string }
   */
  static async confirm(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const { versionId } = req.body;

      if (!projectId) {
        return res.status(400).json({
          success: false,
          error: 'Project ID is required',
        });
      }

      if (!versionId) {
        return res.status(400).json({
          success: false,
          error: 'Version ID is required',
        });
      }

      // Get execution before confirm to preserve pendingConfirmation info
      // (confirm() will clear pendingConfirmation)
      const execBeforeConfirm = await WorkflowExecutionController.executionService.getExecution(projectId, versionId);
      const confirmedRole = execBeforeConfirm?.pendingConfirmation?.role;
      const confirmedAction = execBeforeConfirm?.pendingConfirmation?.action;

      // Confirm the workflow
      const execution = await WorkflowExecutionController.executionService.confirm(projectId, versionId);

      // If a role was confirmed, trigger role completion handlers (e.g., git commit)
      if (confirmedRole && confirmedAction) {
        const executor = new WorkflowExecutor();
        try {
          await executor.onRoleConfirmed(projectId, versionId, confirmedRole, confirmedAction);
        } catch (error: unknown) {
          // Git commit failure shouldn't prevent confirmation process
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error('WorkflowExecutionController: Role confirmation handler failed', {
            projectId,
            versionId,
            role: confirmedRole,
            action: confirmedAction,
            error: errorMessage,
          });
        }
      }

      // Continue execution in background after confirmation
      WorkflowExecutionController.startBackgroundExecution(projectId, versionId);

      return res.json({
        success: true,
        data: {
          id: execution.id,
          state: execution.state,
          currentPosition: execution.currentPosition,
          message: 'Confirmation received, workflow continuing',
        },
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('WorkflowExecutionController: Failed to confirm', {
        error: errorMessage,
        projectId: req.params.projectId,
        versionId: req.body.versionId,
      });

      const statusCode = errorMessage.includes('not waiting') ? 400 : 500;
      return res.status(statusCode).json({
        success: false,
        error: 'Failed to confirm workflow',
        message: errorMessage,
      });
    }
  }

  /**
   * CLI edit pending confirmation content
   * POST /api/workflow/:projectId/pending-confirmation/cli-edit
   * Body: { versionId: string, message: string }
   */
  static async cliEditPendingConfirmation(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const { versionId, message, scope } = req.body;

      if (!projectId) {
        return res.status(400).json({ success: false, error: 'Project ID is required' });
      }
      if (!versionId || typeof versionId !== 'string') {
        return res.status(400).json({ success: false, error: 'Version ID is required' });
      }
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ success: false, error: 'Message is required' });
      }

      const execution = await WorkflowExecutionController.executionService.getExecution(projectId, versionId);
      if (!execution) {
        return res.status(404).json({ success: false, error: 'Workflow execution not found' });
      }

      const editScope: 'pending' | 'last_completed' = scope === 'last_completed' ? 'last_completed' : 'pending';

      let role: string | undefined;
      let action: string | undefined;

      if (editScope === 'pending') {
        if (execution.state !== WorkflowState.WAITING_CONFIRMATION || !execution.pendingConfirmation) {
          return res.status(400).json({
            success: false,
            error: 'Workflow is not waiting for confirmation',
          });
        }
        role = execution.pendingConfirmation.role;
        action = execution.pendingConfirmation.action;
      } else {
        const lastCompleted = WorkflowExecutionController._getLastCompletedStep(execution);
        if (!lastCompleted) {
          return res.status(400).json({
            success: false,
            error: '未找到已完成的步骤，无法修改',
          });
        }
        role = lastCompleted.role;
        action = lastCompleted.action;
      }

      const project = await WorkflowExecutionController.projectRepository.findById(projectId);
      if (!project) {
        return res.status(404).json({ success: false, error: 'Project not found' });
      }

      const applicationId = project.application_id || project.id;
      const workspaceDir = WorkspaceManager.getProjectWorkspacePath({
        applicationId,
        projectId,
        versionId,
      });
      const targetFiles = await WorkflowExecutionController._getTargetFilesForRole(execution, role, workspaceDir);
      if (targetFiles.length === 0) {
        return res.status(400).json({
          success: false,
          error: `当前角色无可通过 CLI 修改的产物: ${role}`,
        });
      }
      const targetFilePaths = targetFiles.map((file) => path.join(workspaceDir, file.relativePath));
      const prompt = [
        '你需要根据用户要求修改以下文件内容：',
        ...targetFilePaths,
        `修改要求：${message}`,
        '要求：只修改以上文件，保持其它内容不变。',
      ].join('\n');

      pushCliLog(projectId, versionId, { type: 'input', message, ts: new Date().toISOString() });

      const executor = new CLIExecutor();
      const cliOutput = await executor.execute(prompt, {
        workDir: workspaceDir,
        enableStreamProgress: true,
        onProgress: (event) => {
          const text = streamEventToText(event);
          if (text) {
            pushCliLog(projectId, versionId, { type: 'output', message: text, ts: new Date().toISOString() });
          }
        },
      });
      if (cliOutput) {
        pushCliLog(projectId, versionId, {
          type: 'output',
          message: cliOutput.substring(0, 500),
          ts: new Date().toISOString(),
        });
      }
      logger.info('WorkflowExecutionController: CLI execution output', {
        projectId,
        versionId,
        outputPreview: cliOutput.substring(0, 500),
      });

      const updatedFiles: Array<{ action: string; content: string; path: string }> = [];
      for (const file of targetFiles) {
        const filePath = path.join(workspaceDir, file.relativePath);
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          updatedFiles.push({ action: file.action, content, path: filePath });
        } catch (readError: unknown) {
          const errorMessage = readError instanceof Error ? readError.message : String(readError);
          logger.warn('WorkflowExecutionController: Failed to read updated file', {
            projectId,
            versionId,
            filePath,
            error: errorMessage,
          });
        }
      }

      const currentActionFile = updatedFiles.find((file) => file.action === action);
      const displayContent = currentActionFile?.content || updatedFiles[0]?.content || '';

      if (displayContent && editScope === 'pending') {
        await WorkflowExecutionController.executionService.updatePendingConfirmationContent(projectId, versionId, displayContent);
      }

      for (const file of updatedFiles) {
        const msg = new Message({
          content: file.content,
          role: role || 'assistant',
          causeBy: file.action,
          sentFrom: role || 'assistant',
        });
        await WorkflowExecutionController.messageRepository.save(projectId, msg, role || undefined, versionId);
      }

      pushCliLog(projectId, versionId, { type: 'status', message: 'done', ts: new Date().toISOString() });

      return res.json({
        success: true,
        data: {
          content: displayContent,
          updatedFiles: updatedFiles.map((file) => ({
            action: file.action,
            path: file.path,
          })),
          cliOutput,
        },
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      pushCliLog(req.params.projectId, req.body?.versionId, {
        type: 'error',
        message: errorMessage || 'CLI error',
        ts: new Date().toISOString(),
      });
      logger.error('WorkflowExecutionController: CLI edit failed', {
        error: errorMessage,
        projectId: req.params.projectId,
        versionId: req.body?.versionId,
      });
      return res.status(500).json({
        success: false,
        error: 'Failed to edit pending confirmation via CLI',
        message: errorMessage,
      });
    }
  }

  /**
   * Map action to target file path
   */
  private static _getTargetFilePath(action: string): string | null {
    const map: Record<string, string> = {
      WriteMRD: path.join('docs', 'mrd', 'MRD.md'),
      MRDReview: path.join('docs', 'mrd', 'MRD_REVIEW.md'),
      ImproveMRD: path.join('docs', 'mrd', 'MRD.md'),
      WritePRD: path.join('docs', 'prd', 'PRD.md'),
      PRDReview: path.join('docs', 'prd', 'PRD_REVIEW.md'),
      ImprovePRD: path.join('docs', 'prd', 'PRD.md'),
      GeneratePrototype: path.join('docs', 'prototype', 'index.html'),
      WriteDesign: path.join('docs', 'design', 'DESIGN.md'),
      DesignReview: path.join('docs', 'design', 'DESIGN_REVIEW.md'),
      ImproveDesign: path.join('docs', 'design', 'DESIGN.md'),
      WriteTestPlan: path.join('docs', 'test', 'TEST_PLAN.md'),
      WriteTest: path.join('docs', 'test', 'TEST.md'),
      TestReview: path.join('docs', 'test', 'TEST_REVIEW.md'),
      ImproveTest: path.join('docs', 'test', 'TEST.md'),
    };
    return map[action] || null;
  }

  private static async _getTargetFilesForRole(
    execution: { workflowSnapshot?: { roles?: Array<{ profile: string; actions: string[] }> } },
    role: string | undefined,
    workspaceDir: string
  ): Promise<Array<{ action: string; relativePath: string }>> {
    if (!role || !execution.workflowSnapshot?.roles) {
      return [];
    }
    const roleConfig = execution.workflowSnapshot.roles.find((r) => r.profile === role);
    if (!roleConfig || !roleConfig.actions) {
      return [];
    }
    const files: Array<{ action: string; relativePath: string }> = [];
    for (const actionName of roleConfig.actions) {
      const actionFiles = await WorkflowExecutionController._getTargetFilesForAction(actionName, workspaceDir);
      for (const relativePath of actionFiles) {
        files.push({ action: actionName, relativePath });
      }
    }
    return files;
  }

  private static async _getTargetFilesForAction(action: string, workspaceDir: string): Promise<string[]> {
    const directPath = WorkflowExecutionController._getTargetFilePath(action);
    if (directPath) {
      const existing = await WorkflowExecutionController._filterExistingFiles(workspaceDir, [directPath]);
      return existing;
    }
    if (action === 'FillProjectContext') {
      return WorkflowExecutionController._filterExistingFiles(workspaceDir, [path.join('openspec', 'project.md')]);
    }
    if (action === 'CreateOpenSpecProposal' || action === 'ValidateOpenSpecProposal') {
      const changeDir = await WorkflowExecutionController._findLatestChangeDir(workspaceDir);
      if (!changeDir) {
        return [];
      }
      const baseFiles = [path.join(changeDir, 'proposal.md'), path.join(changeDir, 'tasks.md'), path.join(changeDir, 'design.md')];
      const existingBaseFiles = await WorkflowExecutionController._filterExistingFiles(workspaceDir, baseFiles);
      const specsDirAbs = path.join(workspaceDir, changeDir, 'specs');
      const specsDirRel = path.join(changeDir, 'specs');
      const specFiles = await WorkflowExecutionController._collectSpecFiles(specsDirAbs, specsDirRel);
      return [...existingBaseFiles, ...specFiles];
    }
    if (action === 'EstimateStoryPoints' || action === 'ValidateStoryPointEstimates') {
      const tasksFile = await WorkflowExecutionController._findLatestTasksFile(workspaceDir);
      if (!tasksFile) {
        return [];
      }
      const estimatesFile = tasksFile.replace('tasks.md', 'tasks-with-estimates.md');
      const existing = await WorkflowExecutionController._filterExistingFiles(workspaceDir, [estimatesFile]);
      if (existing.length > 0) {
        return existing;
      }
      return WorkflowExecutionController._filterExistingFiles(workspaceDir, [tasksFile]);
    }
    return [];
  }

  private static async _filterExistingFiles(workspaceDir: string, relativePaths: string[]): Promise<string[]> {
    const results: string[] = [];
    for (const relPath of relativePaths) {
      try {
        await fs.access(path.join(workspaceDir, relPath));
        results.push(relPath);
      } catch {
        continue;
      }
    }
    return results;
  }

  private static async _findLatestChangeDir(workspaceDir: string): Promise<string | null> {
    const changesDir = path.join(workspaceDir, 'openspec', 'changes');
    try {
      const entries = await fs.readdir(changesDir, { withFileTypes: true });
      const dirs = entries.filter((entry) => entry.isDirectory());
      if (dirs.length === 0) {
        return null;
      }
      const dirsWithMtime: Array<{ name: string; mtime: number }> = [];
      for (const dir of dirs) {
        try {
          const stats = await fs.stat(path.join(changesDir, dir.name));
          dirsWithMtime.push({ name: dir.name, mtime: stats.mtime.getTime() });
        } catch {
          continue;
        }
      }
      if (dirsWithMtime.length === 0) {
        return null;
      }
      dirsWithMtime.sort((a, b) => b.mtime - a.mtime);
      return path.join('openspec', 'changes', dirsWithMtime[0].name);
    } catch {
      return null;
    }
  }

  private static async _findLatestTasksFile(workspaceDir: string): Promise<string | null> {
    const changesDir = path.join(workspaceDir, 'openspec', 'changes');
    try {
      const entries = await fs.readdir(changesDir, { withFileTypes: true });
      const dirs = entries.filter((entry) => entry.isDirectory());
      if (dirs.length === 0) {
        return null;
      }
      const tasksFiles: Array<{ path: string; mtime: number }> = [];
      for (const dir of dirs) {
        const relPath = path.join('openspec', 'changes', dir.name, 'tasks.md');
        const fullPath = path.join(workspaceDir, relPath);
        try {
          const stats = await fs.stat(fullPath);
          if (stats.isFile()) {
            tasksFiles.push({ path: relPath, mtime: stats.mtime.getTime() });
          }
        } catch {
          continue;
        }
      }
      if (tasksFiles.length === 0) {
        return null;
      }
      tasksFiles.sort((a, b) => b.mtime - a.mtime);
      return tasksFiles[0].path;
    } catch {
      return null;
    }
  }

  private static async _collectSpecFiles(dirAbs: string, dirRel: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(dirAbs, { withFileTypes: true });
      const files: string[] = [];
      for (const entry of entries) {
        const absPath = path.join(dirAbs, entry.name);
        const relPath = path.join(dirRel, entry.name);
        if (entry.isDirectory()) {
          const nested = await WorkflowExecutionController._collectSpecFiles(absPath, relPath);
          files.push(...nested);
          continue;
        }
        if (entry.isFile() && entry.name === 'spec.md') {
          files.push(relPath);
        }
      }
      return files;
    } catch {
      return [];
    }
  }

  private static _getLastCompletedStep(execution: {
    steps?: Array<{ role: string; action: string; state: string; completedAt?: string }>;
  }): { role: string; action: string } | null {
    if (!execution.steps || execution.steps.length === 0) {
      return null;
    }
    const completed = execution.steps.filter((step) => step.state === 'completed');
    if (completed.length === 0) return null;
    completed.sort((a, b) => {
      const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0;
      const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0;
      return bTime - aTime;
    });
    return { role: completed[0].role, action: completed[0].action };
  }

  /**
   * Reset workflow to a specific role
   * POST /api/workflow/:projectId/reset
   * Body: { versionId: string, targetRole: string }
   */
  static async reset(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const { versionId, targetRole } = req.body;

      if (!projectId) {
        return res.status(400).json({
          success: false,
          error: 'Project ID is required',
        });
      }

      if (!versionId) {
        return res.status(400).json({
          success: false,
          error: 'Version ID is required',
        });
      }

      if (!targetRole) {
        return res.status(400).json({
          success: false,
          error: 'Target role is required',
        });
      }

      // Stop any running executor first to prevent it from continuing
      WorkflowExecutionController._stopBackgroundExecution(projectId, versionId);

      const execution = await WorkflowExecutionController.executionService.reset(projectId, versionId, targetRole);

      return res.json({
        success: true,
        data: {
          id: execution.id,
          state: execution.state,
          currentPosition: execution.currentPosition,
          message: `Workflow reset to role: ${targetRole}`,
        },
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('WorkflowExecutionController: Failed to reset workflow', {
        error: errorMessage,
        projectId: req.params.projectId,
        versionId: req.body.versionId,
        targetRole: req.body.targetRole,
      });

      const statusCode = errorMessage.includes('not found') ? 404 : 500;
      return res.status(statusCode).json({
        success: false,
        error: 'Failed to reset workflow',
        message: errorMessage,
      });
    }
  }

  /**
   * Pause workflow execution
   * POST /api/workflow/:projectId/pause
   * Body: { versionId: string }
   */
  static async pause(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const { versionId } = req.body;

      if (!projectId) {
        return res.status(400).json({
          success: false,
          error: 'Project ID is required',
        });
      }

      if (!versionId) {
        return res.status(400).json({
          success: false,
          error: 'Version ID is required',
        });
      }

      const execution = await WorkflowExecutionController.executionService.pause(projectId, versionId);

      return res.json({
        success: true,
        data: {
          id: execution.id,
          state: execution.state,
          message: 'Workflow paused',
        },
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('WorkflowExecutionController: Failed to pause workflow', {
        error: errorMessage,
        projectId: req.params.projectId,
        versionId: req.body.versionId,
      });

      const statusCode = errorMessage.includes('Cannot pause') ? 400 : 500;
      return res.status(statusCode).json({
        success: false,
        error: 'Failed to pause workflow',
        message: errorMessage,
      });
    }
  }

  /**
   * Resume workflow execution
   * POST /api/workflow/:projectId/resume
   * Body: { versionId: string }
   */
  static async resume(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const { versionId } = req.body;

      if (!projectId) {
        return res.status(400).json({
          success: false,
          error: 'Project ID is required',
        });
      }

      if (!versionId) {
        return res.status(400).json({
          success: false,
          error: 'Version ID is required',
        });
      }

      const execution = await WorkflowExecutionController.executionService.resume(projectId, versionId);

      return res.json({
        success: true,
        data: {
          id: execution.id,
          state: execution.state,
          currentPosition: execution.currentPosition,
          message: 'Workflow resumed',
        },
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('WorkflowExecutionController: Failed to resume workflow', {
        error: errorMessage,
        projectId: req.params.projectId,
        versionId: req.body.versionId,
      });

      const statusCode = errorMessage.includes('not paused') ? 400 : 500;
      return res.status(statusCode).json({
        success: false,
        error: 'Failed to resume workflow',
        message: errorMessage,
      });
    }
  }

  /**
   * Retry failed workflow
   * POST /api/workflow/:projectId/retry
   * Body: { versionId: string }
   */
  static async retry(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const { versionId } = req.body;

      if (!projectId) {
        return res.status(400).json({
          success: false,
          error: 'Project ID is required',
        });
      }

      if (!versionId) {
        return res.status(400).json({
          success: false,
          error: 'Version ID is required',
        });
      }

      const execution = await WorkflowExecutionController.executionService.retry(projectId, versionId);

      return res.json({
        success: true,
        data: {
          id: execution.id,
          state: execution.state,
          currentPosition: execution.currentPosition,
          message: 'Workflow retry initiated',
        },
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('WorkflowExecutionController: Failed to retry workflow', {
        error: errorMessage,
        projectId: req.params.projectId,
        versionId: req.body.versionId,
      });

      const statusCode = errorMessage.includes('not failed') ? 400 : 500;
      return res.status(statusCode).json({
        success: false,
        error: 'Failed to retry workflow',
        message: errorMessage,
      });
    }
  }

  /**
   * Recover workflow (for page refresh, service restart, etc.)
   * POST /api/workflow/:projectId/recover
   * Body: { versionId: string }
   */
  static async recover(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const { versionId } = req.body;

      if (!projectId) {
        return res.status(400).json({
          success: false,
          error: 'Project ID is required',
        });
      }

      if (!versionId) {
        return res.status(400).json({
          success: false,
          error: 'Version ID is required',
        });
      }

      const result = await WorkflowExecutionController.recoveryService.recover(projectId, versionId);

      return res.json({
        success: true,
        data: result,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('WorkflowExecutionController: Failed to recover workflow', {
        error: errorMessage,
        projectId: req.params.projectId,
        versionId: req.body.versionId,
      });

      return res.status(500).json({
        success: false,
        error: 'Failed to recover workflow',
        message: errorMessage,
      });
    }
  }

  /**
   * Get recovery status (check if recovery is needed)
   * GET /api/workflow/:projectId/recovery-status
   * Query: versionId (required)
   */
  static async getRecoveryStatus(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const { versionId } = req.query;

      if (!projectId) {
        return res.status(400).json({
          success: false,
          error: 'Project ID is required',
        });
      }

      if (!versionId || typeof versionId !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Version ID is required',
        });
      }

      const status = await WorkflowExecutionController.recoveryService.getRecoveryStatus(projectId, versionId);

      return res.json({
        success: true,
        data: status,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('WorkflowExecutionController: Failed to get recovery status', {
        error: errorMessage,
        projectId: req.params.projectId,
        versionId: req.query.versionId,
      });

      return res.status(500).json({
        success: false,
        error: 'Failed to get recovery status',
        message: errorMessage,
      });
    }
  }

  /**
   * Delete workflow execution
   * DELETE /api/workflow/:projectId
   * Query: versionId (required)
   */
  static async delete(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const { versionId } = req.query;

      if (!projectId) {
        return res.status(400).json({
          success: false,
          error: 'Project ID is required',
        });
      }

      if (!versionId || typeof versionId !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Version ID is required',
        });
      }

      const deleted = await WorkflowExecutionController.executionService.delete(projectId, versionId);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: 'Workflow execution not found',
        });
      }

      return res.json({
        success: true,
        message: 'Workflow execution deleted',
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('WorkflowExecutionController: Failed to delete workflow', {
        error: errorMessage,
        projectId: req.params.projectId,
        versionId: req.query.versionId,
      });

      return res.status(500).json({
        success: false,
        error: 'Failed to delete workflow execution',
        message: errorMessage,
      });
    }
  }

  /**
   * Get all active workflows (for admin/monitoring)
   * GET /api/workflow/active
   */
  static async getActiveWorkflows(_req: Request, res: Response) {
    try {
      const activeStates = [WorkflowState.RUNNING, WorkflowState.WAITING_CONFIRMATION, WorkflowState.PAUSED];

      const executions = await WorkflowExecutionController.executionService.findByStates(activeStates);

      return res.json({
        success: true,
        data: executions.map((exec) => ({
          id: exec.id,
          projectId: exec.projectId,
          state: exec.state,
          currentPosition: exec.currentPosition,
          progress: (exec.steps.filter((s) => s.state === 'completed').length / exec.steps.length) * 100,
          updatedAt: exec.updatedAt,
        })),
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('WorkflowExecutionController: Failed to get active workflows', {
        error: errorMessage,
      });

      return res.status(500).json({
        success: false,
        error: 'Failed to get active workflows',
        message: errorMessage,
      });
    }
  }

  /**
   * Start background execution for a workflow
   * This runs asynchronously and doesn't block the API response
   */
  private static startBackgroundExecution(projectId: string, versionId: string): void {
    const key = getExecutorKey(projectId, versionId);

    // Check if already executing
    if (runningExecutors.has(key)) {
      logger.info('WorkflowExecutionController: Executor already running', { projectId, versionId });
      return;
    }

    // Create new executor
    const executor = new WorkflowExecutor();
    runningExecutors.set(key, executor);

    // Start execution in background
    executor
      .execute(projectId, versionId)
      .then(() => {
        logger.info('WorkflowExecutionController: Background execution completed', { projectId, versionId });
      })
      .catch((error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('WorkflowExecutionController: Background execution failed', {
          projectId,
          versionId,
          error: errorMessage,
        });
      })
      .finally(() => {
        // Clean up executor reference
        runningExecutors.delete(key);
      });
  }

  /**
   * Stop background execution for a workflow (used when pausing/resetting)
   * Note: Prefixed with underscore as it's available for future use
   */
  static _stopBackgroundExecution(projectId: string, versionId: string): void {
    const key = getExecutorKey(projectId, versionId);
    const executor = runningExecutors.get(key);
    if (executor) {
      executor.stop();
      runningExecutors.delete(key);
      logger.info('WorkflowExecutionController: Background execution stopped', { projectId, versionId });
    }
  }
}
