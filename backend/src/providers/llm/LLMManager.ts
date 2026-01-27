/**
 * LLM Manager
 * 
 * Centralized singleton for all LLM-related operations.
 * Provides high cohesion by consolidating:
 * - Configuration loading and caching
 * - LLM instance creation and lifecycle management
 * - Hot-reload support for configuration changes
 * - Role-specific LLM management
 * 
 * This is the single source of truth for LLM management in the application.
 */

import { ILLMConfig, LLMProvider } from '@mind2build/shared';
import { BaseLLM } from './BaseLLM';
import { createLLM } from './factory';
import { LLMConfigRepository } from '../../database';
import { CostManager } from '../../core/context/CostManager';
import { logger } from '../../utils/logger';

// Default user ID for system-level operations
const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001';

// Configuration cache settings
const CONFIG_CACHE_TTL = 60000; // 1 minute

// Retry configuration (can be overridden via environment variables)
const DEFAULT_MAX_RETRY_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY_MS = 2000;
const DEFAULT_ENABLE_MODEL_FALLBACK = true;

export class LLMManager {
  private static instance: LLMManager;

  // ============================================
  // Configuration State
  // ============================================
  private configCache: ILLMConfig | null = null;
  private configCacheTime: number = 0;
  private currentUserId: string = DEFAULT_USER_ID;

  // ============================================
  // LLM Instance State
  // ============================================
  private defaultLLM: BaseLLM | null = null;
  private defaultLLMConfig: ILLMConfig | null = null;

  // ============================================
  // Role-specific LLM Cache
  // ============================================
  private roleLLMCache: Map<string, { llm: BaseLLM; config: ILLMConfig }> = new Map();

