/**
 * Engineer Test Controller
 * Provides API endpoints for testing Engineer role functionality
 */

import { Request, Response } from 'express';
import { Engineer } from '../../roles/Engineer';
import { Context } from '../../core/context/Context';
import { Message } from '../../core/message/Message';
import { ACTION_WRITE_PRD, ACTION_WRITE_DESIGN, ACTION_BREAKDOWN_TASKS } from '@mind2build/shared';
import { logger, WorkspaceManager } from '../../utils';
import { createLLM } from '../../providers/llm/factory';

/**
 * Validate if a string is a valid UUID format
 */
function isValidUUID(str: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
}

/**
 * Get valid userId - returns valid UUID or null (to use default)
 * If userId is not a valid UUID, returns null so Role.ts will use its default UUID
 */
function getValidUserId(userId: string | undefined): string | null {
    if (!userId) {
        return null; // Will use default in Role.ts
    }
    if (isValidUUID(userId)) {
        return userId;
    }
    // If not a valid UUID, return null to use default
    logger.debug(`EngineerTestController: Invalid UUID format "${userId}", using default`);
    return null;
}

/**
 * Load documents from workspace filesystem
 * Reads from workspace/{applicationId}/{projectId}/ainative-workspace/docs/{documentType}/ directories
 * applicationId 和 projectId 必须提供，不能使用 'default'，以防止不同应用/项目互相覆盖文件
 */
async function loadDocumentsFromWorkspace(
    applicationId: string,
    projectId: string
): Promise<{ prd: string; design: string; taskBreakdown: string }> {
    if (!applicationId) {
        throw new Error('applicationId is required for loadDocumentsFromWorkspace. Cannot use "default" to prevent file conflicts between different applications.');
    }
    if (!projectId) {
        throw new Error('projectId is required for loadDocumentsFromWorkspace. Cannot use "default" to prevent file conflicts between different projects.');
    }
    const result = {
        prd: '',
        design: '',
        taskBreakdown: '',
    };

    try {
        // Load PRD
        const prdContent = await WorkspaceManager.readAllFromWorkspace({
            applicationId,
            projectId,
            documentType: 'PRD',
        });
        result.prd = prdContent;

        // Load DESIGN
        const designContent = await WorkspaceManager.readAllFromWorkspace({
            applicationId,
            projectId,
            documentType: 'DESIGN',
        });
        result.design = designContent;

        // Load TASKS
        const tasksContent = await WorkspaceManager.readAllFromWorkspace({
            applicationId,
            projectId,
            documentType: 'TASKS',
        });
        result.taskBreakdown = tasksContent;

        // Log summary - only log if at least one document was found
        const foundDocs = [
            result.prd && 'PRD',
            result.design && 'DESIGN',
            result.taskBreakdown && 'TASKS',
        ].filter(Boolean);

        if (foundDocs.length > 0) {
            logger.info('EngineerTestController: Loaded documents from workspace', {
                applicationId,
                projectId,
                foundDocuments: foundDocs,
                prdLength: result.prd.length,
                designLength: result.design.length,
                taskBreakdownLength: result.taskBreakdown.length,
            });
        } else {
            logger.debug('EngineerTestController: No documents found in workspace', {
                applicationId,
                projectId,
            });
        }
    } catch (error: any) {
        logger.warn('EngineerTestController: Error loading documents from workspace', {
            error: error.message,
            applicationId,
            projectId,
        });
    }

    return result;
}

interface EngineerTestRequest {
    prd?: string;
    design?: string;
    taskBreakdown?: string;
    action?: 'WriteCode' | 'ExecuteSubtask' | 'Deploy';
    workspaceOptions?: {
        applicationId?: string;
        projectId?: string;
    };
    llmConfig?: {
        provider?: string;
        apiKey?: string;
        model?: string;
        baseURL?: string;
    };
}

/**
 * Test Engineer role with WriteCode action
 * POST /api/test/engineer/write-code
 */
