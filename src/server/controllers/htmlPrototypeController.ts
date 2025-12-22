/**
 * HTML原型生成控制器
 * 使用Cursor Cloud Agent API生成HTML原型
 */

import { Request, Response } from 'express';
import { cursorApiClient } from '../../adapters/cursor/cursorApiClient.js';
import { createLogger } from '../../utils/logger.js';
import { prdService } from '../../db/services/prdService.js';
import { directGeneratedPrdService } from '../../db/services/directGeneratedPrdService.js';

const logger = createLogger('HtmlPrototypeController');

// 存储生成任务的内存缓存（生产环境应该使用数据库）
const generationTasks = new Map<string, any>();

/**
 * 生成HTML原型
 * POST /api/v1/html-prototype/generate
 */
export async function generateHtmlPrototype(req: Request, res: Response): Promise<void> {
  const startTime = Date.now();
  logger.start('generateHtmlPrototype', {
    prdId: req.body.prdId,
    repository: req.body.repository,
  });

  try {
    const { prdId, prdContent, repository, autoCreatePr } = req.body;

    if (!prdId || !prdContent) {
      logger.warn('Invalid request: prdId or prdContent is missing');
      res.status(400).json({
        success: false,
        error: 'prdId 和 prdContent 不能为空',
      });
      return;
    }

    // 验证仓库URL
    if (!repository) {
      logger.warn('No repository provided');
      res.status(400).json({
        success: false,
        error: '请提供有效的GitHub仓库URL。例如：https://github.com/your-username/your-repo',
      });
      return;
    }

    const targetRepository = repository;

    // 验证GitHub仓库URL格式
    const githubRepoPattern = /^https:\/\/github\.com\/[\w-]+\/[\w-]+$/;
    if (!githubRepoPattern.test(targetRepository)) {
      logger.warn('Invalid repository URL format', { repository: targetRepository });
      res.status(400).json({
        success: false,
        error: 'GitHub仓库URL格式不正确。正确格式：https://github.com/用户名/仓库名',
      });
      return;
    }

    // 构建生成HTML原型的提示词
    const prompt = `请根据以下产品需求文档(PRD)，生成一个完整的HTML原型（包括HTML、CSS和JavaScript）:

${prdContent}

要求:
1. 创建一个现代化、美观的响应式网页原型
2. 使用语义化的HTML5标签
3. 使用现代CSS（可以使用Flexbox/Grid布局）
4. 如果需要交互，请使用原生JavaScript（不依赖外部库）
5. 确保代码结构清晰，有适当的注释
6. 创建一个index.html作为主入口文件
7. 如果需要，可以创建多个HTML页面和样式文件
8. 请确保页面在移动端和桌面端都有良好的显示效果

请直接生成可运行的HTML原型代码。`;

    logger.info('Creating Cursor Cloud Agent for HTML prototype generation', {
      prdId,
      repository: targetRepository,
      promptLength: prompt.length,
    });

    // 调用Cursor API创建Agent
    let agent;
    try {
      agent = await cursorApiClient.createAgent({
        prompt: {
          text: prompt,
        },
        source: {
          repository: targetRepository,
          ref: 'main',
        },
        target: {
          branchName: `html-prototype/prd-${prdId}-${Date.now()}`,
          autoCreatePr: autoCreatePr !== false, // 默认自动创建PR
          openAsCursorGithubApp: false,
          skipReviewerRequest: true,
        },
        // 不指定model，让Cursor自动选择最佳模型
      });
    } catch (error: any) {
      // 提供更详细的错误信息
      let errorMessage = '创建Cloud Agent失败';
      
      if (error.response?.status === 400) {
        errorMessage = '请求参数错误。请检查：\n' +
          '1. GitHub仓库是否存在且有访问权限\n' +
          '2. API Key是否有效\n' +
          '3. 仓库URL格式是否正确';
      } else if (error.response?.status === 401) {
        errorMessage = 'API Key无效或已过期，请检查配置';
      } else if (error.response?.status === 403) {
        errorMessage = '没有访问权限，请检查：\n' +
          '1. API Key权限\n' +
          '2. GitHub仓库访问权限';
      } else if (error.response?.status === 404) {
        errorMessage = 'GitHub仓库不存在，请检查仓库URL';
      }
      
      logger.error('Failed to create Cursor Agent', error, {
        status: error.response?.status,
        data: error.response?.data,
        repository: targetRepository,
      });
      
      res.status(error.response?.status || 500).json({
        success: false,
        error: errorMessage,
        details: error.response?.data,
      });
      return;
    }

    // 创建生成任务记录
    const task = {
      id: agent.id,
      prdId,
      agentId: agent.id,
      status: agent.status.toLowerCase(),
      repository: targetRepository,
      branchName: agent.target.branchName,
      prUrl: agent.target.prUrl,
      createdAt: new Date(agent.createdAt),
      updatedAt: new Date(),
    };

    generationTasks.set(agent.id, task);

    const duration = Date.now() - startTime;
    logger.info('HTML prototype generation started successfully', {
      taskId: agent.id,
      agentId: agent.id,
      duration: `${duration}ms`,
    });
    logger.end('generateHtmlPrototype', { taskId: agent.id }, duration);

    res.json({
      success: true,
      data: {
        taskId: agent.id,
        agentId: agent.id,
        status: agent.status,
        branchName: agent.target.branchName,
        url: agent.target.url,
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Error generating HTML prototype', error, {
      duration: `${duration}ms`,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    });
    logger.end('generateHtmlPrototype', { success: false }, duration);

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '生成HTML原型失败',
    });
  }
}

