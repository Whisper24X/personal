# Cursor CLI 迁移方案

## 文档信息

- **文档版本**: 1.1
- **创建日期**: 2026-01-23
- **最后更新**: 2026-01-26（更新Actions数量为30个）
- **文档状态**: 方案设计
- **相关文档**: 
  - `06_角色系统设计_ROLES.md`
  - `07_行动系统设计_ACTIONS.md`
  - `08_LLM提供商集成_PROVIDERS.md`

---

## 1. 概述

### 1.1 背景

当前系统实现中，大部分角色和Action通过LLM API（如智谱AI、OpenAI等）来完成文档生成、代码生成等任务。Engineer角色和WriteCode Action已经成功迁移到使用Cursor CLI（`cursor-agent`命令）来执行代码生成任务。

为了统一执行方式，提高一致性和可维护性，需要将所有角色和Action的执行方式统一迁移到Cursor CLI。

### 1.2 目标

- **统一执行方式**: 所有角色和Action都通过CLI工具执行，默认使用Cursor CLI，不再依赖外部LLM API
- **提高一致性**: 统一的执行接口和错误处理机制
- **简化架构**: 减少对多个LLM提供商的依赖，降低配置复杂度
- **保持兼容**: 确保现有功能不受影响，平滑迁移
- **本地开发支持**: 支持本地开发调试模式，无需容器化
- **角色自定义CLI**: 每个角色可以配置使用不同的CLI工具（Cursor、Aider、Cline等）

### 1.3 参考实现

当前已有两个Action成功使用Cursor CLI：
- **WriteCode**: 使用`cursor-agent --model composer-1 --print`执行代码生成
- **BreakdownTasks**: 使用Cursor CLI创建openSpec变更提案

这两个实现为其他Action的迁移提供了参考模式。

---

## 2. 当前架构分析

### 2.1 当前实现方式

#### 2.1.1 LLM API方式（待迁移）

大部分Action通过`BaseAction.aask()`方法调用LLM：

```typescript
// 示例：WritePRD.ts
const systemPrompt = await loadPrompt(userId, 'prd', 'system_prompt', PRD_SYSTEM_PROMPT);
const prdContent = await this.aask(prompt, [systemPrompt]);
```

**特点**:
- 通过`BaseAction.llm`获取LLM实例（来自Context或角色特定配置）
- 使用`aask()`或`acompletion()`方法调用LLM
- 依赖LLMManager管理多个LLM提供商
- 需要配置API密钥、模型参数等

#### 2.1.2 Cursor CLI方式（已实现）

Engineer和WriteCode使用Cursor CLI：

```typescript
// 示例：WriteCode.ts
const command = `cursor-agent --model composer-1 --print "${applyCommand}"`;
const output = await executeCommandSimple(command, {
  cwd: workDir,
  timeout: 3600000, // 60分钟超时
});
```

**特点**:
- 使用`executeCommandSimple()`执行shell命令
- 通过`cursor-agent`命令行工具执行
- 支持循环重试机制
- 工作目录隔离（每个项目独立workspace）

### 2.2 架构对比

| 维度 | LLM API方式 | Cursor CLI方式 |
|------|------------|---------------|
| **执行方式** | HTTP API调用 | Shell命令执行 |
| **依赖管理** | 需要多个LLM提供商配置 | 只需Cursor CLI工具 |
| **错误处理** | API错误、超时等 | 命令执行错误、超时 |
| **工作目录** | 无固定工作目录 | 基于workspace的固定目录 |
| **重试机制** | 由LLM提供商处理 | 自定义循环重试 |
| **成本控制** | 按token计费 | Cursor CLI使用限制 |

### 2.3 当前角色和Action清单

#### 2.3.1 已使用Cursor CLI的角色/Action

- ✅ **Engineer** → WriteCode
- ✅ **ProjectManager** → BreakdownTasks

#### 2.3.2 待迁移的角色/Action

**角色列表**:
- ProductManager → WritePRD, PRDReview, ImprovePRD
- Architect → WriteDesign, DesignReview, ImproveDesign
- Salesperson → WriteMRD, MRDReview, ImproveMRD
- QAEngineer → WriteTest, TestReview, TestCaseReview, etc.
- AutomationEngineer → AutomationPlanning, AutomationExecution
- DataAnalyst → DataAnalysis
- TeamLeader → Coordinate

**Action列表** (共30个，已迁移2个，待迁移28个):
- WriteMRD, MRDReview, ImproveMRD
- WritePRD, PRDReview, ImprovePRD
- WriteDesign, DesignReview, ImproveDesign
- BreakdownTasks ✅
- WriteCode ✅
- WriteTest, TestReview, TestCaseReview, ImproveTest
- CodeReview
- RunCode
- FixBug
- SearchEnhancedQA, QAConclusion
- TestabilityReview, CoverageQualityCheck
- AutomationPlanning, AutomationExecution
- DataAnalysis
- Coordinate
- ExecuteSubtask
- WriteTestPlan
- WriteSubProjectDesign, SubProjectDesignReview

---

## 3. 目标架构设计

### 3.1 分层架构设计（支持容器化）

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         API Gateway Layer                                 │
│  (HTTP API, WebSocket, 工作流编排接口)                                    │
└──────────────────────────────┬──────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      Workflow Orchestration Layer                        │
│  - WorkflowExecutor (工作流执行器)                                       │
│  - WorkflowExecutionService (状态管理服务)                              │
│  - 工作流调度和协调                                                      │
└──────────────────────────────┬──────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      Workflow Container Layer                            │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  Container 1: Project A Workflow                                 │   │
│  │  ┌──────────────────────────────────────────────────────────┐   │   │
│  │  │  Role Layer (ProductManager, Architect, etc.)            │   │   │
│  │  │  └─► Action Layer (WritePRD, WriteDesign, etc.)          │   │   │
│  │  │      └─► CursorCLIExecutor                                │   │   │
│  │  │          └─► Workspace (独立文件系统)                    │   │   │
│  │  └──────────────────────────────────────────────────────────┘   │   │
│  │  State: workflow_executions (project_id = A)                   │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  Container 2: Project B Workflow                                 │   │
│  │  ┌──────────────────────────────────────────────────────────┐   │   │
│  │  │  Role Layer + Action Layer + CursorCLIExecutor          │   │   │
│  │  │      └─► Workspace (独立文件系统)                        │   │   │
│  │  └──────────────────────────────────────────────────────────┘   │   │
│  │  State: workflow_executions (project_id = B)                   │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────┬──────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      Infrastructure Layer                                 │
│  - PostgreSQL (状态持久化)                                                │
│  - File System / Object Storage (Workspace存储)                         │
│  - Cursor CLI Tool (cursor-agent)                                        │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 容器化架构设计

#### 3.2.1 工作流容器结构

每个工作流在独立容器中运行，包含：

```
Workflow Container
├── Runtime Environment
│   ├── Node.js Runtime
│   ├── Cursor CLI Tool (cursor-agent)
│   └── System Dependencies
│
├── Application Code
│   ├── Role Classes (ProductManager, Architect, etc.)
│   ├── Action Classes (WritePRD, WriteDesign, etc.)
│   ├── CursorCLIExecutor
│   └── WorkflowExecutor
│
├── Workspace (Volume Mount)
│   └── workspace/{applicationId}/{projectId}/
│       ├── MRD/
│       ├── PRD/
│       ├── DESIGN/
│       ├── CODE/
│       └── TEST/
│
└── State (External)
    └── PostgreSQL (workflow_executions table)
```

#### 3.2.2 容器间隔离

- **文件系统隔离**: 每个工作流容器挂载独立的workspace卷
- **状态隔离**: 通过`project_id`在数据库中隔离状态
- **资源隔离**: 每个容器有独立的CPU/内存限制
- **网络隔离**: 容器间通过API Gateway通信

### 3.3 执行模式设计

#### 3.3.1 本地开发模式 vs 容器模式

系统支持两种执行模式：

**本地开发模式**:
- 直接在本地环境运行，无需Docker容器
- 使用本地文件系统workspace
- 适合开发和调试
- 快速迭代和测试

**容器模式**:
- 在Docker/K8s容器中运行
- 使用容器卷挂载workspace
- 适合生产环境
- 资源隔离和扩展

**模式切换**:
```typescript
// 通过环境变量控制
const isContainerMode = !!process.env.CONTAINER_WORKSPACE_ROOT;
const workspacePath = isContainerMode 
  ? WorkspaceManager.getContainerWorkspacePath(options)
  : WorkspaceManager.getProjectWorkspacePath(options);
```

### 3.4 核心组件设计

#### 3.4.1 CLI提供商抽象接口

**文件**: `backend/src/utils/cli/CLIProvider.ts`

