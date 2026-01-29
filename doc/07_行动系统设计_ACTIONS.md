# mind2build 行动系统设计文档

**文档版本**: v2.0  
**创建日期**: 2025-12-24  
**最后更新**: 2026-01-29（移除7个未使用的Action：SubProjectDesignReview, CodeReview, WriteSubProjectDesign, TestabilityReview, RunCode, FixBug, SearchEnhancedQA，当前共26个Actions）

## Action执行机制

### RoleActionExecutor（行动执行器）

Role类使用`RoleActionExecutor`来处理action的执行逻辑，提供以下功能：

#### 1. 支持Workspace Options的Actions

以下actions支持workspace options参数（applicationId, projectId, version等）：
- `WriteMRD`, `WritePRD`, `WriteDesign`
- `BreakdownTasks`, `WriteCode`, `WriteTest`, `ExecuteSubtask`
- `ImprovePRD`, `ImproveMRD`, `ImproveDesign`, `ImproveTest`
- `MRDReview`, `PRDReview`, `DesignReview`
- `WriteTestPlan`, `TestCaseReview`, `TestReview`
- `AutomationPlanning`, `AutomationExecution`, `CoverageQualityCheck`, `QAConclusion`

这些actions在执行时会自动从消息中提取workspace options，如果找不到则从context中获取。

#### 2. 特殊输入处理

RoleActionExecutor为某些actions提供特殊的输入准备逻辑：

**WriteTest**:
- 自动从memory中查找WritePRD的消息
- 如果找到PRD，将PRD和代码内容组合：`PRD文档：\n{prd}\n\n代码实现：\n{code}`
- 如果找不到PRD，仅使用代码内容

**MRDReview / PRDReview**:
- 优先从`rc.news`中查找对应的文档消息（通过`causeBy`匹配）
- 如果news中找不到，从`rc.memory`中查找
- 如果都找不到，返回空字符串（action会尝试从workspace读取）

**ImprovePRD / ImproveMRD**:
- 优先从`rc.news`中查找审查报告消息（通过`causeBy`匹配）
- 如果news中找不到，从`rc.memory`中查找
- 如果都找不到，返回空字符串（action会尝试从workspace读取）

**BreakdownTasks**:
- 从memory中获取WritePRD和WriteDesign的消息
- 将PRD和Design文档内容传递给action

**ImproveDesign**:
- 优先从`rc.news`中查找审查报告消息（通过`causeBy`匹配DesignReview）
- 如果news中找不到，从`rc.memory`中查找
- 如果都找不到，返回空字符串（action会尝试从workspace读取）

**WriteTestPlan / TestCaseReview**:
- 自动从memory中查找PRD和代码消息
- 组合PRD和代码内容作为输入

#### 3. 序列继续处理（BY_ORDER模式）

在BY_ORDER模式下，当action执行完成后：
- 如果还有更多actions需要执行（`state < actions.length - 1`）：
  - 清除todo，但保留news（供下一个action使用）
  - 下次think()时会自动选择下一个action
- 如果所有actions都已完成：
  - 清除todo和news
  - 重置状态

#### 4. 状态管理

- Action执行前：`action.status = RUNNING`, `role.status = RUNNING`
- Action执行成功：`action.status = COMPLETED`, `role.status = IDLE`
- Action执行失败：`action.status = FAILED`, `role.status = IDLE`（不清理news，允许重试）

#### 5. 超时机制

**设计原则**：超时由各个 Action 自行处理，外层执行器不设置统一超时。

**原因**：
- 不同 Action 执行时间差异很大（如 WritePRD 可能需要几分钟，而 WriteCode 可能需要 30-60 分钟）
- 统一的外层超时可能导致长时间运行的 Action 被错误中断
- 各 Action 更清楚自己的执行时间需求

**各 Action 超时配置**：

