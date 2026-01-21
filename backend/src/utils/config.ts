/**
 * Configuration loader
 * Loads environment variables and provides typed application config
 * 
 * Note: LLM configuration management is handled by LLMManager.
 * This file only provides the application configuration structure.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { IAppConfig } from '@mind2build/shared';

// Load .env file from project root
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

/**
 * Application configuration
 * 
 * Note: config.llm is a placeholder. Actual LLM configuration is managed
 * by LLMManager and loaded from database at runtime.
 * The placeholder values here are only used during initialization
 * before LLMManager is set up.
 */
export const config: IAppConfig = {
  // Placeholder LLM config - actual config is managed by LLMManager
  llm: {
    provider: 'zhipuai',
    apiKey: '',
    model: 'glm-4-flash',
    temperature: 0.7,
    maxTokens: 8000,
  },
  database: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:123456@127.0.0.1:5432/mind2build',
  },
  server: {
    port: parseInt(process.env.BACKEND_PORT || '3000'),
    cors: {
      origin: (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(','),
    },
  },
  workspace: {
    path: process.env.WORKSPACE_PATH || './workspace',
  },
  limits: {
    maxBudget: parseFloat(process.env.MAX_BUDGET || '10.0'),
    maxRetry: parseInt(process.env.MAX_RETRY || '3'),
    requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || '60') * 1000,
    maxTokens: parseInt(process.env.MAX_TOKENS || '8000'),
  },
  features: {
    enableBrowser: process.env.ENABLE_BROWSER === 'true',
    enableTerminal: process.env.ENABLE_TERMINAL === 'true',
    enableCodeExecution: process.env.ENABLE_CODE_EXECUTION === 'true',
  },
};

export default config;