  // ============================================
  // Repositories
  // ============================================
  private llmConfigRepo = new LLMConfigRepository();

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): LLMManager {
    if (!LLMManager.instance) {
      LLMManager.instance = new LLMManager();
    }
    return LLMManager.instance;
  }

  // ============================================
  // Configuration Management
  // ============================================

  /**
   * Load active LLM configuration from database
   * Uses caching to reduce database queries
   */
  async loadConfig(userId?: string): Promise<ILLMConfig> {
    const targetUserId = userId || this.currentUserId;
    const now = Date.now();

    // Check cache (only if same user)
    if (
      this.configCache &&
      targetUserId === this.currentUserId &&
      now - this.configCacheTime < CONFIG_CACHE_TTL
    ) {
      return this.configCache;
    }

    try {
      const dbConfig = await this.llmConfigRepo.findActive(targetUserId);

      if (dbConfig) {
        const config = this.llmConfigRepo.toILLMConfig(dbConfig);
        // Update cache
        this.configCache = config;
        this.configCacheTime = now;
        this.currentUserId = targetUserId;
        return config;
      }

      throw new Error(
        `No active LLM configuration found in database for user ${targetUserId}. ` +
        `Please configure LLM settings in the database.`
      );
    } catch (error: any) {
      if (error.message?.includes('No active LLM configuration')) {
        throw error;
      }
      throw new Error(
        `Failed to load LLM configuration from database: ${error.message}. ` +
        `Please ensure database is available and LLM configuration is set.`
      );
    }
  }

  /**
   * Clear configuration cache
   * Call this when configuration is updated
   */
  clearConfigCache(): void {
    this.configCache = null;
    this.configCacheTime = 0;
    logger.debug('LLMManager: Configuration cache cleared');
  }

  /**
   * Get current configuration info (for display/logging)
   */
  getCurrentConfigInfo(): { provider: string; model: string } | null {
    if (this.defaultLLMConfig) {
      return {
        provider: this.defaultLLMConfig.provider,
        model: this.defaultLLMConfig.model,
      };
    }
    return null;
  }

  // ============================================
  // Default LLM Instance Management
  // ============================================

  /**
   * Get the default (system) LLM instance
   * Automatically creates or updates instance based on current configuration
   * 
   * @param costManager Optional cost manager to bind to the LLM
   */
  getDefaultLLM(costManager?: CostManager): BaseLLM {
    // Check if we need to rebuild (config changed)
    if (this.configCache && !this.isConfigEqual(this.defaultLLMConfig, this.configCache)) {
      this.rebuildDefaultLLM(this.configCache);
    }

    // Create if not exists (use cached config or placeholder)
    if (!this.defaultLLM) {
      if (this.configCache) {
        this.rebuildDefaultLLM(this.configCache);
      } else {
        // This shouldn't happen in normal operation
        // as initialize() should be called at startup
        logger.warn('LLMManager: No configuration available, using placeholder');
        this.rebuildDefaultLLM({
          provider: 'zhipuai',
          apiKey: '',
          model: 'glm-4-flash',
          temperature: 0.7,
          maxTokens: 8000,
        });
      }
    }

    // Bind cost manager if provided
    if (costManager) {
      this.defaultLLM!.costManager = costManager;
    }

    return this.defaultLLM!;
  }

  /**
   * Rebuild default LLM instance with new configuration
   */
  private rebuildDefaultLLM(config: ILLMConfig): void {
    this.defaultLLM = createLLM(config);
    this.defaultLLMConfig = { ...config };
    logger.info(`LLMManager: Default LLM instance created: ${config.provider}/${config.model}`);
  }

  /**
   * Force refresh the default LLM instance
   * Call this after configuration changes to ensure immediate effect
   */
  async refresh(userId?: string): Promise<void> {
    // Clear caches
    this.clearConfigCache();
    this.roleLLMCache.clear();

    // Reload configuration from database
    try {
      const config = await this.loadConfig(userId);
      // Rebuild default LLM
      this.rebuildDefaultLLM(config);
      logger.info(`LLMManager: Refreshed to ${config.provider}/${config.model}`);
    } catch (error: any) {
      logger.error(`LLMManager: Failed to refresh: ${error.message}`);
      throw error;
    }
  }

  // ============================================
  // Role-specific LLM Management
  // ============================================

  /**
   * Get LLM for a specific role
   * Priority:
   * 1. Role-specific configuration from database (cached)
   * 2. System default LLM (always uses latest config)
   * 
   * @param roleProfile Role profile name (e.g., "Salesperson", "Engineer")
   * @param userId User ID
   * @param costManager Cost manager to bind
   */
  async getRoleLLM(
    roleProfile: string,
    userId?: string,
    costManager?: CostManager
  ): Promise<{ llm: BaseLLM; isRoleSpecific: boolean }> {
    const targetUserId = userId || this.currentUserId;

    // Check role-specific cache
    const cacheKey = `${targetUserId}:${roleProfile}`;
    const cached = this.roleLLMCache.get(cacheKey);
    if (cached) {
      if (costManager) {
        cached.llm.costManager = costManager;
      }
      return { llm: cached.llm, isRoleSpecific: true };
    }

    // Try to load role-specific config from database
    try {
      const roleConfig = await this.llmConfigRepo.findByRole(targetUserId, roleProfile);

      if (roleConfig) {
        const llmConfig: ILLMConfig = {
          provider: roleConfig.provider as LLMProvider,
          apiKey: roleConfig.api_key || '',
          baseURL: roleConfig.base_url || undefined,
          model: roleConfig.model,
          temperature: roleConfig.temperature ?? undefined,
          maxTokens: roleConfig.max_tokens ?? undefined,
        };

        const llm = createLLM(llmConfig);
        if (costManager) {
          llm.costManager = costManager;
        }

        // Cache role-specific LLM
        this.roleLLMCache.set(cacheKey, { llm, config: llmConfig });

        logger.info(
          `LLMManager: Role-specific LLM for ${roleProfile}: ${llmConfig.provider}/${llmConfig.model}`
        );

        return { llm, isRoleSpecific: true };
      }
    } catch (error: any) {
      logger.debug(`LLMManager: No role-specific config for ${roleProfile}: ${error.message}`);
    }

    // Fall back to system default (supports hot-reload)
    const defaultLLM = this.getDefaultLLM(costManager);
    const configInfo = this.getCurrentConfigInfo();
    logger.debug(
      `LLMManager: ${roleProfile} using system default LLM: ${configInfo?.provider}/${configInfo?.model}`
    );

    return { llm: defaultLLM, isRoleSpecific: false };
  }

  /**
   * Clear role-specific LLM cache for a user
   * Call this when role LLM configuration is updated
   */
  clearRoleLLMCache(userId?: string, roleProfile?: string): void {
    if (userId && roleProfile) {
      const cacheKey = `${userId}:${roleProfile}`;
      this.roleLLMCache.delete(cacheKey);
      logger.debug(`LLMManager: Cleared role LLM cache for ${roleProfile}`);
    } else if (userId) {
      // Clear all role caches for this user
      for (const key of this.roleLLMCache.keys()) {
        if (key.startsWith(`${userId}:`)) {
          this.roleLLMCache.delete(key);
        }
      }
      logger.debug(`LLMManager: Cleared all role LLM caches for user ${userId}`);
    } else {
      // Clear all
      this.roleLLMCache.clear();
      logger.debug('LLMManager: Cleared all role LLM caches');
    }
  }

  // ============================================
  // Initialization
  // ============================================

  /**
   * Initialize LLM Manager
   * Should be called after database connection is established
   */
  async initialize(userId?: string): Promise<void> {
    try {
      const config = await this.loadConfig(userId);
      this.rebuildDefaultLLM(config);
      logger.info(
        `LLMManager: Initialized with ${config.provider}/${config.model}`
      );
    } catch (error: any) {
      logger.error(`LLMManager: Initialization failed: ${error.message}`);
      throw error;
    }
  }

  // ============================================
  // Intelligent Retry with Model Fallback
  // ============================================

  /**
   * Get all available LLM configurations for a user
   * Returns configs that have valid API keys configured
   * 
   * @param userId User ID (defaults to current user)
   * @returns Array of available LLM configurations
   */
  async getAvailableLLMs(userId?: string): Promise<ILLMConfig[]> {
    const targetUserId = userId || this.currentUserId;
    
    try {
      const configs = await this.llmConfigRepo.findByUserId(targetUserId);
      
      // Filter out configs without valid API keys (Schema V2: api_key field)
      const validConfigs = configs
        .filter(c => c.api_key && c.api_key.trim() !== '')
        .map(c => this.llmConfigRepo.toILLMConfig(c));
      
      logger.debug(`LLMManager: Found ${validConfigs.length} available LLM configs for user ${targetUserId}`, {
        configs: validConfigs.map(c => `${c.provider}/${c.model}`),
      });
      
      return validConfigs;
    } catch (error: any) {
      logger.warn(`LLMManager: Failed to get available LLMs: ${error.message}`);
      return [];
    }
  }

  /**
   * Get retry configuration from environment variables
   */
  private getRetryConfig(): {
    maxAttempts: number;
    retryDelayMs: number;
    enableFallback: boolean;
  } {
    return {
      maxAttempts: parseInt(process.env.LLM_MAX_RETRY_ATTEMPTS || '') || DEFAULT_MAX_RETRY_ATTEMPTS,
      retryDelayMs: parseInt(process.env.LLM_RETRY_DELAY_MS || '') || DEFAULT_RETRY_DELAY_MS,
      enableFallback: process.env.LLM_ENABLE_MODEL_FALLBACK !== 'false' && DEFAULT_ENABLE_MODEL_FALLBACK,
    };
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if an error is retryable
   * Some errors (like cancellation) should not be retried
   */
  private isRetryableError(error: any): boolean {
    const message = error.message?.toLowerCase() || '';
    
    // Don't retry cancellation errors
    if (message.includes('cancelled') || message.includes('aborted')) {
      return false;
    }
    
    // Don't retry authentication errors
    if (message.includes('401') || message.includes('unauthorized') || message.includes('invalid api key')) {
      return false;
    }
    
    // Retry rate limits, timeouts, and server errors
    return true;
  }

  /**
   * Check if an error should trigger a longer delay
   */
  private shouldAddExtraDelay(error: any): boolean {
    const message = error.message?.toLowerCase() || '';
    return message.includes('429') || 
           message.includes('rate limit') || 
           message.includes('too many requests') ||
           message.includes('quota');
  }

  /**
   * Execute LLM call with intelligent retry and model fallback
   * 
   * When a call fails:
   * 1. Retry up to maxAttempts times (default: 3)
   * 2. On each retry, switch to the next available model
   * 3. Add exponential backoff delay for rate limit errors
   * 
   * @param fn Function to execute with the LLM instance
   * @param userId User ID for loading configs
   * @param costManager Optional cost manager to bind to LLM instances
   * @param abortSignal Optional abort signal for cancellation
   * @returns Result from the successful LLM call
   */
  async callWithFallback<T>(
    fn: (llm: BaseLLM) => Promise<T>,
    userId?: string,
    costManager?: CostManager,
    abortSignal?: AbortSignal
  ): Promise<T> {
    const retryConfig = this.getRetryConfig();
    const targetUserId = userId || this.currentUserId;
    
    // Check for cancellation before starting
    if (abortSignal?.aborted) {
      throw new Error('LLM call was cancelled before starting');
    }

    // Get available LLM configurations
    let orderedConfigs: ILLMConfig[] = [];
    
    try {
      // Start with the primary (active) config
      const primaryConfig = await this.loadConfig(targetUserId);
      orderedConfigs.push(primaryConfig);
      
      // If fallback is enabled, add other available configs
      if (retryConfig.enableFallback) {
        const availableLLMs = await this.getAvailableLLMs(targetUserId);
        
        // Add configs that are different from the primary
        const fallbackConfigs = availableLLMs.filter(c => 
          c.provider !== primaryConfig.provider || c.model !== primaryConfig.model
        );
        
        orderedConfigs = [...orderedConfigs, ...fallbackConfigs];
      }
    } catch (error: any) {
      logger.error(`LLMManager: Failed to load LLM configs for fallback: ${error.message}`);
      throw error;
    }

    if (orderedConfigs.length === 0) {
      throw new Error('No LLM configurations available');
    }

    logger.info(`LLMManager: Starting call with fallback`, {
      userId: targetUserId,
      maxAttempts: retryConfig.maxAttempts,
      availableModels: orderedConfigs.map(c => `${c.provider}/${c.model}`),
      fallbackEnabled: retryConfig.enableFallback,
    });

    let lastError: Error | undefined;
    let attemptCount = 0;
    let configIndex = 0;

    while (attemptCount < retryConfig.maxAttempts) {
      // Check for cancellation before each attempt
      if (abortSignal?.aborted) {
        throw new Error('LLM call was cancelled');
      }

      // Get the config for this attempt (cycle through available configs)
      const currentConfig = orderedConfigs[configIndex % orderedConfigs.length];
      attemptCount++;
      
      try {
        // Create LLM instance for this attempt
        const llm = createLLM(currentConfig);
        if (costManager) {
          llm.costManager = costManager;
        }

        logger.info(`LLMManager: Attempt ${attemptCount}/${retryConfig.maxAttempts} with ${currentConfig.provider}/${currentConfig.model}`, {
          attempt: attemptCount,
          maxAttempts: retryConfig.maxAttempts,
          provider: currentConfig.provider,
          model: currentConfig.model,
          isRetry: attemptCount > 1,
          previousError: lastError?.message,
        });

        // Execute the call
        const result = await fn(llm);

        // Success! Log and return
        logger.info(`LLMManager: Call succeeded on attempt ${attemptCount}`, {
          attempt: attemptCount,
          provider: currentConfig.provider,
          model: currentConfig.model,
          hadPreviousFailures: attemptCount > 1,
        });

        return result;
      } catch (error: any) {
        lastError = error;

        // Check if this error should be retried
        if (!this.isRetryableError(error)) {
          logger.error(`LLMManager: Non-retryable error encountered`, {
            attempt: attemptCount,
            provider: currentConfig.provider,
            model: currentConfig.model,
            error: error.message,
          });
          throw error;
        }

        // Log the failure
        const willRetry = attemptCount < retryConfig.maxAttempts;
        const nextConfig = willRetry ? orderedConfigs[(configIndex + 1) % orderedConfigs.length] : null;

        logger.warn(`LLMManager: Attempt ${attemptCount} failed with ${currentConfig.provider}/${currentConfig.model}`, {
          attempt: attemptCount,
          maxAttempts: retryConfig.maxAttempts,
          provider: currentConfig.provider,
          model: currentConfig.model,
          error: error.message,
          willRetry,
          nextModel: nextConfig ? `${nextConfig.provider}/${nextConfig.model}` : 'none',
        });

        // Add delay before retry
        if (willRetry) {
          let delayMs = retryConfig.retryDelayMs * attemptCount; // Linear backoff
          
          // Add extra delay for rate limit errors (exponential backoff)
          if (this.shouldAddExtraDelay(error)) {
            delayMs = retryConfig.retryDelayMs * Math.pow(2, attemptCount - 1);
            logger.info(`LLMManager: Rate limit detected, using exponential backoff: ${delayMs}ms`);
          }

          await this.sleep(delayMs);
          
          // Move to next config for next attempt
          configIndex++;
        }
      }
    }

    // All attempts failed
    logger.error(`LLMManager: All ${retryConfig.maxAttempts} attempts failed`, {
      maxAttempts: retryConfig.maxAttempts,
      triedModels: orderedConfigs.slice(0, Math.min(attemptCount, orderedConfigs.length)).map(c => `${c.provider}/${c.model}`),
      lastError: lastError?.message,
    });

    throw lastError || new Error('All LLM call attempts failed');
  }

  /**
   * Simple wrapper for aask with fallback support
   * Convenience method for common use case
   */
  async aaskWithFallback(
    prompt: string,
    systemMsgs?: string[],
    userId?: string,
    costManager?: CostManager,
    abortSignal?: AbortSignal
  ): Promise<string> {
    return this.callWithFallback(
      (llm) => llm.aask(prompt, systemMsgs, abortSignal),
      userId,
      costManager,
      abortSignal
    );
  }

  // ============================================
  // Utility Methods
  // ============================================

  /**
   * Compare two LLM configs for equality
   */
  private isConfigEqual(a: ILLMConfig | null, b: ILLMConfig): boolean {
    if (!a) return false;
    return (
      a.provider === b.provider &&
      a.model === b.model &&
      a.apiKey === b.apiKey &&
      a.baseURL === b.baseURL
    );
  }

  /**
   * Check if manager is initialized
   */
  isInitialized(): boolean {
    return this.defaultLLM !== null;
  }

  /**
   * Get statistics (for debugging)
   */
  getStats(): {
    initialized: boolean;
    currentConfig: { provider: string; model: string } | null;
    roleCacheSize: number;
    configCached: boolean;
  } {
    return {
      initialized: this.isInitialized(),
      currentConfig: this.getCurrentConfigInfo(),
      roleCacheSize: this.roleLLMCache.size,
      configCached: this.configCache !== null,
    };
  }
}

// Export singleton instance
export const llmManager = LLMManager.getInstance();