| Action | 超时时间 | 说明 |
|--------|----------|------|
| WriteCode | 60 分钟 | cursor-agent apply 命令执行 |
| WriteCode (check) | 5 分钟 | cursor-agent check 命令执行 |
| BreakdownTasks | 60 分钟 | cursor-agent propose 命令执行 |
| BreakdownTasks (context) | 30 分钟 | cursor-agent context 命令执行 |
| 其他 Action | 由 LLM 请求超时控制 | 参考 `REQUEST_TIMEOUT` 环境变量 |

**实现说明**：

- `WorkflowExecutor` 和 `RoleActionExecutionController` 不再设置外层超时
- 各 Action 内部通过 `executeCommandSimple` 等方法设置具体超时
- LLM 请求超时通过 `REQUEST_TIMEOUT` 环境变量控制（默认 300 秒）

---

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

### 5. ImprovePRD

**功能**: 根据审查报告改进和完善 PRD 文档

**接口**:
```typescript
async run(input: string, options?: ImprovePRDOptions): Promise<IActionOutput>
```

**输入**:
- `input: string` - 审查报告内容或 PRD 内容
- `options?: ImprovePRDOptions` - 可选配置
  - `reviewReport?: string` - 审查报告内容（可选，如果不提供则从 workspace 读取）
  - `applicationId?: string` - 应用ID（必须提供）
  - `projectId?: string` - 项目ID（必须提供）
  - `version?: number` - 版本号
  - `workspacePath?: string` - workspace 路径

**输出**: 
- `content: string` - 改进后的 PRD 文档内容
- `data: object` - 包含类型、文档类型、时间戳、原始长度、改进后长度等信息

**关键特性**:
- 自动从 workspace 读取当前 PRD 文档（PRD.md）
- 如果输入包含"审查报告"或"改进建议"关键字，自动识别为审查报告
- 支持从 workspace 读取审查报告（PRD_REVIEW.md 或从主文档末尾提取）
- 根据审查报告中的改进建议，针对性地补充和完善文档内容
- 移除文档中的审查报告部分，只保留改进后的文档内容
- 使用 PRD_IMPROVE_SYSTEM_PROMPT 专门的改进提示词

**使用角色**: ProductManager

### 5.1 ImproveMRD

**功能**: 根据审查报告改进和完善 MRD 文档

**接口**:
```typescript
async run(input: string, options?: ImproveMRDOptions): Promise<IActionOutput>
```

**输入**:
- `input: string` - 审查报告内容或 MRD 内容
- `options?: ImproveMRDOptions` - 可选配置
  - `reviewReport?: string` - 审查报告内容（可选，如果不提供则从 workspace 读取）
  - `applicationId?: string` - 应用ID（必须提供）
  - `projectId?: string` - 项目ID
  - `version?: number` - 版本号
  - `workspacePath?: string` - workspace 路径

**输出**: 
- `content: string` - 改进后的 MRD 文档内容
- `data: object` - 包含类型、文档类型、时间戳等信息

**关键特性**:
- 自动从 workspace 读取当前 MRD 文档（MRD.md）
- 如果输入包含"审查报告"或"改进建议"关键字，自动识别为审查报告
- 根据审查报告中的改进建议，针对性地补充和完善文档内容
- 使用 MRD_IMPROVE_SYSTEM_PROMPT 专门的改进提示词

**使用角色**: Salesperson

### 5.2 ImproveDesign

**功能**: 根据审查报告改进和完善系统设计文档

**接口**:
```typescript
async run(input: string, options?: ImproveDesignOptions): Promise<IActionOutput>
```

**输入**:
- `input: string` - 审查报告内容或 Design 内容
- `options?: ImproveDesignOptions` - 可选配置
  - `reviewReport?: string` - 审查报告内容（可选，如果不提供则从 workspace 读取）
  - `applicationId?: string` - 应用ID（必须提供）
  - `projectId?: string` - 项目ID
  - `version?: number` - 版本号
  - `workspacePath?: string` - workspace 路径