```typescript
export type CLIProviderType = 'cursor' | 'aider' | 'cline' | 'custom';

export interface CLIProviderConfig {
  type: CLIProviderType;
  command: string;              // CLI命令（如 'cursor-agent', 'aider'）
  model?: string;               // 模型名称（如 'composer-1'）
  args?: string[];              // 额外参数
  timeout?: number;             // 超时时间
  env?: Record<string, string>; // 环境变量
}

export interface CLIExecutionResult {
  output: string;
  exitCode: number;
  executionTime: number;
}

/**
 * CLI提供商抽象接口
 */
export interface ICLIProvider {
  /**
   * 执行CLI命令
   */
  execute(command: string, options: CLIProviderConfig): Promise<CLIExecutionResult>;
  
  /**
   * 检查CLI工具是否可用
   */
  checkAvailability(): Promise<boolean>;
  
  /**
   * 获取CLI工具版本
   */
  getVersion(): Promise<string>;
}

/**
 * Cursor CLI提供商（默认）
 */
export class CursorCLIProvider implements ICLIProvider {
  async execute(command: string, config: CLIProviderConfig): Promise<CLIExecutionResult> {
    const model = config.model || 'composer-1';
    const fullCommand = `cursor-agent --model ${model} --print "${command}"`;
    
    const startTime = Date.now();
    const result = await executeCommand(fullCommand, {
      cwd: config.workDir,
      timeout: config.timeout || 3600000,
      env: config.env,
    });
    
    return {
      output: result.stdout,
      exitCode: result.exitCode || 0,
      executionTime: Date.now() - startTime,
    };
  }

  async checkAvailability(): Promise<boolean> {
    try {
      await executeCommand('cursor-agent --version');
      return true;
    } catch {
      return false;
    }
  }

  async getVersion(): Promise<string> {
    const result = await executeCommand('cursor-agent --version');
    return result.stdout.trim();
  }
}

/**
 * Aider CLI提供商
 */
export class AiderCLIProvider implements ICLIProvider {
  async execute(command: string, config: CLIProviderConfig): Promise<CLIExecutionResult> {
    const fullCommand = `aider "${command}"`;
    
    const startTime = Date.now();
    const result = await executeCommand(fullCommand, {
      cwd: config.workDir,
      timeout: config.timeout || 3600000,
      env: config.env,
    });
    
    return {
      output: result.stdout,
      exitCode: result.exitCode || 0,
      executionTime: Date.now() - startTime,
    };
  }

  async checkAvailability(): Promise<boolean> {
    try {
      await executeCommand('aider --version');
      return true;
    } catch {
      return false;
    }
  }

  async getVersion(): Promise<string> {
    const result = await executeCommand('aider --version');
    return result.stdout.trim();
  }
}

/**
 * CLI提供商工厂
 */
export class CLIProviderFactory {
  private static providers: Map<CLIProviderType, ICLIProvider> = new Map([
    ['cursor', new CursorCLIProvider()],
    ['aider', new AiderCLIProvider()],
    // 可以添加更多提供商
  ]);

  static getProvider(type: CLIProviderType = 'cursor'): ICLIProvider {
    const provider = this.providers.get(type);
    if (!provider) {
      throw new Error(`CLI provider '${type}' not found`);
    }
    return provider;
  }

  static registerProvider(type: CLIProviderType, provider: ICLIProvider): void {
    this.providers.set(type, provider);
  }
}
```

#### 3.4.2 CLIExecutor（通用CLI执行器）

统一的CLI执行器，支持多种CLI提供商：

**文件**: `backend/src/utils/CLIExecutor.ts`

```typescript
import { ICLIProvider, CLIProviderFactory, CLIProviderType, CLIProviderConfig } from './cli/CLIProvider';

export interface CLIExecutorOptions {
  workDir: string;              // 工作目录
  timeout?: number;             // 超时时间（毫秒）
  maxRetries?: number;          // 最大重试次数
  provider?: CLIProviderType;    // CLI提供商类型（默认cursor）
  providerConfig?: CLIProviderConfig; // 提供商特定配置
  env?: Record<string, string>;  // 环境变量
}

export interface CLIExecutorResult {
  output: string;               // 命令输出
  isCompleted: boolean;         // 是否完成
  iterations: number;          // 迭代次数
  executionTime: number;       // 执行时间（毫秒）
  provider: CLIProviderType;   // 使用的提供商
}

export class CLIExecutor {
  /**
   * 执行CLI命令
   * @param command 要执行的指令
   * @param options 执行选项
   * @returns 命令输出
   */
  static async execute(
    command: string,
    options: CLIExecutorOptions
  ): Promise<string> {
    const providerType = options.provider || 'cursor';
    const provider = CLIProviderFactory.getProvider(providerType);
    
    const config: CLIProviderConfig = {
      type: providerType,
      command: '',
      workDir: options.workDir,
      timeout: options.timeout || 3600000,
      env: options.env,
      ...options.providerConfig,
    };
    
    const result = await provider.execute(command, config);
    return result.output;
  }

  /**
   * 执行带重试的命令
   * @param command 要执行的指令
   * @param checkCommand 检查命令（用于判断是否完成）
   * @param options 执行选项
   * @returns 所有迭代的输出
   */
  static async executeWithRetry(
    command: string,
    checkCommand: string,
    options: CLIExecutorOptions
  ): Promise<CLIExecutorResult> {
    const providerType = options.provider || 'cursor';
    const provider = CLIProviderFactory.getProvider(providerType);
    const maxRetries = options.maxRetries || 10;
    
    let retryCount = 0;
    let isCompleted = false;
    let allOutputs: string[] = [];
    const startTime = Date.now();

    const config: CLIProviderConfig = {
      type: providerType,
      command: '',
      workDir: options.workDir,
      timeout: options.timeout || 3600000,
      env: options.env,
      ...options.providerConfig,
    };

    while (!isCompleted && retryCount < maxRetries) {
      retryCount++;
      
      // 执行主命令
      const outputResult = await provider.execute(command, config);
      allOutputs.push(`=== Iteration ${retryCount} - Execute ===\n${outputResult.output}`);
      
      // 执行检查命令
      const checkResult = await provider.execute(checkCommand, config);
      allOutputs.push(`=== Iteration ${retryCount} - Check ===\n${checkResult.output}`);
      
      // 判断是否完成
      if (checkResult.output.includes('已完成') || checkResult.output.includes('SUCCESS')) {
        isCompleted = true;
      }
    }

    return {
      output: allOutputs.join('\n\n'),
      isCompleted,
      iterations: retryCount,
      executionTime: Date.now() - startTime,
      provider: providerType,
    };
  }

  /**
   * 检查CLI提供商是否可用
   */
  static async checkProviderAvailability(providerType: CLIProviderType = 'cursor'): Promise<boolean> {
    try {
      const provider = CLIProviderFactory.getProvider(providerType);
      return await provider.checkAvailability();
    } catch {
      return false;
    }
  }
}
```

**向后兼容的CursorCLIExecutor**:

```typescript
// 为了向后兼容，保留CursorCLIExecutor作为CLIExecutor的别名
export const CursorCLIExecutor = CLIExecutor;
export type CursorCLIOptions = CLIExecutorOptions;
export type CursorCLIResult = CLIExecutorResult;
```

#### 3.4.3 角色CLI配置

**文件**: `backend/src/roles/RoleCLIConfig.ts`

```typescript
export interface RoleCLIConfig {
  provider?: CLIProviderType;  // CLI提供商类型
  providerConfig?: CLIProviderConfig; // 提供商特定配置
}

export class RoleCLIConfig {
  private profile: string;
  private context: Context;
  private cachedConfig?: RoleCLIConfig;

  constructor(profile: string, context: Context) {
    this.profile = profile;
    this.context = context;
  }

  /**
   * 获取角色的CLI配置
   * 优先级: 数据库配置 > 环境变量 > 默认配置
   */
  async getConfig(): Promise<RoleCLIConfig> {
    if (this.cachedConfig) {
      return this.cachedConfig;
    }

    // 1. 尝试从数据库加载
    const dbConfig = await this.loadFromDatabase();
    if (dbConfig) {
      this.cachedConfig = dbConfig;
      return dbConfig;
    }

    // 2. 从环境变量加载（格式: ROLE_{PROFILE}_CLI_PROVIDER=cursor）
    const envProvider = process.env[`ROLE_${this.profile.toUpperCase()}_CLI_PROVIDER`];
    if (envProvider) {
      this.cachedConfig = {
        provider: envProvider as CLIProviderType,
      };
      return this.cachedConfig;
    }

    // 3. 使用默认配置（Cursor CLI）
    this.cachedConfig = {
      provider: 'cursor',
    };
    return this.cachedConfig;
  }

  /**
   * 从数据库加载配置
   */
  private async loadFromDatabase(): Promise<RoleCLIConfig | null> {
    // TODO: 实现数据库查询逻辑
    // 查询 role_definitions 表的 metadata 字段中的 cli_config
    return null;
  }

  /**
   * 更新角色的CLI配置
   */
  async updateConfig(config: RoleCLIConfig): Promise<void> {
    // TODO: 实现数据库更新逻辑
    this.cachedConfig = config;
  }
}
```

**角色配置示例**:

