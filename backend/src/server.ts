/**
 * Express server entry point
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import http from 'http';
import { config, logger } from './utils';
import { connectDatabase } from './database';
import apiRoutes from './api/routes';
import { llmManager } from './providers/llm/LLMManager';

const app: express.Application = express();
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
  
  // Connect to database first
  connectDatabase()
    .then(async () => {
      // Initialize LLM Manager with configuration from database
      await llmManager.initialize();
      
      const llmConfig = llmManager.getCurrentConfigInfo();
      
      server.listen(port, () => {
        logger.info(`Mind2Build backend server listening on port ${port}`);
        logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
        logger.info(`LLM Provider: ${llmConfig?.provider} (${llmConfig?.model})`);
      });
    })
    .catch((error) => {
      logger.error('Failed to connect to database:', error);
      process.exit(1);
    });
  
  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
  });
  
  process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
  });
}

export default app;

