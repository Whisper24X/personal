/**
 * Interactive Session Controller
 * Handles interactive session-related HTTP requests
 */

import { Request, Response } from 'express';
import { sessionManager } from '../../orchestration/InteractiveSessionManager';
import { logger } from '../../utils';
import { getOrRestoreSession } from '../helpers/sessionHelpers';

const DEFAULT_USER_ID = '302769d6-247d-43db-a005-0519712255fb';

export class InteractiveController {
    /**
     * List all interactive sessions
     */
    static async list(_req: Request, res: Response) {
        try {
            const sessions = sessionManager.getAllSessions();

            return res.json({
                sessions: sessions.map(session => session.getInfo()),
            });
        } catch (error: any) {
            logger.error('API: Error listing interactive sessions', error);
            return res.status(500).json({
                error: error.message || 'Failed to list interactive sessions',
            });
        }
    }

    /**
     * Create a new interactive session
     */
    static async create(req: Request, res: Response) {
        try {
            const { name, idea, description, investment, projectId, applicationId } = req.body;

            // Validate required fields
            if (!name || !idea) {
                return res.status(400).json({
                    error: 'Missing required fields: name, idea',
                });
            }

            // If projectId is provided, use it; otherwise create a new project
            let finalProjectId = projectId;
            const userId = req.body.userId || DEFAULT_USER_ID;

            if (!finalProjectId) {
                // Create project in database
                const { ProjectRepository } = await import('../../database/repositories/ProjectRepository');
                const projectRepo = new ProjectRepository();

                // Check for duplicate project name in the same application
                const exists = await projectRepo.existsByNameAndApplication(name, applicationId || null, userId);
                if (exists) {
                    return res.status(409).json({
                        error: 'Duplicate project name',
                        message: applicationId
                            ? `项目名称 "${name}" 在该应用下已存在，请使用不同的名称`
                            : `项目名称 "${name}" 已存在，请使用不同的名称`,
                    });
                }

                const project = await projectRepo.create({
                    userId,
                    name,
                    idea,
                    description,
                    investment: investment || 10.0,
                    applicationId,
                });

                finalProjectId = project.id;
                logger.info(`API: Created project ${finalProjectId} for interactive session`);
            }

            // Get applicationId from project if projectId is provided
            let finalApplicationId = applicationId;
            if (finalProjectId) {
                // Try to get project data to use as source of truth
                try {
                    const { ProjectRepository } = await import('../../database/repositories/ProjectRepository');
                    const projectRepo = new ProjectRepository();
                    const project = await projectRepo.findById(finalProjectId);
                    if (project) {
                        // Get applicationId from project if not provided
                        if (!finalApplicationId && project.application_id) {
                            finalApplicationId = project.application_id;
                        }
                    }
                } catch (error: any) {
                    logger.warn('API: Failed to get project data', { error: error.message });
                }
            }

            // Create new session (always create new session, but will restore state from projectId if exists)
            // Session is managed by sessionManager, no need to use the returned value directly
            sessionManager.createSession({
                name,
                idea,
                description,
                investment: investment || 10.0,
                nRound: 5, // Deprecated: kept for backward compatibility, not used
                userId,
                applicationId: finalApplicationId,
                projectId: finalProjectId,
            });
            logger.info(`API: Created interactive session for project ${finalProjectId}`);

            return res.json({
                projectId: finalProjectId,
                config: {
                    name,
                    idea,
                    description,
                    investment: investment || 10.0,
                },
            });
        } catch (error: any) {
            logger.error('API: Error creating interactive session', error);
            return res.status(500).json({
                error: error.message || 'Failed to create interactive session',
            });
        }
    }

    /**
     * Get manager stats
     */
    static async getStats(_req: Request, res: Response) {
        try {
            const stats = sessionManager.getStats();

            return res.json({
                stats,
            });
        } catch (error: any) {
            logger.error('API: Error getting stats', error);
            return res.status(500).json({
                error: error.message || 'Failed to get stats',
            });
        }
    }

