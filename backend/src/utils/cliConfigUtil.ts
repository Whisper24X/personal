/**
 * CLI Configuration Utility
 * CLI 配置工具
 * 
 * 统一管理所有 CLI 相关配置，从环境变量加载配置
 * 支持全局配置和角色级别配置
 */

import { CLIProviderConfig } from '../executors/types';

export interface CLIConfigOptions {
  // 基础配置
  command?: string;
  model?: string;
  timeout?: number;
  
  // API Key 配置
  apiKey?: string;
  apiKeys?: string[];
  apiKeyIndex?: number;
  
  // 流式进度跟踪配置
  enableStreamProgress?: boolean;
  outputFormat?: 'text' | 'json' | 'stream-json';
  streamPartialOutput?: boolean;
  
  // 环境变量
  env?: Record<string, string>;
}

/**
 * CLI 配置工具类
 */
export class CLIConfigUtil {
  /**
   * 从环境变量加载全局 CLI 配置
   */
  static loadGlobalConfig(): Partial<CLIConfigOptions> {
    return {
      model: process.env.CURSOR_CLI_MODEL || 'composer-1',
      timeout: process.env.CURSOR_CLI_TIMEOUT 
        ? parseInt(process.env.CURSOR_CLI_TIMEOUT, 10) 
        : 3600000,
      enableStreamProgress: process.env.CURSOR_CLI_ENABLE_STREAM_PROGRESS === 'true',
      outputFormat: (process.env.CURSOR_CLI_OUTPUT_FORMAT as 'text' | 'json' | 'stream-json') || 'text',
      streamPartialOutput: process.env.CURSOR_CLI_STREAM_PARTIAL_OUTPUT === 'true',
      apiKey: process.env.CURSOR_API_KEY,
      apiKeys: this.collectApiKeys('CURSOR_API_KEY'),
      apiKeyIndex: process.env.CURSOR_API_KEY_INDEX 
        ? parseInt(process.env.CURSOR_API_KEY_INDEX, 10) 
        : 0,
    };
  }

  /**
   * 从环境变量加载角色级别 CLI 配置
   */
  static loadRoleConfig(roleProfile: string): Partial<CLIConfigOptions> {
    const profileUpper = roleProfile.toUpperCase();
    const prefix = `ROLE_${profileUpper}_CLI`;
    
    const config: Partial<CLIConfigOptions> = {};
    
    // 模型配置
    if (process.env[`${prefix}_MODEL`]) {
      config.model = process.env[`${prefix}_MODEL`];
    }
    
    // 流式进度跟踪配置
    if (process.env[`${prefix}_ENABLE_STREAM_PROGRESS`]) {
      config.enableStreamProgress = process.env[`${prefix}_ENABLE_STREAM_PROGRESS`] === 'true';
    }
    
    if (process.env[`${prefix}_OUTPUT_FORMAT`]) {
      config.outputFormat = process.env[`${prefix}_OUTPUT_FORMAT`] as 'text' | 'json' | 'stream-json';
    }
    
    if (process.env[`${prefix}_STREAM_PARTIAL_OUTPUT`]) {
      config.streamPartialOutput = process.env[`${prefix}_STREAM_PARTIAL_OUTPUT`] === 'true';
    }
    
    // API Keys
    const apiKeys = this.collectApiKeys(`${prefix}_API_KEY`);
    if (apiKeys.length > 0) {
      config.apiKeys = apiKeys;
    }
    
    if (process.env[`${prefix}_API_KEY_INDEX`]) {
      config.apiKeyIndex = parseInt(process.env[`${prefix}_API_KEY_INDEX`], 10);
    }
    
    return config;
  }

  /**
   * 合并配置（角色配置优先）
   */
  static mergeConfig(
    globalConfig: Partial<CLIConfigOptions>,
    roleConfig?: Partial<CLIConfigOptions>
  ): Partial<CLIConfigOptions> {
    if (!roleConfig) {
      return globalConfig;
    }
    
    return {
      ...globalConfig,
      ...roleConfig,
      // 数组类型需要特殊处理
      apiKeys: roleConfig.apiKeys && roleConfig.apiKeys.length > 0 
        ? roleConfig.apiKeys 
        : globalConfig.apiKeys,
      apiKeyIndex: roleConfig.apiKeyIndex !== undefined 
        ? roleConfig.apiKeyIndex 
        : (globalConfig.apiKeyIndex ?? 0),
    };
  }

  /**
   * 将 CLIConfigOptions 转换为 CLIProviderConfig
   */
  static toCLIProviderConfig(
    options: Partial<CLIConfigOptions>,
    providerType: string
  ): Partial<CLIProviderConfig> {
    const config: Partial<CLIProviderConfig> = {
      type: providerType as any,
    };
    
    if (options.model) {
      config.model = options.model;
    }
    
    if (options.timeout) {
      config.timeout = options.timeout;
    }
    
    if (options.apiKey) {
      config.apiKey = options.apiKey;
    }
    
    if (options.apiKeys && options.apiKeys.length > 0) {
      config.apiKeys = options.apiKeys;
    }
    
    if (options.apiKeyIndex !== undefined) {
      config.apiKeyIndex = options.apiKeyIndex;
    }
    
    if (options.enableStreamProgress !== undefined) {
      config.enableStreamProgress = options.enableStreamProgress;
    }
    
    if (options.outputFormat) {
      config.outputFormat = options.outputFormat;
    }
    
    if (options.streamPartialOutput !== undefined) {
      config.streamPartialOutput = options.streamPartialOutput;
    }
    
    if (options.env) {
      config.env = options.env;
    }
    
    return config;
  }

  /**
   * 收集多个 API key（支持 CURSOR_API_KEY_0, CURSOR_API_KEY_1 格式）
   */
  private static collectApiKeys(prefix: string): string[] {
    const apiKeys: string[] = [];
    let index = 0;
    
    // 收集所有 {PREFIX}_N 格式的环境变量
    while (true) {
      const envKey = `${prefix}_${index}`;
      const apiKey = process.env[envKey];
      if (apiKey) {
        apiKeys.push(apiKey);
        index++;
      } else {
        break;
      }
    }
    
    // 如果没有找到带索引的，检查是否有默认的
    if (apiKeys.length === 0 && process.env[prefix]) {
      apiKeys.push(process.env[prefix]);
    }
    
    return apiKeys;
  }
}

export default CLIConfigUtil;
