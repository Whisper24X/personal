# 即思即成（Mind2Build）工作流文档

**Slogan**: 让所思，即所得

**文档版本**: v1.7  
**创建日期**: 2025-12-24  
**最后更新**: 2026-01-26（修正QAEngineer为3步流程，AutomationEngineer为4步流程包含QAConclusion，确认默认工作流配置与代码一致）

## 1. 项目初始化与Git管理流程

### 1.1 GitService 功能概述

系统通过 `GitService` 提供完整的Git仓库管理功能，支持项目创建、版本管理和分支操作。

**GitService 主要方法**（共11个）:

1. **prepareRepository()** - 准备仓库（克隆或拉取）
   - 如果目录不存在或不是Git仓库：克隆远程仓库
   - 如果目录存在且是Git仓库：切换到main/master分支并拉取最新更改

2. **cloneRepository()** - 克隆远程仓库
   - 支持SSH和HTTPS协议
   - 超时时间：5分钟（300000毫秒）

3. **pullRepository()** - 拉取最新更改
   - 自动检测main或master分支
   - 先fetch再pull，确保获取最新状态

4. **createProjectBranch()** - 创建项目分支
   - 分支命名规则：`project/{projectId}`
   - 自动处理本地和远程分支的创建

5. **createBranch()** - 创建版本分支
   - 分支命名规则：`{alias}/{version}`（如：`my-project/v1.0`）
   - 支持从当前HEAD创建或从远程分支创建

6. **checkoutBranch()** - 切换分支
   - 自动处理本地和远程分支的切换
   - 如果本地不存在，自动从远程创建跟踪分支

7. **listBranches()** - 列出所有分支
   - 返回本地分支、远程分支和当前分支

8. **deleteBranch()** - 删除分支
   - 支持删除本地分支和远程分支
   - 不能删除当前正在使用的分支

9. **commitChanges()** - 提交更改
   - 自动添加所有更改
   - 检查是否有更改再提交

10. **pushChanges()** - 推送更改
    - 推送到远程仓库
    - 支持设置上游分支

11. **generateVersionBranchName()** - 生成版本分支名
    - 格式：`{alias}/{version}`
    - 自动转换为Git兼容的分支名格式

### 1.2 项目创建时的Git初始化流程

**流程说明**:
```
用户创建项目（提供gitRepositoryUrl）
  ↓
GitService.prepareRepository()
  ↓
├─ 目录不存在或不是Git仓库
│   → GitService.cloneRepository()
│   → 克隆远程仓库到workspace路径
│
└─ 目录存在且是Git仓库
    → GitService.pullRepository()
    → 切换到main/master分支
    → 拉取最新更改
  ↓
项目创建完成，Git仓库准备就绪
```

**代码位置**: `backend/src/api/controllers/ProjectController.ts` - `create()` 方法

### 1.3 版本创建时的分支管理流程

**流程说明**:
```
用户创建项目版本
  ↓
检查项目是否关联Git仓库
  ↓
├─ 是 → GitService.prepareRepository()
│        → 克隆或拉取仓库
│        ↓
│       GitService.generateVersionBranchName()
│        → 生成分支名：{alias}/{version}
│        ↓
│       GitService.createBranch()
│        → 创建版本分支并checkout
│        ↓
│       版本分支准备就绪
│
└─ 否 → 使用模板工作区
         → 创建版本工作区
```

**版本分支命名规则**:
- 格式：`{projectAlias}/{versionName}`
- 示例：`my-todo-app/v1.0`, `blog-platform/v2.1`
- 项目别名（name_alias）必须是英文，用于Git分支兼容性

**代码位置**: `backend/src/api/controllers/ProjectVersionController.ts` - `create()` 方法

### 1.4 工作流执行时的Git操作

**当前实现**:
- 工作流执行时，所有文档和代码保存到workspace
- Git提交和推送操作由用户手动执行（未来可扩展为自动提交）

**未来扩展**:
- 每个角色完成Action后自动提交
- 工作流完成后自动推送到远程仓库
- 支持配置自动提交消息模板

### 1.5 Git操作与工作流执行的集成点

**集成位置**:

1. **项目创建时** (`ProjectController.create()`):
   - 如果提供 `gitRepositoryUrl`，调用 `GitService.prepareRepository()`

2. **版本创建时** (`ProjectVersionController.create()`):
   - 如果项目关联Git仓库，调用 `GitService.createBranch()` 创建版本分支