**输出**: 
- `content: string` - 改进后的设计文档内容
- `data: object` - 包含类型、文档类型、时间戳、原始长度、改进后长度等信息

**关键特性**:
- 自动从 workspace 读取当前设计文档（DESIGN.md）
- 如果输入包含"审查报告"或"改进建议"关键字，自动识别为审查报告
- 支持从 workspace 读取审查报告（DESIGN_REVIEW.md 或从主文档末尾提取）
- 根据审查报告中的改进建议，针对性地补充和完善文档内容
- 移除文档中的审查报告部分，只保留改进后的文档内容
- 使用 DESIGN_IMPROVE_SYSTEM_PROMPT 专门的改进提示词

**使用角色**: Architect

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

### 11. WriteTest

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
- 自动保存到 workspace（TEST 目录，文件名 TEST.md）
- 生成全面的测试用例，包括单元测试和集成测试

**使用角色**: QAEngineer

### 12. WriteTestPlan

**功能**: 制定综合测试计划

**接口**:
```typescript
async run(input: string, options?: WriteTestPlanOptions): Promise<IActionOutput>
```

**输入**:
- `input: string` - PRD 和代码内容（格式：`PRD文档：\n{prd}\n\n代码实现：\n{code}`）
- `options?: WriteTestPlanOptions` - 可选配置（继承 WorkspaceOptions）

**输出**: 
- `content: string` - 测试计划内容
- `data: object` - 包含类型、文件名、时间戳、工作区目录等信息

**关键特性**:
- 自动从 workspace 读取可测性审查报告（TESTABILITY_REVIEW.md）
- 自动从 workspace 读取 PRD 文档（如输入中没有）
- 包含测试范围、测试策略、测试资源规划
- 自动保存到 workspace（TEST 目录，文件名 TEST_PLAN.md）

**使用角色**: QAEngineer

### 13. TestCaseReview

**功能**: 审查测试用例并补充边界、异常和负面测试用例

**接口**:
```typescript
async run(input: string, options?: TestCaseReviewOptions): Promise<IActionOutput>
```

**输入**:
- `input: string` - 测试用例内容（如未提供，从 workspace 读取 TEST.md）
- `options?: TestCaseReviewOptions` - 可选配置（继承 WorkspaceOptions）

**输出**: 
- `content: string` - 审查后的测试用例
- `data: object` - 包含类型、文件名、时间戳、工作区目录等信息

**关键特性**:
- 从 workspace 读取测试用例（TEST.md）
- 从 workspace 读取 PRD 和代码作为参考
- 补充边界条件测试用例
- 补充异常情况测试用例
- 补充负面测试用例
- 自动保存到 workspace（TEST 目录，文件名 TEST_CASES_REVIEWED.md）

**使用角色**: QAEngineer

### 14. TestReview

**功能**: 审查测试用例文档的完整性和质量

**接口**:
```typescript
async run(testCasesContent: string, options?: TestReviewOptions): Promise<IActionOutput>
```

**输入**:
- `testCasesContent: string` - 测试用例内容（如内容过短，从 workspace 读取 TEST.md）
- `options?: TestReviewOptions` - 可选配置（继承 WorkspaceOptions）

**输出**: 
- `content: string` - 测试审查报告
- `data: object` - 包含类型、文件名、时间戳、工作区目录等信息

**关键特性**:
- 自动从 workspace 读取测试用例文档
- 从 workspace 读取 PRD 和代码作为参考
- 评估测试用例的完整性
- 评估测试用例的质量
- 自动保存到 workspace（TEST 目录，文件名 TEST_REVIEW.md）

**使用角色**: QAEngineer

### 15. ImproveTest

**功能**: 根据审查报告改进测试用例文档

**接口**:
```typescript
async run(input: string, options?: ImproveTestOptions): Promise<IActionOutput>
```

