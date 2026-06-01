/**
 * Shared utility functions for Mind2Build
 */

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Calculate cost from token usage
 */
export function calculateCost(
  model: string,
  promptTokens: number,
  completionTokens: number,
  costPer1k: Record<string, { prompt: number; completion: number }>
): number {
  const costs = costPer1k[model];
  if (!costs) {
    // Default cost if model not found
    return ((promptTokens + completionTokens) / 1000) * 0.001;
  }
  
  const promptCost = (promptTokens / 1000) * costs.prompt;
  const completionCost = (completionTokens / 1000) * costs.completion;
  
  return promptCost + completionCost;
}

/**
 * Check if two sets have intersection
 */
export function hasIntersection<T>(set1: Set<T>, set2: Set<T>): boolean {
  for (const item of set1) {
    if (set2.has(item)) {
      return true;
    }
  }
  return false;
}

/**
 * Convert class/function to string name
 */
export function anyToStr(obj: any): string {
  if (obj === undefined || obj === null) {
    return String(obj); // Returns "undefined" or "null" as string
  }
  if (typeof obj === 'string') {
    return obj;
  }
  if (typeof obj === 'function') {
    return obj.name;
  }
  if (obj?.constructor) {
    return obj.constructor.name;
  }
  return String(obj);
}

/**
 * Format date to ISO string
 */
export function formatDate(date: Date): string {
  return date.toISOString();
}

/**
 * Parse ISO date string
 */
export function parseDate(dateStr: string): Date {
  return new Date(dateStr);
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxAttempts) {
        const delay = delayMs * Math.pow(2, attempt - 1);
        await sleep(delay);
      }
    }
  }
  
  throw lastError;
}

/**
 * Truncate string to max length
 */
export function truncate(str: string, maxLength: number, suffix: string = '...'): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Check if object is empty
 */
export function isEmpty(obj: any): boolean {
  if (obj == null) return true;
  if (Array.isArray(obj)) return obj.length === 0;
  if (typeof obj === 'object') return Object.keys(obj).length === 0;
  return false;
}

