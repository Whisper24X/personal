/**
 * PM2 Ecosystem Configuration
 * PM2 process manager configuration for Mind2Build
 * 
 * Usage:
 *   ./scripts/pm2-start.sh                    # Start all apps (builds shared first, then uses pnpm dev:backend and pnpm dev:frontend)
 *   pm2 start ecosystem.config.js              # Start all apps directly (assumes shared is already built)
 *   pm2 start ecosystem.config.js --env development  # Start in development mode
 *   pm2 start ecosystem.config.js --only mind2build-backend  # Start only backend
 *   pm2 start ecosystem.config.js --only mind2build-frontend  # Start only frontend
 *   pm2 stop ecosystem.config.js               # Stop all apps
 *   pm2 restart ecosystem.config.js            # Restart all apps
 *   pm2 reload ecosystem.config.js             # Zero-downtime reload
 *   pm2 delete ecosystem.config.js             # Delete all apps
 *   pm2 logs                                   # View logs
 *   pm2 monit                                  # Monitor
 * 
 * Note: The shared build task is included but will exit after building.
 *       Use ./scripts/pm2-start.sh to ensure shared is built before starting services.
 */

module.exports = {
  apps: [
    {
      name: 'mind2build-backend',
      script: 'pnpm',
      args: 'dev:backend',
      cwd: process.cwd(),
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '1G',

      // Environment variables
      env: {
        NODE_ENV: 'development',
        BACKEND_PORT: 3000,
        FRONTEND_PORT: 5173,
        LOG_LEVEL: 'debug',
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
      name: 'log-cleanup',
      script: './scripts/log-manager.js',
      cwd: process.cwd(),
      instances: 1,
      exec_mode: 'fork',
      autorestart: false,
      cron_restart: '0 * * * *', // 每小时运行一次
      watch: false,
      
      // Logging configuration
      error_file: './logs/log-cleanup-error.log',
      out_file: './logs/log-cleanup-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      time: true,
      merge_logs: true,
    }
  ],
};

