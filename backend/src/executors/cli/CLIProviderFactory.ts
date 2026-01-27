/**
 * CLI Provider Factory
 * CLI 提供商工厂
 * 
 * 管理和创建 CLI 提供商实例
 */

import { ICLIProvider, CLIProviderType, CLIProviderConfig } from '../types';
import { CursorCLIProvider } from './CursorCLIProvider';
import { AiderCLIProvider } from './AiderCLIProvider';
import { logger } from '../../utils/logger';

/**
 * CLI 提供商工厂
 */
export class CLIProviderFactory {
  /** 已注册的提供商 */
  private static providers: Map<CLIProviderType, ICLIProvider> = new Map();

  /** 自定义提供商构造函数 */
  private static customProviderConstructors: Map<
    string,
    new (config?: Partial<CLIProviderConfig>) => ICLIProvider
  > = new Map();

  /** 是否已初始化 */
  private static initialized = false;

  /**
   * 初始化默认提供商
   */
  private static initialize(): void {
    if (this.initialized) return;

    // 注册默认提供商
    this.providers.set('cursor', new CursorCLIProvider());
    this.providers.set('aider', new AiderCLIProvider());

    this.initialized = true;
    logger.debug('CLIProviderFactory: Initialized with default providers', {
      providers: Array.from(this.providers.keys()),
    });
  }

  /**
   * 获取 CLI 提供商
   * @param type 提供商类型
   * @param config 可选配置（用于创建新实例）
   */
  static getProvider(
    type: CLIProviderType = 'cursor',
    config?: Partial<CLIProviderConfig>
  ): ICLIProvider {
    this.initialize();

    // 如果提供了配置，创建新实例
    if (config) {
      return this.createProvider(type, config);
    }

    // 返回缓存的实例
    const provider = this.providers.get(type);
    if (!provider) {
      throw new Error(`CLI provider '${type}' not found. Available: ${Array.from(this.providers.keys()).join(', ')}`);
    }

    return provider;
  }

  /**
   * 创建新的提供商实例
   */
  static createProvider(
    type: CLIProviderType,
    config?: Partial<CLIProviderConfig>
  ): ICLIProvider {
    this.initialize();

    switch (type) {
      case 'cursor':
        return new CursorCLIProvider(config);
      case 'aider':
        return new AiderCLIProvider(config);
      case 'custom': {
        // 检查是否有注册的自定义提供商
        const customType = config?.command || 'custom';
        const CustomConstructor = this.customProviderConstructors.get(customType);
        if (CustomConstructor) {
          return new CustomConstructor(config);
        }
        throw new Error(`Custom CLI provider '${customType}' not registered`);
      }
      default:
        throw new Error(`Unknown CLI provider type: ${type}`);
    }
  }

  /**
   * 注册自定义 CLI 提供商
   * @param name 提供商名称
   * @param ProviderClass 提供商类
   */
  static registerProvider(
    name: string,
    ProviderClass: new (config?: Partial<CLIProviderConfig>) => ICLIProvider
  ): void {
    this.initialize();

    // 创建实例并注册
    const instance = new ProviderClass();
    this.providers.set(instance.getType(), instance);
    this.customProviderConstructors.set(name, ProviderClass);

    logger.info('CLIProviderFactory: Registered custom provider', {
      name,
      type: instance.getType(),
    });
  }

  /**
   * 检查提供商是否可用
   */
  static async checkProviderAvailability(type: CLIProviderType = 'cursor'): Promise<boolean> {
    try {
      const provider = this.getProvider(type);
      return await provider.checkAvailability();
    } catch {
      return false;
    }
  }

  /**
   * 获取所有可用的提供商
   */
  static async getAvailableProviders(): Promise<CLIProviderType[]> {
    this.initialize();

    const available: CLIProviderType[] = [];
    for (const [type, provider] of this.providers) {
      try {
        if (await provider.checkAvailability()) {
          available.push(type);
        }
      } catch {
        // 忽略检查失败的提供商
      }
    }

    return available;
  }

  /**
   * 获取默认提供商类型
   * 从环境变量读取，默认为 cursor
   */
  static getDefaultProviderType(): CLIProviderType {
    const envProvider = process.env.DEFAULT_CLI_PROVIDER;
    if (envProvider && ['cursor', 'aider', 'cline', 'custom'].includes(envProvider)) {
      return envProvider as CLIProviderType;
    }
    return 'cursor';
  }

  /**
   * 获取所有已注册的提供商类型
   */
  static getRegisteredTypes(): CLIProviderType[] {
    this.initialize();
    return Array.from(this.providers.keys());
  }
}

export default CLIProviderFactory;
