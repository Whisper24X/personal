/**
 * Interactive Session API Routes
 */

import { Router } from 'express';
import { sessionManager } from '../../orchestration/InteractiveSessionManager';
import { logger } from '../../utils';

const router = Router();

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
    
    res.json({
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
    res.status(500).json({
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
    
    res.json({
      session: session.getInfo(),
    });
  } catch (error: any) {
    logger.error('API: Error getting session info', error);
    res.status(500).json({
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
    
    res.json({
      message: 'Session deleted successfully',
    });
  } catch (error: any) {
    logger.error('API: Error deleting session', error);
    res.status(500).json({
      error: error.message || 'Failed to delete session',
    });
  }
});

/**
 * Get manager stats
 */
router.get('/interactive-stats', async (req, res) => {
  try {
    const stats = sessionManager.getStats();
    
    res.json({
      stats,
    });
  } catch (error: any) {
    logger.error('API: Error getting stats', error);
    res.status(500).json({
      error: error.message || 'Failed to get stats',
    });
  }
});

export default router;

