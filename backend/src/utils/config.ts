/**
 * Configuration loader
 * Loads environment variables and provides typed config
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { IAppConfig, ILLMConfig, LLMProvider } from '@mind2build/shared';
import { LLMConfigRepository } from '../database';
import { logger } from './logger';

// Load .env file from project root
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// Cache for database config
let dbConfigCache: ILLMConfig | null = null;
let dbConfigCacheTime: number = 0;
const DB_CONFIG_CACHE_TTL = 60000; // 1 minute cache

/**
 * Load LLM configuration from environment
 * @deprecated This function is deprecated. LLM configuration should only be loaded from database.
 * This function is kept for backward compatibility but should not be used in new code.
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
    ark: {
      provider: 'ark',
      apiKey: process.env.ARK_API_KEY || '',
      baseURL: process.env.ARK_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3',
      model: process.env.ARK_MODEL || 'doubao-1-5-pro-32k-250115',
    },
    cursor: {
      provider: 'cursor',
      apiKey: process.env.CURSOR_API_KEY || '',
      model: 'auto',
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
 * Load LLM configuration from database only
 * This function only loads from database, no fallback to environment variables
 * @throws Error if no active LLM configuration is found in database
 */
export async function loadLLMConfigFromDB(userId?: string): Promise<ILLMConfig> {
  // Check cache first
  const now = Date.now();
  if (dbConfigCache && (now - dbConfigCacheTime) < DB_CONFIG_CACHE_TTL) {
    return dbConfigCache;
  }

  try {
    const llmConfigRepo = new LLMConfigRepository();
    const defaultUserId = userId || '302769d6-247d-43db-a005-0519712255fb';
    const dbConfig = await llmConfigRepo.findActive(defaultUserId);

    if (dbConfig) {
      const config = llmConfigRepo.toILLMConfig(dbConfig);
      // Update cache
      dbConfigCache = config;
      dbConfigCacheTime = now;
      return config;
    } else {
      // No active LLM configuration found in database
      throw new Error(`No active LLM configuration found in database for user ${defaultUserId}. Please configure LLM settings in the database.`);
    }
  } catch (error: any) {
    // Re-throw error if it's already our custom error
    if (error.message && error.message.includes('No active LLM configuration')) {
      throw error;
    }
    // If database query fails, throw error instead of falling back to environment variables
    throw new Error(`Failed to load LLM configuration from database: ${error.message}. Please ensure database is available and LLM configuration is set.`);
  }
}

/**
 * Clear LLM config cache (call this after updating config)
 */
export function clearLLMConfigCache(): void {
  dbConfigCache = null;
  dbConfigCacheTime = 0;
}

/**
 * Initialize default LLM configuration from database
 * This function should be called after database connection is established
 * It will update config.llm with the database configuration
 * @throws Error if no active LLM configuration is found in database
 */
export async function initializeDefaultLLMConfig(userId?: string): Promise<void> {
  try {
    const dbConfig = await loadLLMConfigFromDB(userId);
    // Update the config object with database configuration
    config.llm = dbConfig;
    logger.info(`Default LLM config initialized from database: ${dbConfig.provider}/${dbConfig.model}`);
  } catch (error: any) {
    // If initialization fails, throw error - no fallback to environment variables
    logger.error(`Failed to initialize LLM config from database: ${error.message}`);
    throw error;
  }
}

/**
 * Get current LLM configuration from database only
 * @throws Error if no active LLM configuration is found in database
 */
export async function getLLMConfig(userId?: string): Promise<ILLMConfig> {
  return await loadLLMConfigFromDB(userId);
}

/**
 * Application configuration
 * Note: config.llm will be initialized from database after database connection is established
 * The initial value is a placeholder and MUST be replaced by initializeDefaultLLMConfig()
 * See initializeDefaultLLMConfig() function
 */
export const config: IAppConfig = {
  // Placeholder config - will be replaced by initializeDefaultLLMConfig() from database
  // This is only used during initialization before database connection
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