```typescript
// 在Role构造函数中
export class ProductManager extends Role {
  private cliConfig: RoleCLIConfig;

  constructor(context: Context, name: string = 'ProductManager') {
    // ... 其他初始化代码
    
    this.cliConfig = new RoleCLIConfig(this.profile, context);
  }

  /**
   * 获取CLI配置
   */
  async getCLIConfig(): Promise<RoleCLIConfig> {
    return await this.cliConfig.getConfig();
  }
}
```

#### 3.4.4 WorkflowContainer（新增）

工作流容器封装类，管理单个工作流的完整生命周期：

**文件**: `backend/src/workflow/WorkflowContainer.ts`

```typescript
export interface WorkflowContainerConfig {
  projectId: string;
  applicationId: string;
  workflowConfig: WorkflowConfig;
  workspacePath: string;        // 容器内workspace路径
  stateService: WorkflowExecutionService; // 状态服务（外部）
}

export class WorkflowContainer {
  private executor: WorkflowExecutor;
  private config: WorkflowContainerConfig;
  private context: Context;

  constructor(config: WorkflowContainerConfig) {
    this.config = config;
    this.context = new Context();
    this.context.set('projectId', config.projectId);
    this.context.set('applicationId', config.applicationId);
    
    // 创建工作流执行器
    this.executor = new WorkflowExecutor({
      workspacePath: config.workspacePath,
      stateService: config.stateService,
    });
  }

  /**
   * 启动工作流执行
   */
  async start(): Promise<void> {
    await this.executor.execute(this.config.projectId);
  }

  /**
   * 停止工作流执行
   */
  async stop(): Promise<void> {
    this.executor.stop();
  }

  /**
   * 获取工作流状态
   */
  async getState(): Promise<WorkflowState> {
    return await this.config.stateService.getCurrentState(this.config.projectId);
  }

  /**
   * 获取workspace路径
   */
  getWorkspacePath(): string {
    return this.config.workspacePath;
  }
}
```

#### 3.4.5 BaseAction改造

移除LLM相关方法，添加CLI支持（支持角色自定义CLI）：

**文件**: `backend/src/core/base/BaseAction.ts`

```typescript
import { CLIExecutor, CLIExecutorOptions, CLIExecutorResult } from '../utils/CLIExecutor';
import { RoleCLIConfig } from '../roles/RoleCLIConfig';

export abstract class BaseAction {
  // 移除: protected async aask(...) [标记为deprecated]
  // 移除: protected async acompletion(...) [标记为deprecated]
  // 移除: protected get llm() [标记为deprecated]
  
  /**
   * 获取角色的CLI配置
   */
  protected async getCLIConfig(): Promise<RoleCLIConfig> {
    const role = (this as any).role;
    if (role && typeof role.getCLIConfig === 'function') {
      return await role.getCLIConfig();
    }
    
    // 默认使用Cursor CLI
    return {
      provider: 'cursor',
    };
  }

  /**
   * 执行CLI命令（自动使用角色配置的CLI提供商）
   */
  protected async executeCLI(
    command: string,
    options?: CLIExecutorOptions
  ): Promise<string> {
    const cliConfig = await this.getCLIConfig();
    const workspacePath = options?.workDir || this.getWorkspaceDir(options);
    
    return CLIExecutor.execute(command, {
      workDir: workspacePath,
      provider: cliConfig.provider,
      providerConfig: cliConfig.providerConfig,
      ...options,
    });
  }

  /**
   * 执行带重试的CLI命令
   */
  protected async executeCLIWithRetry(
    command: string,
    checkCommand: string,
    options?: CLIExecutorOptions
  ): Promise<CLIExecutorResult> {
    const cliConfig = await this.getCLIConfig();
    const workspacePath = options?.workDir || this.getWorkspaceDir(options);
    
    return CLIExecutor.executeWithRetry(command, checkCommand, {
      workDir: workspacePath,
      provider: cliConfig.provider,
      providerConfig: cliConfig.providerConfig,
      ...options,
    });
  }

  /**
   * 向后兼容：executeCursorCLI（使用默认Cursor CLI）
   */
  protected async executeCursorCLI(
    command: string,
    options?: CLIExecutorOptions
  ): Promise<string> {
    return this.executeCLI(command, {
      ...options,
      provider: 'cursor',
    });
  }

  /**
   * 向后兼容：executeCursorCLIWithRetry
   */
  protected async executeCursorCLIWithRetry(
    command: string,
    checkCommand: string,
    options?: CLIExecutorOptions
  ): Promise<CLIExecutorResult> {
    return this.executeCLIWithRetry(command, checkCommand, {
      ...options,
      provider: 'cursor',
    });
  }
}
```

#### 3.4.6 本地开发模式支持

**文件**: `backend/src/utils/WorkspaceManager.ts`

```typescript
export class WorkspaceManager {
  /**
   * 判断是否在容器环境中
   */
  static isContainerEnvironment(): boolean {
    return !!process.env.CONTAINER_WORKSPACE_ROOT;
  }

  /**
   * 判断是否为本地开发模式
   */
  static isLocalDevelopmentMode(): boolean {
    return process.env.NODE_ENV === 'development' || 
           process.env.LOCAL_DEV === 'true' ||
           !this.isContainerEnvironment();
  }

  /**
   * 获取workspace路径（自动判断环境）
   */
  static getWorkspacePath(options: WorkspaceOptions): string {
    if (this.isContainerEnvironment()) {
      return this.getContainerWorkspacePath(options);
    }
    return this.getProjectWorkspacePath(options);
  }

  /**
   * 获取本地开发workspace路径
   */
  static getLocalWorkspacePath(options: WorkspaceOptions): string {
    const projectRoot = this.getProjectRoot();
    return path.join(
      projectRoot,
      'workspace',
      options.applicationId || 'default',
      options.projectId || 'default'
    );
  }
}
```

**本地开发配置**:

```env
# .env.local (本地开发环境)
NODE_ENV=development
LOCAL_DEV=true
WORKSPACE_PATH=./workspace

# 角色CLI配置（可选，覆盖默认Cursor CLI）
ROLE_PRODUCTMANAGER_CLI_PROVIDER=cursor
ROLE_ARCHITECT_CLI_PROVIDER=cursor
ROLE_ENGINEER_CLI_PROVIDER=cursor
```

#### 3.4.7 提示词管理

保留提示词系统，但改为Cursor CLI命令的一部分：

```typescript
// 之前: 作为system prompt传递给LLM
const systemPrompt = await loadPrompt(userId, 'prd', 'system_prompt', PRD_SYSTEM_PROMPT);
const result = await this.aask(prompt, [systemPrompt]);

// 之后: 作为命令的一部分传递给Cursor CLI
const systemPrompt = await loadPrompt(userId, 'prd', 'system_prompt', PRD_SYSTEM_PROMPT);
const command = `${systemPrompt}\n\n## 任务\n\n${prompt}\n\n请生成完整的PRD文档，保存到PRD/PRD.md文件中。`;
const result = await this.executeCursorCLI(command, options);
```

### 3.5 工作目录和状态管理

#### 3.4.1 Workspace管理（容器化）

每个工作流容器有独立的workspace卷：

```
容器内路径: /workspace/{applicationId}/{projectId}/
├── MRD/
│   └── MRD.md
├── PRD/
│   └── PRD.md
├── DESIGN/
│   └── DESIGN.md
├── CODE/
│   └── ...
└── TEST/
    └── ...
```

**WorkspaceManager增强**:

```typescript
export class WorkspaceManager {
  /**
   * 获取容器内workspace路径
   * @param options workspace选项
   * @returns 容器内绝对路径
   */
  static getContainerWorkspacePath(options: WorkspaceOptions): string {
    const containerWorkspaceRoot = process.env.CONTAINER_WORKSPACE_ROOT || '/workspace';
    return path.join(
      containerWorkspaceRoot,
      options.applicationId || 'default',
      options.projectId || 'default'
    );
  }

  /**
   * 初始化容器workspace
   * 确保所有必要的目录结构存在
   */
  static async initializeContainerWorkspace(options: WorkspaceOptions): Promise<void> {
    const workspacePath = this.getContainerWorkspacePath(options);
    const directories = ['MRD', 'PRD', 'DESIGN', 'CODE', 'TEST'];
    
    for (const dir of directories) {
      await fs.mkdir(path.join(workspacePath, dir), { recursive: true });
    }
  }
}
```

#### 3.4.2 状态持久化（数据库）

工作流状态存储在PostgreSQL的`workflow_executions`表中：

- **状态隔离**: 通过`project_id`隔离不同项目
- **状态快照**: `workflow_snapshot`保存工作流配置
- **步骤状态**: `steps`数组保存所有步骤的执行状态
- **执行上下文**: `execution_context`保存中间数据

### 3.6 错误处理和重试

统一的重试机制（已在CursorCLIExecutor中实现）：

```typescript
// 使用CursorCLIExecutor.executeWithRetry
const result = await this.executeCursorCLIWithRetry(
  command,
  checkCommand,
  {
    workDir: workspacePath,
    timeout: 3600000,
    maxRetries: 10,
  }
);
```

### 3.7 容器编排设计

#### 3.6.1 容器生命周期管理

```typescript
export class WorkflowContainerManager {
  private containers: Map<string, WorkflowContainer> = new Map();

