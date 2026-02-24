/**
 * Executor Types
 * 执行器类型定义
 *
 * 定义执行器的核心接口和类型，支持 LLM 模式和 CLI 模式的切换
 */

/**
 * 执行模式类型
 * - llm: 使用大模型 API 执行
 * - cli: 使用命令行工具执行（如 Cursor CLI, Aider）
 */
export type ExecutorMode = 'llm' | 'cli';

/**
 * CLI 提供商类型
 */
export type CLIProviderType = 'cursor' | 'aider' | 'cline' | 'custom';

/**
 * 执行器选项
 */
export interface ExecutorOptions {
  /** 系统提示词 */
  systemPrompt?: string;
  /** 工作目录 */
  workDir?: string;
  /** 超时时间（毫秒） */
  timeout?: number;
  /** 输出文件路径（CLI 模式下指定输出文件） */
  outputFile?: string;
  /** 是否启用流式进度跟踪 */
  enableStreamProgress?: boolean;
  /** 流式进度回调 */
  onProgress?: (event: StreamJSONEvent) => void;
  /** 环境变量 */
  env?: Record<string, string>;
  /** AbortSignal 用于取消执行 */
  abortSignal?: AbortSignal;
}

/**
 * 执行结果
 */
export interface ExecutorResult {
  /** 输出内容 */
  output: string;
  /** 执行时间（毫秒） */
  executionTime: number;
  /** 执行模式 */
  mode: ExecutorMode;
  /** 元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 执行器接口
 */
export interface IExecutor {
  /**
   * 执行提示词
   * @param prompt 提示词内容
   * @param options 执行选项
   * @returns 执行结果字符串
   */
  execute(prompt: string, options?: ExecutorOptions): Promise<string>;

  /**
   * 获取执行模式
   */
  getMode(): ExecutorMode;
}

/**
 * Stream JSON 事件类型
 */
export interface StreamJSONEvent {
  type: 'system' | 'assistant' | 'tool_call' | 'result';
  subtype?: 'init' | 'started' | 'completed';
  model?: string;
  message?: {
    content: Array<{ text: string }>;
  };
  tool_call?: {
    writeToolCall?: {
      args: { path: string };
      result?: {
        success?: {
          linesCreated?: number;
          fileSize?: number;
        };
      };
    };
    readToolCall?: {
      args: { path: string };
      result?: {
        success?: {
          totalLines?: number;
        };
      };
    };
  };
  duration_ms?: number;
}

/**
 * CLI 提供商配置
 */
export interface CLIProviderConfig {
  /** 提供商类型 */
  type: CLIProviderType;
  /** CLI 命令（如 'cursor-agent', 'aider'） */
  command?: string;
  /** 模型名称（如 'composer-1'） */
  model?: string;
  /** 额外参数 */
  args?: string[];
  /** 超时时间（毫秒） */
  timeout?: number;
  /** 环境变量 */
  env?: Record<string, string>;
  /** AbortSignal 用于取消执行 */
  abortSignal?: AbortSignal;
  /** 多个 API key 数组 */
  apiKeys?: string[];
  /** 当前使用的 API key（直接指定 key 值） */
  apiKey?: string;
  /** 当前使用的 API key 索引（用于从 apiKeys 数组中选择） */
  apiKeyIndex?: number;
  /** 是否启用流式进度跟踪 */
  enableStreamProgress?: boolean;
  /** 输出格式 */
  outputFormat?: 'text' | 'json' | 'stream-json';
  /** 是否启用增量流式传输 */
  streamPartialOutput?: boolean;
  /** 流式进度回调 */
  onProgress?: (event: StreamJSONEvent) => void;
}

/**
 * CLI 执行结果
 */
export interface CLIExecutionResult {
  /** 输出内容 */
  output: string;
  /** 退出码 */
  exitCode: number;
  /** 执行时间（毫秒） */
  executionTime: number;
  /** 标准错误输出 */
  stderr?: string;
}

/**
 * CLI 提供商接口
 */
export interface ICLIProvider {
  /**
   * 执行 CLI 命令
   * @param prompt 提示词
   * @param workDir 工作目录
   * @param config 配置选项
   */
  execute(prompt: string, workDir: string, config?: Partial<CLIProviderConfig>): Promise<CLIExecutionResult>;

  /**
   * 检查 CLI 工具是否可用
   */
  checkAvailability(): Promise<boolean>;

  /**
   * 获取 CLI 工具版本
   */
  getVersion(): Promise<string>;

  /**
   * 获取提供商类型
   */
  getType(): CLIProviderType;
}

/**
 * 角色执行器配置
 */
export interface RoleExecutorConfigData {
  /** 执行模式 */
  mode?: ExecutorMode;
  /** CLI 提供商类型 */
  cliProvider?: CLIProviderType;
  /** CLI 提供商配置 */
  cliConfig?: Partial<CLIProviderConfig>;
}

/**
 * LLM 执行上下文（传递给 LLMExecutor）
 */
export interface LLMExecutorContext {
  /** LLM 实例 */
  llm: unknown;
  /** AbortSignal */
  abortSignal?: AbortSignal;
}

/**
 * CLI 模型降级策略接口
 */
export interface ICLIModelFallbackStrategy {
  /**
   * 判断是否需要降级
   * @param originalConfig 原始配置
   * @param error 执行错误
   * @param result 执行结果（如果有）
   */
  shouldFallback(originalConfig: Partial<CLIProviderConfig>, error: unknown, result?: CLIExecutionResult): boolean;

  /**
   * 获取降级配置
   * @param originalConfig 原始配置
   */
  getFallbackConfig(originalConfig: Partial<CLIProviderConfig>): Partial<CLIProviderConfig>;

  /**
   * 判断错误是否与模型不可用相关
   * @param error 执行错误
   * @param result 执行结果（如果有）
   */
  isModelUnavailableError(error: unknown, result?: CLIExecutionResult): boolean;
}
