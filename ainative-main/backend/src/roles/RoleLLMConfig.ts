/**
 * Role LLM Configuration
 * 
 * Manages LLM configuration for a specific role.
 * Delegates actual LLM management to LLMManager for centralized control.
 * 
 * Priority:
 * 1. Role-specific LLM config from database (via LLMManager)
 * 2. System default LLM (via LLMManager, supports hot-reload)
 */

import { ILLMConfig } from '@mind2build/shared';
import { Context } from '../core/context/Context';
import { BaseAction } from '../core/base/BaseAction';
import { logger } from '../utils';
import { llmManager } from '../providers/llm/LLMManager';
import { BaseLLM } from '../providers/llm/BaseLLM';

export class RoleLLMConfig {
  private cachedLLM?: BaseLLM;
  private isRoleSpecific: boolean = false;
  private initialized: boolean = false;
  protected llmLoadPromise?: Promise<void>;

  constructor(
    private profile: string,
    private context: Context,
    private actions: BaseAction[] = []
  ) {}

  /**
   * Initialize LLM with explicit config (for role-specific config only)
   * @deprecated Use startLoadingFromDatabase() instead
   */
  initializeWithConfig(_config: ILLMConfig | undefined): void {
    // No-op: LLM initialization is now handled by LLMManager
    // This method is kept for backward compatibility
    logger.debug(`${this.profile}: initializeWithConfig called (no-op, using LLMManager)`);
  }

  /**
   * Start loading LLM configuration from database
   */
  startLoadingFromDatabase(): Promise<void> {
    this.llmLoadPromise = this.loadRoleLLM();
    return this.llmLoadPromise;
  }

  /**
   * Get the current LLM instance
   * Returns role-specific LLM if configured, otherwise system default
   * System default supports hot-reload via LLMManager
   */
  getLLM(): BaseLLM {
    if (this.isRoleSpecific && this.cachedLLM) {
      // Role-specific LLM (cached)
      this.cachedLLM.costManager = this.context.costManager;
      return this.cachedLLM;
    }
    
    // System default (supports hot-reload)
    return llmManager.getDefaultLLM(this.context.costManager);
  }

  /**
   * Check if this role has its own specific LLM configuration
   */
  hasSpecificConfig(): boolean {
    return this.isRoleSpecific;
  }

  /**
   * Update actions with role-specific LLM if configured
   * 
   * IMPORTANT: Only sets custom LLM on Actions when there's a role-specific config.
   * If no role-specific config, Actions will use their Context to get LLM dynamically,
   * which supports hot-reload of system default LLM configuration.
   */
  updateActionsLLM(actions: BaseAction[]): void {
    if (actions.length === 0) return;

    if (this.isRoleSpecific && this.cachedLLM) {
      // Only set custom LLM for role-specific config
      actions.forEach((action) => action.setLLM(this.cachedLLM!));
      logger.debug(`${this.profile}: Set role-specific LLM for ${actions.length} actions`);
    } else {
      // Clear any custom LLM so Actions use Context.llm (supports hot-reload)
      actions.forEach((action) => action.clearCustomLLM());
      logger.debug(`${this.profile}: ${actions.length} actions will use system default LLM via Context (supports hot-reload)`);
    }
  }

  /**
   * Load role LLM configuration
   * Uses LLMManager.getRoleLLM() for centralized management
   */
  private async loadRoleLLM(): Promise<void> {
    try {
      const userId = this.context.get('userId');
      
      const result = await llmManager.getRoleLLM(
        this.profile,
        userId,
        this.context.costManager
      );

      this.cachedLLM = result.llm;
      this.isRoleSpecific = result.isRoleSpecific;
      this.initialized = true;

      if (result.isRoleSpecific) {
        logger.info(`${this.profile}: Using role-specific LLM configuration`);
      } else {
        const configInfo = llmManager.getCurrentConfigInfo();
        logger.info(
          `${this.profile}: Using system default LLM (supports hot-reload): ` +
          `${configInfo?.provider}/${configInfo?.model}`
        );
      }

      // Update actions if any
      if (this.actions.length > 0) {
        this.updateActionsLLM(this.actions);
      }
    } catch (error: any) {
      logger.warn(`${this.profile}: Failed to load LLM config: ${error.message}`);
      // Will use system default via LLMManager
      this.isRoleSpecific = false;
      this.initialized = true;
    }
  }

  /**
   * Check if LLM configuration has been loaded
   */
  isLoaded(): boolean {
    return this.initialized;
  }
}
