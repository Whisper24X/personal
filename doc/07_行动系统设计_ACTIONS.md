# mind2build 行动系统设计文档

**文档版本**: v1.3  
**创建日期**: 2025-12-24  
**最后更新**: 2026-01-07（根据PRD更新，添加知识库集成和RAG检索支持）

## BaseAction 基类

所有 Actions 都继承自 `BaseAction` 基类，提供以下核心功能：

**核心方法**:
- `run(...args: any[]): Promise<IActionOutput>` - 抽象方法，子类必须实现
- `aask(prompt: string, systemMsgs?: string[]): Promise<string>` - 调用 LLM 生成内容
- `acompletion(messages: any[]): Promise<any>` - LLM 聊天完成接口
- `saveToWorkspace(filePath: string, content: string, options?: WorkspaceOptions)` - 保存文件到工作区
- `saveFilesToWorkspace(files: Array<{path: string; content: string}>, options?: WorkspaceOptions)` - 批量保存文件
- `getWorkspaceDir(options?: WorkspaceOptions): string` - 获取工作区目录路径
- `readWorkspaceFile(filePath: string, options?: WorkspaceOptions): Promise<string | null>` - 读取工作区文件
- `readAllFromWorkspace(options?: WorkspaceOptions, filter?: (filename: string) => boolean): Promise<string>` - 读取工作区所有文件

**属性**:
- `name: string` - Action 名称
- `description?: string` - Action 描述
- `llm?: any` - LLM 实例（由 Role 注入）
- `context?: Context` - 上下文实例（由 Role 注入）

**WorkspaceOptions 接口**:
```typescript
interface WorkspaceOptions {
  applicationId?: string; // 应用ID，必须提供且不能为 'default'
  projectId?: string; // 项目ID
  version?: number; // 版本号，默认为 1
  workspacePath?: string; // workspace 路径，默认 ./workspace
  documentType?: 'MRD' | 'PRD' | 'DESIGN' | 'TASKS' | 'CODE' | 'TEST'; // 文档类型
}
```

## 核心 Actions

### 1. WriteMRD

**功能**: 编写市场研究文档（Market Research Document）

**接口**:
```typescript
async run(userIdea: string, options?: WriteMRDOptions): Promise<IActionOutput>
```

**输入**:
- `userIdea: string` - 用户原始需求描述
- `options?: WriteMRDOptions` - 可选配置
  - `mode?: 'new' | 'update'` - 模式：新建或更新
  - `historyMRD?: string` - 历史 MRD 文档（更新模式）
  - `useRAG?: boolean` - 是否使用 RAG 检索
  - `relevantChunks?: string` - RAG 检索到的相关文档片段
  - `useStepwiseGeneration?: boolean` - 是否使用分步骤生成（默认 true）
  - `applicationId?: string` - 应用ID（必须提供）
  - `projectId?: string` - 项目ID
  - `version?: number` - 版本号
  - `workspacePath?: string` - workspace 路径

**输出**: 
- `content: string` - MRD 文档内容
- `data: object` - 包含类型、文件名、时间戳、工作区目录等信息

**关键特性**:
- 支持分步骤生成（默认启用）：大纲 → 章节 → 审查 → 改进
- 支持 RAG 增强搜索（使用历史 MRD 文档）
- 支持更新模式（基于历史 MRD 更新）
- 自动保存到 workspace（MRD 目录）
- 自动审查和改进机制
- 超时错误处理和友好提示

**默认章节结构**:
1. 需求背景与目标价值分析
2. 需求价值分析
3. 用户分析
4. 业务流程分析
5. 市场分析
6. 可行性分析
7. 项目范围

**使用角色**: Salesperson

### 2. MRDReview

**功能**: 审查 MRD 文档

**输入**: MRD 文档内容

**输出**: 审查报告和改进建议

**使用角色**: Salesperson

### 3. WritePRD

**功能**: 编写产品需求文档（Product Requirements Document）

**接口**:
```typescript
async run(input: string, options?: WritePRDOptions): Promise<IActionOutput>
```

**输入**:
- `input: string` - MRD 文档内容或用户需求（优先从 workspace 读取 MRD.md）
- `options?: WritePRDOptions` - 可选配置
  - `mode?: 'new' | 'update'` - 模式：新建或更新
  - `historyPRD?: string` - 历史 PRD 文档（更新模式）
  - `relevantChunks?: string` - RAG 检索到的相关文档片段
  - `useRAG?: boolean` - 是否使用 RAG 检索
  - `useStepwiseGeneration?: boolean` - 是否使用分步骤生成（默认 true）
  - `applicationId?: string` - 应用ID（必须提供，不能为 'default'）
  - `projectId?: string` - 项目ID
  - `version?: number` - 版本号
  - `workspacePath?: string` - workspace 路径

