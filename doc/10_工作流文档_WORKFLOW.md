# 即思即成（Mind2Build）工作流文档

**Slogan**: 让所思，即所得

**文档版本**: v1.5  
**创建日期**: 2025-12-24  
**最后更新**: 2026-01-23（移除外层超时机制，超时由各个 Action 自行处理）

## 1. 项目初始化与Git管理流程

### 1.1 Git仓库初始化流程

系统使用Git来管理每个项目，所有文档（MRD、PRD、系统设计文档等）和代码都存储在Git仓库中。

**初始化流程**:
```
用户提供项目需求
  ↓
检查是否提供Git仓库地址
  ↓
├─ 是 → 执行 git clone <repository_url>
│        ↓
│      检查仓库中是否已有文档或代码
│        ↓
│      ├─ 有 → 根据版本号创建新分支（v2, v3...）
│      └─ 无 → 在 main 分支开始工作
│
└─ 否 → 创建新的Git仓库
         ↓
       初始化仓库（git init）
         ↓
       创建初始提交
```

**版本分支管理**:
- 每个版本对应一个Git分支：`v1`, `v2`, `v3`...
- 主分支（`main`）存储最新稳定版本
- 如果检测到已有文档或代码，自动创建新版本分支
- 所有文档和代码提交到对应版本分支

**Git操作示例**:
```bash
# 初始化项目时
git clone https://github.com/user/project.git
cd project

# 检查是否存在已有版本
git branch -a | grep "v[0-9]"

# 如果存在v1分支，创建v2分支
git checkout -b v2

# 生成文档和代码后，提交到版本分支
git add .
git commit -m "feat: 生成v2版本文档和代码"
git push origin v2
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

```
用户需求 + Git仓库地址
  ↓
Git仓库初始化（git clone 或 git init）
  ↓
检查版本并创建分支（如 v1, v2...）
  ↓
Salesperson(WriteMRD) → 保存到 MRD/ 目录
  ↓
ProductManager(WritePRD) → 保存到 PRD/ 目录
  ↓
Architect(WriteDesign) → 保存到 DESIGN/ 目录
  ↓
Engineer(WriteCode) → 保存到 CODE/ 目录
  ↓
QAEngineer(完整QA工作流) → 保存到 TEST/ 目录
  ↓
提交到Git仓库（git commit + git push）
  ↓
输出项目（Git仓库地址和版本分支）
```

## 2.1 QA 工作流（9 步 QA 流程）

QAEngineer 角色实现了完整的质量保证工作流，包含 8 个 Actions，按顺序执行：

```
PRD + 代码
  ↓
Step 1: TestabilityReview（可测性审查）
  ↓ 输出: TESTABILITY_REVIEW.md
Step 2: WriteTestPlan（制定测试计划）
  ↓ 输出: TEST_PLAN.md
Step 3: WriteTest（测试用例生成）
  ↓ 输出: TEST.md
Step 4: TestCaseReview（用例评审与补充）
  ↓ 输出: TEST_CASES_REVIEWED.md
Step 5: AutomationPlanning（自动化测试规划）
  ↓ 输出: AUTOMATION_PLAN.md
Step 6: AutomationExecution（自动化测试执行）
  ↓ 输出: tests/automated_tests.md
Step 7: CoverageQualityCheck（覆盖率与质量检查）
  ↓ 输出: COVERAGE_REPORT.md, QUALITY_CHECK.md
Step 8: QAConclusion（QA 结论）
  ↓ 输出: QA_CONCLUSION.md
最终结论: 通过(pass) / 阻断(block) / 需修改(needs_modification)
```

### QA 工作流详解

| 步骤 | Action | 说明 | 输入 | 输出 |
|------|--------|------|------|------|
| 1 | TestabilityReview | 审查 PRD 和代码的可测性 | PRD, 代码 | 可测性审查报告 |
| 2 | WriteTestPlan | 基于可测性审查制定测试计划 | PRD, 代码, 可测性报告 | 测试计划 |
| 3 | WriteTest | 生成测试用例 | PRD, 代码 | 测试用例文档 |
| 4 | TestCaseReview | 补充边界、异常、负面测试 | 测试用例, PRD, 代码 | 审查后的测试用例 |
| 5 | AutomationPlanning | 评估自动化可行性 | 测试用例, 代码 | 自动化计划 |
| 6 | AutomationExecution | 执行自动化测试 | 自动化计划 | 执行结果 |
| 7 | CoverageQualityCheck | 分析覆盖率和质量 | 测试用例, 代码, 执行结果 | 覆盖率和质量报告 |
| 8 | QAConclusion | 综合所有结果给出结论 | 所有测试文档 | QA 结论报告 |

### QA 工作流触发条件

QAEngineer 监听以下 Actions 完成事件：
- `ACTION_WRITE_PRD` - ProductManager 完成 PRD
- `ACTION_WRITE_CODE` - Engineer 完成代码

当两者都完成时，QAEngineer 开始执行完整的 9 步 QA 工作流。

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
            self.rc.todo = CodeReview()
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
| CodeReview | 代码审查 | 10 分钟 | 代码审查分析 |
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
