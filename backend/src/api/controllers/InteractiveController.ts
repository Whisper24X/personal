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
            const { name, idea, description, investment, nRound, projectId, applicationId } = req.body;

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
                    nRound: nRound || 5,
                    applicationId,
                });

                finalProjectId = project.id;
                logger.info(`API: Created project ${finalProjectId} for interactive session`);
            }

            // Get applicationId and nRound from project if projectId is provided
            let finalApplicationId = applicationId;
            let finalNRound = nRound || 5;
            if (finalProjectId) {
                // Try to get project data to use as source of truth
                try {
                    const { ProjectRepository } = await import('../../database/repositories/ProjectRepository');
                    const projectRepo = new ProjectRepository();
                    const project = await projectRepo.findById(finalProjectId);
                    if (project) {
                        // Use project's nRound as source of truth if project exists
                        if (project.n_round !== undefined && project.n_round !== null) {
                            finalNRound = project.n_round;
                        }
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
                nRound: finalNRound,
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
                    nRound: finalNRound,
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

            // Get workflow tracker
            const workflowTracker = (session as any).workflowTracker;

            // Get all workflow items with their statuses
            const workflowItems = workflowTracker ? await workflowTracker.getWorkflowItems() : [];

            // Get current running state
            const runningState = workflowTracker ? await workflowTracker.getCurrentState() : { role: null, action: null };

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

            // Get workflow tracker
            const workflowTracker = (session as any).workflowTracker;

            // Get current running state
            const runningInfo = workflowTracker ? await workflowTracker.getCurrentState() : { role: null, action: null };

            // Get all workflow items with their statuses
            const workflowItems = workflowTracker ? await workflowTracker.getWorkflowItems() : [];

            // Get confirmation status from database via workflowTracker
            const confirmationStatus = workflowTracker ? await workflowTracker.isConfirmationRequired() : { required: false, role: null };
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
                    confirmationRequired = {
                        role: confirmationMessage.data.role,
                        action: confirmationMessage.data.action,
                        content: confirmationMessage.data.content,
                        outputFiles: confirmationMessage.data.outputFiles || [],
                        instructContent: confirmationMessage.data.instructContent,
                    };
                } else if (confirmationStatus.role) {
                    // Fallback: use confirmation role from database if confirmation message not found
                    confirmationRequired = {
                        role: confirmationStatus.role,
                        action: runningInfo.action,
                        content: null,
                        outputFiles: [],
                        instructContent: null,
                    };
                } else {
                    // Fallback: use running state if confirmation role not found
                    confirmationRequired = {
                        role: runningInfo.role,
                        action: runningInfo.action,
                        content: null,
                        outputFiles: [],
                        instructContent: null,
                    };
                }

                // Check if all workflow items are completed
                // If all workflow items are completed, clear confirmation
                const completedCount = workflowItems.filter((item: any) => item.status === 'completed').length;
                const totalCount = workflowItems.length;

                const allItemsCompleted = completedCount === totalCount && totalCount > 0;

                if (allItemsCompleted) {
                    confirmationRequired.role = '';
                    requiresConfirmation = false;
                }
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

            // Get workflow tracker
            const workflowTracker = (session as any).workflowTracker;
            if (!workflowTracker) {
                return res.status(500).json({
                    error: 'Workflow tracker not found',
                });
            }

            // Check current confirmation status from database
            const confirmationStatus = await workflowTracker.isConfirmationRequired();

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
            await workflowTracker.clearConfirmationRequired();

            // Verify confirmation is cleared
            const verifyStatus = await workflowTracker.isConfirmationRequired();
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

            // Get workflow tracker from session
            const workflowTracker = (session as any).workflowTracker;
            if (!workflowTracker) {
                return res.status(500).json({
                    error: 'Workflow tracker not found',
                });
            }

            // Get repository and reset workflow
            const repository = (workflowTracker as any).repository;
            await repository.resetWorkflowFromRole(projectId, role);

            // Clear running state if the reset role is currently running
            const currentState = await workflowTracker.getCurrentState();
            if (currentState.role === role) {
                await workflowTracker.clearState();
            }

            logger.info(`API: Reset workflow from role ${role} for project ${projectId}`);

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

