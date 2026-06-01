/**
 * Global Context
 * Manages application-wide configuration and shared resources
 * 
 * LLM access is delegated to LLMManager for centralized management
 * and hot-reload support.
 */

import { IAppConfig } from '@mind2build/shared';
import { config as defaultConfig } from '../../utils/config';
import { CostManager } from './CostManager';
import { BaseLLM } from '../../providers/llm/BaseLLM';
import { llmManager } from '../../providers/llm/LLMManager';

export class Context {
  config: IAppConfig;
  costManager: CostManager;
  private _customLLM?: BaseLLM;
  private kwargs: Map<string, any> = new Map();

  constructor(config?: Partial<IAppConfig>, maxBudget?: number) {
    this.config = { ...defaultConfig, ...config };
    this.costManager = new CostManager(maxBudget || this.config.limits.maxBudget);
  }

  /**
   * Get LLM instance
   * 
   * Uses LLMManager to get the current LLM instance, which automatically
   * uses the latest configuration from database and supports hot-reload.
   * 
   * If a custom LLM was set via setter, returns that instead.
   * Each call binds this Context's CostManager to the LLM for cost tracking.
   */
  get llm(): BaseLLM {
    // If custom LLM was set, use that
    if (this._customLLM) {
      return this._customLLM;
    }
    
    // Get LLM from manager (automatically uses latest config)
    return llmManager.getDefaultLLM(this.costManager);
  }

  /**
   * Set custom LLM instance (for special scenarios)
   * Note: Once set, this Context will use the custom LLM instead of LLMManager
   */
  set llm(llm: BaseLLM) {
    this._customLLM = llm;
    // Connect cost manager to LLM
    if (llm && !llm.costManager) {
      llm.costManager = this.costManager;
    }
  }

  /**
   * Set a custom attribute
   */
  set(key: string, value: any): void {
    this.kwargs.set(key, value);
  }

  /**
   * Get a custom attribute
   */
  get(key: string): any {
    return this.kwargs.get(key);
  }

  /**
   * Check if attribute exists
   */
  has(key: string): boolean {
    return this.kwargs.has(key);
  }

  /**
   * Serialize context to JSON
   */
  toJSON(): Record<string, any> {
    return {
      config: this.config,
      costManager: this.costManager.toJSON(),
      kwargs: Object.fromEntries(this.kwargs),
    };
  }

  /**
   * Deserialize context from JSON
   */
  static fromJSON(data: any): Context {
    const ctx = new Context(data.config);
    ctx.costManager = CostManager.fromJSON(data.costManager);

    if (data.kwargs) {
      ctx.kwargs = new Map(Object.entries(data.kwargs));
    }

    return ctx;
  }

  /**
   * Create a copy of the context
   */
  clone(): Context {
    return Context.fromJSON(this.toJSON());
  }
}

export default Context;