    /**
     * Poll for new messages (for polling mechanism)
     */
    static async poll(req: Request, res: Response) {
        try {
            const { projectId } = req.params;
            const { lastMessageId } = req.query;

            const session = await getOrRestoreSession(projectId);

            if (!session) {
                return res.status(404).json({
                    error: 'Session not found',
                });
            }

            // Start session if not already started (for polling mode)
            // This allows starting session without WebSocket
            const sessionInfo = session.getInfo();
            if (!sessionInfo.isStarted) {
                // Session hasn't started yet, start it
                (session as any).startWithoutWebSocket();
            }

            // Get messages since last poll
            const messages = session.getMessagesSince(lastMessageId as string | null || null);

            // Get the last message ID for next poll
            const latestMessageId = messages.length > 0
                ? messages[messages.length - 1].id
                : (lastMessageId as string | null);

            return res.json({
                messages,
                lastMessageId: latestMessageId,
                hasMore: messages.length > 0,
            });
        } catch (error: any) {
            return res.status(500).json({
                error: error.message || 'Failed to poll messages',
            });
        }
    }

    /**
     * Send user action (for polling mechanism)
     */
    static async action(req: Request, res: Response) {
        try {
            const { projectId } = req.params;
            const { action, modifiedContent } = req.body;

            if (!action) {
                return res.status(400).json({
                    error: 'Missing required field: action',
                });
            }

            const session = sessionManager.getSession(projectId);

            if (!session) {
                return res.status(404).json({
                    error: 'Session not found',
                });
            }

            // Handle user action
            session.handleUserAction({
                action,
                modifiedContent,
            });

            return res.json({
                success: true,
                message: 'Action processed successfully',
            });
        } catch (error: any) {
            logger.error('API: Error processing user action', error);
            return res.status(500).json({
                error: error.message || 'Failed to process user action',
            });
        }
    }

    /**
     * Get workflow information (all roles and their actions)
     */
    static async getWorkflow(req: Request, res: Response) {
        try {
            const { projectId } = req.params;
            const session = await getOrRestoreSession(projectId);

            if (!session) {
                return res.status(404).json({
                    error: 'Session not found',
                });
            }

            const workflowInfo = session.getWorkflowInfo();

            // Get state manager
            const stateManager = (session as any).stateManager;

            // Get all workflow items with their statuses
            const workflowItems = stateManager ? await stateManager.getWorkflowItems() : [];

            // Get current running state
            const runningState = stateManager ? await stateManager.getRunningState() : { role: null, action: null };

            return res.json({
                success: true,
                ...workflowInfo,
                items: workflowItems, // All workflow items with their statuses (role, action, status)
                running: runningState, // Current running role and action
            });
        } catch (error: any) {
            logger.error('API: Error getting workflow info', error);
            return res.status(500).json({
                error: error.message || 'Failed to get workflow info',
            });
        }
    }

