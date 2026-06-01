/**
 * Initialize LLM Configs from Environment Variables
 * Reads existing .env configuration and writes to database
 * 
 * Schema V2: Uses unified LLMConfigRepository
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { LLMConfigRepository } from '../repositories';
import { connectDatabase, disconnectDatabase, query } from '../client';
import { logger } from '../../utils';
import { LLMProvider } from '@mind2build/shared';

// Load .env file from project root
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001';
const ACTIVE_PROVIDER = (process.env.LLM_PROVIDER || 'zhipuai') as LLMProvider;

async function ensureDefaultUser(): Promise<string> {
  try {
    // Check if user exists
    const userResult = await query<{ id: string }>(
      'SELECT id FROM users WHERE id = $1',
      [DEFAULT_USER_ID]
    );

    if (userResult.rows.length === 0) {
      // Create default user if not exists
      // Using a simple password hash (in production, use proper bcrypt)
      // For initialization scripts, we use a placeholder hash
      const defaultPasswordHash = '$2b$10$placeholder.hash.for.default.user.initialization';
      
      try {
        await query(
          `INSERT INTO users (id, username, email, password_hash, full_name, status)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            DEFAULT_USER_ID,
            'default_user',
            'default@mind2build.com',
            defaultPasswordHash,
            'Default User',
            'active'
          ]
        );
        logger.info('   ✅ Default user created');
        return DEFAULT_USER_ID;
      } catch (insertError: any) {
        // If user already exists (by username or email), use the existing user id
        if (insertError.code === '23505') { // Unique violation
          const existingUser = await query<{ id: string }>(
            'SELECT id FROM users WHERE username = $1 OR email = $2 LIMIT 1',
            ['default_user', 'default@mind2build.com']
          );
          if (existingUser.rows.length > 0) {
            logger.info(`   ℹ️  Default user already exists with id: ${existingUser.rows[0].id}`);
            return existingUser.rows[0].id;
          }
        }
        throw insertError;
      }
    } else {
      logger.info('   ✅ Default user already exists');
      return DEFAULT_USER_ID;
    }
  } catch (error: any) {
    logger.warn(`   ⚠️  Failed to ensure default user: ${error.message}`);
    throw error;
  }
}

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

    // Ensure default user exists before inserting LLM configs
    const actualUserId = await ensureDefaultUser();

    const llmConfigRepo = new LLMConfigRepository();

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
      {
        provider: 'deepseek',
        apiKey: process.env.DEEPSEEK_API_KEY,
        baseURL: process.env.DEEPSEEK_BASE_URL || 'https://ops-ai-gateway.yc345.tv/v1',
        model: process.env.DEEPSEEK_MODEL || 'deepseek-v3-2',
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
        
        // Save provider config with model settings (Schema V2: unified table)
        const savedConfig = await llmConfigRepo.upsertProvider({
          userId: actualUserId,
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
      await llmConfigRepo.setActive(actualUserId, activeConfigId);
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

