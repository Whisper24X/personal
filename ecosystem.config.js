/**
 * PM2 Ecosystem Configuration
 * PM2 process manager configuration for Mind2Build
 * 
 * Usage:
 *   pm2 start ecosystem.config.js              # Start all apps in production mode
 *   pm2 start ecosystem.config.js --env development  # Start in development mode
 *   pm2 start ecosystem.config.js --only mind2build-backend  # Start only backend
 *   pm2 start ecosystem.config.js --only mind2build-frontend  # Start only frontend
 *   pm2 stop ecosystem.config.js               # Stop all apps
 *   pm2 restart ecosystem.config.js            # Restart all apps
 *   pm2 reload ecosystem.config.js             # Zero-downtime reload
 *   pm2 delete ecosystem.config.js             # Delete all apps
 *   pm2 logs                                   # View logs
 *   pm2 monit                                  # Monitor
 */

module.exports = {
  apps: [
    {
      name: 'mind2build-backend',
      script: './backend/dist/server.js',
      cwd: process.cwd(),
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '1G',
      
      // Environment variables
      env: {
        NODE_ENV: 'production',
        BACKEND_PORT: 3000,
        FRONTEND_PORT: 5173,
        LOG_LEVEL: 'info',
      },
      env_development: {
        NODE_ENV: 'development',
        BACKEND_PORT: 3000,
        FRONTEND_PORT: 5173,
        LOG_LEVEL: 'debug',
      },
      env_production: {
        NODE_ENV: 'production',
        BACKEND_PORT: 3000,
        FRONTEND_PORT: 5173,
        LOG_LEVEL: 'info',
      },
      env_test: {
        NODE_ENV: 'test',
        BACKEND_PORT: 3000,
        LOG_LEVEL: 'error',
      },
      
      // Logging configuration
      error_file: './logs/pm2-backend-error.log',
      out_file: './logs/pm2-backend-out.log',
      log_file: './logs/pm2-backend-combined.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      time: true,
      merge_logs: true,
      
      // Restart strategy
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 4000,
      exp_backoff_restart_delay: 100,
      
      // Process management
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
      shutdown_with_message: true,
      
      // Advanced options
      instance_var: 'INSTANCE_ID',
      ignore_watch: [
        'node_modules',
        'logs',
        'dist',
        '.git',
        'workspace',
        'temp',
      ],
    },
    {
      name: 'mind2build-frontend',
      script: 'pnpm',
      args: '--filter @mind2build/frontend preview',
      cwd: process.cwd(),
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '500M',
      
      // Environment variables
      env: {
        NODE_ENV: 'production',
        PORT: 4173,
        BACKEND_URL: 'http://localhost:3000',
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 4173,
        BACKEND_URL: 'http://localhost:3000',
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 4173,
        BACKEND_URL: 'http://localhost:3000',
      },
      
      // Logging configuration
      error_file: './logs/pm2-frontend-error.log',
      out_file: './logs/pm2-frontend-out.log',
      log_file: './logs/pm2-frontend-combined.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      time: true,
      merge_logs: true,
      
      // Restart strategy
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 4000,
      exp_backoff_restart_delay: 100,
      
      // Process management
      kill_timeout: 3000,
      
      // Advanced options
      ignore_watch: [
        'node_modules',
        'logs',
        'dist',
        '.git',
        'backend',
        'workspace',
        'temp',
      ],
    },
  ],
};

