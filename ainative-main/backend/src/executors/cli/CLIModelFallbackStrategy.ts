/**
 * CLI Model Fallback Strategy
 * CLI 模型降级策略
 * 
 * 提供CLI模式下模型降级的通用能力
 */

import { ICLIModelFallbackStrategy, CLIProviderConfig, CLIExecutionResult } from '../types';

/**
 * 默认CLI模型降级策略
 * 
 * 策略规则：
 * 1. 如果当前模型来自角色配置（ROLE_{PROFILE}_CLI_MODEL），且与CURSOR_CLI_MODEL不同，则允许降级
 * 2. 降级时使用CURSOR_CLI_MODEL作为降级模型
 */
export class DefaultCLIModelFallbackStrategy implements ICLIModelFallbackStrategy {
  private roleProfile?: string;

  constructor(roleProfile?: string) {
    this.roleProfile = roleProfile;
  }

  /**
   * 判断是否需要降级
   */
  shouldFallback(
    originalConfig: Partial<CLIProviderConfig>,
    error: any,
    result?: CLIExecutionResult
  ): boolean {
    const originalModel = originalConfig.model;
    const fallbackModel = process.env.CURSOR_CLI_MODEL;

    // 如果没有配置降级模型，不降级
    if (!fallbackModel) {
      return false;
    }

    // 如果当前模型已经是降级模型，不降级
    if (originalModel === fallbackModel) {
      return false;
    }

    // 检查是否使用了角色级别的CLI模型配置
    const isRoleModel = this.isUsingRoleCLIModel(originalModel);

    if (!isRoleModel) {
      return false;
    }

    // 如果错误与模型相关，则允许降级
    return this.isModelUnavailableError(error, result);
  }

  /**
   * 获取降级配置
   */
  getFallbackConfig(originalConfig: Partial<CLIProviderConfig>): Partial<CLIProviderConfig> {
    const defaultProvider = process.env.DEFAULT_CLI_PROVIDER;
    const fallbackModel = process.env.CURSOR_CLI_MODEL;

    return {
      ...originalConfig,
      model: fallbackModel,
      type: (defaultProvider as any) || originalConfig.type || 'cursor',
    };
  }

  /**
   * 判断错误是否与模型不可用相关
   */
  isModelUnavailableError(error: any, result?: CLIExecutionResult): boolean {
    // 检查异常消息
    if (error?.message) {
      const errorMsg = error.message.toLowerCase();
      const modelErrorKeywords = [
        'model',
        'unavailable',
        'not found',
        'invalid model',
        'model not found',
        'unknown model',
        'model error',
      ];

      if (modelErrorKeywords.some(keyword => errorMsg.includes(keyword))) {
        return true;
      }
    }

    // 检查执行结果的stderr
    if (result?.stderr) {
      const stderr = result.stderr.toLowerCase();
      const modelErrorKeywords = [
        'model',
        'unavailable',
        'not found',
        'invalid model',
        'model not found',
        'unknown model',
        'model error',
      ];

      if (modelErrorKeywords.some(keyword => stderr.includes(keyword))) {
        return true;
      }
    }

    // 如果退出码非零，也可能是模型问题（保守策略：允许降级）
    if (result && result.exitCode !== 0) {
      return true;
    }

    return false;
  }

  /**
   * 判断是否使用了角色级别的CLI模型配置
   */
  private isUsingRoleCLIModel(model?: string): boolean {
    if (!this.roleProfile || !model) {
      return false;
    }

    // 检查环境变量中是否有角色级别的CLI模型配置
    const roleModelEnv = process.env[`ROLE_${this.roleProfile.toUpperCase()}_CLI_MODEL`];
    if (roleModelEnv && roleModelEnv === model) {
      return true;
    }

    return false;
  }
}

/**
 * 创建默认降级策略实例
 */
export function createDefaultFallbackStrategy(roleProfile?: string): DefaultCLIModelFallbackStrategy {
  return new DefaultCLIModelFallbackStrategy(roleProfile);
}