export async function testWriteCode(req: Request, res: Response) {
    try {
        const {
            prd: providedPrd,
            design: providedDesign,
            taskBreakdown: providedTaskBreakdown,
            workspaceOptions,
            llmConfig,
        } = req.body as EngineerTestRequest;

        // Determine applicationId, projectId from workspaceOptions
        // applicationId 和 projectId 必须提供，不能使用 'default'
        if (!workspaceOptions?.applicationId) {
            return res.status(400).json({
                error: 'applicationId is required in workspaceOptions. Cannot use "default" to prevent file conflicts between different applications.',
            });
        }
        if (!workspaceOptions?.projectId) {
            return res.status(400).json({
                error: 'projectId is required in workspaceOptions. Cannot use "default" to prevent file conflicts between different projects.',
            });
        }
        const applicationId = workspaceOptions.applicationId;
        const projectId = workspaceOptions.projectId;

        // Load documents from workspace if not provided in request
        let prd = providedPrd;
        let design = providedDesign;
        let taskBreakdown = providedTaskBreakdown;

        if (!prd || !design || !taskBreakdown) {
            const workspaceDocs = await loadDocumentsFromWorkspace(applicationId, projectId);
            prd = prd || workspaceDocs.prd;
            design = design || workspaceDocs.design;
            taskBreakdown = taskBreakdown || workspaceDocs.taskBreakdown;
        }

        // Validate required fields - Design is required for code generation
        if (!design) {
            return res.status(400).json({
                error: 'Design document is required for code generation. Please provide in request body or ensure DESIGN.md exists in workspace.',
            });
        }

        // Create context
        const context = new Context();

        // Set userId in context (only if valid UUID)
        const userId = getValidUserId((req as any).userId);
        if (userId) {
            context.set('userId', userId);
        }

        // If provided LLM config, set it as fallback (will be overridden by database config if exists)
        if (llmConfig) {
            const fallbackLLM = createLLM({
                provider: (llmConfig.provider || 'zhipuai') as any,
                apiKey: llmConfig.apiKey || '',
                model: llmConfig.model || 'glm-4',
                baseURL: llmConfig.baseURL,
            });
            fallbackLLM.costManager = context.costManager;
            context.llm = fallbackLLM;
        }

        // Create Engineer instance - it will automatically load LLM config from database
        // Priority: database config > provided llmConfig > default context.llm
        const engineer = new Engineer(context);

        // Wait for database config to load (Role.ts loads it asynchronously)
        // The Role's loadRoleLLMFromDatabase will override context.llm if database config exists
        if ((engineer as any).llmLoadPromise) {
            await (engineer as any).llmLoadPromise;
        }

        // Add PRD message if provided
        if (prd) {
            const prdMessage = new Message({
                content: prd,
                role: 'ProductManager',
                causeBy: ACTION_WRITE_PRD,
                sentFrom: 'ProductManager',
            });
            engineer['rc'].memory.add(prdMessage);
        }

        // Add Design message if provided
        if (design) {
            const designMessage = new Message({
                content: design,
                role: 'Architect',
                causeBy: ACTION_WRITE_DESIGN,
                sentFrom: 'Architect',
            });
            engineer['rc'].memory.add(designMessage);
        }

        // Add BreakdownTasks message if provided
        if (taskBreakdown) {
            const breakdownMessage = new Message({
                content: taskBreakdown,
                role: 'Architect',
                causeBy: ACTION_BREAKDOWN_TASKS,
                sentFrom: 'Architect',
            });
            engineer['rc'].memory.add(breakdownMessage);
        }

        // Set WriteCode as todo action
        const writeCodeAction = engineer.actions.find(a => a.name === 'WriteCode');
        if (!writeCodeAction) {
            return res.status(500).json({
                error: 'WriteCode action not found',
            });
        }

        engineer['rc'].todo = writeCodeAction;

        // Set workspaceOptions in context if provided
        if (workspaceOptions) {
            if (workspaceOptions.applicationId) {
                context.set('applicationId', workspaceOptions.applicationId);
            }
            if (workspaceOptions.projectId) {
                context.set('projectId', workspaceOptions.projectId);
            }
        }

        // Execute action
        logger.info('EngineerTestController: Executing WriteCode action');
        const result = await engineer.act();

        if (!result) {
            return res.status(200).json({
                success: true,
                message: 'No result returned (likely no PRD/Design available)',
                result: null,
            });
        }

        return res.json({
            success: true,
            result: {
                content: result.content,
                role: result.role,
                causeBy: result.causeBy,
                sentFrom: result.sentFrom,
                instructContent: result.instructContent,
                messageId: result.id,
            },
        });
    } catch (error: any) {
        logger.error('EngineerTestController: WriteCode test failed:', error);
        return res.status(500).json({
            error: 'Failed to test WriteCode',
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        });
    }
}