**输出**: 
- `content: string` - PRD 文档内容
- `data: object` - 包含类型、文件名、时间戳、工作区目录等信息

**关键特性**:
- **自动读取 MRD**: 优先从 workspace 读取 `MRD.md` 文件作为输入
- 支持分步骤生成（默认启用）：大纲 → 章节 → 审查 → 改进
- 支持 RAG 增强搜索（使用历史 PRD 文档）
- 支持更新模式（基于历史 PRD 更新）
- 自动保存到 workspace（PRD 目录）
- 自动审查和改进机制
- 超时错误处理和友好提示

**默认章节结构**:
0. 版本说明
1. 产品概述
2. 目标与成功指标
3. 用户故事
4. 功能需求
5. 页面与交互设计说明
6. 非功能需求
7. 技术实现建议
8. 验收与交付标准
9. 风险与应对
10. 附录

**使用角色**: ProductManager

### 4. PRDReview

**功能**: 审查 PRD 文档

**输入**: PRD 文档内容

**输出**: 审查报告和改进建议

**使用角色**: ProductManager

### 5. ImproveDocument

**功能**: 根据审查报告改进和完善 PRD、MRD 或 DESIGN 文档

**接口**:
```typescript
async run(input: string, options?: ImproveDocumentOptions): Promise<IActionOutput>
```

**输入**:
- `input: string` - 审查报告内容或文档类型标识
- `options?: ImproveDocumentOptions` - 可选配置
  - `documentType: 'PRD' | 'MRD' | 'DESIGN'` - 文档类型（必须）
  - `reviewReport?: string` - 审查报告内容（可选，如果不提供则从 workspace 读取）
  - `applicationId?: string` - 应用ID（必须提供，不能为 'default'）
  - `projectId?: string` - 项目ID
  - `version?: number` - 版本号
  - `workspacePath?: string` - workspace 路径

**输出**: 
- `content: string` - 改进后的文档内容
- `data: object` - 包含类型、文件名、时间戳等信息

**关键特性**:
- 支持 PRD、MRD 和 DESIGN 三种文档类型
- 自动从 workspace 读取当前文档和审查报告
- 如果输入包含"审查报告"关键字，自动识别为审查报告
- 根据审查报告中的改进建议，针对性地补充和完善文档内容
- 保持文档的原有结构和格式
- 移除文档中的审查报告部分，只保留改进后的文档内容
- 使用专门的改进提示词（PRD_IMPROVE_SYSTEM_PROMPT、MRD_IMPROVE_SYSTEM_PROMPT）

**使用角色**: ProductManager, Salesperson, Architect

**使用场景**:
- PRD、MRD 或 DESIGN 文档经过审查后，需要根据审查报告中的改进建议完善文档
- 文档内容过于简略，需要补充详细描述
- 功能需求描述不完整，需要补充触发条件、异常流程等

### 6. WriteDesign

**功能**: 编写系统设计文档

**接口**:
```typescript
async run(prd: string, options?: WriteDesignOptions): Promise<IActionOutput>
```

**输入**:
- `prd: string` - PRD 文档内容
- `options?: WriteDesignOptions` - 可选配置
  - `useStepwiseGeneration?: boolean` - 是否使用分步骤生成（默认 true）
  - `applicationId?: string` - 应用ID（必须提供）
  - `projectId?: string` - 项目ID
  - `version?: number` - 版本号
  - `workspacePath?: string` - workspace 路径

**输出**: 
- `content: string` - 设计文档内容
- `data: object` - 包含类型、文件名、时间戳、工作区目录等信息

**关键特性**:
- 支持分步骤生成（默认启用）：大纲 → 章节 → 审查 → 改进
- 自动保存到 workspace（DESIGN 目录）
- 自动审查和改进机制

**默认章节结构**:
1. 系统概述
2. 系统总体架构设计
3. 技术选型总览
4. 前端技术方案设计
5. 后端技术方案设计
6. 数据模型设计
7. 安全性设计
8. 性能与扩展性
9. 日志、错误与监控
10. 测试策略
11. 部署与 DevOps
12. 未来演进方向

**使用角色**: Architect

### 7. DesignReview

