/**
 * WebSocket Server Setup for Interactive Sessions
 */

import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { sessionManager } from '../orchestration/InteractiveSessionManager';
import { logger } from '../utils';
import url from 'url';

/**
 * Setup WebSocket server for interactive sessions
 */
export function setupWebSocketServer(wss: WebSocketServer): void {
  logger.info('WebSocket: Setting up server');

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const requestUrl = req.url || '';
    logger.info(`WebSocket: New connection attempt from ${req.headers.origin || 'unknown'}, URL: ${requestUrl}`);

    // Extract session ID from URL
    const sessionId = extractSessionId(requestUrl);

    if (!sessionId) {
      logger.warn(`WebSocket: Connection rejected - no session ID in URL: ${requestUrl}`);
      ws.close(1008, 'Session ID required');
      return;
    }

    logger.info(`WebSocket: Extracted session ID: ${sessionId}`);

    // Get session
    const session = sessionManager.getSession(sessionId);

    if (!session) {
      logger.warn(`WebSocket: Connection rejected - session ${sessionId} not found`);
      ws.close(1008, `Session ${sessionId} not found`);
      return;
    }

    logger.info(`WebSocket: Client connected to session ${sessionId}`);

    // Attach WebSocket to session
    session.setWebSocket(ws);

    // Handle incoming messages
    ws.on('message', (data: Buffer) => {
      try {
        const messageStr = data.toString();
        logger.info(`WebSocket: Received message from client: ${messageStr}`);
        const message = JSON.parse(messageStr);
        logger.info(`WebSocket: Parsed message type: ${message.type}, action: ${message.action}`);
        handleClientMessage(session.id, message);
      } catch (error: any) {
        logger.error('WebSocket: Error parsing message', error);
        ws.send(JSON.stringify({
          type: 'error',
          data: { message: 'Invalid message format' },
        }));
      }
    });

    // Handle connection close
    ws.on('close', () => {
      logger.info(`WebSocket: Client disconnected from session ${sessionId}`);
    });

    // Handle errors
    ws.on('error', (error) => {
      logger.error(`WebSocket: Error in session ${sessionId}`, error);
    });

    // Start the session
    session.start().catch((error) => {
      logger.error(`WebSocket: Error starting session ${sessionId}`, error);
      ws.send(JSON.stringify({
        type: 'error',
        data: { message: error.message || 'Session error' },
      }));
    });
  });

  logger.info('WebSocket: Server setup complete');
}

/**
 * Extract session ID from WebSocket URL
 */
function extractSessionId(urlString: string): string | null {
  try {
    // Remove query string if present
    const pathOnly = urlString.split('?')[0];
    const pathParts = pathOnly.split('/').filter(Boolean);

    logger.debug(`WebSocket: Parsing URL: ${urlString}, path parts:`, pathParts);

    // Expected URL format: /api/interactive/:sessionId
    const interactiveIndex = pathParts.indexOf('interactive');
    if (interactiveIndex !== -1 && pathParts.length > interactiveIndex + 1) {
      const sessionId = pathParts[interactiveIndex + 1];
      logger.debug(`WebSocket: Found session ID: ${sessionId}`);
      return sessionId;
    }

    logger.warn(`WebSocket: Could not find session ID in URL: ${urlString}`);
    return null;
  } catch (error) {
    logger.error('WebSocket: Error extracting session ID', error);
    return null;
  }
}

/**
 * Handle client message
 */
function handleClientMessage(sessionId: string, message: any): void {
  logger.info(`WebSocket: Handling client message for session ${sessionId}, type: ${message.type}`);

  const session = sessionManager.getSession(sessionId);

  if (!session) {
    logger.warn(`WebSocket: Session ${sessionId} not found for message`);
    return;
  }

  switch (message.type) {
    case 'user_action':
      logger.info(`WebSocket: Calling session.handleUserAction with action: ${message.action}`);
      try {
        session.handleUserAction({
          action: message.action,
          modifiedContent: message.modifiedContent,
        });
        logger.info(`WebSocket: session.handleUserAction completed successfully`);
      } catch (error: any) {
        logger.error(`WebSocket: Error in session.handleUserAction:`, error);
        logger.error(`WebSocket: Error stack:`, error.stack);
      }
      break;

    case 'ping':
      // Update activity
      session.updateActivity();
      break;

    default:
      logger.warn(`WebSocket: Unknown message type: ${message.type}`);
  }
}

/**
 * Broadcast message to all sessions
 */
export function broadcastToAllSessions(message: any): void {
  const sessions = sessionManager.getAllSessions();
  logger.info(`WebSocket: Broadcasting to ${sessions.length} sessions`);

  sessions.forEach(session => {
    try {
      // Send via session's WebSocket (handled internally)
      // This is a placeholder - actual implementation would be in InteractiveSession
    } catch (error: any) {
      logger.error(`WebSocket: Error broadcasting to session ${session.id}`, error);
    }
  });
}

export default setupWebSocketServer;