**输入**:
- `input: string` - 审查报告内容或测试用例内容
- `options?: ImproveTestOptions` - 可选配置
  - `reviewReport?: string` - 审查报告内容（可选，如果不提供则从 workspace 读取）
  - `applicationId?: string` - 应用ID（必须提供）
  - `projectId?: string` - 项目ID（必须提供）
  - `version?: number` - 版本号

**输出**: 
- `content: string` - 改进后的测试用例文档
- `data: object` - 包含类型、文档类型、时间戳、原始长度、改进后长度等信息

**关键特性**:
- 自动从 workspace 读取当前测试用例文档（TEST.md）
- 支持从 workspace 读取审查报告（TEST_REVIEW.md 或从主文档末尾提取）
- 从 workspace 读取 PRD 和代码作为参考
- 根据审查报告改进测试用例
- 移除文档中的审查报告部分
- 自动保存改进后的文档到 workspace（TEST.md）

**使用角色**: QAEngineer

### 16. AutomationPlanning

**功能**: 评估测试用例的自动化可行性并制定自动化计划

**接口**:
```typescript
async run(input: string, options?: AutomationPlanningOptions): Promise<IActionOutput>
```

**输入**:
- `input: string` - 测试用例内容
- `options?: AutomationPlanningOptions` - 可选配置（继承 WorkspaceOptions）

**输出**: 
- `content: string` - 自动化测试计划
- `data: object` - 包含类型、文件名、时间戳、工作区目录等信息

**关键特性**:
- 优先从 workspace 读取审查后的测试用例（TEST_CASES_REVIEWED.md）
- 回退到原始测试用例（TEST.md）
- 从 workspace 读取代码作为参考
- 评估每个测试用例的自动化可行性
- 确定自动化优先级
- 选择合适的自动化技术
- 自动保存到 workspace（TEST 目录，文件名 AUTOMATION_PLAN.md）

**使用角色**: AutomationEngineer

### 17. AutomationExecution

**功能**: 实现和执行自动化测试用例

**接口**:
```typescript
async run(input: string, options?: AutomationExecutionOptions): Promise<IActionOutput>
```

**输入**:
- `input: string` - 自动化计划内容
- `options?: AutomationExecutionOptions` - 可选配置（继承 WorkspaceOptions）

**输出**: 
- `content: string` - 自动化执行结果
- `data: object` - 包含类型、是否跳过、时间戳、工作区目录等信息

**关键特性**:
- 基于自动化计划实现自动化测试
- 执行自动化测试用例
- 收集执行结果

**使用角色**: AutomationEngineer

**注意**: 当前实现为占位符，延迟 1 秒后跳过执行。实际的自动化测试执行需要根据项目技术栈实现。

### 18. CoverageQualityCheck

**功能**: 检查测试覆盖率并进行质量自评

**接口**:
```typescript
async run(input: string, options?: CoverageQualityCheckOptions): Promise<IActionOutput>
```

**输入**:
- `input: string` - 测试用例内容
- `options?: CoverageQualityCheckOptions` - 可选配置（继承 WorkspaceOptions）

**输出**: 
- `content: string` - 覆盖率报告和质量检查报告
- `data: object` - 包含类型、文件名、时间戳、工作区目录等信息

**关键特性**:
- 从 workspace 读取测试用例（优先 TEST_CASES_REVIEWED.md，回退到 TEST.md）
- 从 workspace 读取代码
- 尝试读取测试执行结果（如已执行自动化测试）
- 分析测试覆盖率
- 进行质量自评
- 自动保存到 workspace（TEST 目录，文件名 COVERAGE_REPORT.md 和 QUALITY_CHECK.md）

**使用角色**: AutomationEngineer

### 19. QAConclusion

**功能**: 基于所有测试结果给出最终 QA 结论（通过/阻断/需修改）

**接口**:
```typescript
async run(input: string, options?: QAConclusionOptions): Promise<IActionOutput>
```

