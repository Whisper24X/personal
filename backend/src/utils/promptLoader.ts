/**
 * Prompt Loader Utility
 * Loads prompts from database with fallback to default prompts
 */

import { PromptType } from '../database/repositories/PromptConfigRepository';
import { logger } from './logger';

const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001';

// Lazy load repository to avoid circular dependency
function getPromptConfigRepo() {
  const { PromptConfigRepository } = require('../database/repositories/PromptConfigRepository');
  return new PromptConfigRepository();
}

// Cache for prompt configs
const promptCache: Record<string, Record<string, string>> = {};
let cacheTime: number = 0;
const CACHE_TTL = 60000; // 1 minute cache

/**
 * Load prompt from database or return default
 */
export async function loadPrompt(
  userId: string | undefined,
  promptType: PromptType,
  promptKey: string,
  defaultPrompt: string
): Promise<string> {
  const actualUserId = userId || DEFAULT_USER_ID;
  // const cacheKey = `${actualUserId}:${promptType}:${promptKey}`; // Unused for now

  // Check cache first
  const now = Date.now();
  if (promptCache[promptType]?.[promptKey] && (now - cacheTime) < CACHE_TTL) {
    return promptCache[promptType][promptKey];
  }

  try {
    const promptConfigRepo = getPromptConfigRepo();
    const config = await promptConfigRepo.findByTypeAndKey(actualUserId, promptType, promptKey);
    
    if (config && config.is_active) {
      // Update cache
      if (!promptCache[promptType]) {
        promptCache[promptType] = {};
      }
      promptCache[promptType][promptKey] = config.content;
      cacheTime = now;
      
      logger.info(`Loaded prompt from database: ${promptType}/${promptKey}`);
      return config.content;
    }
  } catch (error: any) {
    // If database query fails, fall back to default prompt
    logger.warn(`Failed to load prompt from database, using default: ${error.message}`);
  }

  // Fallback to default prompt
  if (!promptCache[promptType]) {
    promptCache[promptType] = {};
  }
  promptCache[promptType][promptKey] = defaultPrompt;
  cacheTime = now;
  
  return defaultPrompt;
}

/**
 * Clear prompt cache (call this after updating prompts)
 */
export function clearPromptCache(): void {
  Object.keys(promptCache).forEach((key) => {
    delete promptCache[key];
  });
  cacheTime = 0;
}

/**
 * Clear prompt cache for specific type
 */
export function clearPromptCacheForType(promptType: PromptType): void {
  if (promptCache[promptType]) {
    delete promptCache[promptType];
  }
}