/**
 * Test Engineer role with ExecuteSubtask action
 * POST /api/test/engineer/execute-subtask
 */
export async function testExecuteSubtask(req: Request, res: Response) {
    try {
        const {
            prd: providedPrd,
            design: providedDesign,
            taskBreakdown: providedTaskBreakdown,
            workspaceOptions,
            llmConfig,
        } = req.body as EngineerTestRequest;

        // Determine applicationId, projectId from workspaceOptions
        // applicationId 和 projectId 必须提供，不能使用 'default'
        if (!workspaceOptions?.applicationId) {
            return res.status(400).json({
                error: 'applicationId is required in workspaceOptions. Cannot use "default" to prevent file conflicts between different applications.',
            });
        }
        if (!workspaceOptions?.projectId) {
            return res.status(400).json({
                error: 'projectId is required in workspaceOptions. Cannot use "default" to prevent file conflicts between different projects.',
            });
        }
        const applicationId = workspaceOptions.applicationId;
        const projectId = workspaceOptions.projectId;

        // Load documents from workspace if not provided in request
        let prd = providedPrd;
        let design = providedDesign;
        let taskBreakdown = providedTaskBreakdown;

        if (!prd || !design || !taskBreakdown) {
            const workspaceDocs = await loadDocumentsFromWorkspace(applicationId, projectId);
            prd = prd || workspaceDocs.prd;
            design = design || workspaceDocs.design;
            taskBreakdown = taskBreakdown || workspaceDocs.taskBreakdown;
        }

        // Validate required fields
        if (!taskBreakdown) {
            return res.status(400).json({
                error: 'taskBreakdown is required for ExecuteSubtask. Please provide in request body or ensure TASK_BREAKDOWN.md exists in workspace/{applicationId}/{projectId}/ainative-workspace/docs/tasks/',
            });
        }

        // Design is also required for code generation
        if (!design) {
            return res.status(400).json({
                error: 'Design document is required for code generation. Please provide in request body or ensure DESIGN.md exists in workspace.',
            });
        }

        // Create context
        const context = new Context();

        // Set userId in context (only if valid UUID)
        const userId = getValidUserId((req as any).userId);
        if (userId) {
            context.set('userId', userId);
        }

        // If provided LLM config, set it as fallback (will be overridden by database config if exists)
        if (llmConfig) {
            const fallbackLLM = createLLM({
                provider: (llmConfig.provider || 'zhipuai') as any,
                apiKey: llmConfig.apiKey || '',
                model: llmConfig.model || 'glm-4',
                baseURL: llmConfig.baseURL,
            });
            fallbackLLM.costManager = context.costManager;
            context.llm = fallbackLLM;
        }

        // Create Engineer instance - it will automatically load LLM config from database
        // Priority: database config > provided llmConfig > default context.llm
        const engineer = new Engineer(context);

        // Wait for database config to load (Role.ts loads it asynchronously)
        // The Role's loadRoleLLMFromDatabase will override context.llm if database config exists
        if ((engineer as any).llmLoadPromise) {
            await (engineer as any).llmLoadPromise;
        }

        // Add PRD message if provided
        if (prd) {
            const prdMessage = new Message({
                content: prd,
                role: 'ProductManager',
                causeBy: ACTION_WRITE_PRD,
                sentFrom: 'ProductManager',
            });
            engineer['rc'].memory.add(prdMessage);
        }

        // Add Design message if provided
        if (design) {
            const designMessage = new Message({
                content: design,
                role: 'Architect',
                causeBy: ACTION_WRITE_DESIGN,
                sentFrom: 'Architect',
            });
            engineer['rc'].memory.add(designMessage);
        }

        // Add BreakdownTasks message
        const breakdownMessage = new Message({
            content: taskBreakdown,
            role: 'Architect',
            causeBy: ACTION_BREAKDOWN_TASKS,
            sentFrom: 'Architect',
        });
        engineer['rc'].memory.add(breakdownMessage);

        // Set ExecuteSubtask as todo action
        const executeSubtaskAction = engineer.actions.find(a => a.name === 'ExecuteSubtask');
        if (!executeSubtaskAction) {
            return res.status(500).json({
                error: 'ExecuteSubtask action not found',
            });
        }

        engineer['rc'].todo = executeSubtaskAction;

        // Mock extractWorkspaceOptions
        engineer['extractWorkspaceOptions'] = () => workspaceOptions;

        // Execute action
        logger.info('EngineerTestController: Executing ExecuteSubtask action');
        const result = await engineer.act();

        if (!result) {
            return res.status(200).json({
                success: true,
                message: 'No result returned (likely no pending tasks)',
                result: null,
            });
        }

        return res.json({
            success: true,
            result: {
                content: result.content,
                role: result.role,
                causeBy: result.causeBy,
                sentFrom: result.sentFrom,
                instructContent: result.instructContent,
                messageId: result.id,
            },
        });
    } catch (error: any) {
        logger.error('EngineerTestController: ExecuteSubtask test failed:', error);
        return res.status(500).json({
            error: 'Failed to test ExecuteSubtask',
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        });
    }
}