**输入**:
- `input: string` - 输入内容（可选，主要从 workspace 读取所有测试文档）
- `options?: QAConclusionOptions` - 可选配置（继承 WorkspaceOptions）

**输出**: 
- `content: string` - QA 结论报告
- `data: object` - 包含类型、文件名、时间戳、工作区目录、结论状态等信息

**关键特性**:
- 从 workspace 读取所有测试相关文档：
  - TESTABILITY_REVIEW.md - 可测性审查
  - TEST_PLAN.md - 测试计划
  - TEST.md - 测试用例
  - TEST_CASES_REVIEWED.md - 审查后的测试用例
  - AUTOMATION_PLAN.md - 自动化计划
  - tests/automated_tests.md - 自动化执行结果
  - COVERAGE_REPORT.md - 覆盖率报告
  - QUALITY_CHECK.md - 质量检查报告
- 从 workspace 读取 PRD 文档
- 综合分析所有测试结果
- 给出最终结论（pass/block/needs_modification）
- 自动保存到 workspace（TEST 目录，文件名 QA_CONCLUSION.md）

**使用角色**: QAEngineer

### 20. DataAnalysis

**功能**: 数据分析和可视化

**输入**: 数据或分析需求

**输出**: 分析代码和可视化结果

**使用角色**: DataAnalyst

### 21. Coordinate

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

### 文档编写 Actions
✅ **WriteMRD** - 市场研究文档编写  
✅ **WritePRD** - PRD文档编写  
✅ **WriteDesign** - 系统设计文档编写  
✅ **WriteCode** - 代码编写  
✅ **WriteTest** - 测试用例编写  
✅ **WriteTestPlan** - 测试计划制定  
✅ **GeneratePrototype** - 生成原型

### 文档审查 Actions
✅ **MRDReview** - MRD文档审查  
✅ **PRDReview** - PRD文档审查  
✅ **DesignReview** - 设计文档审查  

### 文档改进 Actions
✅ **ImprovePRD** - 根据审查报告改进PRD文档  
✅ **ImproveMRD** - 根据审查报告改进MRD文档  
✅ **ImproveDesign** - 根据审查报告改进设计文档  
✅ **ImproveTest** - 根据审查报告改进测试用例  

### 任务管理 Actions
✅ **BreakdownTasks** - 任务拆分  
✅ **ExecuteSubtask** - 子任务执行  

### OpenSpec Actions (ProjectManager)
✅ **FillProjectContext** - 填充项目上下文  
✅ **CreateOpenSpecProposal** - 创建变更提案  
✅ **ValidateOpenSpecProposal** - 验证变更提案  
✅ **EstimateStoryPoints** - 故事点评估  
✅ **ValidateStoryPointEstimates** - 验证故事点评估  

### 代码执行 Actions
✅ **Deploy** - 部署应用程序

### QA 工作流 Actions (QAEngineer)
✅ **WriteTestPlan** - 测试计划制定（已在文档编写Actions中列出）
✅ **WriteTest** - 测试用例编写（已在文档编写Actions中列出）
✅ **TestCaseReview** - 测试用例评审与补充  
✅ **TestReview** - 测试用例文档审查  
✅ **ImproveTest** - 根据审查报告改进测试用例（已在文档改进Actions中列出）

**注意**: WriteTestPlan、WriteTest 和 ImproveTest 已在其他分类中列出，此处仅作说明。

### 自动化测试 Actions (AutomationEngineer)
✅ **AutomationPlanning** - 自动化测试规划  
✅ **AutomationExecution** - 自动化测试执行  
✅ **CoverageQualityCheck** - 测试覆盖率与质量检查  
✅ **QAConclusion** - QA结论输出（综合所有测试结果和覆盖率报告）  

### 其他 Actions
✅ **DataAnalysis** - 数据分析和可视化  
✅ **Coordinate** - 团队协调和任务分配

