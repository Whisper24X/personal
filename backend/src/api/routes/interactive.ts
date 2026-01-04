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
    const { name, idea, description, investment, nRound } = req.body;
    
    // Validate required fields
    if (!name || !idea) {
      return res.status(400).json({
        error: 'Missing required fields: name, idea',
      });
    }
    
    // Create session
    const session = sessionManager.createSession({
      name,
      idea,
      description,
      investment: investment || 10.0,
      nRound: nRound || 5,
      userId: req.body.userId, // TODO: Get from auth middleware
    });
    
    logger.info(`API: Created interactive session ${session.id}`);
    
    return res.json({
      sessionId: session.id,
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