/**
 * Get Engineer role information
 * GET /api/test/engineer/info
 */
export async function getEngineerInfo(_req: Request, res: Response) {
    try {
        const context = new Context();
        const engineer = new Engineer(context);

        return res.json({
            success: true,
            info: {
                profile: engineer.profile,
                goal: engineer.goal,
                constraints: engineer.constraints,
                description: engineer.description,
                actions: engineer.actions.map(a => ({
                    name: a.name,
                    description: a.description,
                })),
                watchedActions: Array.from(engineer['rc'].watch),
            },
        });
    } catch (error: any) {
        logger.error('EngineerTestController: Failed to get info:', error);
        return res.status(500).json({
            error: 'Failed to get Engineer info',
            message: error.message,
        });
    }
}

/**
 * Test Engineer role with custom scenario
 * POST /api/test/engineer/custom
 */
export async function testCustom(req: Request, res: Response) {
    try {
        const {
            prd: providedPrd,
            design: providedDesign,
            taskBreakdown: providedTaskBreakdown,
            workspaceOptions,
            llmConfig,
            action,
        } = req.body as EngineerTestRequest;

        // Validate action
        if (!action || !['WriteCode', 'ExecuteSubtask', 'Deploy'].includes(action)) {
            return res.status(400).json({
                error: 'action must be either "WriteCode", "ExecuteSubtask", or "Deploy"',
            });
        }

        // Determine applicationId, projectId from workspaceOptions
        // applicationId 和 projectId 必须提供，不能使用 'default'
        if (!workspaceOptions?.applicationId) {
            return res.status(400).json({
                error: 'applicationId is required in workspaceOptions. Cannot use "default" to prevent file conflicts between different applications.',
            });
        }
        if (!workspaceOptions?.projectId) {
            return res.status(400).json({
                error: 'projectId is required in workspaceOptions. Cannot use "default" to prevent file conflicts between different projects.',
            });
        }
        const applicationId = workspaceOptions.applicationId;
        const projectId = workspaceOptions.projectId;

        // Load documents from workspace if not provided in request
        let prd = providedPrd;
        let design = providedDesign;
        let taskBreakdown = providedTaskBreakdown;

        if (!prd || !design || !taskBreakdown) {
            const workspaceDocs = await loadDocumentsFromWorkspace(applicationId, projectId);
            prd = prd || workspaceDocs.prd;
            design = design || workspaceDocs.design;
            taskBreakdown = taskBreakdown || workspaceDocs.taskBreakdown;
        }

        // Validate required fields - Design is required for code generation
        if (!design) {
            return res.status(400).json({
                error: 'Design document is required for code generation. Please provide in request body or ensure DESIGN.md exists in workspace.',
            });
        }

        // For ExecuteSubtask, taskBreakdown is also required
        if (action === 'ExecuteSubtask' && !taskBreakdown) {
            return res.status(400).json({
                error: 'taskBreakdown is required for ExecuteSubtask. Please provide in request body or ensure TASK_BREAKDOWN.md exists in workspace.',
            });
        }

        // Create context
        const context = new Context();

        // Set userId in context (only if valid UUID)
        const userId = getValidUserId((req as any).userId);
        if (userId) {
            context.set('userId', userId);
        }

        // If provided LLM config, set it as fallback (will be overridden by database config if exists)
        if (llmConfig) {
            const fallbackLLM = createLLM({
                provider: (llmConfig.provider || 'zhipuai') as any,
                apiKey: llmConfig.apiKey || '',
                model: llmConfig.model || 'glm-4',
                baseURL: llmConfig.baseURL,
            });
            fallbackLLM.costManager = context.costManager;
            context.llm = fallbackLLM;
        }

        // Create Engineer instance - it will automatically load LLM config from database
        // Priority: database config > provided llmConfig > default context.llm
        const engineer = new Engineer(context);

        // Wait for database config to load (Role.ts loads it asynchronously)
        // The Role's loadRoleLLMFromDatabase will override context.llm if database config exists
        if ((engineer as any).llmLoadPromise) {
            await (engineer as any).llmLoadPromise;
        }

        // Add messages to memory
        if (prd) {
            const prdMessage = new Message({
                content: prd,
                role: 'ProductManager',
                causeBy: ACTION_WRITE_PRD,
                sentFrom: 'ProductManager',
            });
            engineer['rc'].memory.add(prdMessage);
        }

        if (design) {
            const designMessage = new Message({
                content: design,
                role: 'Architect',
                causeBy: ACTION_WRITE_DESIGN,
                sentFrom: 'Architect',
            });
            engineer['rc'].memory.add(designMessage);
        }

        if (taskBreakdown) {
            const breakdownMessage = new Message({
                content: taskBreakdown,
                role: 'Architect',
                causeBy: ACTION_BREAKDOWN_TASKS,
                sentFrom: 'Architect',
            });
            engineer['rc'].memory.add(breakdownMessage);
        }

        // Set action as todo
        const targetAction = engineer.actions.find(a => a.name === action);
        if (!targetAction) {
            return res.status(500).json({
                error: `Action ${action} not found`,
            });
        }

        engineer['rc'].todo = targetAction;

        // Mock extractWorkspaceOptions if provided
        if (workspaceOptions) {
            engineer['extractWorkspaceOptions'] = () => workspaceOptions;
        }

        // Execute action
        logger.info(`EngineerTestController: Executing ${action} action`);
        const result = await engineer.act();

        return res.json({
            success: true,
            action,
            result: result ? {
                content: result.content,
                role: result.role,
                causeBy: result.causeBy,
                sentFrom: result.sentFrom,
                instructContent: result.instructContent,
                messageId: result.id,
            } : null,
        });
    } catch (error: any) {
        logger.error('EngineerTestController: Custom test failed:', error);
        return res.status(500).json({
            error: 'Failed to test Engineer',
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        });
    }
}