**功能**: 审查设计文档

**输入**: 设计文档内容

**输出**: 审查报告和改进建议

**使用角色**: Architect

### 8. WriteCode

**功能**: 编写代码实现

**接口**:
```typescript
async run(design: string, options?: WriteCodeOptions): Promise<IActionOutput>
```

**输入**:
- `design: string` - 设计文档内容
- `options?: WriteCodeOptions` - 可选配置
  - `applicationId?: string` - 应用ID（必须提供）
  - `projectId?: string` - 项目ID
  - `version?: number` - 版本号
  - `workspacePath?: string` - workspace 路径

**输出**: 
- `content: string` - 生成的代码摘要和完整代码
- `data: object` - 包含文件列表、文件数量、工作区目录等信息

**关键特性**:
- 解析 LLM 输出，自动提取多个代码文件
- 自动保存文件到 workspace（CODE 目录）
- 支持文件路径解析（`parseCodeFiles`）
- 生成文件列表摘要

**使用角色**: Engineer

### 9. ExecuteSubtask

**功能**: 执行单个子任务，生成对应的代码

**接口**:
```typescript
async run(taskDescription: string, options?: ExecuteSubtaskOptions): Promise<IActionOutput>
```

**输入**:
- `taskDescription: string` - 任务描述
- `options?: ExecuteSubtaskOptions` - 可选配置
  - `taskId: string` - 要执行的任务ID（必须）
  - `taskDescription: string` - 任务描述（必须）
  - `prd?: string` - PRD 文档（可选）
  - `design?: string` - 设计文档（可选）
  - `taskBreakdown?: string` - 任务拆分文档内容（可选）
  - `applicationId?: string` - 应用ID（必须提供）
  - `projectId?: string` - 项目ID
  - `version?: number` - 版本号
  - `workspacePath?: string` - workspace 路径

**输出**: 
- `content: string` - 代码生成结果
- `data: object` - 包含文件列表、文件数量等信息

**关键特性**:
- 将任务描述转换为设计文档格式，供 WriteCode 使用
- 内部调用 WriteCode 生成代码
- 自动更新子任务状态（标记为已完成）
- 生成任务执行报告（TASK_EXECUTION_REPORT.md）
- 支持从 workspace 加载任务拆分文档

**使用角色**: Engineer

### 10. BreakdownTasks

**功能**: 基于 PRD 和系统设计文档进行任务拆分

**接口**:
```typescript
async run(prd: string, design: string, options?: BreakdownTasksOptions): Promise<IActionOutput>
```

**输入**:
- `prd: string` - PRD 文档内容
- `design: string` - 系统设计文档内容
- `options?: BreakdownTasksOptions` - 可选配置
  - `applicationId?: string` - 应用ID（必须提供）
  - `projectId?: string` - 项目ID
  - `version?: number` - 版本号
  - `workspacePath?: string` - workspace 路径

**输出**: 
- `content: string` - 任务拆分文档内容
- `data: object` - 包含类型、文件名、任务数量、任务列表、工作区目录等信息

**关键特性**:
- 任务拆分符合最小颗粒度原则（1-3天可完成）
- 每个任务独立、可测试、可交付
- 识别任务依赖关系
- 定义任务优先级和验收标准
- 明确任务类型（前端/后端/全栈/基础设施）
- 使用 `SubtaskManager` 解析和管理任务
- 自动保存到 workspace（TASKS 目录）
- 同时保存原始文档和解析后的任务数据

**使用角色**: ProjectManager

### 11. WriteSubProjectDesign

**功能**: 基于任务拆分生成子项目设计文档

**接口**:
```typescript
async run(taskBreakdown: string, design: string, options?: WriteSubProjectDesignOptions): Promise<IActionOutput>
```

**输入**:
- `taskBreakdown: string` - 任务拆分文档内容
- `design: string` - 系统设计文档内容
- `options?: WriteSubProjectDesignOptions` - 可选配置
  - `autoReview?: boolean` - 是否自动审查（默认 true）
  - `autoImprove?: boolean` - 是否自动改进（默认 true）
  - `applicationId?: string` - 应用ID（必须提供）
  - `projectId?: string` - 项目ID
  - `version?: number` - 版本号
  - `workspacePath?: string` - workspace 路径

**输出**: 
- `content: string` - 子项目设计文档内容
- `data: object` - 包含类型、文件名、时间戳、工作区目录等信息

