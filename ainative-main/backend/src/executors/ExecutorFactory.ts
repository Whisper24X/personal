/**
 * Executor Factory
 * 执行器工厂
 * 
 * 根据配置创建对应的执行器实例
 */

import { IExecutor, ExecutorMode, LLMExecutorContext, CLIProviderType, CLIProviderConfig } from './types';
import { LLMExecutor } from './LLMExecutor';
import { CLIExecutor, CLIExecutorConfig } from './CLIExecutor';
import { logger } from '../utils/logger';

/**
 * 执行器上下文
 * 用于创建执行器时传递必要的上下文信息
 */
export interface ExecutorContext {
  /** LLM 实例（LLM 模式必需） */
  llm?: any;
  /** AbortSignal */
  abortSignal?: AbortSignal;
  /** 默认工作目录（CLI 模式使用） */
  workDir?: string;
  /** CLI 提供商类型 */
  cliProvider?: CLIProviderType;
  /** CLI 提供商配置 */
  cliConfig?: Partial<CLIProviderConfig>;
}

/**
 * 执行器工厂
 */
export class ExecutorFactory {
  /** 缓存的 LLM 执行器 */
  private static llmExecutorCache: WeakMap<any, LLMExecutor> = new WeakMap();

  /**
   * 获取执行器
   * @param mode 执行模式
   * @param context 执行器上下文
   */
  static getExecutor(mode: ExecutorMode, context: ExecutorContext): IExecutor {
    if (mode === 'llm') {
      return this.getLLMExecutor(context);
    } else {
      return this.getCLIExecutor(context);
    }
  }

  /**
   * 获取 LLM 执行器
   */
  static getLLMExecutor(context: ExecutorContext): LLMExecutor {
    if (!context.llm) {
      throw new Error('ExecutorFactory: LLM instance is required for LLM mode');
    }

    // 检查缓存
    let executor = this.llmExecutorCache.get(context.llm);
    if (executor) {
      return executor;
    }

    // 创建新实例
    const llmContext: LLMExecutorContext = {
      llm: context.llm,
      abortSignal: context.abortSignal,
    };

    executor = new LLMExecutor(llmContext);
    this.llmExecutorCache.set(context.llm, executor);

    logger.debug('ExecutorFactory: Created new LLMExecutor');
    return executor;
  }

  /**
   * 获取 CLI 执行器
   */
  static getCLIExecutor(context: ExecutorContext): CLIExecutor {
    const config: CLIExecutorConfig = {
      providerType: context.cliProvider,
      providerConfig: context.cliConfig,
      defaultWorkDir: context.workDir,
    };

    logger.debug('ExecutorFactory: Created new CLIExecutor', {
      providerType: config.providerType,
      workDir: config.defaultWorkDir,
    });

    return new CLIExecutor(config);
  }

  /**
   * 获取默认执行模式
   * 从环境变量读取，默认为 llm
   */
  static getDefaultMode(): ExecutorMode {
    const envMode = process.env.DEFAULT_EXECUTOR_MODE;
    if (envMode === 'cli' || envMode === 'llm') {
      return envMode;
    }
    return 'llm';
  }

  /**
   * 根据角色配置确定执行模式
   * @param roleProfile 角色配置名称
   */
  static getModeForRole(roleProfile: string): ExecutorMode {
    // 检查角色特定的环境变量
    const envKey = `ROLE_${roleProfile.toUpperCase()}_EXECUTOR_MODE`;
    const roleEnvMode = process.env[envKey];

    if (roleEnvMode === 'cli' || roleEnvMode === 'llm') {
      logger.debug(`ExecutorFactory: Using role-specific mode for ${roleProfile}`, {
        mode: roleEnvMode,
        envKey,
      });
      return roleEnvMode;
    }

    // 回退到默认模式
    return this.getDefaultMode();
  }

  /**
   * 检查执行模式是否可用
   */
  static async checkModeAvailability(mode: ExecutorMode, context?: ExecutorContext): Promise<boolean> {
    if (mode === 'llm') {
      return !!context?.llm;
    } else {
      const executor = new CLIExecutor({
        providerType: context?.cliProvider,
      });
      return await executor.checkAvailability();
    }
  }
}

export default ExecutorFactory;
