/**
 * Configuration loader
 * Loads environment variables and provides typed config
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { IAppConfig, ILLMConfig, LLMProvider } from '@mind2build/shared';

// Load .env file from project root
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

/**
 * Load LLM configuration from environment
 */
function loadLLMConfig(): ILLMConfig {
  const provider = (process.env.LLM_PROVIDER || 'zhipuai') as LLMProvider;
  
  const configs: Record<LLMProvider, Partial<ILLMConfig>> = {
    zhipuai: {
      provider: 'zhipuai',
      apiKey: process.env.ZHIPUAI_API_KEY || '',
      baseURL: process.env.ZHIPUAI_BASE_URL,
      model: process.env.ZHIPUAI_MODEL || 'glm-4-flash',
    },
    openai: {
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY || '',
      baseURL: process.env.OPENAI_BASE_URL,
      model: process.env.OPENAI_MODEL || 'gpt-4-turbo',
    },
    anthropic: {
      provider: 'anthropic',
      apiKey: process.env.ANTHROPIC_API_KEY || '',
      model: process.env.ANTHROPIC_MODEL || 'claude-3-opus-20240229',
    },
    gemini: {
      provider: 'gemini',
      apiKey: process.env.GOOGLE_API_KEY || '',
      model: process.env.GOOGLE_MODEL || 'gemini-pro',
    },
    qianfan: {
      provider: 'qianfan',
      apiKey: process.env.QIANFAN_API_KEY || '',
      model: 'ERNIE-Bot',
    },
    dashscope: {
      provider: 'dashscope',
      apiKey: process.env.DASHSCOPE_API_KEY || '',
      model: 'qwen-turbo',
    },
    ollama: {
      provider: 'ollama',
      apiKey: '',
      baseURL: 'http://localhost:11434',
      model: 'llama2',
    },
  };
  
  const config = configs[provider];
  if (!config) {
    throw new Error(`Unsupported LLM provider: ${provider}`);
  }
  
  return {
    ...config,
    temperature: parseFloat(process.env.TEMPERATURE || '0.7'),
    maxTokens: parseInt(process.env.MAX_TOKENS || '8000'),
  } as ILLMConfig;
}

/**
 * Application configuration
 */
export const config: IAppConfig = {
  llm: loadLLMConfig(),
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

