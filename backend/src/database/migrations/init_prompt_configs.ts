/**
 * Initialize Prompt Configs from Source Files
 * Reads existing prompt constants and writes to database
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { PromptConfigRepository } from '../repositories/PromptConfigRepository';
import { connectDatabase, disconnectDatabase } from '../client';
import { logger } from '../../utils';

// Import all prompt constants
import {
  REQUIREMENT_SPEC_SYSTEM_PROMPT,
  REQUIREMENT_SPEC_TEMPLATE,
  REQUIREMENT_SPEC_REVIEW_SYSTEM_PROMPT,
} from '../../prompts/requirement';

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

const DEFAULT_USER_ID = '302769d6-247d-43db-a005-0519712255fb';

interface PromptConfig {
  promptType: 'requirement' | 'prd' | 'design' | 'code' | 'test' | 'task';
  promptKey: string;
  content: string;
  description: string;
}

async function initPromptConfigs() {
  try {
    await connectDatabase();
    logger.info('🔄 Initializing prompt configs from source files...');

    const promptConfigRepo = new PromptConfigRepository();

    // Define all prompt configurations
    const configs: PromptConfig[] = [
      // Requirement prompts
      {
        promptType: 'requirement',
        promptKey: 'system_prompt',
        content: REQUIREMENT_SPEC_SYSTEM_PROMPT,
        description: '需求说明文档系统提示词',
      },
      {
        promptType: 'requirement',
        promptKey: 'template',
        content: REQUIREMENT_SPEC_TEMPLATE,
        description: '需求说明文档模板',
      },
      {
        promptType: 'requirement',
        promptKey: 'review_system_prompt',
        content: REQUIREMENT_SPEC_REVIEW_SYSTEM_PROMPT,
        description: '需求说明文档审查系统提示词',
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
          userId: DEFAULT_USER_ID,
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