    /**
     * Get current running role and action
     */
    static async getRunning(req: Request, res: Response) {
        try {
            const { projectId } = req.params;

            const session = await getOrRestoreSession(projectId);

            if (!session) {
                logger.warn(`API: GET /interactive/${projectId}/running - Session not found and could not be restored`);
                return res.status(404).json({
                    error: 'Session not found',
                });
            }

            // Get state manager
            const stateManager = (session as any).stateManager;

            // Get current running state
            const runningInfo = stateManager ? await stateManager.getRunningState() : { role: null, action: null };

            // Get all workflow items with their statuses
            const workflowItems = stateManager ? await stateManager.getWorkflowItems() : [];

            // Get confirmation status from database via stateManager
            const confirmationStatus = stateManager ? await stateManager.getConfirmationStatus() : { required: false, role: null };
            let requiresConfirmation = confirmationStatus.required || false;

            // Get confirmation details from message queue if confirmation required
            // IMPORTANT: Use confirmation role from database as the source of truth
            // Only use message queue if the message role matches the database confirmation role
            let confirmationRequired = null;
            if (requiresConfirmation) {
                // First, check if we have a confirmation role from database
                const confirmationRoleFromDB = confirmationStatus.role;
                
                // Find the latest confirmation_required message from message queue
                // But only use it if it matches the database confirmation role
                const allMessages = session.getMessagesSince(null);
                const confirmationMessages = allMessages
                    .filter((msg: any) => msg.type === 'confirmation_required')
                    .reverse();
                
                // Find message that matches the database confirmation role
                let confirmationMessage = null;
                if (confirmationRoleFromDB) {
                    confirmationMessage = confirmationMessages.find(
                        (msg: any) => msg.data && msg.data.role === confirmationRoleFromDB
                    );
                }
                
                // If no matching message found, use the latest one (for backward compatibility)
                if (!confirmationMessage && confirmationMessages.length > 0) {
                    confirmationMessage = confirmationMessages[0];
                }

                if (confirmationMessage && confirmationMessage.data) {
                    // Get retry_count for failed actions
                    let retryCount = 0;
                    if (confirmationMessage.data.role && confirmationMessage.data.action) {
                        const failedItem = workflowItems.find(
                            (item: any) => item.role === confirmationMessage.data.role && 
                                          item.action === confirmationMessage.data.action &&
                                          item.status === 'failed'
                        );
                        retryCount = (failedItem as any)?.retry_count || 0;
                    }

                    confirmationRequired = {
                        role: confirmationMessage.data.role,
                        action: confirmationMessage.data.action,
                        content: confirmationMessage.data.content,
                        outputFiles: confirmationMessage.data.outputFiles || [],
                        instructContent: confirmationMessage.data.instructContent,
                        retryCount: retryCount,
                    };
                } else if (confirmationStatus.role) {
                    // Fallback: use confirmation role from database if confirmation message not found
                    // Get the last failed or completed action for this role
                    const roleItems = workflowItems.filter((item: any) => item.role === confirmationStatus.role);
                    const failedItems = roleItems.filter((item: any) => item.status === 'failed');
                    const completedItems = roleItems.filter((item: any) => item.status === 'completed');
                    
                    // Prefer failed action if exists, otherwise use last completed
                    const targetItems = failedItems.length > 0 ? failedItems : completedItems;
                    const lastAction = targetItems.sort((a: any, b: any) => {
                        const orderA = (a as any).action_order ?? 999;
                        const orderB = (b as any).action_order ?? 999;
                        return orderB - orderA; // Sort descending to get last action
                    })[0];
                    
                    const retryCount = lastAction ? ((lastAction as any).retry_count || 0) : 0;
                    
                    confirmationRequired = {
                        role: confirmationStatus.role,
                        action: lastAction?.action || null,
                        content: null,
                        outputFiles: [],
                        instructContent: null,
                        retryCount: retryCount,
                    };
                } else {
                    // Fallback: use running state if confirmation role not found
                    confirmationRequired = {
                        role: runningInfo.role,
                        action: runningInfo.action,
                        content: null,
                        outputFiles: [],
                        instructContent: null,
                        retryCount: 0,
                    };
                }

                // REMOVED: Do NOT automatically clear confirmation when all items are completed
                // Confirmation should only be cleared when user explicitly confirms
                // The workflow should wait for user confirmation even if all items are completed
            }

            const response = {
                success: true,
                running: runningInfo, // Current running role and action
                items: workflowItems, // All workflow items with their statuses (role, action, status)
                requiresConfirmation: requiresConfirmation, // Whether confirmation is required (from database)
                confirmationRequired: confirmationRequired, // Details of what needs confirmation (null if not required)
            };

            return res.json(response);
        } catch (error: any) {
            logger.error(`API: GET /interactive/${req.params.projectId}/running - Error getting running info`, {
                error: error.message,
                errorStack: error.stack,
            });
            return res.status(500).json({
                error: error.message || 'Failed to get running info',
            });
        }
    }

    /**
     * Confirm role completion and allow proceeding to next role
     */
    static async confirm(req: Request, res: Response) {
        try {
            const { projectId } = req.params;
            const { action, modifiedContent } = req.body;

            if (!action) {
                return res.status(400).json({
                    error: 'Missing required field: action',
                });
            }

            const session = await getOrRestoreSession(projectId);

            if (!session) {
                return res.status(404).json({
                    error: 'Session not found',
                });
            }

            // Get state manager
            const stateManager = session.getStateManager();
            if (!stateManager) {
                return res.status(500).json({
                    error: 'State manager not found',
                });
            }

            // Check current confirmation status from database
            const confirmationStatus = await stateManager.getConfirmationStatus();

            if (!confirmationStatus.required) {
                logger.warn(`API: POST /interactive/${projectId}/confirm - No confirmation required, but confirm endpoint called`);
                return res.json({
                    success: true,
                    message: 'No confirmation required',
                    alreadyCleared: true,
                });
            }

            logger.info(`API: POST /interactive/${projectId}/confirm - Confirming role ${confirmationStatus.role}, action: ${action}`);

            // Handle user action via session (for backward compatibility and message handling)
            session.handleUserAction({
                action,
                modifiedContent,
            });

            // Clear confirmation status in database
            await stateManager.clearConfirmationRequired();

            // Verify confirmation is cleared
            const verifyStatus = await stateManager.getConfirmationStatus();
            if (verifyStatus.required) {
                logger.error(`API: POST /interactive/${projectId}/confirm - Failed to clear confirmation status!`);
                return res.status(500).json({
                    error: 'Failed to clear confirmation status',
                });
            }

            logger.info(`API: POST /interactive/${projectId}/confirm - Confirmation cleared successfully for role ${confirmationStatus.role}`);

            return res.json({
                success: true,
                message: 'Confirmation processed successfully',
                role: confirmationStatus.role,
                action,
            });
        } catch (error: any) {
            logger.error('API: Error processing confirmation', error);
            return res.status(500).json({
                error: error.message || 'Failed to process confirmation',
            });
        }
    }