3. **版本激活时** (`ProjectVersionController.activate()`):
   - 如果项目关联Git仓库，调用 `GitService.checkoutBranch()` 切换到版本分支

4. **获取分支列表** (`ProjectVersionController.getBranches()`):
   - 调用 `GitService.listBranches()` 获取所有分支信息

### 1.6 Git操作错误处理和回退机制

**错误处理**:
- Git操作失败时，记录错误日志但不中断项目创建
- 如果Git操作失败，回退到使用模板工作区
- 提供友好的错误提示信息

**超时配置**:
- Git操作超时时间：5分钟（300000毫秒）
- 分支操作超时时间：30秒（30000毫秒）
- 可通过环境变量配置（未来扩展）

### 1.7 项目文档和代码存储结构

所有项目内容存储在Git仓库中，目录结构如下：

```
project-repo/
├── MRD/                    # 需求说明文档
│   └── MRD.md
├── PRD/                    # 产品需求文档
│   └── PRD.md
├── DESIGN/                 # 系统设计文档
│   └── DESIGN.md
├── CODE/                   # 源代码
│   ├── src/
│   ├── package.json
│   └── ...
├── TEST/                   # 测试代码
│   └── tests/
└── README.md               # 项目说明
```

### 1.2 项目文档和代码存储结构

所有项目内容存储在Git仓库中，目录结构如下：

```
project-repo/
├── MRD/                    # 需求说明文档
│   └── MRD.md
├── PRD/                    # 产品需求文档
│   └── PRD.md
├── DESIGN/                 # 系统设计文档
│   └── DESIGN.md
├── CODE/                   # 源代码
│   ├── src/
│   ├── package.json
│   └── ...
├── TEST/                   # 测试代码
│   └── tests/
└── README.md               # 项目说明
```

## 2. 标准软件开发流程

### 2.1 默认工作流配置

系统默认工作流配置（定义在 `backend/src/services/defaultWorkflowConfig.ts`）：

```
用户需求
  ↓
Salesperson (Order: 0)
  ├─ WriteMRD → 保存到 MRD/ 目录
  ├─ MRDReview → 审查MRD
  └─ ImproveMRD → 改进MRD
  ↓
ProductManager (Order: 1)
  ├─ WritePRD → 保存到 PRD/ 目录
  ├─ PRDReview → 审查PRD
  └─ ImprovePRD → 改进PRD
  ↓
QAEngineer (Order: 2)
  ├─ WriteTestPlan → 测试计划
  ├─ WriteTest → 测试用例
  └─ TestCaseReview → 用例评审与补充
  ↓
Architect (Order: 3)
  ├─ WriteDesign → 保存到 DESIGN/ 目录
  ├─ DesignReview → 审查设计
  └─ ImproveDesign → 改进设计
  ↓
ProjectManager (Order: 4)
  └─ BreakdownTasks → 保存到 TASKS/ 目录
  ↓
Engineer (Order: 5)
  └─ WriteCode → 保存到 CODE/ 目录
  ↓
AutomationEngineer (Order: 6)
  ├─ AutomationPlanning → 自动化测试规划
  ├─ AutomationExecution → 自动化测试执行
  ├─ CoverageQualityCheck → 覆盖率与质量检查
  └─ QAConclusion → QA结论
  ↓
工作流完成
  ↓
（可选）提交到Git仓库（git commit + git push）
  ↓
输出项目（Git仓库地址和版本分支）
```

**角色顺序说明**:
- **Order 0**: Salesperson - 需求收集和市场调研
- **Order 1**: ProductManager - 产品需求文档
- **Order 2**: QAEngineer - 测试计划（与Architect并行，但先执行）
- **Order 3**: Architect - 系统设计
- **Order 4**: ProjectManager - 任务拆分
- **Order 5**: Engineer - 代码实现
- **Order 6**: AutomationEngineer - 自动化测试和QA结论

**注意**: QAEngineer在Architect之前执行，这样可以提前进行可测性审查。

### 2.2 工作流配置结构

工作流配置存储在 `application_workflows` 表中，结构如下：

```typescript
interface WorkflowConfig {
  roles: Array<{
    profile: string;        // 角色类型（如 'ProductManager'）
    name: string;           // 显示名称（如 'Product Manager'）
    order: number;          // 执行顺序（0, 1, 2...）
    actions: string[];      // Actions列表（按顺序执行）
    watch_actions: string[]; // 监听的Actions（触发条件）
  }>;
}
```

