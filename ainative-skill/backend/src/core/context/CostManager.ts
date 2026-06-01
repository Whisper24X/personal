/**
 * Cost Manager
 * Tracks LLM API usage and costs
 */

import { ILLMUsage, NoMoneyException, COST_PER_1K_TOKENS, calculateCost } from '@mind2build/shared';
import { logger } from '../../utils';

export class CostManager {
  private totalPromptTokens: number = 0;
  private totalCompletionTokens: number = 0;
  private totalTokens: number = 0;
  private totalCost: number = 0;
  public maxBudget: number;

  constructor(maxBudget: number = 10.0) {
    this.maxBudget = maxBudget;
  }

  /**
   * Update cost from LLM usage
   */
  updateCost(model: string, usage: ILLMUsage): void {
    this.totalPromptTokens += usage.promptTokens;
    this.totalCompletionTokens += usage.completionTokens;
    this.totalTokens += usage.totalTokens;

    const cost = calculateCost(
      model,
      usage.promptTokens,
      usage.completionTokens,
      COST_PER_1K_TOKENS
    );

    this.totalCost += cost;

    logger.debug('Cost updated', {
      model,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      cost: cost.toFixed(4),
      totalCost: this.totalCost.toFixed(4),
      budget: this.maxBudget,
    });

    // Check if budget exceeded
    if (this.totalCost >= this.maxBudget) {
      throw new NoMoneyException(
        `Budget exhausted: ${this.totalCost.toFixed(2)} >= ${this.maxBudget}`
      );
    }

    // Warn at 80% budget
    if (this.totalCost >= this.maxBudget * 0.8 && this.totalCost < this.maxBudget * 0.81) {
      logger.warn(`Cost is approaching budget limit: ${(this.getUsagePercentage()).toFixed(1)}%`);
    }
  }

  /**
   * Get usage percentage
   */
  getUsagePercentage(): number {
    return (this.totalCost / this.maxBudget) * 100;
  }

  /**
   * Get remaining budget
   */
  getRemainingBudget(): number {
    return Math.max(0, this.maxBudget - this.totalCost);
  }

  /**
   * Get cost report
   */
  getReport(): {
    totalPromptTokens: number;
    totalCompletionTokens: number;
    totalTokens: number;
    totalCost: number;
    maxBudget: number;
    remainingBudget: number;
    usagePercentage: number;
  } {
    return {
      totalPromptTokens: this.totalPromptTokens,
      totalCompletionTokens: this.totalCompletionTokens,
      totalTokens: this.totalTokens,
      totalCost: this.totalCost,
      maxBudget: this.maxBudget,
      remainingBudget: this.getRemainingBudget(),
      usagePercentage: this.getUsagePercentage(),
    };
  }

  /**
   * Reset cost tracking
   */
  reset(): void {
    this.totalPromptTokens = 0;
    this.totalCompletionTokens = 0;
    this.totalTokens = 0;
    this.totalCost = 0;
  }

  /**
   * Serialize to JSON
   */
  toJSON(): Record<string, any> {
    return {
      totalPromptTokens: this.totalPromptTokens,
      totalCompletionTokens: this.totalCompletionTokens,
      totalTokens: this.totalTokens,
      totalCost: this.totalCost,
      maxBudget: this.maxBudget,
    };
  }

  /**
   * Deserialize from JSON
   */
  static fromJSON(data: any): CostManager {
    const costManager = new CostManager(data.maxBudget);
    costManager.totalPromptTokens = data.totalPromptTokens || 0;
    costManager.totalCompletionTokens = data.totalCompletionTokens || 0;
    costManager.totalTokens = data.totalTokens || 0;
    costManager.totalCost = data.totalCost || 0;
    return costManager;
  }
}

export default CostManager;