/**
 * 获取HTML原型生成任务状态
 * GET /api/v1/html-prototype/generate/:taskId/status
 */
export async function getGenerationStatus(req: Request, res: Response): Promise<void> {
  const startTime = Date.now();
  const { taskId } = req.params;
  logger.debug('Getting HTML prototype generation status', { taskId });

  try {
    // 从Cursor API获取最新状态
    const agent = await cursorApiClient.getAgentStatus(taskId);

    // 更新本地任务状态
    const task = generationTasks.get(taskId);
    if (task) {
      task.status = agent.status.toLowerCase();
      task.updatedAt = new Date();
      task.prUrl = agent.target.prUrl;
      task.summary = agent.summary;
      if (agent.status === 'FINISHED' || agent.status === 'FAILED') {
        task.completedAt = new Date();
      }
      generationTasks.set(taskId, task);
    }

    const duration = Date.now() - startTime;
    logger.debug('HTML prototype generation status retrieved successfully', {
      taskId,
      status: agent.status,
      duration: `${duration}ms`,
    });

    res.json({
      success: true,
      data: {
        taskId,
        status: agent.status,
        branchName: agent.target.branchName,
        url: agent.target.url,
        prUrl: agent.target.prUrl,
        summary: agent.summary,
        createdAt: agent.createdAt,
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Error getting HTML prototype generation status', error, {
      taskId,
      duration: `${duration}ms`,
    });

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取生成状态失败',
    });
  }
}

/**
 * 获取HTML原型生成会话历史
 * GET /api/v1/html-prototype/generate/:taskId/conversation
 */
export async function getGenerationConversation(req: Request, res: Response): Promise<void> {
  const startTime = Date.now();
  const { taskId } = req.params;
  logger.debug('Getting HTML prototype generation conversation', { taskId });

  try {
    const conversation = await cursorApiClient.getAgentConversation(taskId);

    const duration = Date.now() - startTime;
    logger.debug('HTML prototype generation conversation retrieved successfully', {
      taskId,
      messageCount: conversation.messages.length,
      duration: `${duration}ms`,
    });

    res.json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Error getting HTML prototype generation conversation', error, {
      taskId,
      duration: `${duration}ms`,
    });

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取会话历史失败',
    });
  }
}

/**
 * 发送后续指令
 * POST /api/v1/html-prototype/generate/:taskId/followup
 */
