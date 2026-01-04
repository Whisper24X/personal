/**
 * Global Context
 * Manages application-wide configuration and shared resources
 */

import { IAppConfig } from '@mind2build/shared';
import { config as defaultConfig } from '../../utils/config';
import { CostManager } from './CostManager';
import { createLLM } from '../../providers/llm/factory';
import { BaseLLM } from '../../providers/llm/BaseLLM';

export class Context {
  config: IAppConfig;
  costManager: CostManager;
  private _llm?: BaseLLM;
  private kwargs: Map<string, any> = new Map();

  constructor(config?: Partial<IAppConfig>, maxBudget?: number) {
    this.config = { ...defaultConfig, ...config };
    this.costManager = new CostManager(maxBudget || this.config.limits.maxBudget);
  }

  /**
   * Get LLM instance (lazy loading)
   * Uses system default LLM config (from database only, no environment variable fallback)
   * If explicitly configured in config.llm, uses that; otherwise uses system default from database
   * Note: All LLM configurations are loaded from database, environment variables are not used
   */
  get llm(): BaseLLM {
    if (!this._llm) {
      // Priority: explicit config.llm > system default (from database)
      // If no explicit config provided, use system default from database
      // Note: defaultConfig.llm is initialized from database via initializeDefaultLLMConfig()
      const llmConfig = this.config.llm || defaultConfig.llm;
      this._llm = createLLM(llmConfig);
      this._llm.costManager = this.costManager;
    }
    return this._llm;
  }

  /**
   * Set LLM instance
   */
  set llm(llm: BaseLLM) {
    this._llm = llm;
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
