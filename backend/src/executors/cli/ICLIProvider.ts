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
   * 用于在 shell 双引号字符串中安全传递 prompt
   * 
   * Shell 双引号内需要转义的字符：
   * - 反斜杠 \ -> \\（必须先转义）
   * - 双引号 " -> \"
   * - 美元符号 $ -> \$（防止变量展开）
   * - 反引号 ` -> \`（防止命令替换）
   * - 换行符 \n -> \\n（转为字面量，避免 shell 解析中断）
   * - 回车符 \r -> \\r
   */
  protected escapePrompt(prompt: string): string {
    return prompt
      .replace(/\\/g, '\\\\')      // 反斜杠必须先转义
      .replace(/"/g, '\\"')        // 双引号
      .replace(/\$/g, '\\$')       // 美元符号（防止变量展开）
      .replace(/`/g, '\\`')        // 反引号（防止命令替换）
      .replace(/\n/g, '\\n')       // 换行符（关键：避免 shell 解析中断）
      .replace(/\r/g, '\\r');      // 回车符
  }
}