export async function sendFollowup(req: Request, res: Response): Promise<void> {
  const startTime = Date.now();
  const { taskId } = req.params;
  const { message } = req.body;

  logger.info('Sending followup message to HTML prototype generation', {
    taskId,
    messageLength: message?.length || 0,
  });

  try {
    if (!message || typeof message !== 'string' || message.trim() === '') {
      logger.warn('Invalid request: message is empty');
      res.status(400).json({
        success: false,
        error: '消息内容不能为空',
      });
      return;
    }

    await cursorApiClient.sendFollowup(taskId, {
      prompt: {
        text: message.trim(),
      },
    });

    const duration = Date.now() - startTime;
    logger.info('Followup message sent successfully', {
      taskId,
      duration: `${duration}ms`,
    });

    res.json({
      success: true,
      data: {
        taskId,
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Error sending followup message', error, {
      taskId,
      duration: `${duration}ms`,
    });

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '发送后续指令失败',
    });
  }
}

/**
 * 停止HTML原型生成
 * POST /api/v1/html-prototype/generate/:taskId/stop
 */
export async function stopGeneration(req: Request, res: Response): Promise<void> {
  const startTime = Date.now();
  const { taskId } = req.params;
  logger.info('Stopping HTML prototype generation', { taskId });

  try {
    await cursorApiClient.stopAgent(taskId);

    // 更新本地任务状态
    const task = generationTasks.get(taskId);
    if (task) {
      task.status = 'stopped';
      task.updatedAt = new Date();
      generationTasks.set(taskId, task);
    }

    const duration = Date.now() - startTime;
    logger.info('HTML prototype generation stopped successfully', {
      taskId,
      duration: `${duration}ms`,
    });

    res.json({
      success: true,
      data: {
        taskId,
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Error stopping HTML prototype generation', error, {
      taskId,
      duration: `${duration}ms`,
    });

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '停止生成失败',
    });
  }
}

/**
 * 删除HTML原型生成任务
 * DELETE /api/v1/html-prototype/generate/:taskId
 */
export async function deleteGeneration(req: Request, res: Response): Promise<void> {
  const startTime = Date.now();
  const { taskId } = req.params;
  logger.info('Deleting HTML prototype generation', { taskId });

  try {
    await cursorApiClient.deleteAgent(taskId);

    // 删除本地任务记录
    generationTasks.delete(taskId);

    const duration = Date.now() - startTime;
    logger.info('HTML prototype generation deleted successfully', {
      taskId,
      duration: `${duration}ms`,
    });

    res.json({
      success: true,
      data: {
        taskId,
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Error deleting HTML prototype generation', error, {
      taskId,
      duration: `${duration}ms`,
    });

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '删除生成任务失败',
    });
  }
}

/**
 * 列出所有HTML原型生成任务
 * GET /api/v1/html-prototype/generate
 */
export async function listGenerations(req: Request, res: Response): Promise<void> {
  const startTime = Date.now();
  const { limit = 20, cursor } = req.query;
  logger.debug('Listing HTML prototype generations', { limit, cursor });

  try {
    const result = await cursorApiClient.listAgents(
      Number(limit),
      cursor as string | undefined
    );

    const duration = Date.now() - startTime;
    logger.debug('HTML prototype generations listed successfully', {
      count: result.agents.length,
      duration: `${duration}ms`,
    });

    res.json({
      success: true,
      data: {
        agents: result.agents,
        nextCursor: result.nextCursor,
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Error listing HTML prototype generations', error, {
      duration: `${duration}ms`,
    });

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取生成任务列表失败',
    });
  }
}

/**
 * 从PRD ID生成HTML原型
 * POST /api/v1/html-prototype/generate-from-prd/:prdId
 */
export async function generateFromPrd(req: Request, res: Response): Promise<void> {
  const startTime = Date.now();
  const { prdId } = req.params;
  const { repository, autoCreatePr } = req.body;

  logger.start('generateFromPrd', { prdId });

  try {
    // 从数据库获取PRD内容
    const prd = await prdService.getPRDById(prdId);

    if (!prd) {
      logger.warn('PRD not found', { prdId });
      res.status(404).json({
        success: false,
        error: 'PRD不存在',
      });
      return;
    }

    // 调用生成HTML原型的函数
    const generateReq = {
      body: {
        prdId,
        prdContent: prd.content,
        repository,
        autoCreatePr,
      },
    } as Request;

    await generateHtmlPrototype(generateReq, res);
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Error generating HTML prototype from PRD', error, {
      prdId,
      duration: `${duration}ms`,
    });

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '从PRD生成HTML原型失败',
    });
  }
}

