/**
 * Role Executor Configuration
 * 角色执行器配置
 * 
 * 管理角色的执行器配置，支持从环境变量和数据库加载
 * 配置优先级：数据库 > 环境变量 > 默认
 */

import { ExecutorMode, CLIProviderType, CLIProviderConfig, RoleExecutorConfigData } from '../executors/types';
import { Context } from '../core/context/Context';
import { logger } from '../utils/logger';

/**
 * 角色执行器配置类
 */
export class RoleExecutorConfig {
  private profile: string;
  private context: Context;
  private cachedConfig?: RoleExecutorConfigData;
  private initialized: boolean = false;
  private loadPromise?: Promise<void>;

  constructor(profile: string, context: Context) {
    this.profile = profile;
    this.context = context;
  }

  /**
   * 开始异步加载配置
   */
  startLoading(): Promise<void> {
    if (!this.loadPromise) {
      this.loadPromise = this.loadConfig();
    }
    return this.loadPromise;
  }

  /**
   * 获取执行器配置
   * 优先级: 数据库配置 > 环境变量 > 默认配置
   */
  async getConfig(): Promise<RoleExecutorConfigData> {
    // 等待加载完成
    if (this.loadPromise) {
      await this.loadPromise;
    }

    if (this.cachedConfig) {
      return this.cachedConfig;
    }

    // 如果没有加载过，立即加载
    await this.loadConfig();
    return this.cachedConfig!;
  }

  /**
   * 同步获取配置（仅在已加载后使用）
   */
  getConfigSync(): RoleExecutorConfigData | undefined {
    return this.cachedConfig;
  }

  /**
   * 获取执行模式
   */
  async getMode(): Promise<ExecutorMode> {
    const config = await this.getConfig();
    return config.mode || 'llm';
  }

  /**
   * 同步获取执行模式
   */
  getModeSync(): ExecutorMode {
    return this.cachedConfig?.mode || this.getEnvMode() || 'llm';
  }

  /**
   * 获取 CLI 提供商类型
   */
  async getCLIProvider(): Promise<CLIProviderType | undefined> {
    const config = await this.getConfig();
    return config.cliProvider;
  }

  /**
   * 获取 CLI 提供商配置
   */
  async getCLIConfig(): Promise<Partial<CLIProviderConfig> | undefined> {
    const config = await this.getConfig();
    return config.cliConfig;
  }

  /**
   * 检查配置是否已加载
   */
  isLoaded(): boolean {
    return this.initialized;
  }

  /**
   * 加载配置
   */
  private async loadConfig(): Promise<void> {
    try {
      // 1. 尝试从数据库加载
      const dbConfig = await this.loadFromDatabase();
      if (dbConfig) {
        this.cachedConfig = dbConfig;
        this.initialized = true;
        logger.info(`RoleExecutorConfig: Loaded config for ${this.profile} from database`, {
          mode: dbConfig.mode,
          cliProvider: dbConfig.cliProvider,
        });
        return;
      }

      // 2. 从环境变量加载
      const envConfig = this.loadFromEnv();
      if (envConfig.mode) {
        this.cachedConfig = envConfig;
        this.initialized = true;
        logger.info(`RoleExecutorConfig: Loaded config for ${this.profile} from environment`, {
          mode: envConfig.mode,
          cliProvider: envConfig.cliProvider,
        });
        return;
      }

      // 3. 使用默认配置
      this.cachedConfig = this.getDefaultConfig();
      this.initialized = true;
      logger.debug(`RoleExecutorConfig: Using default config for ${this.profile}`, {
        mode: this.cachedConfig.mode,
      });
    } catch (error: any) {
      logger.warn(`RoleExecutorConfig: Failed to load config for ${this.profile}`, {
        error: error.message,
      });
      // 使用默认配置
      this.cachedConfig = this.getDefaultConfig();
      this.initialized = true;
    }
  }

  /**
   * 从数据库加载配置
   */
  private async loadFromDatabase(): Promise<RoleExecutorConfigData | null> {
    try {
      // 从 context 获取用户ID用于查询用户级别配置
      const userId = this.context.get('userId');
      
      // 查询 role_definitions 表
      // 这里需要根据实际的数据库访问方式实现
      // 暂时返回 null，表示没有数据库配置
      
      // TODO: 实现数据库查询
      // const db = getDatabase();
      // const result = await db.query(
      //   'SELECT metadata FROM role_definitions WHERE profile = $1 AND (user_id = $2 OR user_id IS NULL)',
      //   [this.profile, userId]
      // );
      
      logger.debug(`RoleExecutorConfig: Database config not implemented for ${this.profile}`, {
        userId,
      });
      // 
      // if (result.rows.length > 0 && result.rows[0].metadata?.executor_config) {
      //   const dbConfig = result.rows[0].metadata.executor_config;
      //   return {
      //     mode: dbConfig.mode,
      //     cliProvider: dbConfig.cli_provider,
      //     cliConfig: dbConfig.cli_config,
      //   };
      // }

      return null;
    } catch (error: any) {
      logger.debug(`RoleExecutorConfig: Database query failed for ${this.profile}`, {
        error: error.message,
      });
      return null;
    }
  }

  /**
   * 从环境变量加载配置
   */
  private loadFromEnv(): RoleExecutorConfigData {
    const profileUpper = this.profile.toUpperCase();

    // 执行模式
    const mode = this.getEnvMode();

    // CLI 提供商
    const cliProviderEnv = process.env[`ROLE_${profileUpper}_CLI_PROVIDER`];
    const cliProvider = this.isValidCLIProvider(cliProviderEnv) ? cliProviderEnv : undefined;

    // CLI 模型
    const cliModel = process.env[`ROLE_${profileUpper}_CLI_MODEL`];

    // 构建配置
    const config: RoleExecutorConfigData = {};

    if (mode) {
      config.mode = mode;
    }

    if (cliProvider) {
      config.cliProvider = cliProvider;
    }

    if (cliModel) {
      config.cliConfig = {
        model: cliModel,
      };
    }

    return config;
  }

  /**
   * 获取环境变量中的执行模式
   */
  private getEnvMode(): ExecutorMode | undefined {
    const profileUpper = this.profile.toUpperCase();

    // 角色特定的环境变量
    const roleMode = process.env[`ROLE_${profileUpper}_EXECUTOR_MODE`];
    if (roleMode === 'llm' || roleMode === 'cli') {
      return roleMode;
    }

    // 全局默认
    const defaultMode = process.env.DEFAULT_EXECUTOR_MODE;
    if (defaultMode === 'llm' || defaultMode === 'cli') {
      return defaultMode;
    }

    return undefined;
  }

  /**
   * 获取默认配置
   */
  private getDefaultConfig(): RoleExecutorConfigData {
    return {
      mode: 'llm', // 默认使用 LLM 模式，保持向后兼容
    };
  }

  /**
   * 验证 CLI 提供商类型
   */
  private isValidCLIProvider(value: string | undefined): value is CLIProviderType {
    return !!value && ['cursor', 'aider', 'cline', 'custom'].includes(value);
  }

  /**
   * 更新配置（用于运行时动态更新）
   */
  updateConfig(config: Partial<RoleExecutorConfigData>): void {
    this.cachedConfig = {
      ...this.cachedConfig,
      ...config,
    };
    logger.debug(`RoleExecutorConfig: Updated config for ${this.profile}`, {
      mode: this.cachedConfig.mode,
      cliProvider: this.cachedConfig.cliProvider,
    });
  }
}

export default RoleExecutorConfig;
