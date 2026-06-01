/**
 * Unified error handling utilities
 * Provides consistent error handling and user feedback across the application
 */

import { ElMessage } from 'element-plus';

/**
 * Extract error message from various error formats
 */
export function getErrorMessage(error: any, defaultMessage: string = '未知错误'): string {
  if (!error) return defaultMessage;
  
  // Handle Error objects
  if (error instanceof Error) {
    return error.message || defaultMessage;
  }
  
  // Handle string errors
  if (typeof error === 'string') {
    return error;
  }
  
  // Handle API error responses
  if (error.message) {
    return error.message;
  }
  if (error.error) {
    return typeof error.error === 'string' ? error.error : JSON.stringify(error.error);
  }
  
  // Fallback
  try {
    return JSON.stringify(error) || defaultMessage;
  } catch {
    return defaultMessage;
  }
}

/**
 * Handle API errors with consistent UI feedback
 */
export function handleApiError(error: any, defaultMessage: string = '操作失败'): void {
  const message = getErrorMessage(error, defaultMessage);
  ElMessage.error(message);
  console.error(defaultMessage, error);
}

/**
 * Handle API errors without showing UI message (for background operations)
 */
export function handleSilentError(error: any, context: string = 'Error'): void {
  const message = getErrorMessage(error);
  console.error(`${context}:`, message, error);
}

/**
 * Wrap async function with error handling
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  errorMessage: string = '操作失败',
  options: { silent?: boolean; rethrow?: boolean } = {}
): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    if (options.silent) {
      handleSilentError(error, errorMessage);
    } else {
      handleApiError(error, errorMessage);
    }
    if (options.rethrow) {
      throw error;
    }
    return null;
  }
}

/**
 * Create an error handler for specific context
 */
export function createErrorHandler(context: string) {
  return {
    handle: (error: any, specificMessage?: string) => {
      handleApiError(error, specificMessage || `${context}失败`);
    },
    silent: (error: any) => {
      handleSilentError(error, context);
    },
    getMessage: (error: any, defaultMsg?: string) => {
      return getErrorMessage(error, defaultMsg || `${context}失败`);
    },
  };
}

export default {
  getErrorMessage,
  handleApiError,
  handleSilentError,
  withErrorHandling,
  createErrorHandler,
};