**关键特性**:
- 将相关任务组织成子项目
- 为每个子项目提供详细技术设计
- 定义子项目间的接口和依赖关系
- 确保子项目可独立开发和测试
- 支持自动审查和改进（默认启用）
- 自动保存到 workspace（DESIGN 目录）

**使用角色**: ProjectManager

### 12. SubProjectDesignReview

**功能**: 审查子项目设计文档

**输入**: 子项目设计文档内容

**输出**: 审查报告和改进建议

**使用角色**: ProjectManager

### 13. GenerateTask

**功能**: 为工程师生成详细的任务说明

**接口**:
```typescript
async run(taskBreakdown: string, subProjectDesign?: string, options?: GenerateTaskOptions): Promise<IActionOutput>
```

**输入**:
- `taskBreakdown: string` - 任务拆分文档内容
- `subProjectDesign?: string` - 子项目设计文档内容（可选）
- `options?: GenerateTaskOptions` - 可选配置
  - `applicationId?: string` - 应用ID（必须提供）
  - `projectId?: string` - 项目ID
  - `version?: number` - 版本号
  - `workspacePath?: string` - workspace 路径

**输出**: 
- `content: string` - 任务说明文档内容
- `data: object` - 包含类型、文件名、时间戳、工作区目录等信息

**关键特性**:
- 详细开发指南
- 技术实现方案
- 代码示例和最佳实践
- 测试要点和注意事项
- 自动保存到 workspace（TASKS 目录）

**使用角色**: ProjectManager

### 14. CodeReview

**功能**: 代码审查和反馈

**输入**: 代码内容、任务描述，可选设计文档

**输出**: 代码审查报告（CODE_REVIEW.md）

**关键特性**:
- 代码质量审查（结构、命名、可读性）
- 技术审查（设计规范、性能、安全性）
- 功能审查（任务完成度、边界处理）
- 提供改进建议和代码示例
- 评分（1-10分）

**使用角色**: ProjectManager

### 15. WriteTest

**功能**: 编写测试用例

**接口**:
```typescript
async run(input: string, options?: WriteTestOptions): Promise<IActionOutput>
```

**输入**:
- `input: string` - 代码内容或包含 PRD 和代码的字符串
  - 如果包含 `PRD文档：` 和 `代码实现：`，会自动解析
  - 否则视为纯代码内容
- `options?: WriteTestOptions` - 可选配置
  - `applicationId?: string` - 应用ID（必须提供）
  - `projectId?: string` - 项目ID
  - `version?: number` - 版本号
  - `workspacePath?: string` - workspace 路径

**输出**: 
- `content: string` - 测试用例内容
- `data: object` - 包含类型、文件名、时间戳、工作区目录等信息

**关键特性**:
- 支持基于代码和 PRD 生成测试用例
- 自动解析输入中的 PRD 和代码部分
- 自动保存到 workspace（TEST 目录）
- 生成全面的测试用例，包括单元测试和集成测试

**使用角色**: QAEngineer

### 16. SearchEnhancedQA

**功能**: 增强搜索和问答（用于市场调研和需求验证）

**接口**:
```typescript
async run(question: string): Promise<IActionOutput>
```

**输入**:
- `question: string` - 搜索问题（必须提供）

**输出**: 
- `content: string` - 答案内容
- `data: object` - 包含类型、问题、时间戳等信息

**关键特性**:
- 智能搜索和分析
- 答案增强（提供详细分析）
- 市场趋势分析
- 竞品对比分析
- 可行性评估
- 引用来源追踪

**使用角色**: ProductManager

### 17. DataAnalysis

**功能**: 数据分析和可视化

**输入**: 数据或分析需求

**输出**: 分析代码和可视化结果

**使用角色**: DataAnalyst

### 18. Coordinate

**功能**: 协调团队工作和制定决策

**接口**:
```typescript
async run(allMessages: string): Promise<IActionOutput>
```

**输入**:
- `allMessages: string` - 所有团队成员的消息历史（格式化的字符串）

**输出**: 
- `content: string` - 协调结果和任务分配文档
- `data: object` - 包含类型、时间戳等信息

**关键特性**:
- 分析所有角色的工作进展
- 识别阻塞和问题
- 制定任务分配计划
- 做出关键决策
- 协调团队协作
- 提供优先级排序
- 生成协调计划

**输出格式**:
1. 工作进展总结
2. 问题识别
3. 任务分配
4. 优先级排序
5. 决策建议
6. 协调计划

**使用角色**: TeamLeader

---

## 已实现 Actions 列表