**共计 26 个 Actions**

**统计**:
- 文档编写: 7个 (WriteMRD, WritePRD, WriteDesign, WriteCode, WriteTest, WriteTestPlan, GeneratePrototype)
- 文档审查: 3个 (MRDReview, PRDReview, DesignReview)
- 文档改进: 4个 (ImprovePRD, ImproveMRD, ImproveDesign, ImproveTest)
- 任务管理: 2个 (BreakdownTasks, ExecuteSubtask)
- OpenSpec: 5个 (FillProjectContext, CreateOpenSpecProposal, ValidateOpenSpecProposal, EstimateStoryPoints, ValidateStoryPointEstimates)
- 代码执行: 1个 (Deploy)
- QA工作流: 5个 (WriteTestPlan, WriteTest, TestCaseReview, TestReview, ImproveTest)
- 自动化测试: 4个 (AutomationPlanning, AutomationExecution, CoverageQualityCheck, QAConclusion)
- 其他: 2个 (DataAnalysis, Coordinate)

**注意**: 
- WriteTestPlan、WriteTest 和 ImproveTest 在多个分类中都有涉及，但实际只计算一次
- **QAConclusion属于AutomationEngineer角色，不属于QAEngineer**
- QAEngineer包含3个Actions：WriteTestPlan, WriteTest, TestCaseReview
- AutomationEngineer包含4个Actions：AutomationPlanning, AutomationExecution, CoverageQualityCheck, QAConclusion

## 自定义 Action

系统采用配置驱动的动态加载架构，添加新 Action 只需修改少量文件，无需改动核心业务代码。

### 步骤 1: 创建 Action 类文件

在 `backend/src/actions/` 目录下创建 Action 文件：

```typescript
// backend/src/actions/CustomAction.ts
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

### 步骤 2: 注册到 ACTION_REGISTRY

修改 `backend/src/actions/index.ts`：

```typescript
// 添加 export
export { CustomAction } from './CustomAction';

// 在 ACTION_REGISTRY 中添加（这是唯一需要修改的代码文件）
export const ACTION_REGISTRY: Record<string, new () => BaseAction> = {
  // 文档编写 Actions
  WriteMRD, WritePRD, WriteDesign,
  WriteCode, WriteTest, WriteTestPlan, GeneratePrototype,
  // 文档审查 Actions
  MRDReview, PRDReview, DesignReview,
  // ... 其他 Actions
  CustomAction,  // 添加新 Action
};
```

### 步骤 3: 运行数据库迁移

```bash
cd backend
npx ts-node --transpile-only src/database/migrations/init_role_action_definitions.ts
```

迁移脚本会自动从 ACTION_REGISTRY 读取 Action 信息并更新数据库。

### 注意事项

- 继承 `BaseAction` 基类
- 在构造函数中调用 `super(name, description)` 设置名称和描述
- 实现 `run(...args: any[]): Promise<IActionOutput>` 方法
- 使用 `this.aask()` 调用 LLM
- 使用 `this.saveToWorkspace()` 保存文件到工作区
- 使用 `this.getWorkspaceDir()` 获取工作区目录
- 使用 `this.readWorkspaceFile()` 读取工作区文件
- LLM 和 Context 实例由 Role 自动注入，无需手动设置
- **核心文件零修改**: Controller、Service 等核心业务文件无需改动

### 架构优势

```
┌─────────────────────────────────────────┐
│  actions/index.ts (ACTION_REGISTRY)     │  ← 唯一需要修改的代码文件
├─────────────────────────────────────────┤
│  RoleActionFactory                      │  ← 自动从 REGISTRY 读取
├─────────────────────────────────────────┤
│  Database (action_definitions)          │  ← 元数据存储
├─────────────────────────────────────────┤
│  Controllers / Services                 │  ← 无需修改
└─────────────────────────────────────────┘
```

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
