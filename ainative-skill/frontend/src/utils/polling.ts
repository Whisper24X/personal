/**
 * 通用的轮询工具
 * 使用 setTimeout 实现轮询功能，替代 WebSocket 方案
 */

export interface PollingOptions {
  /** 轮询间隔（毫秒），默认 1000ms */
  interval?: number;
  /** 动态轮询间隔函数，返回下次轮询间隔（毫秒），优先级高于 interval */
  getInterval?: () => number;
  /** 最大重试次数，默认 3 */
  maxRetries?: number;
  /** 重试延迟（毫秒），默认 1000ms */
  retryDelay?: number;
  /** 是否立即执行第一次轮询，默认 true */
  immediate?: boolean;
  /** 轮询条件，返回 false 时停止轮询 */
  shouldContinue?: () => boolean;
  /** 错误处理函数 */
  onError?: (error: Error) => void;
}

export interface PollingResult {
  /** 停止轮询 */
  stop: () => void;
  /** 手动触发一次轮询 */
  poll: () => Promise<void>;
  /** 是否正在轮询 */
  isPolling: () => boolean;
}

/**
 * 创建轮询实例
 * @param pollFn 轮询函数，返回 Promise<T>
 * @param onUpdate 更新回调函数
 * @param options 配置选项
 */
export function createPolling<T>(
  pollFn: () => Promise<T>,
  onUpdate: (data: T) => void,
  options: PollingOptions = {}
): PollingResult {
  const {
    interval = 1000,
    getInterval,
    maxRetries = 3,
    retryDelay = 1000,
    immediate = true,
    shouldContinue = () => true,
    onError,
  } = options;

  // Get current interval (dynamic or static)
  const getCurrentInterval = () => getInterval ? getInterval() : interval;

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let isPolling = false;
  let retryCount = 0;

  const poll = async (): Promise<void> => {
    if (!shouldContinue()) {
      stop();
      return;
    }

    if (isPolling) {
      return; // 防止并发轮询
    }

    isPolling = true;

    try {
      const data = await pollFn();
      retryCount = 0; // 重置重试计数
      onUpdate(data);
    } catch (error: any) {
      retryCount++;
      
      // 确保错误对象有 message 属性
      // 处理各种错误格式：Error 对象、API 错误响应对象、字符串等
      let errorMessage = '未知错误';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error?.error) {
        errorMessage = typeof error.error === 'string' ? error.error : JSON.stringify(error.error);
      } else if (error?.message) {
        errorMessage = error.message;
      } else {
        errorMessage = JSON.stringify(error) || '未知错误';
      }
      
      const errorObj = error instanceof Error ? error : new Error(errorMessage);
      
      if (retryCount <= maxRetries) {
        if (onError) {
          onError(errorObj);
        }
        // 延迟后重试
        timeoutId = setTimeout(() => {
          isPolling = false;
          poll();
        }, retryDelay);
        return;
      } else {
        if (onError) {
          onError(errorObj);
        }
        stop();
        return;
      }
    }

    isPolling = false;

    // 继续下一次轮询
    if (shouldContinue()) {
      timeoutId = setTimeout(() => {
        poll();
      }, getCurrentInterval());
    }
  };

  const stop = (): void => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    isPolling = false;
    retryCount = 0;
  };

  const isPollingFn = (): boolean => {
    return isPolling;
  };

  // 开始轮询
  if (immediate) {
    poll();
  } else {
    timeoutId = setTimeout(() => {
      poll();
    }, getCurrentInterval());
  }

  return {
    stop,
    poll,
    isPolling: isPollingFn,
  };
}

/**
 * 简单的轮询函数（简化版）
 * @param pollFn 轮询函数
 * @param onUpdate 更新回调
 * @param interval 轮询间隔
 */
export function simplePolling<T>(
  pollFn: () => Promise<T>,
  onUpdate: (data: T) => void,
  interval: number = 1000
): () => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let isPolling = false;

  const poll = async (): Promise<void> => {
    if (isPolling) return;
    isPolling = true;

    try {
      const data = await pollFn();
      onUpdate(data);
    } catch (error: any) {
      // Error handled silently
    } finally {
      isPolling = false;
      timeoutId = setTimeout(poll, interval);
    }
  };

  // 立即开始
  poll();

  // 返回停止函数
  return () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    isPolling = false;
  };
}

export default {
  createPolling,
  simplePolling,
};