✅ **WriteMRD** - 市场研究文档编写  
✅ **MRDReview** - MRD文档审查  
✅ **WritePRD** - PRD文档编写  
✅ **PRDReview** - PRD文档审查  
✅ **ImproveDocument** - 根据审查报告改进PRD/MRD文档  
✅ **WriteDesign** - 系统设计文档编写  
✅ **DesignReview** - 设计文档审查  
✅ **BreakdownTasks** - 任务拆分  
✅ **WriteSubProjectDesign** - 子项目设计  
✅ **SubProjectDesignReview** - 子项目设计审查  
✅ **GenerateTask** - 任务说明生成  
✅ **WriteCode** - 代码编写  
✅ **ExecuteSubtask** - 子任务执行  
✅ **CodeReview** - 代码审查  
✅ **WriteTest** - 测试用例编写  
✅ **SearchEnhancedQA** - 增强搜索和问答  
✅ **DataAnalysis** - 数据分析和可视化  
✅ **Coordinate** - 团队协调和任务分配

## 自定义 Action

**示例**:
```typescript
import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import { WorkspaceOptions } from '../utils/WorkspaceManager';

export interface CustomActionOptions extends WorkspaceOptions {
  // 自定义选项
}

export class CustomAction extends BaseAction {
  constructor() {
    super('CustomAction', 'Custom action description');
  }
  
  async run(input: string, options?: CustomActionOptions): Promise<IActionOutput> {
    // 1. 构建提示词
    const prompt = `Task: ${input}`;
    
    // 2. 调用 LLM（使用 aask 方法）
    const content = await this.aask(prompt);
    
    // 3. 可选：保存到 workspace
    if (options?.applicationId) {
      await this.saveToWorkspace('output.md', content, options);
    }
    
    // 4. 返回结果
    return {
      content,
      data: {
        type: 'custom',
        timestamp: new Date().toISOString(),
      },
    };
  }
}
```

**注意事项**:
- 继承 `BaseAction` 基类
- 在构造函数中调用 `super(name, description)` 设置名称和描述
- 实现 `run(...args: any[]): Promise<IActionOutput>` 方法
- 使用 `this.aask()` 调用 LLM
- 使用 `this.saveToWorkspace()` 保存文件到工作区
- 使用 `this.getWorkspaceDir()` 获取工作区目录
- 使用 `this.readWorkspaceFile()` 读取工作区文件
- LLM 和 Context 实例由 Role 自动注入，无需手动设置

## 知识库集成

### RAG检索支持

Actions 可以通过 RAGService 检索相关知识库：

**RAG检索示例**:
```typescript
import { RAGService } from '../services/RAGService';

export class WritePRD extends BaseAction {
  async run(input: string, options?: WritePRDOptions): Promise<IActionOutput> {
    const ragService = new RAGService();
    
    // 检索相关PRD文档
    const searchResult = await ragService.searchPRD(
      input,
      options?.applicationId || 'default',
      options?.topK || 5
    );
    
    // 将检索结果注入提示词
    const prompt = buildPRDPrompt(input, searchResult.relevantChunks);
    
    // 生成PRD
    const content = await this.aask(prompt);
    
    return { content, data: {...} };
  }
}
```

### 代码仓库检索

Actions 可以从关联的代码仓库检索相关代码：

**代码仓库检索示例**:
```typescript
// 在WriteCode Action中使用代码仓库
async run(design: string, options?: WriteCodeOptions): Promise<IActionOutput> {
  const ragService = new RAGService();
  
  // 检索代码仓库中的相关代码
  if (options?.codeRepository) {
    const codeResults = await ragService.searchCodeRepository(
      design,
      options.codeRepository
    );
    
    // 将代码示例注入提示词
    const prompt = buildCodePrompt(design, codeResults);
    const content = await this.aask(prompt);
    
    return { content, data: {...} };
  }
}
```

### 知识库自动更新

Actions 执行完成后，可以自动更新知识库：

**知识库更新示例**:
```typescript
async run(input: string, options?: WritePRDOptions): Promise<IActionOutput> {
  // ... 生成PRD ...
  
  // 如果启用自动更新知识库
  if (options?.autoUpdateKnowledge && options?.applicationId) {
    await this.updateKnowledgeBase({
      applicationId: options.applicationId,
      version: options.version,
      documentType: 'PRD',
      content: content
    });
  }
  
  return { content, data: {...} };
}
```

---

**参考**: 完整实现见源码 `backend/src/actions/`
