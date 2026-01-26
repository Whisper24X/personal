/**
 * CLI Provider Interface
 * CLI 提供商接口定义
 * 
 * 定义所有 CLI 提供商必须实现的接口
 */

import { ICLIProvider, CLIProviderType, CLIProviderConfig, CLIExecutionResult } from '../types';

export { ICLIProvider, CLIProviderType, CLIProviderConfig, CLIExecutionResult };

/**
 * CLI 提供商基类
 * 提供通用的辅助方法
 */
export abstract class BaseCLIProvider implements ICLIProvider {
  protected type: CLIProviderType;
  protected defaultConfig: Partial<CLIProviderConfig>;

  constructor(type: CLIProviderType, defaultConfig?: Partial<CLIProviderConfig>) {
    this.type = type;
    this.defaultConfig = defaultConfig || {};
  }

  /**
   * 执行 CLI 命令
   */
  abstract execute(
    prompt: string,
    workDir: string,
    config?: Partial<CLIProviderConfig>
  ): Promise<CLIExecutionResult>;

  /**
   * 检查 CLI 工具是否可用
   */
  abstract checkAvailability(): Promise<boolean>;

  /**
   * 获取 CLI 工具版本
   */
  abstract getVersion(): Promise<string>;

  /**
   * 获取提供商类型
   */
  getType(): CLIProviderType {
    return this.type;
  }

  /**
   * 合并配置
   */
  protected mergeConfig(config?: Partial<CLIProviderConfig>): CLIProviderConfig {
    return {
      type: this.type,
      ...this.defaultConfig,
      ...config,
    } as CLIProviderConfig;
  }

  /**
   * 转义命令中的特殊字符
   */
  protected escapePrompt(prompt: string): string {
    // 转义双引号和反斜杠
    return prompt.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }
}
