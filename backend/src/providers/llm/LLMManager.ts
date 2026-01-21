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
import { LLMConfigRepository, RoleLLMConfigRepository } from '../../database';
import { CostManager } from '../../core/context/CostManager';
import { logger } from '../../utils/logger';

// Default user ID for system-level operations
const DEFAULT_USER_ID = '302769d6-247d-43db-a005-0519712255fb';

// Configuration cache settings
const CONFIG_CACHE_TTL = 60000; // 1 minute

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
  private roleLLMConfigRepo = new RoleLLMConfigRepository();

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
      const roleConfig = await this.roleLLMConfigRepo.findByProfile(targetUserId, roleProfile);

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