    /**
     * Reset workflow from a specific role (reset that role and all downstream roles)
     */
    static async resetWorkflow(req: Request, res: Response) {
        try {
            const { projectId } = req.params;
            const { role } = req.body;

            if (!role) {
                return res.status(400).json({
                    error: 'Missing required field: role',
                });
            }

            const session = sessionManager.getSession(projectId);

            if (!session) {
                return res.status(404).json({
                    error: 'Session not found',
                });
            }

            // Stop workflow executor if it's running
            session.stopWorkflowExecutor();

            // Get state manager from session
            const stateManager = session.getStateManager();
            if (!stateManager) {
                return res.status(500).json({
                    error: 'State manager not found',
                });
            }

            // Reset workflow using StateManager
            await stateManager.resetWorkflow(role);

            // Check reset result - verify first action is set to RUNNING
            const runningState = await stateManager.getRunningState();
            const firstActionStatus = runningState.action && runningState.role
                ? await stateManager.getActionStatus(runningState.role!, runningState.action)
                : null;

            logger.info(`API: Reset workflow from role ${role} for project ${projectId}`, {
                projectId,
                role,
                resetRole: runningState.role,
                resetAction: runningState.action,
                actionStatus: firstActionStatus,
            });

            // Restart executor if first action is RUNNING
            // getActionStatus returns ActionStatus enum, compare with ActionStatus.RUNNING
            const { ActionStatus } = await import('@mind2build/shared');
            if (runningState.role && runningState.action && firstActionStatus === ActionStatus.RUNNING) {
                logger.info(`API: Restarting executor after reset for role ${runningState.role}, action ${runningState.action}`, {
                    projectId,
                    role: runningState.role,
                    action: runningState.action,
                });
                
                // Restart executor asynchronously (don't block API response)
                session.restartExecutor().catch((error: any) => {
                    logger.error(`API: Failed to restart executor after reset for project ${projectId}`, {
                        projectId,
                        role: runningState.role,
                        action: runningState.action,
                        error: error.message,
                    });
                });
            } else {
                logger.warn(`API: Not restarting executor after reset - invalid state`, {
                    projectId,
                    role: runningState.role,
                    action: runningState.action,
                    actionStatus: firstActionStatus,
                });
            }

            return res.json({
                success: true,
                message: `Workflow reset from role ${role} and all downstream roles`,
            });
        } catch (error: any) {
            logger.error('API: Error resetting workflow', error);
            return res.status(500).json({
                error: error.message || 'Failed to reset workflow',
            });
        }
    }