  /**
   * 创建工作流容器
   */
  async createContainer(config: WorkflowContainerConfig): Promise<WorkflowContainer> {
    // 初始化workspace
    await WorkspaceManager.initializeContainerWorkspace({
      applicationId: config.applicationId,
      projectId: config.projectId,
    });

    // 创建容器实例
    const container = new WorkflowContainer(config);
    this.containers.set(config.projectId, container);

    return container;
  }

  /**
   * 启动工作流容器
   */
  async startContainer(projectId: string): Promise<void> {
    const container = this.containers.get(projectId);
    if (!container) {
      throw new Error(`Container not found for project: ${projectId}`);
    }
    await container.start();
  }

  /**
   * 停止工作流容器
   */
  async stopContainer(projectId: string): Promise<void> {
    const container = this.containers.get(projectId);
    if (container) {
      await container.stop();
    }
  }

  /**
   * 销毁工作流容器
   */
  async destroyContainer(projectId: string): Promise<void> {
    const container = this.containers.get(projectId);
    if (container) {
      await container.stop();
      this.containers.delete(projectId);
    }
  }
}
```

---

## 4. 本地开发模式

### 4.1 本地开发环境设置

#### 4.1.1 环境配置

创建 `.env.local` 文件：

```env
# 本地开发模式
NODE_ENV=development
LOCAL_DEV=true

# Workspace路径（本地文件系统）
WORKSPACE_PATH=./workspace

# 数据库配置（本地PostgreSQL）
DATABASE_URL=postgresql://localhost:5432/testflow

# CLI配置（默认使用Cursor CLI）
DEFAULT_CLI_PROVIDER=cursor
CURSOR_CLI_MODEL=composer-1

# 角色CLI配置（可选，每个角色可以配置不同的CLI）
# ROLE_PRODUCTMANAGER_CLI_PROVIDER=cursor
# ROLE_ARCHITECT_CLI_PROVIDER=aider
# ROLE_ENGINEER_CLI_PROVIDER=cursor
```

#### 4.1.2 启动本地开发

```bash
# 1. 安装依赖
pnpm install

# 2. 启动数据库（如果使用Docker）
docker-compose up -d postgres

# 3. 运行数据库迁移
pnpm run db:migrate

# 4. 启动开发服务器
pnpm run dev

# 5. 在另一个终端启动前端
cd frontend
pnpm run dev
```

#### 4.1.3 本地调试工作流

```typescript
// 本地直接执行工作流（无需容器）
import { WorkflowExecutor } from './workflow/WorkflowExecutor';

const executor = new WorkflowExecutor();
await executor.execute('project-id');
```

### 4.2 角色CLI配置示例

#### 4.2.1 通过环境变量配置

```bash
# 为不同角色配置不同的CLI工具
export ROLE_PRODUCTMANAGER_CLI_PROVIDER=cursor
export ROLE_ARCHITECT_CLI_PROVIDER=aider
export ROLE_ENGINEER_CLI_PROVIDER=cursor
export ROLE_QAENGINEER_CLI_PROVIDER=cursor
```

#### 4.2.2 通过数据库配置

```sql
-- 更新角色定义，添加CLI配置
UPDATE role_definitions 
SET metadata = jsonb_set(
  metadata, 
  '{cli_config}', 
  '{"provider": "aider", "model": "gpt-4"}'
)
WHERE profile = 'Architect';
```

#### 4.2.3 通过代码配置

```typescript
// 在角色构造函数中配置
export class Architect extends Role {
  constructor(context: Context, name: string = 'Architect') {
    // ... 其他初始化
    
    // 配置使用Aider CLI
    this.cliConfig = new RoleCLIConfig(this.profile, context);
    this.cliConfig.updateConfig({
      provider: 'aider',
      providerConfig: {
        model: 'gpt-4',
      },
    });
  }
}
```

### 4.3 本地开发调试工具

#### 4.3.1 CLI工具检查脚本

**文件**: `scripts/check-cli-tools.ts`

```typescript
import { CLIProviderFactory } from '../backend/src/utils/cli/CLIProvider';

async function checkCLITools() {
  const providers = ['cursor', 'aider', 'cline'];
  
  console.log('Checking CLI tools availability...\n');
  
  for (const provider of providers) {
    try {
      const cliProvider = CLIProviderFactory.getProvider(provider as any);
      const available = await cliProvider.checkAvailability();
      const version = available ? await cliProvider.getVersion() : 'Not installed';
      
      console.log(`${provider}: ${available ? '✅' : '❌'} ${version}`);
    } catch (error) {
      console.log(`${provider}: ❌ Not available`);
    }
  }
}

checkCLITools();
```

#### 4.3.2 本地测试Action

```typescript
// 本地测试WritePRD Action
import { WritePRD } from './actions/WritePRD';

const action = new WritePRD();
const result = await action.run(mrdContent, {
  applicationId: 'test-app',
  projectId: 'test-project',
});

console.log('PRD generated:', result.content);
```

---

## 5. 容器化部署方案

### 4.1 Docker容器设计

#### 4.1.1 工作流容器镜像

**Dockerfile**: `docker/workflow-container/Dockerfile`

```dockerfile
FROM node:20-alpine

# 安装系统依赖
RUN apk add --no-cache \
    git \
    curl \
    bash \
    python3 \
    make \
    g++

# 安装Cursor CLI工具
# 注意: 需要根据实际安装方式调整
COPY cursor-agent /usr/local/bin/cursor-agent
RUN chmod +x /usr/local/bin/cursor-agent

# 设置工作目录
WORKDIR /app

# 复制应用代码
COPY backend/package.json backend/pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

COPY backend/ ./backend/
RUN cd backend && pnpm build

# 创建workspace目录
RUN mkdir -p /workspace

# 设置环境变量
ENV NODE_ENV=production
ENV CONTAINER_WORKSPACE_ROOT=/workspace
ENV CURSOR_CLI_MODEL=composer-1

# 暴露端口（如果需要）
EXPOSE 3000

# 启动命令
CMD ["node", "backend/dist/workflow/container-entry.js"]
```

#### 4.1.2 容器入口脚本

**文件**: `backend/src/workflow/container-entry.ts`

```typescript
import { WorkflowContainerManager } from './WorkflowContainerManager';
import { WorkflowExecutionService } from './WorkflowExecutionService';

async function main() {
  const projectId = process.env.PROJECT_ID;
  const applicationId = process.env.APPLICATION_ID;
  
  if (!projectId || !applicationId) {
    throw new Error('PROJECT_ID and APPLICATION_ID must be set');
  }

  const manager = new WorkflowContainerManager();
  const stateService = new WorkflowExecutionService();
  
  // 获取工作流配置
  const workflowConfig = await stateService.getWorkflowConfig(projectId);
  
  // 创建容器
  const container = await manager.createContainer({
    projectId,
    applicationId,
    workflowConfig,
    workspacePath: `/workspace/${applicationId}/${projectId}`,
    stateService,
  });

  // 启动工作流
  await container.start();
}

main().catch(console.error);
```

### 4.2 Kubernetes部署

#### 4.2.1 Deployment配置

**文件**: `k8s/workflow-deployment.yaml`

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: workflow-executor
spec:
  replicas: 1
  selector:
    matchLabels:
      app: workflow-executor
  template:
    metadata:
      labels:
        app: workflow-executor
    spec:
      containers:
      - name: workflow-container
        image: workflow-executor:latest
        env:
        - name: PROJECT_ID
          valueFrom:
            fieldRef:
              fieldPath: metadata.labels['project-id']
        - name: APPLICATION_ID
          valueFrom:
            fieldRef:
              fieldPath: metadata.labels['application-id']
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: database-secret
              key: url
        volumeMounts:
        - name: workspace
          mountPath: /workspace
        resources:
          requests:
            memory: "2Gi"
            cpu: "1"
          limits:
            memory: "4Gi"
            cpu: "2"
      volumes:
      - name: workspace
        persistentVolumeClaim:
          claimName: workspace-pvc
```

#### 4.2.2 工作流Pod创建

```typescript
// 为每个项目创建工作流Pod
async function createWorkflowPod(projectId: string, applicationId: string) {
  const k8s = require('@kubernetes/client-node');
  const k8sApi = k8s.KubeConfig.defaultClient();
  
  const deployment = {
    metadata: {
      name: `workflow-${projectId}`,
      labels: {
        'project-id': projectId,
        'application-id': applicationId,
      },
    },
    spec: {
      // ... deployment spec
    },
  };

  await k8sApi.createNamespacedDeployment('default', deployment);
}
```

### 4.3 工作流迁移到其他容器

#### 4.3.1 工作流导出

