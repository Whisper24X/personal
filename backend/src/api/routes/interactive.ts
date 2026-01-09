/**
 * Interactive Session API Routes
 */

import { Router } from 'express';
import { sessionManager } from '../../orchestration/InteractiveSessionManager';
import { logger } from '../../utils';
import { InteractiveSession } from '../../orchestration/InteractiveSession';

const router: Router = Router();

/**
 * Helper function to get or restore session from database
 * If session doesn't exist in memory, tries to restore it from database
 */
async function getOrRestoreSession(projectId: string): Promise<InteractiveSession | null> {
  let session = sessionManager.getSession(projectId);

  // If session exists, return it
  if (session) {
    return session;
  }

  // Try to restore from database
  logger.info(`API: Session not found in memory for project ${projectId}, attempting to restore from database`);

  try {
    const { ProjectRepository } = await import('../../database/repositories/ProjectRepository');
    const projectRepo = new ProjectRepository();
    const project = await projectRepo.findById(projectId);

    if (!project) {
      logger.warn(`API: Project ${projectId} not found in database`);
      return null;
    }

    // Restore session from project data
    const DEFAULT_USER_ID = '302769d6-247d-43db-a005-0519712255fb';
    const userId = project.user_id || DEFAULT_USER_ID;

    logger.info(`API: Restoring session for project ${projectId} from database`);
    session = sessionManager.createSession({
      name: project.name,
      idea: project.idea,
      description: project.description || '',
      investment: parseFloat(project.investment?.toString() || '10.0'),
      nRound: project.n_round || 5,
      userId,
      applicationId: project.application_id || undefined,
      projectId: project.id,
    });

    logger.info(`API: Successfully restored session for project ${projectId}`);
    return session;
  } catch (error: any) {
    logger.error(`API: Failed to restore session for project ${projectId}`, {
      error: error.message,
      errorStack: error.stack,
    });
    return null;
  }
}

/**
 * List all interactive sessions
 */
router.get('/interactive', async (_req, res) => {
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
});

/**
 * Create a new interactive session
 */
router.post('/interactive', async (req, res) => {
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
    const DEFAULT_USER_ID = '302769d6-247d-43db-a005-0519712255fb';
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

    // Workflow state is now managed by projectId directly, no migration needed

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
});

/**
 * Get manager stats
 */
router.get('/interactive-stats', async (_req, res) => {
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
});

/**
 * Poll for new messages (for polling mechanism)
 * GET /api/interactive/:projectId/poll?lastMessageId=xxx
 */
router.get('/interactive/:projectId/poll', async (req, res) => {
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
});

/**
 * Send user action (for polling mechanism)
 * POST /api/interactive/:projectId/action
 */
router.post('/interactive/:projectId/action', async (req, res) => {
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
});

/**
 * Get workflow information (all roles and their actions)
 * GET /api/interactive/:projectId/workflow
 * Returns complete state including all roles, actions, their statuses, and current running state
 */
router.get('/interactive/:projectId/workflow', async (req, res) => {
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
});

/**
 * Get current running role and action
 * GET /api/interactive/:projectId/running
 * Returns complete state including current running state and all workflow items with their statuses
 * If manual confirmation is required, returns confirmation status and blocks workflow execution
 */
router.get('/interactive/:projectId/running', async (req, res) => {
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

    // Get workflow structure
    const workflowInfo = session.getWorkflowInfo();

    // Get confirmation status from database via workflowTracker
    const confirmationStatus = workflowTracker ? await workflowTracker.isConfirmationRequired() : { required: false, role: null };
    const requiresConfirmation = confirmationStatus.required || false;
    const confirmationRole = confirmationStatus.role;

    // Check if session is paused (waiting for manual confirmation)
    const sessionInfo = session.getInfo();
    const isPaused = sessionInfo.isPaused || false;

    // Get confirmation details from message queue if paused or confirmation required
    let confirmationRequired = null;
    if (isPaused || requiresConfirmation) {
      // Find the latest confirmation_required message from message queue
      const allMessages = session.getMessagesSince(null);
      const confirmationMessage = allMessages
        .slice()
        .reverse()
        .find((msg: any) => msg.type === 'confirmation_required');

      if (confirmationMessage && confirmationMessage.data) {
        confirmationRequired = {
          role: confirmationMessage.data.role,
          action: confirmationMessage.data.action,
          content: confirmationMessage.data.content,
          outputFiles: confirmationMessage.data.outputFiles || [],
          instructContent: confirmationMessage.data.instructContent,
        };
      } else if (confirmationRole) {
        // Fallback: use confirmation role from database if confirmation message not found
        confirmationRequired = {
          role: confirmationRole,
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
    }

    const response = {
      success: true,
      role: runningInfo.role,
      action: runningInfo.action,
      running: runningInfo, // Current running role and action
      items: workflowItems, // All workflow items with their statuses (role, action, status)
      roles: workflowInfo.roles, // Workflow structure (all roles and their actions)
      // Add confirmation status from database
      requiresConfirmation: requiresConfirmation, // Whether confirmation is required (from database)
      confirmationRole: confirmationRole, // Role waiting for confirmation (from database)
      isPaused: isPaused, // Whether workflow is paused waiting for confirmation (from session)
      confirmationRequired: confirmationRequired, // Details of what needs confirmation (null if not paused)
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
});

/**
 * Confirm role completion and allow proceeding to next role
 * POST /api/interactive/:projectId/confirm
 * This endpoint clears the confirmation status in database, allowing workflow to proceed
 */
router.post('/interactive/:projectId/confirm', async (req, res) => {
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
});

/**
 * Reset workflow from a specific role (reset that role and all downstream roles)
 * POST /api/interactive/:projectId/reset-workflow
 */
router.post('/interactive/:projectId/reset-workflow', async (req, res) => {
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
});

/**
 * Get session info
 */
router.get('/interactive/:projectId', async (req, res) => {
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
});

/**
 * Delete session
 */
router.delete('/interactive/:projectId', async (req, res) => {
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
});

export default router;