/**
 * Test Engineer role with Deploy action
 * POST /api/test/engineer/deploy
 */
export async function testDeploy(req: Request, res: Response) {
    try {
        const {
            design: providedDesign,
            workspaceOptions,
            llmConfig,
        } = req.body as EngineerTestRequest;

        // Determine applicationId, projectId from workspaceOptions
        if (!workspaceOptions?.applicationId) {
            return res.status(400).json({
                error: 'applicationId is required in workspaceOptions. Cannot use "default" to prevent file conflicts between different applications.',
            });
        }
        if (!workspaceOptions?.projectId) {
            return res.status(400).json({
                error: 'projectId is required in workspaceOptions. Cannot use "default" to prevent file conflicts between different projects.',
            });
        }
        const applicationId = workspaceOptions.applicationId;
        const projectId = workspaceOptions.projectId;

        // Load design from workspace if not provided in request
        let design = providedDesign;

        if (!design) {
            const workspaceDocs = await loadDocumentsFromWorkspace(applicationId, projectId);
            design = workspaceDocs.design;
        }

        // Design is not strictly required for Deploy, but use a default message if not provided
        if (!design) {
            design = '执行部署操作';
        }

        // Create context
        const context = new Context();

        // Set userId in context (only if valid UUID)
        const userId = getValidUserId((req as any).userId);
        if (userId) {
            context.set('userId', userId);
        }

        // If provided LLM config, set it as fallback (will be overridden by database config if exists)
        if (llmConfig) {
            const fallbackLLM = createLLM({
                provider: (llmConfig.provider || 'zhipuai') as any,
                apiKey: llmConfig.apiKey || '',
                model: llmConfig.model || 'glm-4',
                baseURL: llmConfig.baseURL,
            });
            fallbackLLM.costManager = context.costManager;
            context.llm = fallbackLLM;
        }

        // Create Engineer instance - it will automatically load LLM config from database
        const engineer = new Engineer(context);

        // Wait for database config to load
        if ((engineer as any).llmLoadPromise) {
            await (engineer as any).llmLoadPromise;
        }

        // Add Design message if provided
        if (design) {
            const designMessage = new Message({
                content: design,
                role: 'Architect',
                causeBy: ACTION_WRITE_DESIGN,
                sentFrom: 'Architect',
            });
            engineer['rc'].memory.add(designMessage);
        }

        // Set Deploy as todo action
        const deployAction = engineer.actions.find(a => a.name === 'Deploy');
        if (!deployAction) {
            return res.status(500).json({
                error: 'Deploy action not found',
            });
        }

        engineer['rc'].todo = deployAction;

        // Set workspaceOptions in context if provided
        if (workspaceOptions) {
            if (workspaceOptions.applicationId) {
                context.set('applicationId', workspaceOptions.applicationId);
            }
            if (workspaceOptions.projectId) {
                context.set('projectId', workspaceOptions.projectId);
            }
        }

        // Execute action
        logger.info('EngineerTestController: Executing Deploy action');
        const result = await engineer.act();

        if (!result) {
            return res.status(200).json({
                success: true,
                message: 'No result returned',
                result: null,
            });
        }

        return res.json({
            success: true,
            result: {
                content: result.content,
                role: result.role,
                causeBy: result.causeBy,
                sentFrom: result.sentFrom,
                instructContent: result.instructContent,
                messageId: result.id,
            },
        });
    } catch (error: any) {
        logger.error('EngineerTestController: Deploy test failed:', error);
        return res.status(500).json({
            error: 'Failed to test Deploy',
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        });
    }
}