```typescript
export interface WorkflowExport {
  projectId: string;
  applicationId: string;
  workflowConfig: WorkflowConfig;
  workspaceSnapshot: WorkspaceSnapshot;
  stateSnapshot: WorkflowState;
}

export class WorkflowExporter {
  /**
   * 导出工作流到可移植格式
   */
  async exportWorkflow(projectId: string): Promise<WorkflowExport> {
    const stateService = new WorkflowExecutionService();
    const state = await stateService.getCurrentState(projectId);
    
    // 导出workspace文件
    const workspaceSnapshot = await this.exportWorkspace(projectId);
    
    // 导出工作流配置
    const workflowConfig = await stateService.getWorkflowConfig(projectId);
    
    return {
      projectId,
      applicationId: state.applicationId,
      workflowConfig,
      workspaceSnapshot,
      stateSnapshot: state,
    };
  }

  /**
   * 导出workspace为tar包
   */
  private async exportWorkspace(projectId: string): Promise<WorkspaceSnapshot> {
    const workspacePath = WorkspaceManager.getContainerWorkspacePath({
      projectId,
    });
    
    // 创建tar包
    const tar = require('tar');
    const tarPath = `/tmp/workspace-${projectId}.tar.gz`;
    await tar.create(
      {
        gzip: true,
        file: tarPath,
        cwd: workspacePath,
      },
      ['.']
    );
    
    return {
      tarPath,
      size: (await fs.stat(tarPath)).size,
    };
  }
}
```

#### 4.3.2 工作流导入

```typescript
export class WorkflowImporter {
  /**
   * 导入工作流到新容器
   */
  async importWorkflow(
    exportData: WorkflowExport,
    targetProjectId: string,
    targetApplicationId: string
  ): Promise<void> {
    // 1. 恢复workspace
    await this.importWorkspace(
      exportData.workspaceSnapshot,
      targetProjectId,
      targetApplicationId
    );
    
    // 2. 恢复状态
    const stateService = new WorkflowExecutionService();
    await stateService.importState(
      targetProjectId,
      exportData.stateSnapshot,
      exportData.workflowConfig
    );
  }

  /**
   * 导入workspace
   */
  private async importWorkspace(
    snapshot: WorkspaceSnapshot,
    projectId: string,
    applicationId: string
  ): Promise<void> {
    const workspacePath = WorkspaceManager.getContainerWorkspacePath({
      projectId,
      applicationId,
    });
    
    // 解压tar包
    const tar = require('tar');
    await tar.extract({
      file: snapshot.tarPath,
      cwd: workspacePath,
    });
  }
}
```

---

## 6. 迁移方案

### 6.1 迁移策略

采用**渐进式迁移 + 容器化改造**策略：

#### 阶段0: 基础设施准备（CLI抽象和本地开发支持）
1. **阶段0.1**: 创建CLI提供商抽象接口（ICLIProvider）
2. **阶段0.2**: 实现CursorCLIProvider（默认）和其他提供商
3. **阶段0.3**: 创建CLIExecutor（通用CLI执行器）
4. **阶段0.4**: 实现RoleCLIConfig（角色CLI配置）
5. **阶段0.5**: 改造WorkspaceManager支持本地/容器模式
6. **阶段0.6**: 创建WorkflowContainer和WorkflowContainerManager
7. **阶段0.7**: 创建Docker镜像和K8s配置

#### 阶段1: Action迁移（保持现有架构）
1. **阶段1.1**: 改造BaseAction，添加Cursor CLI支持
2. **阶段1.2**: 迁移文档生成类Action（WritePRD, WriteDesign, WriteMRD）
3. **阶段1.3**: 迁移Review类Action（PRDReview, DesignReview等）
4. **阶段1.4**: 迁移Improve类Action（ImprovePRD, ImproveDesign等）
5. **阶段1.5**: 迁移其他Action（测试、自动化、数据分析等）

#### 阶段2: 容器化迁移
1. **阶段2.1**: 创建容器入口脚本
2. **阶段2.2**: 实现工作流导出/导入功能
3. **阶段2.3**: 迁移单个工作流到容器测试
4. **阶段2.4**: 批量迁移所有工作流到容器

#### 阶段3: 优化和清理
1. **阶段3.1**: 性能优化和监控
2. **阶段3.2**: 清理LLM相关代码（可选，保留作为fallback）
3. **阶段3.3**: 文档更新

### 6.2 迁移步骤详解

#### 步骤1: 创建CLI提供商抽象（阶段0.1-0.2）

**文件**: `backend/src/utils/cli/CLIProvider.ts`

实现CLI提供商抽象接口和具体提供商（见3.4.1节）。

#### 步骤2: 创建CLIExecutor（阶段0.3）

**文件**: `backend/src/utils/CLIExecutor.ts`

实现通用CLI执行器（见3.4.2节）。

#### 步骤3: 实现RoleCLIConfig（阶段0.4）

**文件**: `backend/src/roles/RoleCLIConfig.ts`

实现角色CLI配置管理（见3.4.3节）。

#### 步骤4: 改造WorkspaceManager（阶段0.5）

**文件**: `backend/src/utils/CursorCLIExecutor.ts`

实现见3.3.1节。

#### 步骤5: 创建WorkflowContainer（阶段0.6）

**文件**: `backend/src/workflow/WorkflowContainer.ts`

实现见3.3.2节。

**文件**: `backend/src/utils/WorkspaceManager.ts`

添加本地/容器模式支持（见3.4.6节）。

**文件**: `backend/src/utils/WorkspaceManager.ts`

添加容器路径支持：

```typescript
export class WorkspaceManager {
  /**
   * 获取容器内workspace路径
   */
  static getContainerWorkspacePath(options: WorkspaceOptions): string {
    const containerRoot = process.env.CONTAINER_WORKSPACE_ROOT || '/workspace';
    return path.join(
      containerRoot,
      options.applicationId || 'default',
      options.projectId || 'default'
    );
  }

  /**
   * 判断是否在容器环境中
   */
  static isContainerEnvironment(): boolean {
    return !!process.env.CONTAINER_WORKSPACE_ROOT;
  }

  /**
   * 获取workspace路径（自动判断环境）
   */
  static getWorkspacePath(options: WorkspaceOptions): string {
    if (this.isContainerEnvironment()) {
      return this.getContainerWorkspacePath(options);
    }
    return this.getProjectWorkspacePath(options);
  }
}
```

#### 步骤6: 改造BaseAction（阶段1.1）

**文件**: `backend/src/core/base/BaseAction.ts`

- 保留`aask()`和`acompletion()`方法（标记为deprecated，逐步移除）
- 添加`executeCursorCLI()`和`executeCursorCLIWithRetry()`方法
- 更新workspace路径获取逻辑

#### 步骤7: 迁移单个Action示例（阶段1.2）

以WritePRD为例：

**之前**:
```typescript
const systemPrompt = await loadPrompt(userId, 'prd', 'system_prompt', PRD_SYSTEM_PROMPT);
const prompt = buildPRDPrompt(mrdContent);
const prdContent = await this.aask(prompt, [systemPrompt]);
```

**之后（使用角色配置的CLI）**:
```typescript
const systemPrompt = await loadPrompt(userId, 'prd', 'system_prompt', PRD_SYSTEM_PROMPT);
const prompt = buildPRDPrompt(mrdContent);
const command = `${systemPrompt}\n\n## 任务\n\n${prompt}\n\n请生成完整的PRD文档，保存到PRD/PRD.md文件中。`;

const workDir = WorkspaceManager.getWorkspacePath({ ...options, documentType: 'PRD' });
// executeCLI会自动使用角色配置的CLI提供商（默认Cursor）
const prdContent = await this.executeCLI(command, {
  workDir,
  timeout: 3600000,
});
```

#### 步骤8: 创建容器入口（阶段2.1）

**文件**: `backend/src/workflow/container-entry.ts`

实现见4.1.2节。

#### 步骤9: 实现工作流导出/导入（阶段2.2）

**文件**: 
- `backend/src/workflow/WorkflowExporter.ts`
- `backend/src/workflow/WorkflowImporter.ts`

实现见4.3节。

#### 步骤10: 更新Role类（阶段1.1）

**文件**: `backend/src/roles/Role.ts`

添加CLI配置支持：

```typescript
export class Role extends BaseRole {
  private cliConfig: RoleCLIConfig;

  constructor(config: IRoleConfig, context: Context) {
    // ... 现有初始化代码
    
    // 初始化CLI配置
    this.cliConfig = new RoleCLIConfig(this.profile, context);
  }