### 2.3 工作流执行机制

- **顺序执行**: 根据 `order` 字段顺序执行角色
- **Action顺序**: 每个角色内的Actions按数组顺序执行（BY_ORDER模式）
- **触发条件**: 角色通过 `watch_actions` 监听前序角色的Actions完成事件
- **状态管理**: 通过 `StateManager` 统一管理执行状态
- **恢复支持**: 支持中断后恢复执行

## 2.1 QA 工作流

### QAEngineer 工作流（3步测试设计流程）

QAEngineer 角色实现了测试设计工作流，包含 3 个 Actions，按顺序执行：

```
PRD + 代码
  ↓
Step 1: WriteTestPlan（制定测试计划）
  ↓ 输出: TEST_PLAN.md
Step 2: WriteTest（测试用例生成）
  ↓ 输出: TEST.md
Step 3: TestCaseReview（用例评审与补充）
  ↓ 输出: TEST_CASES_REVIEWED.md
```

### AutomationEngineer 工作流（4步自动化测试流程）

AutomationEngineer 角色实现了自动化测试工作流，包含 4 个 Actions：

```
测试用例（来自QAEngineer）
  ↓
Step 1: AutomationPlanning（自动化测试规划）
  ↓ 输出: AUTOMATION_PLAN.md
Step 2: AutomationExecution（自动化测试执行）
  ↓ 输出: tests/automated_tests.md
Step 3: CoverageQualityCheck（覆盖率与质量检查）
  ↓ 输出: COVERAGE_REPORT.md, QUALITY_CHECK.md
Step 4: QAConclusion（QA结论）
  ↓ 输出: QA_CONCLUSION.md
最终结论: 通过(pass) / 阻断(block) / 需修改(needs_modification)
```

**注意**: QAConclusion 由 AutomationEngineer 执行，综合所有测试结果和覆盖率报告给出最终QA结论。

### QA 工作流详解

**QAEngineer 工作流**:

| 步骤 | Action | 说明 | 输入 | 输出 |
|------|--------|------|------|------|
| 1 | WriteTestPlan | 制定测试计划 | PRD, 代码 | 测试计划 |
| 2 | WriteTest | 生成测试用例 | PRD, 代码 | 测试用例文档 |
| 3 | TestCaseReview | 补充边界、异常、负面测试 | 测试用例, PRD, 代码 | 审查后的测试用例 |

**AutomationEngineer 工作流**:

| 步骤 | Action | 说明 | 输入 | 输出 |
|------|--------|------|------|------|
| 1 | AutomationPlanning | 评估自动化可行性 | 测试用例（TestCaseReview完成） | 自动化计划 |
| 2 | AutomationExecution | 执行自动化测试 | 自动化计划 | 执行结果 |
| 3 | CoverageQualityCheck | 分析覆盖率和质量 | 测试用例, 代码, 执行结果 | 覆盖率和质量报告 |
| 4 | QAConclusion | 综合所有结果给出结论 | 所有测试文档（包括覆盖率报告） | QA 结论报告 |

### QA 工作流触发条件

- **QAEngineer**: 监听 `ACTION_WRITE_PRD` 和 `ACTION_IMPROVE_PRD`，当PRD完成时开始执行（3步测试设计流程）
- **AutomationEngineer**: 监听 `ACTION_TEST_CASE_REVIEW`，等待 QAEngineer 完成测试用例评审后开始执行（4步自动化测试流程，包括QAConclusion）

## 3. 数据分析流程

```
数据需求 → DataInterpreter → 数据加载 → 分析处理 
→ 可视化 → 输出结果
```

## 4. 增量开发流程

```
已有项目 + 新需求 → 分析现有代码 → 生成增量代码 
→ 合并到项目 → 输出更新
```

## 5. React 模式

### REACT 模式
```python
while not done:
    observe()    # 观察环境
    think()      # LLM 动态决策
    act()        # 执行动作
```

### BY_ORDER 模式
```python
for action in actions:
    act(action)  # 按顺序执行
```

### PLAN_AND_ACT 模式
```python
plan = create_plan()  # 先规划
for step in plan:
    act(step)          # 后执行
```

## 6. 多角色串联工作流

### 6.1 工作流配置