    /**
     * Recover from stale or failed actions
     * Automatically detects and resets stale/failed actions to allow workflow continuation
     */
    static async recoverFromStaleActions(req: Request, res: Response) {
        try {
            const { projectId } = req.params;
            const session = await getOrRestoreSession(projectId);

            if (!session) {
                return res.status(404).json({
                    success: false,
                    error: 'Session not found',
                });
            }

            const stateManager = session.getStateManager();
            const workflowItems = await stateManager.getWorkflowItems();

            // Detect stale actions (RUNNING for too long)
            const STALE_THRESHOLD_MS = process.env.STALE_ACTION_THRESHOLD_MINUTES
                ? parseInt(process.env.STALE_ACTION_THRESHOLD_MINUTES, 10) * 60 * 1000
                : 5 * 60 * 1000; // Default 5 minutes
            const now = Date.now();
            const runningState = await stateManager.getRunningStateWithTimestamp();

            let recoveredActions: Array<{ role: string; action: string; reason: string }> = [];

            // Check if current running action is stale
            if (runningState.role && runningState.action && runningState.updatedAt) {
                const runningDuration = now - runningState.updatedAt.getTime();
                if (runningDuration > STALE_THRESHOLD_MS) {
                    const { ActionStatus } = await import('@mind2build/shared');
                    await stateManager.setActionStatus(
                        runningState.role,
                        runningState.action,
                        ActionStatus.FAILED
                    );
                    await stateManager.clearRunningState();
                    recoveredActions.push({
                        role: runningState.role,
                        action: runningState.action,
                        reason: 'stale_running',
                    });
                }
            }

            // Check for failed actions that can be retried
            const { ActionStatus } = await import('@mind2build/shared');
            const failedItems = workflowItems.filter(item => item.status === ActionStatus.FAILED);
            for (const item of failedItems) {
                const retryCount = item.retry_count || 0;
                if (retryCount < 3) {
                    // Reset to PENDING to allow retry
                    await stateManager.setActionStatus(item.role, item.action, ActionStatus.PENDING);
                    recoveredActions.push({
                        role: item.role,
                        action: item.action,
                        reason: 'failed_retry',
                    });
                }
            }

            // Restart executor if session was stopped and actions were recovered
            if (recoveredActions.length > 0) {
                try {
                    await session.start();
                } catch (error: any) {
                    logger.warn('API: Failed to restart session after recovery', { error: error.message });
                }
            }

            return res.json({
                success: true,
                recoveredActions,
                message: recoveredActions.length > 0
                    ? `已恢复 ${recoveredActions.length} 个异常操作`
                    : '未发现需要恢复的操作',
            });
        } catch (error: any) {
            logger.error('API: Error recovering from stale actions', error);
            return res.status(500).json({
                success: false,
                error: error.message || 'Failed to recover from stale actions',
            });
        }
    }

