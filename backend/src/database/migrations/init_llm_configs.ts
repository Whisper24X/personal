/**
 * Initialize LLM Configs from Environment Variables
 * Reads existing .env configuration and writes to database
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { LLMConfigRepository, ProviderConfigRepository } from '../repositories';
import { connectDatabase, disconnectDatabase } from '../client';
import { logger } from '../../utils';
import { LLMProvider } from '@mind2build/shared';

// Load .env file from project root
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const DEFAULT_USER_ID = '302769d6-247d-43db-a005-0519712255fb';
const ACTIVE_PROVIDER = (process.env.LLM_PROVIDER || 'zhipuai') as LLMProvider;

interface ProviderConfig {
  provider: LLMProvider;
  apiKey?: string;
  baseURL?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

async function initLLMConfigs() {
  try {
    await connectDatabase();
    logger.info('🔄 Initializing LLM configs from environment variables...');

    const llmConfigRepo = new LLMConfigRepository();
    const providerConfigRepo = new ProviderConfigRepository();

    // Define all provider configurations from environment
    const configs: ProviderConfig[] = [
      {
        provider: 'zhipuai',
        apiKey: process.env.ZHIPUAI_API_KEY,
        baseURL: process.env.ZHIPUAI_BASE_URL,
        model: process.env.ZHIPUAI_MODEL || 'glm-4-flash',
      },
      {
        provider: 'openai',
        apiKey: process.env.OPENAI_API_KEY,
        baseURL: process.env.OPENAI_BASE_URL,
        model: process.env.OPENAI_MODEL || 'gpt-4-turbo',
      },
      {
        provider: 'anthropic',
        apiKey: process.env.ANTHROPIC_API_KEY,
        model: process.env.ANTHROPIC_MODEL || 'claude-3-opus-20240229',
      },
      {
        provider: 'gemini',
        apiKey: process.env.GOOGLE_API_KEY,
        model: process.env.GOOGLE_MODEL || 'gemini-pro',
      },
      {
        provider: 'qianfan',
        apiKey: process.env.QIANFAN_API_KEY,
        model: 'ERNIE-Bot',
      },
      {
        provider: 'dashscope',
        apiKey: process.env.DASHSCOPE_API_KEY,
        model: 'qwen-turbo',
      },
      {
        provider: 'ollama',
        apiKey: '', // Ollama doesn't need API key
        baseURL: 'http://localhost:11434',
        model: 'llama2',
      },
      {
        provider: 'ark',
        apiKey: process.env.ARK_API_KEY,
        baseURL: process.env.ARK_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3',
        model: process.env.ARK_MODEL || 'doubao-1-5-pro-32k-250115',
      },
    ];

    // Get temperature and maxTokens from environment
    const temperature = parseFloat(process.env.TEMPERATURE || '0.7');
    const maxTokens = parseInt(process.env.MAX_TOKENS || '8000');

    let activeConfigId: string | null = null;
    let createdCount = 0;
    let updatedCount = 0;

    // Process each provider configuration
    for (const config of configs) {
      // Skip if no API key (except for ollama which doesn't need one)
      if (!config.apiKey && config.provider !== 'ollama') {
        logger.info(`   ⏭️  Skipping ${config.provider}: no API key found`);
        continue;
      }

      try {
        const isActive = config.provider === ACTIVE_PROVIDER;
        
        // Step 1: Save provider config (API Key, Base URL, and Model) separately
        if (config.apiKey || config.baseURL || config.model || config.provider === 'ollama') {
          try {
            await providerConfigRepo.upsert({
              userId: DEFAULT_USER_ID,
              provider: config.provider,
              apiKey: config.apiKey || '',
              baseURL: config.baseURL,
              model: config.model,
            });
            logger.info(`   ✅ Provider config saved: ${config.provider}`);
          } catch (error: any) {
            logger.warn(`   ⚠️  Failed to save provider config for ${config.provider}:`, error.message);
          }
        }
        
        // Step 2: Save model config (Model, Temperature, Max Tokens)
        const savedConfig = await llmConfigRepo.upsert({
          userId: DEFAULT_USER_ID,
          provider: config.provider,
          model: config.model,
          temperature,
          maxTokens,
          isActive,
        });

        if (isActive) {
          activeConfigId = savedConfig.id;
        }

        logger.info(`   ✅ Model config saved: ${config.provider}/${config.model} (${isActive ? 'ACTIVE' : 'inactive'})`);
        
        // Check if it was an update or create by comparing timestamps
        const timeDiff = savedConfig.updated_at.getTime() - savedConfig.created_at.getTime();
        if (timeDiff < 1000) { // Created within 1 second (new record)
          createdCount++;
        } else {
          updatedCount++;
        }
      } catch (error: any) {
        logger.error(`   ❌ Failed to save ${config.provider}:`, error.message);
      }
    }

    // Ensure active provider is set correctly
    if (activeConfigId) {
      await llmConfigRepo.setActive(DEFAULT_USER_ID, activeConfigId);
      logger.info(`   ✅ Activated provider: ${ACTIVE_PROVIDER}`);
    }

    logger.info(`✅ LLM configs initialization completed!`);
    logger.info(`   Created: ${createdCount}, Updated: ${updatedCount}`);
    logger.info(`   Active provider: ${ACTIVE_PROVIDER}`);

    await disconnectDatabase();
    process.exit(0);
  } catch (error: any) {
    logger.error('❌ Failed to initialize LLM configs:', error);
    await disconnectDatabase();
    process.exit(1);
  }
}

initLLMConfigs();

