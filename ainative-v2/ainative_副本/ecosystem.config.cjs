const path = require('node:path')

const rootDir = __dirname
const backendDir = path.resolve(rootDir, 'backend')
const frontendDir = path.resolve(rootDir, 'frontend')

module.exports = {
  apps: [
    {
      name: 'ainative-backend-test',
      cwd: backendDir,
      script: path.resolve(backendDir, 'dist/main.js'),
      interpreter: 'node',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      time: true,
      env: {
        NODE_ENV: 'test',
      },
      env_test: {
        NODE_ENV: 'test',
      },
    },
    {
      name: 'ainative-frontend-test',
      cwd: frontendDir,
      script: path.resolve(frontendDir, 'node_modules/vite/bin/vite.js'),
      args: 'preview --host 0.0.0.0 --port 8000',
      interpreter: 'node',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      time: true,
      env: {
        NODE_ENV: 'test',
      },
      env_test: {
        NODE_ENV: 'test',
      },
    },
  ],
}