  /**
   * 获取CLI配置
   */
  async getCLIConfig(): Promise<RoleCLIConfig> {
    return await this.cliConfig.getConfig();
  }
}
```

**文件**: `backend/src/roles/Role.ts`, `backend/src/roles/RoleLLMConfig.ts`

- 保留`RoleLLMConfig`类（标记为deprecated）
- 简化Role初始化逻辑，移除LLM配置依赖
- 添加容器环境检测

### 6.3 迁移检查清单

#### Action迁移检查清单

每个Action迁移时需要检查：

- [ ] 是否移除了`aask()`或`acompletion()`调用（或标记为deprecated）
- [ ] 是否添加了`executeCLI()`调用（自动使用角色配置的CLI）
- [ ] 是否正确设置了工作目录（使用`WorkspaceManager.getWorkspacePath()`）
- [ ] 是否正确处理了超时和错误
- [ ] 是否需要重试机制（使用`executeCLIWithRetry()`）
- [ ] 是否支持本地开发模式（无需容器）
- [ ] 是否更新了单元测试
- [ ] 是否更新了相关文档

#### 角色CLI配置检查清单

每个角色配置时需要检查：

- [ ] 是否实现了`getCLIConfig()`方法
- [ ] 是否支持环境变量配置
- [ ] 是否支持数据库配置
- [ ] 是否设置了默认CLI提供商（Cursor）
- [ ] 是否测试了不同CLI提供商的切换

#### 容器化迁移检查清单

每个工作流容器化时需要检查：

- [ ] 是否创建了Docker镜像
- [ ] 是否配置了K8s Deployment
- [ ] 是否挂载了workspace卷
- [ ] 是否配置了环境变量（PROJECT_ID, APPLICATION_ID等）
- [ ] 是否实现了工作流导出功能
- [ ] 是否实现了工作流导入功能
- [ ] 是否测试了容器间迁移
- [ ] 是否配置了资源限制（CPU/内存）
- [ ] 是否配置了健康检查
- [ ] 是否配置了日志收集

---

## 7. 具体Action迁移设计

### 5.1 文档生成类Action

#### 5.1.1 WritePRD

**当前实现**: 使用`aask()`调用LLM生成PRD

**迁移后**:
```typescript
async run(input: string, options?: WritePRDOptions): Promise<IActionOutput> {
  // 1. 准备命令
  const systemPrompt = await loadPrompt(userId, 'prd', 'system_prompt', PRD_SYSTEM_PROMPT);
  const prompt = buildPRDPrompt(mrdContent);
  const command = `${systemPrompt}\n\n## 任务\n\n${prompt}\n\n请生成完整的PRD文档，保存到PRD/PRD.md文件中。`;

  // 2. 执行Cursor CLI
  const workDir = this.getWorkspaceDir({ ...options, documentType: 'PRD' });
  const output = await this.executeCursorCLI(command, {
    workDir,
    timeout: 3600000,
  });

  // 3. 读取生成的文件
  const prdContent = await this.readWorkspaceFile('PRD.md', { ...options, documentType: 'PRD' });
  
  return {
    content: prdContent || output,
    data: { type: 'prd', ... }
  };
}
```

#### 5.1.2 WriteDesign

**迁移方式**: 与WritePRD类似，使用Cursor CLI生成设计文档

#### 5.1.3 WriteMRD

**迁移方式**: 与WritePRD类似，使用Cursor CLI生成MRD文档

### 5.2 Review类Action

#### 5.2.1 PRDReview

**当前实现**: 使用`aask()`调用LLM审核PRD

**迁移后**:
```typescript
async run(prd: string, options?: WorkspaceOptions): Promise<IActionOutput> {
  // 1. 保存PRD到workspace（如果还没有）
  await this.saveToWorkspace('PRD.md', prd, { ...options, documentType: 'PRD' });

  // 2. 构建审核命令
  const reviewPrompt = buildPRDReviewPrompt(prd);
  const command = `请审核PRD/PRD.md文件，检查其完整性、一致性和质量。\n\n${reviewPrompt}\n\n请生成审核报告，保存到PRD/PRD-review.md文件中。`;

  // 3. 执行Cursor CLI
  const workDir = this.getWorkspaceDir({ ...options, documentType: 'PRD' });
  const reviewContent = await this.executeCursorCLI(command, {
    workDir,
    timeout: 1800000,
  });

  // 4. 读取审核结果
  const reviewResult = await this.readWorkspaceFile('PRD-review.md', { ...options, documentType: 'PRD' });
  
  return {
    content: reviewResult || reviewContent,
    data: { type: 'review', ... }
  };
}
```

### 5.3 Improve类Action

#### 5.3.1 ImprovePRD

**迁移方式**: 结合原始PRD和改进建议，使用Cursor CLI生成改进版本

```typescript
async run(prd: string, review: string, options?: WorkspaceOptions): Promise<IActionOutput> {
  const improvePrompt = buildPRDImprovePrompt(prd, review);
  const command = `根据PRD/PRD-review.md中的审核意见，改进PRD/PRD.md文件。\n\n${improvePrompt}\n\n请生成改进后的PRD，保存到PRD/PRD-improved.md文件中。`;

  const workDir = this.getWorkspaceDir({ ...options, documentType: 'PRD' });
  const improvedContent = await this.executeCursorCLI(command, {
    workDir,
    timeout: 3600000,
  });

  // 读取改进后的PRD
  const improvedPRD = await this.readWorkspaceFile('PRD-improved.md', { ...options, documentType: 'PRD' });
  
  return {
    content: improvedPRD || improvedContent,
    data: { type: 'prd', improved: true, ... }
  };
}
```

### 5.4 测试相关Action

#### 5.4.1 WriteTest

**迁移方式**: 参考WriteCode的实现，使用Cursor CLI生成测试代码

#### 5.4.2 TestReview

**迁移方式**: 参考PRDReview的实现，使用Cursor CLI审核测试代码

### 5.5 其他Action

- **CodeReview**: 参考PRDReview
- **RunCode**: 可能需要保留shell命令执行，但可以使用Cursor CLI来准备和执行
- **FixBug**: 使用Cursor CLI分析和修复bug
- **DataAnalysis**: 使用Cursor CLI执行数据分析任务

---

## 8. 配置和依赖调整

### 6.1 移除的配置

以下配置项可以移除或标记为可选：

- LLM提供商配置（`LLM_PROVIDER`, `LLM_API_KEY`等）
- 角色特定的LLM配置
- LLM模型选择配置

### 6.2 新增的配置

可能需要新增的配置：

```env
# Cursor CLI配置
CURSOR_CLI_MODEL=composer-1  # 默认模型
CURSOR_CLI_TIMEOUT=3600000   # 默认超时（毫秒）
CURSOR_CLI_MAX_RETRIES=10    # 默认最大重试次数
```

### 6.3 依赖调整

**移除的依赖**:
- 各种LLM SDK（如果不再需要）

**保留的依赖**:
- `child_process`（用于执行shell命令）
- 文件系统操作（`fs/promises`）

### 8.1 本地开发配置

#### 8.1.1 环境变量配置

**本地开发环境变量**:

```env
# 开发模式标识
NODE_ENV=development
LOCAL_DEV=true

# Workspace路径
WORKSPACE_PATH=./workspace

# 默认CLI提供商
DEFAULT_CLI_PROVIDER=cursor
CURSOR_CLI_MODEL=composer-1

# 角色CLI配置（可选）
ROLE_PRODUCTMANAGER_CLI_PROVIDER=cursor
ROLE_ARCHITECT_CLI_PROVIDER=aider
ROLE_ENGINEER_CLI_PROVIDER=cursor
```

#### 8.1.2 数据库配置

```sql
-- 为角色配置CLI提供商
UPDATE role_definitions 
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'), 
  '{cli_config}', 
  '{"provider": "cursor", "model": "composer-1"}'
)
WHERE profile = 'ProductManager';
```

### 8.2 容器化配置

#### 7.1.1 环境变量配置

**容器环境变量**:

```env
# 容器标识
CONTAINER_WORKSPACE_ROOT=/workspace
PROJECT_ID=${projectId}
APPLICATION_ID=${applicationId}

# Cursor CLI配置
CURSOR_CLI_MODEL=composer-1
CURSOR_CLI_TIMEOUT=3600000
CURSOR_CLI_MAX_RETRIES=10

