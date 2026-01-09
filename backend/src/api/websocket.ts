/**
 * WebSocket Server Setup for Interactive Sessions
 */

import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { sessionManager } from '../orchestration/InteractiveSessionManager';
import { logger } from '../utils';
// import url from 'url'; // Unused

/**
 * Setup WebSocket server for interactive sessions
 */
export function setupWebSocketServer(wss: WebSocketServer): void {
  logger.info('WebSocket: Setting up server');

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const requestUrl = req.url || '';
    logger.info(`WebSocket: New connection attempt from ${req.headers.origin || 'unknown'}, URL: ${requestUrl}`);

    // Extract project ID from URL
    const projectId = extractProjectId(requestUrl);

    if (!projectId) {
      logger.warn(`WebSocket: Connection rejected - no project ID in URL: ${requestUrl}`);
      ws.close(1008, 'Project ID required');
      return;
    }

    logger.info(`WebSocket: Extracted project ID: ${projectId}`);

    // Get session
    const session = sessionManager.getSession(projectId);

    if (!session) {
      logger.warn(`WebSocket: Connection rejected - session for project ${projectId} not found`);
      ws.close(1008, `Session for project ${projectId} not found`);
      return;
    }

    logger.info(`WebSocket: Client connected to project ${projectId}`);

    // Attach WebSocket to session
    session.setWebSocket(ws);

    // Handle incoming messages
    ws.on('message', (data: Buffer) => {
      try {
        const messageStr = data.toString();
        logger.info(`WebSocket: Received message from client: ${messageStr}`);
        const message = JSON.parse(messageStr);
        logger.info(`WebSocket: Parsed message type: ${message.type}, action: ${message.action}`);
        handleClientMessage(session.projectId, message);
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
      logger.info(`WebSocket: Client disconnected from project ${projectId}`);
    });

    // Handle errors
    ws.on('error', (error) => {
      logger.error(`WebSocket: Error in session for project ${projectId}`, error);
    });

    // Start the session
    session.start().catch((error) => {
      logger.error(`WebSocket: Error starting session for project ${projectId}`, error);
      ws.send(JSON.stringify({
        type: 'error',
        data: { message: error.message || 'Session error' },
      }));
    });
  });

  logger.info('WebSocket: Server setup complete');
}

/**
 * Extract project ID from WebSocket URL
 */
function extractProjectId(urlString: string): string | null {
  try {
    // Remove query string if present
    const pathOnly = urlString.split('?')[0];
    const pathParts = pathOnly.split('/').filter(Boolean);

    logger.debug(`WebSocket: Parsing URL: ${urlString}, path parts:`, pathParts);

    // Expected URL format: /api/interactive/:projectId
    const interactiveIndex = pathParts.indexOf('interactive');
    if (interactiveIndex !== -1 && pathParts.length > interactiveIndex + 1) {
      const projectId = pathParts[interactiveIndex + 1];
      logger.debug(`WebSocket: Found project ID: ${projectId}`);
      return projectId;
    }

    logger.warn(`WebSocket: Could not find project ID in URL: ${urlString}`);
    return null;
  } catch (error) {
    logger.error('WebSocket: Error extracting project ID', error);
    return null;
  }
}

/**
 * Handle client message
 */
function handleClientMessage(projectId: string, message: any): void {
  logger.info(`WebSocket: Handling client message for project ${projectId}, type: ${message.type}`);

  const session = sessionManager.getSession(projectId);

  if (!session) {
    logger.warn(`WebSocket: Session for project ${projectId} not found for message`);
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
export function broadcastToAllSessions(_message: any): void {
  const sessions = sessionManager.getAllSessions();
  logger.info(`WebSocket: Broadcasting to ${sessions.length} sessions`);

  sessions.forEach(session => {
    try {
      // Send via session's WebSocket (handled internally)
      // This is a placeholder - actual implementation would be in InteractiveSession
    } catch (error: any) {
      logger.error(`WebSocket: Error broadcasting to project ${session.projectId}`, error);
    }
  });
}

export default setupWebSocketServer;

