/**
 * Express server entry point
 * Will be implemented in Phase 9
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import http from 'http';
import { WebSocketServer } from 'ws';
import { config, logger } from './utils';
import { connectDatabase } from './database';
import apiRoutes from './api/routes';
import { setupWebSocketServer } from './api/websocket';
import { sessionManager } from './orchestration/InteractiveSessionManager';

const app = express();
const port = config.server.port;

// Middleware
app.use(helmet());
app.use(cors({ origin: config.server.cors.origin }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'mind2build-backend' });
});

// Root endpoint
app.get('/', (_req, res) => {
  res.json({
    name: 'Mind2Build API',
    version: '1.0.0',
    status: 'production',
    message: 'Multi-Agent AI Collaboration Framework',
  });
});

// API routes
app.use('/api', apiRoutes);

// Error handling middleware
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// Start server
if (process.env.NODE_ENV !== 'test') {
  // Create HTTP server
  const server = http.createServer(app);
  
  // Setup WebSocket server
  // Note: We verify the path in verifyClient to ensure it matches /api/interactive/:sessionId
  const wss = new WebSocketServer({
    server,
    verifyClient: (info) => {
      // Only accept connections to /api/interactive/:sessionId
      const path = info.req.url || '';
      const isValid = path.startsWith('/api/interactive/') && path.split('/').length >= 4;
      if (!isValid) {
        logger.warn(`WebSocket: Connection rejected - invalid path: ${path}`);
      }
      return isValid;
    },
  });
  
  setupWebSocketServer(wss);
  
  // Connect to database first
  connectDatabase()
    .then(() => {
      server.listen(port, () => {
        logger.info(`Mind2Build backend server listening on port ${port}`);
        logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
        logger.info(`LLM Provider: ${config.llm.provider}`);
        logger.info(`WebSocket server ready at ws://localhost:${port}/api/interactive/:sessionId`);
      });
    })
    .catch((error) => {
      logger.error('Failed to connect to database:', error);
      process.exit(1);
    });
  
  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    sessionManager.shutdown();
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
  });
  
  process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    sessionManager.shutdown();
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
  });
}

export default app;

