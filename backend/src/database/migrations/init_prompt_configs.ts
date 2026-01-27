/**
 * Initialize Prompt Configs from Source Files
 * Reads existing prompt constants and writes to database
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { PromptConfigRepository } from '../repositories/PromptConfigRepository';
import { connectDatabase, disconnectDatabase, query } from '../client';
import { logger } from '../../utils';

// Import all prompt constants
import {
  MRD_SYSTEM_PROMPT,
  MRD_TEMPLATE,
  MRD_REVIEW_SYSTEM_PROMPT,
} from '../../prompts/mrd';

import {
  PRD_SYSTEM_PROMPT,
  PRD_TEMPLATE,
  PRD_REVIEW_SYSTEM_PROMPT,
} from '../../prompts/prd';

import {
  DESIGN_SYSTEM_PROMPT,
  DESIGN_TEMPLATE,
} from '../../prompts/design';

import {
  CODE_SYSTEM_PROMPT,
  CODE_COMPLETENESS_CHECK_SYSTEM_PROMPT,
} from '../../prompts/code';

import {
  TEST_SYSTEM_PROMPT,
} from '../../prompts/test';

import {
  TASK_BREAKDOWN_SYSTEM_PROMPT,
  TASK_BREAKDOWN_TEMPLATE,
} from '../../prompts/task';

// Load .env file from project root
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001';

interface PromptConfig {
  promptType: 'mrd' | 'prd' | 'design' | 'code' | 'test' | 'task';
  promptKey: string;
  content: string;
  description: string;
}

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

async function initPromptConfigs() {
  try {
    await connectDatabase();
    logger.info('🔄 Initializing prompt configs from source files...');

    // Ensure default user exists before inserting prompts
    const actualUserId = await ensureDefaultUser();

    const promptConfigRepo = new PromptConfigRepository();

    // Define all prompt configurations
    const configs: PromptConfig[] = [
      // MRD prompts
      {
        promptType: 'mrd',
        promptKey: 'system_prompt',
        content: MRD_SYSTEM_PROMPT,
        description: '市场研究文档系统提示词',
      },
      {
        promptType: 'mrd',
        promptKey: 'template',
        content: MRD_TEMPLATE,
        description: '市场研究文档模板',
      },
      {
        promptType: 'mrd',
        promptKey: 'review_system_prompt',
        content: MRD_REVIEW_SYSTEM_PROMPT,
        description: '市场研究文档审查系统提示词',
      },
      // PRD prompts
      {
        promptType: 'prd',
        promptKey: 'system_prompt',
        content: PRD_SYSTEM_PROMPT,
        description: '产品需求文档系统提示词',
      },
      {
        promptType: 'prd',
        promptKey: 'template',
        content: PRD_TEMPLATE,
        description: '产品需求文档模板',
      },
      {
        promptType: 'prd',
        promptKey: 'review_system_prompt',
        content: PRD_REVIEW_SYSTEM_PROMPT,
        description: '产品需求文档审查系统提示词',
      },
      // Design prompts
      {
        promptType: 'design',
        promptKey: 'system_prompt',
        content: DESIGN_SYSTEM_PROMPT,
        description: '系统设计文档系统提示词',
      },
      {
        promptType: 'design',
        promptKey: 'template',
        content: DESIGN_TEMPLATE,
        description: '系统设计文档模板',
      },
      // Code prompts
      {
        promptType: 'code',
        promptKey: 'system_prompt',
        content: CODE_SYSTEM_PROMPT,
        description: '代码生成系统提示词',
      },
      {
        promptType: 'code',
        promptKey: 'completeness_check_system_prompt',
        content: CODE_COMPLETENESS_CHECK_SYSTEM_PROMPT,
        description: '代码完整性检测系统提示词',
      },
      // Test prompts
      {
        promptType: 'test',
        promptKey: 'system_prompt',
        content: TEST_SYSTEM_PROMPT,
        description: '测试用例系统提示词',
      },
      // Task prompts
      {
        promptType: 'task',
        promptKey: 'system_prompt',
        content: TASK_BREAKDOWN_SYSTEM_PROMPT,
        description: '任务拆分系统提示词',
      },
      {
        promptType: 'task',
        promptKey: 'template',
        content: TASK_BREAKDOWN_TEMPLATE,
        description: '任务拆分文档模板',
      },
    ];

    let createdCount = 0;
    let updatedCount = 0;

    // Process each prompt configuration
    for (const config of configs) {
      try {
        const savedConfig = await promptConfigRepo.upsert({
          userId: actualUserId,
          promptType: config.promptType,
          promptKey: config.promptKey,
          content: config.content,
          description: config.description,
          isActive: true,
        });

        logger.info(`   ✅ ${config.promptType}/${config.promptKey}: ${savedConfig.id}`);
        
        // Check if it was an update or create by comparing timestamps
        const timeDiff = savedConfig.updated_at.getTime() - savedConfig.created_at.getTime();
        if (timeDiff < 1000) { // Created within 1 second (new record)
          createdCount++;
        } else {
          updatedCount++;
        }
      } catch (error: any) {
        logger.error(`   ❌ Failed to save ${config.promptType}/${config.promptKey}:`, error.message);
      }
    }

    logger.info(`✅ Prompt configs initialization completed!`);
    logger.info(`   Created: ${createdCount}, Updated: ${updatedCount}`);
    logger.info(`   Total prompts: ${configs.length}`);

    await disconnectDatabase();
    process.exit(0);
  } catch (error: any) {
    logger.error('❌ Failed to initialize prompt configs:', error);
    await disconnectDatabase();
    process.exit(1);
  }
}

initPromptConfigs();