# 数据库配置
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# 日志配置
LOG_LEVEL=info
LOG_FORMAT=json
```

#### 8.2.2 卷挂载配置

```yaml
# Kubernetes PersistentVolumeClaim
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: workspace-pvc
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 50Gi
```

### 8.3 依赖调整

**新增的依赖**:
- CLI工具（Cursor CLI、Aider等）- 需要在环境中安装

**移除的依赖**:
- 各种LLM SDK（如果不再需要）

**保留的依赖**:
- `child_process`（用于执行shell命令）
- 文件系统操作（`fs/promises`）

---

## 9. 测试策略

### 9.1 单元测试

为每个迁移的Action编写单元测试：

```typescript
describe('WritePRD with Cursor CLI', () => {
  it('should generate PRD using Cursor CLI', async () => {
    const action = new WritePRD();
    const result = await action.run(mrdContent, options);
    expect(result.content).toContain('产品需求文档');
  });
});
```

### 9.2 集成测试

测试完整的角色工作流：

```typescript
describe('ProductManager workflow', () => {
  it('should complete PRD generation workflow', async () => {
    const pm = new ProductManager(context);
    // 执行完整工作流
    const result = await pm.act();
    expect(result).toBeDefined();
  });
});
```

### 9.3 本地开发模式测试

测试本地开发模式下的功能：

```typescript
describe('Local Development Mode', () => {
  it('should use local workspace path', () => {
    process.env.LOCAL_DEV = 'true';
    const path = WorkspaceManager.getWorkspacePath({
      applicationId: 'test-app',
      projectId: 'test-project',
    });
    expect(path).toContain('workspace');
    expect(path).not.toContain('/workspace'); // 不是容器路径
  });

  it('should use role CLI config', async () => {
    process.env.ROLE_PRODUCTMANAGER_CLI_PROVIDER = 'aider';
    const role = new ProductManager(context);
    const config = await role.getCLIConfig();
    expect(config.provider).toBe('aider');
  });
});
```

### 9.4 容器化测试

测试工作流在容器中的执行：

```typescript
describe('WorkflowContainer', () => {
  it('should execute workflow in container', async () => {
    const container = await WorkflowContainerManager.createContainer({
      projectId: 'test-project',
      applicationId: 'test-app',
      workflowConfig: testWorkflowConfig,
      workspacePath: '/tmp/test-workspace',
      stateService: mockStateService,
    });

    await container.start();
    const state = await container.getState();
    expect(state.state).toBe('running');
  });
});
```

### 9.5 工作流迁移测试

测试工作流导出和导入：

```typescript
describe('Workflow Migration', () => {
  it('should export and import workflow', async () => {
    // 导出工作流
    const exporter = new WorkflowExporter();
    const exportData = await exporter.exportWorkflow('source-project');

    // 导入到新容器
    const importer = new WorkflowImporter();
    await importer.importWorkflow(
      exportData,
      'target-project',
      'target-app'
    );

    // 验证状态和文件
    const state = await stateService.getCurrentState('target-project');
    expect(state).toBeDefined();
  });
});
```

### 9.6 CLI提供商切换测试

测试不同CLI提供商的切换：

```typescript
describe('CLI Provider Switching', () => {
  it('should switch between CLI providers', async () => {
    // 测试Cursor CLI
    const cursorResult = await CLIExecutor.execute('test command', {
      workDir: '/tmp',
      provider: 'cursor',
    });
    expect(cursorResult).toBeDefined();

    // 测试Aider CLI（如果可用）
    if (await CLIExecutor.checkProviderAvailability('aider')) {
      const aiderResult = await CLIExecutor.execute('test command', {
        workDir: '/tmp',
        provider: 'aider',
      });
      expect(aiderResult).toBeDefined();
    }
  });
});
```

### 9.7 回归测试

确保现有功能不受影响：

- 所有现有的API端点
- 前端交互功能
- 工作流执行

---

## 10. 风险评估和缓解

### 10.1 风险识别

| 风险 | 影响 | 可能性 | 缓解措施 |
|------|------|--------|----------|
| Cursor CLI不可用 | 高 | 低 | 保留LLM作为fallback选项 |
| 命令执行超时 | 中 | 中 | 增加超时时间，优化命令 |
| 输出格式不一致 | 中 | 中 | 统一输出格式规范 |
| 工作目录冲突 | 低 | 低 | 使用独立的workspace目录（容器隔离） |
| 迁移工作量大 | 中 | 高 | 分阶段迁移，充分测试 |
| 容器资源不足 | 中 | 中 | 配置资源限制和监控 |
| 状态同步问题 | 高 | 低 | 使用数据库事务和乐观锁 |
| 工作流迁移失败 | 中 | 低 | 实现完整的导出/导入测试 |
| 容器间通信问题 | 中 | 低 | 使用API Gateway统一管理 |
| CLI工具不可用 | 高 | 中 | 提供CLI检查工具，支持fallback |
| 本地开发环境不一致 | 中 | 中 | 提供环境检查脚本和文档 |
| 角色CLI配置错误 | 中 | 低 | 提供配置验证和默认值 |

### 10.2 回滚方案

如果迁移出现问题，可以：

1. **快速回滚**: 恢复使用LLM API的代码版本
2. **部分回滚**: 只回滚有问题的Action，其他继续使用Cursor CLI
3. **混合模式**: 部分Action使用Cursor CLI，部分使用LLM API
4. **容器回滚**: 停止问题容器，恢复到之前的容器版本
5. **工作流回滚**: 使用工作流导出功能恢复到之前的状态

---

## 11. 实施计划

### 11.1 时间线

| 阶段 | 时间 | 任务 |
|------|------|------|
| **阶段0: 基础设施** | 7-10天 | CLI提供商抽象, CLIExecutor, RoleCLIConfig, 本地开发支持, WorkflowContainer, Docker/K8s配置 |
| **阶段1: Action迁移** | 10-15天 | 迁移所有Action到CLI（支持角色自定义CLI） |
| **阶段2: 容器化** | 5-7天 | 容器入口, 导出/导入功能, 容器测试 |
| **阶段3: 优化** | 3-5天 | 性能优化, 监控, 文档更新 |

**总计**: 约25-37个工作日（约1-1.5个月）

### 11.2 详细时间分配

#### 阶段0: 基础设施准备（7-10天）
- Day 1-2: CLI提供商抽象接口设计和实现
- Day 3: CursorCLIProvider和其他提供商实现
- Day 4: CLIExecutor实现和测试
- Day 5: RoleCLIConfig实现（环境变量和数据库支持）
- Day 6: WorkspaceManager改造（本地/容器模式）
- Day 7-8: WorkflowContainer和WorkflowContainerManager实现
- Day 9-10: Docker镜像和K8s配置

#### 阶段1: Action迁移（10-15天）
- Day 1-2: BaseAction改造
- Day 3-5: 文档生成类Action（WritePRD, WriteDesign, WriteMRD）
- Day 6-7: Review类Action
- Day 8-9: Improve类Action
- Day 10-12: 测试相关Action
- Day 13-15: 其他Action和测试

#### 阶段2: 容器化（5-7天）
- Day 1-2: 容器入口脚本实现
- Day 3-4: 工作流导出/导入功能
- Day 5-6: 容器测试和调试
- Day 7: 迁移单个工作流到容器

#### 阶段3: 优化（3-5天）
- Day 1-2: 性能优化和监控
- Day 3: 清理和文档
- Day 4-5: 最终测试和发布准备

### 11.3 资源需求

- **开发人员**: 2-3人（1人负责CLI抽象和Action迁移，1人负责容器化，1人负责测试）
- **DevOps**: 1人（负责Docker/K8s配置和本地开发环境）
- **测试人员**: 1-2人
- **文档人员**: 1人（兼职）

### 11.4 里程碑

- [ ] **M0**: 基础设施完成（CLI提供商抽象, CLIExecutor, RoleCLIConfig, 本地开发支持, WorkflowContainer, Docker/K8s）
- [ ] **M1**: BaseAction改造完成，文档生成类Action迁移完成（支持角色CLI配置）
- [ ] **M2**: 所有Action迁移完成，测试通过（本地开发模式可用）
- [ ] **M3**: 容器化完成，单个工作流成功迁移到容器
- [ ] **M4**: 工作流导出/导入功能完成
- [ ] **M5**: 所有工作流迁移到容器，性能优化完成
- [ ] **M6**: 文档更新完成，正式发布

---

## 12. 后续优化

### 12.1 性能优化

- 命令执行缓存
- 并行执行多个命令
- 优化超时设置
- 容器资源优化（CPU/内存分配）
- Workspace文件增量同步

### 12.2 功能增强

- 支持更多Cursor CLI参数
- 支持命令模板
- 支持命令链式执行
- 工作流版本管理
- 工作流快照和回滚
- 多容器负载均衡

### 12.3 监控和日志

- 命令执行时间监控
- 失败率统计
- 详细的执行日志
- 容器资源使用监控
- 工作流执行状态监控
- 告警和通知机制

### 12.4 CLI提供商扩展

- 支持更多CLI工具（Cline, Continue等）
- 支持自定义CLI提供商
- CLI工具版本管理
- CLI工具自动安装和更新

### 12.5 容器化增强

- 自动扩缩容（基于工作流队列长度）
- 容器健康检查
- 优雅关闭和重启
- 容器镜像版本管理
- 多区域部署支持

---

## 13. 工作流迁移到其他容器的完整流程

### 12.1 迁移场景

1. **开发环境 → 生产环境**: 将开发环境的工作流迁移到生产容器
2. **容器故障恢复**: 将故障容器的工作流迁移到新容器
3. **资源优化**: 将工作流迁移到资源更充足的容器
4. **多区域部署**: 将工作流迁移到不同区域的容器

### 12.2 迁移步骤

#### 步骤1: 导出工作流

```typescript
// 1. 停止当前工作流执行
await container.stop();

// 2. 导出工作流
const exporter = new WorkflowExporter();
const exportData = await exporter.exportWorkflow(projectId);

// 3. 保存导出数据（可以保存到对象存储）
await saveToObjectStorage(`workflow-${projectId}.json`, exportData);
```

#### 步骤2: 创建目标容器

```typescript
// 1. 创建新的容器实例
const targetContainer = await WorkflowContainerManager.createContainer({
  projectId: targetProjectId,
  applicationId: targetApplicationId,
  workflowConfig: exportData.workflowConfig,
  workspacePath: `/workspace/${targetApplicationId}/${targetProjectId}`,
  stateService: targetStateService,
});
```

#### 步骤3: 导入工作流

```typescript
// 1. 导入workspace文件
const importer = new WorkflowImporter();
await importer.importWorkspace(
  exportData.workspaceSnapshot,
  targetProjectId,
  targetApplicationId
);

