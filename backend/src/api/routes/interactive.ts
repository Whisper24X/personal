/**
 * Interactive Session API Routes
 */

import { Router } from 'express';
import { sessionManager } from '../../orchestration/InteractiveSessionManager';
import { logger } from '../../utils';

const router: Router = Router();

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
    
    // Get applicationId from project if projectId is provided
    let finalApplicationId = applicationId;
    if (finalProjectId && !finalApplicationId) {
      // Try to get applicationId from project
      try {
        const { ProjectRepository } = await import('../../database/repositories/ProjectRepository');
        const projectRepo = new ProjectRepository();
        const project = await projectRepo.findById(finalProjectId);
        if (project?.application_id) {
          finalApplicationId = project.application_id;
        }
      } catch (error: any) {
        logger.warn('API: Failed to get applicationId from project', { error: error.message });
      }
    }
    
    // Create session
    const session = sessionManager.createSession({
      name,
      idea,
      description,
      investment: investment || 10.0,
      nRound: nRound || 5,
      userId,
      applicationId: finalApplicationId,
      projectId: finalProjectId,
    });
    
    logger.info(`API: Created interactive session ${session.id} for project ${finalProjectId}`);
    
    return res.json({
      sessionId: session.id,
      projectId: finalProjectId,
      config: {
        name,
        idea,
        description,
        investment: investment || 10.0,
        nRound: nRound || 5,
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
 * Get session info
 */
router.get('/interactive/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = sessionManager.getSession(sessionId);
    
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
router.delete('/interactive/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const removed = sessionManager.removeSession(sessionId);
    
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
 * GET /api/interactive/:sessionId/poll?lastMessageId=xxx
 */
router.get('/interactive/:sessionId/poll', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { lastMessageId } = req.query;
    
    const session = sessionManager.getSession(sessionId);
    
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
    logger.error('API: Error polling messages', error);
    return res.status(500).json({
      error: error.message || 'Failed to poll messages',
    });
  }
});

/**
 * Send user action (for polling mechanism)
 * POST /api/interactive/:sessionId/action
 */
router.post('/interactive/:sessionId/action', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { action, modifiedContent } = req.body;
    
    if (!action) {
      return res.status(400).json({
        error: 'Missing required field: action',
      });
    }

    const session = sessionManager.getSession(sessionId);
    
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

export default router;