支持将多个角色直接串联，自定义执行顺序和输入输出映射：

```yaml
# workflows/multi-role-chain.yaml
name: 多角色串联工作流
description: ProductManager -> Architect -> Engineer
version: "1.0"

workflow:
  chain:
    - id: step1
      role: ProductManager
      actions: [WritePRD]
      input:
        source: user
        mapping:
          idea: ${user.idea}
      output:
        target: step2
        mapping:
          prd: ${output.prd}
    
    - id: step2
      role: Architect
      actions: [WriteDesign]
      input:
        source: step1
        mapping:
          prd: ${step1.output.prd}
      output:
        target: step3
        mapping:
          design: ${output.design}
    
    - id: step3
      role: Engineer
      actions: [WriteCode]
      input:
        source: [step1, step2]
        mapping:
          prd: ${step1.output.prd}
          design: ${step2.output.design}
      output:
        target: user
        mapping:
          code: ${output.code}
```

### 5.2 输入输出映射

**输入来源类型**:
- `user`: 用户输入
- `step{id}`: 前一个步骤的输出
- `[step1, step2]`: 多个步骤的输出合并
- `constant`: 固定值
- `storage`: 从存储中读取

**输出目标类型**:
- `step{id}`: 传递给下一个步骤
- `user`: 返回给用户
- `storage`: 保存到存储
- `[step1, user]`: 同时传递给多个目标

### 5.3 工作流执行

```typescript
// 创建多角色串联工作流
POST /api/v1/workflow/create
{
  "name": "快速原型工作流",
  "description": "ProductManager -> Architect -> Engineer",
  "chain": [...]
}

// 执行工作流
POST /api/v1/workflow/execute
{
  "workflowId": "workflow-123",
  "input": {
    "idea": "Create a todo app"
  }
}

// 调整工作流顺序
PUT /api/v1/workflow/{workflowId}/reorder
{
  "stepOrder": ["step1", "step3", "step2"]
}
```

## 6. 交互模式工作流

### 6.1 交互模式流程

在交互模式下，每个角色完成后暂停，等待用户确认：

```
[Salesperson] 完成市场研究文档（MRD）
📄 生成文件: MRD.md
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🛑 等待确认 (continue/edit/regenerate/skip/quit):
> c

[ProductManager] 完成PRD文档
📄 生成文件: PRD.md
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🛑 等待确认 (continue/edit/regenerate/skip/quit):
> e  # 用户选择编辑
[编辑器打开 PRD.md，用户修改后保存]
✅ 已保存修改，继续下一步
```

### 6.2 用户操作选项

| 操作 | 命令 | 说明 |
|------|------|------|
| 确认继续 | `continue` / `c` | 接受当前输出，继续下一步 |
| 修改后继续 | `edit` / `e` | 打开编辑器修改输出，然后继续 |
| 重新生成 | `regenerate` / `r` | 要求当前角色重新生成 |
| 跳过节点 | `skip` / `s` | 跳过当前节点，使用现有输出 |
| 查看详情 | `view` / `v` | 查看完整输出内容 |
| 退出流程 | `quit` / `q` | 保存当前状态并退出 |

### 6.3 启用方式

```yaml
# config.yaml
workflow:
  mode: "interactive"  # 或 "auto"
  auto_save: true      # 自动保存每个节点的输出
```

```typescript
// API调用
POST /api/v1/run
{
  "idea": "Create a todo app",
  "interactive": true
}
```

## 7. 自定义工作流

**示例**: 敏捷开发流程
```python
class AgileRole(Role):
    async def _think(self):
        if sprint_planning:
            self.rc.todo = PlanSprint()
        elif development:
            self.rc.todo = WriteCode()
        elif review:
            # CodeReview已移除，代码审查由其他机制处理
        return True
```

## 8. 知识库集成工作流

### 8.1 知识库关联流程

系统支持在项目创建时关联知识库和代码仓库：

```
项目创建
  ↓
关联知识库配置
  ├─ 文档知识库（技术规范、最佳实践）
  ├─ 代码仓库（Git仓库或本地仓库）
  └─ API文档库（接口规范）
  ↓
初始化知识库索引
  ├─ 文档向量化
  ├─ 代码结构分析
  └─ API文档索引
  ↓
知识库就绪，可用于RAG检索
```

### 8.2 知识库检索集成

在角色执行Action时，自动检索相关知识库：

