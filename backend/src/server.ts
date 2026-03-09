/**
 * Express server entry point
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import http from 'http';
import { exec } from 'child_process';
import { promisify } from 'util';
import { config, logger } from './utils';
import { connectDatabase } from './database';
import apiRoutes from './api/routes';
import { llmManager } from './providers/llm/LLMManager';

const execAsync = promisify(exec);

const app: express.Application = express();
const port = config.server.port;

/**
 * 清理占用指定端口的进程
 * @param port 端口号
 */
async function killProcessOnPort(port: number): Promise<void> {
  try {
    // 查找占用端口的进程（macOS/Linux）
    const { stdout } = await execAsync(`lsof -ti:${port}`);
    const pids = stdout.trim().split('\n').filter(Boolean);

    if (pids.length > 0) {
      logger.info(`Found processes on port ${port}: ${pids.join(', ')}`);

      // 终止所有占用端口的进程
      for (const pid of pids) {
        try {
          await execAsync(`kill -9 ${pid}`);
          logger.info(`Killed process ${pid} on port ${port}`);
        } catch (error: any) {
          logger.warn(`Failed to kill process ${pid}: ${error.message}`);
        }
      }

      // 等待端口释放
      await new Promise((resolve) => setTimeout(resolve, 500));
      logger.info(`Port ${port} cleanup completed`);
    }
  } catch (error: any) {
    // 如果没有找到占用端口的进程，lsof 会返回错误，这是正常的
    if (error.code === 1 || error.message.includes('No such process')) {
      logger.debug(`No process found on port ${port}`);
    } else {
      logger.debug(`Port cleanup check error: ${error.message}`);
    }
  }
}

// Middleware
app.use(helmet());
// CORS configuration: In development, allow all localhost ports for flexibility
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // In development, allow all localhost origins
    if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
      callback(null, true);
      return;
    }
    // In production or when origin is specified, check against allowed origins
    const allowedOrigins = Array.isArray(config.server.cors.origin) ? config.server.cors.origin : [config.server.cors.origin];
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      logger.info(`CORS allowed origin: ${origin}, allowed: ${allowedOrigins.join(', ')}`);
    } else {
      logger.error(`CORS blocked origin: ${origin}, allowed: ${allowedOrigins.join(', ')}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
};
app.use(cors(corsOptions));
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

      // 清理占用端口的进程
      await killProcessOnPort(port);

      // 启动服务器，添加错误处理
      server
        .listen(port, () => {
          logger.info(`Mind2Build backend server listening on port ${port}`);
          logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
          logger.info(`LLM Provider: ${llmConfig?.provider} (${llmConfig?.model})`);
        })
        .on('error', (error: NodeJS.ErrnoException) => {
          if (error.code === 'EADDRINUSE') {
            logger.error(`Port ${port} is already in use. Please check if another process is using this port.`);
            logger.error(`You can manually kill the process using: lsof -ti:${port} | xargs kill -9`);
            process.exit(1);
          } else {
            logger.error(`Server failed to start: ${error.message}`);
            process.exit(1);
          }
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