    /**
     * Download workspace code (full ainative-workspace directory)
     * GET /api/interactive/:projectId/download/code
     */
    static async downloadCode(req: Request, res: Response) {
        try {
            const { projectId } = req.params;

            // Get project to find applicationId
            const { ProjectRepository } = await import('../../database/repositories/ProjectRepository');
            const projectRepo = new ProjectRepository();
            const project = await projectRepo.findById(projectId);

            if (!project) {
                return res.status(404).json({
                    error: 'Project not found',
                });
            }

            if (!project.application_id) {
                return res.status(400).json({
                    error: 'Project does not have an associated application',
                });
            }

            const { WorkspaceManager } = await import('../../utils/WorkspaceManager');
            const { createZipFromDirectory } = await import('../../utils/zipUtils');
            const path = await import('path');
            const fs = await import('fs');

            // Get workspace path
            const workspacePath = WorkspaceManager.getProjectWorkspacePath({
                applicationId: project.application_id,
                projectId: projectId,
            });

            // Check if workspace exists
            if (!fs.existsSync(workspacePath)) {
                return res.status(404).json({
                    error: 'Workspace not found',
                    message: '工作区目录不存在，可能还未生成代码',
                });
            }

            // Create temp directory for zip
            const tempDir = path.join(process.cwd(), 'temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            // Generate zip file with clean filename
            // Format: 项目名称-全部代码-YYYYMMDD-HHMMSS.zip
            const now = new Date();
            const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
            const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
            const safeProjectName = (project.name || 'project').replace(/[<>:"/\\|?*\s]/g, '_').slice(0, 50);
            const zipFileName = `${safeProjectName}-全部代码-${dateStr}-${timeStr}.zip`;
            const zipPath = path.join(tempDir, zipFileName);

            await createZipFromDirectory(workspacePath, zipPath, { includeRoot: true });

            // Send file
            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(zipFileName)}`);

            const fileStream = fs.createReadStream(zipPath);
            fileStream.pipe(res);

            // Clean up zip file after sending (with delay to ensure stream completes)
            fileStream.on('close', () => {
                setTimeout(() => {
                    try {
                        fs.unlinkSync(zipPath);
                    } catch (e) {
                        // Ignore cleanup errors
                    }
                }, 5000);
            });

            logger.info(`API: Downloaded workspace code for project ${projectId}`, {
                projectId,
                applicationId: project.application_id,
                zipPath,
            });
        } catch (error: any) {
            logger.error('API: Error downloading workspace code', error);
            return res.status(500).json({
                error: error.message || 'Failed to download workspace code',
            });
        }
    }

    /**
     * Download workspace docs (docs and openspec directories)
     * GET /api/interactive/:projectId/download/docs
     */
    static async downloadDocs(req: Request, res: Response) {
        try {
            const { projectId } = req.params;

            // Get project to find applicationId
            const { ProjectRepository } = await import('../../database/repositories/ProjectRepository');
            const projectRepo = new ProjectRepository();
            const project = await projectRepo.findById(projectId);

            if (!project) {
                return res.status(404).json({
                    error: 'Project not found',
                });
            }

            if (!project.application_id) {
                return res.status(400).json({
                    error: 'Project does not have an associated application',
                });
            }

            const { WorkspaceManager } = await import('../../utils/WorkspaceManager');
            const path = await import('path');
            const fs = await import('fs');
            const archiver = (await import('archiver')).default;

            // Get workspace path
            const workspacePath = WorkspaceManager.getProjectWorkspacePath({
                applicationId: project.application_id,
                projectId: projectId,
            });

            // Check if workspace exists
            if (!fs.existsSync(workspacePath)) {
                return res.status(404).json({
                    error: 'Workspace not found',
                    message: '工作区目录不存在，可能还未生成文档',
                });
            }

            const docsPath = path.join(workspacePath, 'docs');
            const openspecPath = path.join(workspacePath, 'openspec');

            // Check if at least one directory exists
            const docsExists = fs.existsSync(docsPath);
            const openspecExists = fs.existsSync(openspecPath);

            if (!docsExists && !openspecExists) {
                return res.status(404).json({
                    error: 'No documents found',
                    message: 'docs 和 openspec 目录均不存在',
                });
            }

            // Create temp directory for zip
            const tempDir = path.join(process.cwd(), 'temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            // Generate zip file with clean filename
            // Format: 项目名称-文档-YYYYMMDD-HHMMSS.zip
            const now = new Date();
            const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
            const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
            const safeProjectName = (project.name || 'project').replace(/[<>:"/\\|?*\s]/g, '_').slice(0, 50);
            const zipFileName = `${safeProjectName}-文档-${dateStr}-${timeStr}.zip`;
            const zipPath = path.join(tempDir, zipFileName);

            // Create zip with both directories
            await new Promise<void>((resolve, reject) => {
                const output = fs.createWriteStream(zipPath);
                const archive = archiver('zip', {
                    zlib: { level: 9 },
                });

                output.on('close', () => {
                    resolve();
                });

                archive.on('error', (err: Error) => {
                    reject(err);
                });

                archive.pipe(output);

                // Add docs directory if exists
                if (docsExists) {
                    archive.directory(docsPath, 'docs');
                }

                // Add openspec directory if exists
                if (openspecExists) {
                    archive.directory(openspecPath, 'openspec');
                }

                archive.finalize();
            });

            // Send file
            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(zipFileName)}`);

            const fileStream = fs.createReadStream(zipPath);
            fileStream.pipe(res);

            // Clean up zip file after sending (with delay to ensure stream completes)
            fileStream.on('close', () => {
                setTimeout(() => {
                    try {
                        fs.unlinkSync(zipPath);
                    } catch (e) {
                        // Ignore cleanup errors
                    }
                }, 5000);
            });

            logger.info(`API: Downloaded workspace docs for project ${projectId}`, {
                projectId,
                applicationId: project.application_id,
                docsExists,
                openspecExists,
                zipPath,
            });
        } catch (error: any) {
            logger.error('API: Error downloading workspace docs', error);
            return res.status(500).json({
                error: error.message || 'Failed to download workspace docs',
            });
        }
    }

    /**
     * Get session info
     */
    static async getSession(req: Request, res: Response) {
        try {
            const { projectId } = req.params;
            const session = await getOrRestoreSession(projectId);

            if (!session) {
                return res.status(404).json({
                    error: 'Session not found',
                });
            }

            return res.json({
                session: session.getInfo(),
            });
        } catch (error: any) {
            logger.error('API: Error getting session info', error);
            return res.status(500).json({
                error: error.message || 'Failed to get session info',
            });
        }
    }

    /**
     * Delete session
     */
    static async delete(req: Request, res: Response) {
        try {
            const { projectId } = req.params;
            const removed = sessionManager.removeSession(projectId);

            if (!removed) {
                return res.status(404).json({
                    error: 'Session not found',
                });
            }

            return res.json({
                message: 'Session deleted successfully',
            });
        } catch (error: any) {
            logger.error('API: Error deleting session', error);
            return res.status(500).json({
                error: error.message || 'Failed to delete session',
            });
        }
    }
}