```
角色执行Action
  ↓
生成检索查询（基于需求和上下文）
  ↓
并行检索多源知识库
  ├─ 文档知识库（语义检索）
  ├─ 代码仓库（代码片段检索）
  └─ API文档库（接口检索）
  ↓
结果融合和排序
  ↓
注入到角色上下文
  ↓
生成完整产出（参考知识库）
```

### 8.3 知识库自动更新

每次迭代完成后，自动更新知识库：

```
迭代完成
  ↓
提取产出（文档、代码、设计）
  ↓
向量化和索引化
  ├─ 文档 → 向量数据库
  ├─ 代码 → 代码仓库索引
  └─ API → API文档索引
  ↓
更新知识库版本
  ↓
下一轮迭代可使用更新后的知识库
```

## 9. 工作流可视化设计器

### 9.1 可视化编辑功能

- **拖拽式界面**: 直观拖拽角色节点，快速构建工作流
- **连线编辑**: 通过连线直观配置角色间的输入输出关系
- **顺序调整**: 支持拖拽调整角色执行顺序
- **输入输出映射编辑**: 可视化编辑每个角色的输入来源和输出目标
- **数据映射预览**: 实时预览数据在角色间的流转和转换

### 9.2 工作流验证

- **完整性检查**: 自动检查工作流的完整性，确保所有输入都有来源
- **循环检测**: 检测并提示工作流中的循环依赖
- **类型验证**: 验证输入输出数据的类型匹配
- **执行预览**: 预览工作流的执行顺序和数据流转

### 9.3 工作流管理

- **版本控制**: 支持工作流版本的保存和管理
- **模板库**: 支持工作流模板的保存和复用
- **导入导出**: 支持工作流的导入和导出（YAML/JSON格式）
- **实时生效**: 工作流变更后能立即生效，无需重启

## 10. 角色独立调试工作流

### 10.1 独立调试流程

支持角色独立运行和调试，无需依赖完整工作流：

```
选择角色
  ↓
设置调试选项（断点、日志级别等）
  ↓
提供模拟输入
  ↓
执行角色（独立运行）
  ├─ 观察阶段（模拟消息）
  ├─ 思考阶段（决策逻辑）
  └─ 行动阶段（Action执行）
  ↓
输出调试结果
  ├─ 执行结果
  ├─ 详细日志
  └─ 性能指标
```

### 10.2 调试工具特性

- **独立执行**: 每个角色可以独立运行，不依赖其他角色或工作流
- **输入模拟**: 支持模拟各种输入场景（消息、文档、上下文等）
- **输出验证**: 支持验证角色输出的格式和内容
- **断点调试**: 支持在特定Action处设置断点，暂停执行
- **单步执行**: 支持逐步执行角色的思考和行为过程
- **日志记录**: 详细记录角色的思考过程、Action执行、LLM调用等
- **性能监控**: 监控角色的执行时间、Token使用、API调用次数等

## 11. 超时机制

### 11.1 设计原则

工作流执行层（`WorkflowExecutor`）和 API 控制器层（`RoleActionExecutionController`）不再设置统一的外层超时。超时由各个 Action 自行处理。

**原因**：
- 不同 Action 执行时间差异很大
- 统一的外层超时可能导致长时间运行的 Action 被错误中断并触发重试
- 各 Action 更清楚自己的执行时间需求

### 11.2 各 Action 超时配置

| Action | 操作 | 超时时间 | 说明 |
|--------|------|----------|------|
| WriteCode | apply 命令 | 60 分钟 | cursor-agent 代码生成 |
| WriteCode | check 命令 | 5 分钟 | 任务完成检查 |
| BreakdownTasks | propose 命令 | 60 分钟 | OpenSpec 任务拆分 |
| BreakdownTasks | context 命令 | 30 分钟 | 上下文准备 |
| TestReview | 测试审查 | 10 分钟 | 测试用例审查分析 |
| LLM 请求 | aask 调用 | REQUEST_TIMEOUT | 默认 300 秒 |

### 11.3 配置说明

**LLM 请求超时**：通过环境变量 `REQUEST_TIMEOUT` 配置（单位：秒），默认 300 秒。

```bash
# .env
REQUEST_TIMEOUT=600  # 设置为 10 分钟
```

**Action 内部超时**：在各 Action 实现中通过 `executeCommandSimple` 的 `timeout` 参数配置。

---

**参考**: 实现示例见 examples/