// 2. 导入状态
await importer.importState(
  targetProjectId,
  exportData.stateSnapshot,
  exportData.workflowConfig
);
```

#### 步骤4: 验证和启动

```typescript
// 1. 验证导入结果
const state = await targetContainer.getState();
console.log('Imported state:', state);

// 2. 启动工作流
await targetContainer.start();
```

### 12.3 迁移API

```typescript
export class WorkflowMigrationService {
  /**
   * 迁移工作流到新容器
   */
  async migrateWorkflow(
    sourceProjectId: string,
    targetProjectId: string,
    targetApplicationId: string
  ): Promise<void> {
    // 1. 导出源工作流
    const exporter = new WorkflowExporter();
    const exportData = await exporter.exportWorkflow(sourceProjectId);

    // 2. 导入到目标容器
    const importer = new WorkflowImporter();
    await importer.importWorkflow(
      exportData,
      targetProjectId,
      targetApplicationId
    );

    // 3. 启动目标工作流
    const manager = new WorkflowContainerManager();
    const container = await manager.createContainer({
      projectId: targetProjectId,
      applicationId: targetApplicationId,
      workflowConfig: exportData.workflowConfig,
      workspacePath: `/workspace/${targetApplicationId}/${targetProjectId}`,
      stateService: new WorkflowExecutionService(),
    });
    await container.start();
  }
}
```

### 12.4 迁移检查清单

- [ ] 源工作流已停止
- [ ] 工作流状态已导出
- [ ] Workspace文件已导出
- [ ] 目标容器已创建
- [ ] Workspace文件已导入
- [ ] 工作流状态已导入
- [ ] 状态验证通过
- [ ] 目标工作流启动成功
- [ ] 功能验证通过

---

## 14. 本地开发调试指南

### 14.1 快速开始

```bash
# 1. 克隆项目
git clone <repository>
cd testflow

# 2. 安装依赖
pnpm install

# 3. 配置环境变量
cp config/env.template .env.local
# 编辑 .env.local，设置 LOCAL_DEV=true

# 4. 启动数据库（如果使用Docker）
docker-compose up -d postgres

# 5. 运行数据库迁移
pnpm run db:migrate

# 6. 启动后端开发服务器
pnpm run dev

# 7. 启动前端（另一个终端）
cd frontend
pnpm run dev
```

### 14.2 配置角色CLI

#### 方式1: 环境变量（推荐用于本地开发）

```bash
# .env.local
ROLE_PRODUCTMANAGER_CLI_PROVIDER=cursor
ROLE_ARCHITECT_CLI_PROVIDER=aider
ROLE_ENGINEER_CLI_PROVIDER=cursor
```

#### 方式2: 数据库配置（推荐用于生产）

```sql
UPDATE role_definitions 
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'), 
  '{cli_config}', 
  '{"provider": "aider"}'
)
WHERE profile = 'Architect';
```

### 14.3 检查CLI工具可用性

```bash
# 运行CLI检查脚本
pnpm run check-cli-tools

# 或手动检查
cursor-agent --version
aider --version
```

### 14.4 调试单个Action

```typescript
// test-action.ts
import { WritePRD } from './backend/src/actions/WritePRD';

async function test() {
  const action = new WritePRD();
  const result = await action.run('MRD内容', {
    applicationId: 'test-app',
    projectId: 'test-project',
  });
  console.log(result.content);
}

test();
```

### 14.5 调试完整工作流

```typescript
// test-workflow.ts
import { WorkflowExecutor } from './backend/src/workflow/WorkflowExecutor';

async function test() {
  const executor = new WorkflowExecutor();
  await executor.execute('project-id');
}

test();
```

---

## 15. 附录

### 15.1 参考实现

- `backend/src/actions/WriteCode.ts` - Cursor CLI代码生成实现
- `backend/src/actions/BreakdownTasks.ts` - Cursor CLI任务拆解实现
- `backend/src/utils/commandExecutor.ts` - 命令执行工具

### 15.2 相关文档

- `06_角色系统设计_ROLES.md` - 角色系统设计
- `07_行动系统设计_ACTIONS.md` - Action系统设计
- `08_LLM提供商集成_PROVIDERS.md` - LLM集成文档（迁移后可能需要更新）

### 15.3 命令格式规范

统一使用以下格式：

```bash
cursor-agent --model composer-1 --print "<command>"
```

其中`<command>`是具体的任务指令，应该：
- 清晰描述任务目标
- 包含必要的上下文信息
- 指定输出文件位置
- 使用中文（根据项目要求）

### 15.4 CLI提供商配置示例

#### Cursor CLI配置

```typescript
// 默认配置
{
  provider: 'cursor',
  providerConfig: {
    model: 'composer-1',
    command: 'cursor-agent',
  }
}
```

#### Aider CLI配置

```typescript
{
  provider: 'aider',
  providerConfig: {
    command: 'aider',
    model: 'gpt-4',
  }
}
```

#### 自定义CLI配置

```typescript
// 注册自定义CLI提供商
import { CLIProviderFactory, ICLIProvider } from './cli/CLIProvider';

class CustomCLIProvider implements ICLIProvider {
  async execute(command: string, config: CLIProviderConfig) {
    // 自定义实现
  }
  // ... 其他方法
}

CLIProviderFactory.registerProvider('custom', new CustomCLIProvider());
```

### 15.5 容器化部署示例

#### Docker Compose示例

```yaml
version: '3.8'
services:
  workflow-executor:
    build:
      context: .
      dockerfile: docker/workflow-container/Dockerfile
    environment:
      - PROJECT_ID=${PROJECT_ID}
      - APPLICATION_ID=${APPLICATION_ID}
      - DATABASE_URL=${DATABASE_URL}
      - CONTAINER_WORKSPACE_ROOT=/workspace
    volumes:
      - workspace-data:/workspace
    networks:
      - workflow-network

volumes:
  workspace-data:

networks:
  workflow-network:
    driver: bridge
```

#### Kubernetes Job示例

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: workflow-${PROJECT_ID}
spec:
  template:
    spec:
      containers:
      - name: workflow-container
        image: workflow-executor:latest
        env:
        - name: PROJECT_ID
          value: "${PROJECT_ID}"
        - name: APPLICATION_ID
          value: "${APPLICATION_ID}"
        volumeMounts:
        - name: workspace
          mountPath: /workspace
      volumes:
      - name: workspace
        persistentVolumeClaim:
          claimName: workspace-pvc
      restartPolicy: Never
```

---

## 16. 总结

本迁移方案将系统从依赖多个LLM API的统一架构迁移到使用Cursor CLI的统一执行方式，并支持容器化部署和工作流迁移。

### 16.1 关键优势

**架构优势**:
- ✅ 统一的执行接口（CLI抽象，默认Cursor CLI）
- ✅ 清晰的层次架构（API Gateway → Orchestration → Container → Infrastructure）
- ✅ 容器化支持，每个工作流独立运行
- ✅ 工作流可移植性，支持完整迁移
- ✅ **本地开发支持，无需容器即可调试**

**技术优势**:
- ✅ 简化的配置管理（无需多个LLM提供商配置）
- ✅ 更好的工作目录隔离（容器级别隔离）
- ✅ 一致的错误处理和重试机制
- ✅ 状态持久化（数据库 + 文件系统）
- ✅ **角色自定义CLI，灵活切换不同CLI工具**
- ✅ **CLI提供商抽象，易于扩展**

**运维优势**:
- ✅ 资源隔离（每个容器独立资源限制）
- ✅ 弹性扩展（支持多容器部署）
- ✅ 故障隔离（单个容器故障不影响其他）
- ✅ 易于监控和管理
- ✅ **本地开发快速迭代**

### 16.2 注意事项

- ⚠️ 需要确保CLI工具在环境中可用（Cursor CLI默认，其他可选）
- ⚠️ 需要充分测试每个迁移的Action
- ⚠️ 需要测试工作流迁移功能
- ⚠️ 需要配置合适的资源限制（容器模式）
- ⚠️ 需要确保本地开发环境一致性
- ⚠️ 保留回滚方案以防万一

### 16.3 下一步行动

1. **技术评审**: 评审架构设计和实施方案
2. **POC验证**: 
   - 实现CLI提供商抽象和CLIExecutor
   - 实现本地开发模式支持
   - 实现一个角色的CLI配置
   - 实现一个完整的工作流容器化POC
3. **制定详细计划**: 根据评审结果制定详细的实施计划
4. **开始实施**: 按照阶段0开始实施

---

**文档版本**: 3.0  
**更新日期**: 2026-01-23  
**文档状态**: 优化完成（支持本地开发和角色CLI配置），待技术评审  
**下一步**: 技术评审，POC验证
