# 即思即成（Mind2Build）角色系统设计文档

**文档版本**: v1.7  
**创建日期**: 2025-12-24
**最后更新**: 2026-01-22（拆分QAEngineer和AutomationEngineer角色，添加配置驱动的角色注册机制）

## Role类实现架构

### 核心组件

Role类采用模块化设计，将职责分离到不同的组件中：

#### 1. RoleActionExecutor（行动执行器）

**职责**: 处理action执行逻辑，包括输入准备、执行和状态管理

**核心功能**:
- 支持workspace options的actions列表（WriteMRD, WritePRD, WriteDesign等）
- 特殊输入处理：
  - `WriteTest`: 自动从memory中获取PRD文档，组合PRD和代码作为输入
  - `MRDReview/PRDReview`: 从news或memory中查找对应的文档内容
  - `ImprovePRD/ImproveMRD/ImproveDesign`: 从news或memory中查找审查报告
  - `WriteTestPlan/TestabilityReview`: 自动从memory中获取PRD和代码
- 序列继续处理（BY_ORDER模式）：自动处理action序列的执行和状态清理
- 状态管理：action执行时设置为RUNNING，完成后设置为COMPLETED，失败时设置为FAILED

**支持的Actions（带workspace options）**:
```typescript
const ACTIONS_WITH_OPTIONS = [
  'WriteMRD', 'WritePRD', 'WriteDesign', 'WriteSubProjectDesign',
  'BreakdownTasks', 'WriteCode', 'WriteTest', 'WriteTestPlan',
  'ExecuteSubtask', 'ImprovePRD', 'ImproveMRD', 'ImproveDesign', 'ImproveTest',
  'MRDReview', 'PRDReview', 'DesignReview', 'SubProjectDesignReview',
  'TestabilityReview', 'TestCaseReview', 'TestReview',
  'AutomationPlanning', 'AutomationExecution', 'CoverageQualityCheck', 'QAConclusion'
];
```

#### 2. RoleThinker（思考决策器）

**职责**: 处理角色决策逻辑，决定下一步要执行的action

**支持的React模式**:
- **BY_ORDER**: 按顺序执行actions，支持序列继续
  - 检查是否有相关消息（匹配watch set）
  - 如果已有todo，保持不变
  - 如果在序列中，继续下一个action
  - 否则从第一个action开始新序列
- **REACT**: LLM动态决策（MVP阶段使用简单逻辑）
- **PLAN_AND_ACT**: 先计划后执行（MVP阶段类似BY_ORDER）

**状态管理**:
- `state: -1` 表示初始/终止状态
- `state >= 0` 表示正在执行序列中的某个action
- 序列完成后重置state为-1

#### 3. RoleLLMConfig（LLM配置管理器）

**职责**: 管理角色的LLM配置，支持从数据库加载角色特定配置

**配置优先级**:
1. **数据库配置（最高优先级）**: 从`role_llm_configs`表加载角色特定的LLM配置
2. **显式配置**: 构造函数中传入的`config.llm`
3. **默认配置（最低优先级）**: 使用系统默认的LLM配置（`context.llm`）

**功能特性**:
- 异步加载数据库配置（`startLoadingFromDatabase()`）
- 自动更新actions的LLM实例
- 支持fallback到active LLM config（如果角色特定配置不存在）

**数据库配置字段**:
- `provider`: LLM提供商（如'openai', 'zhipu'等）
- `api_key`: API密钥
- `base_url`: API基础URL（可选）
- `model`: 模型名称
- `temperature`: 温度参数（可选）
- `max_tokens`: 最大token数（可选）
- `repository`: 代码仓库（可选）
- `branch_name`: 分支名称（可选）
- `auto_create_pr`: 是否自动创建PR（可选）

#### 4. RoleWorkspaceExtractor（工作区选项提取器）

**职责**: 从消息和上下文中提取workspace选项（applicationId, projectId, version等）

**提取策略**:
1. 从`rc.news`中查找消息的`instructContent`
2. 从`rc.memory`中查找WritePRD、WriteDesign、WriteMRD的消息
3. 解析`workspaceDir`路径（支持新格式和旧格式）
4. Fallback到context中的applicationId和projectId

**支持的路径格式**:
- 新格式: `workspace/{applicationId}/{projectId}/v{version}/{documentType}/`
- 旧格式（无projectId）: `workspace/{applicationId}/v{version}/{documentType}/`
- 遗留格式: `{applicationId}-v{version}-{documentType}`

**文档类型映射**:
```typescript
const DOCUMENT_TYPE_MAP = {
  WriteMRD: 'MRD',
  WritePRD: 'PRD',
  WriteDesign: 'DESIGN',
  WriteSubProjectDesign: 'DESIGN',
  BreakdownTasks: 'TASKS',
  WriteCode: 'CODE',
  WriteTest: 'TEST',
  WriteTestPlan: 'TEST',
  TestabilityReview: 'TEST',
  TestCaseReview: 'TEST',
  TestReview: 'TEST',
  ImproveTest: 'TEST',
  AutomationPlanning: 'TEST',
  AutomationExecution: 'TEST',
  CoverageQualityCheck: 'TEST',
  QAConclusion: 'TEST',
  ExecuteSubtask: 'CODE'
};
```

### Role类核心方法

#### observe(): Promise<number>
- 从消息缓冲区获取新消息
- 将新消息添加到news和memory
- 检查消息是否匹配watch set
- 返回新消息数量

#### think(): Promise<boolean>
- 委托给`RoleThinker.think()`
- 根据reactMode选择相应的决策策略
- 返回是否有待执行的action

#### act(): Promise<Message | null>
- 委托给`RoleActionExecutor.act()`
- 执行当前todo action
- 返回action产生的消息

#### run(): Promise<Message | null>
- 主执行循环：observe -> think -> act
- 处理边界情况（无新消息、无todo等）
- 返回action产生的消息或null

### 状态管理

**RoleStatus（角色状态）**:
- `IDLE`: 空闲状态
- `PENDING`: 有待执行的任务
- `RUNNING`: 正在执行action
- `FAILED`: 执行失败

**ActionStatus（Action状态）**:
- `PENDING`: 待执行
- `RUNNING`: 执行中
- `COMPLETED`: 已完成
- `FAILED`: 执行失败

**状态转换流程**:
```
IDLE -> PENDING (think()选择action) 
  -> RUNNING (act()开始执行)
    -> IDLE (执行完成) 或 FAILED (执行失败)
```

---

## 核心角色

### 0. Salesperson (销售)

**职责**: 收集需求、进行市场调研和业务分析，产出市场研究文档（MRD）

**核心属性**:
```typescript
class Salesperson extends Role {
    name = "Salesperson"
    profile = "Salesperson"
    goal = "需求收集专家，负责收集和分析用户需求，进行市场调研和业务分析，输出市场研究文档（MRD）"
    constraints = "深入理解用户需求，进行市场调研、目标价值分析、需求价值分析和业务流程分析"
    description = "我是一名专业的需求收集和市场研究专家，擅长与客户沟通，深入理解用户需求，进行市场调研和业务分析，并将其转化为清晰的市场研究文档（MRD）。"
    // 监听: User 消息（用户原始需求）
    // Actions: WriteMRD
}
```

**工作流程**:
1. 监听用户原始需求（`watch(['User'])`）
2. 接收用户消息后，触发 WriteMRD Action
3. 进行目标价值分析和需求价值分析
4. 进行市场调研和竞品分析
5. 生成业务流程分析
6. 编写市场研究文档（MRD - Market Research Document）
7. 发布 MRD 给 ProductManager（通过 WriteMRD action 输出）

**监听机制**:
- 监听 `User` 消息类型（用户初始需求）
- 作为工作流的第一个角色，负责接收和处理用户输入

**输出产物**:
- 市场研究文档（MRD.md）
  - 需求背景与目标价值分析
  - 需求价值分析（优先级、重要程度、业务价值）
  - 用户分析（用户画像、痛点、使用场景）
  - 业务流程分析（业务流程图、功能逻辑、模块关系）
  - 市场分析（竞品分析、差异化优势、市场机会）
  - 可行性分析（商业可行性、风险评估）
  - 项目范围

### 1. ProductManager (产品经理)

**职责**: 基于市场研究文档（MRD）编写 PRD、产品规划

**核心属性**:
```typescript
class ProductManager extends Role {
    name = "ProductManager"
    profile = "ProductManager"
    goal = "Create comprehensive Product Requirements Document (PRD) from Market Research Document (MRD)"
    constraints = "Focus on user needs, market analysis, and clear feature specifications. Transform MRD into detailed, executable PRD"
    description = "Experienced product manager who transforms Market Research Documents (MRD) into detailed Product Requirements Documents (PRD)"
    // 监听: ACTION_WRITE_MRD action（来自 Salesperson）
    // Actions: WritePRD, SearchEnhancedQA
}
```

**工作流程**:
1. 监听 Salesperson 的 WriteMRD action 输出（`watch([ACTION_WRITE_MRD])`）
2. 接收市场研究文档（MRD）
3. 使用 RAG 检索历史 PRD 文档（如可用，通过 SearchEnhancedQA）
4. 基于 MRD 和历史 PRD 编写产品需求文档 PRD（WritePRD）
5. 发布 PRD 给 Architect（通过 WritePRD action 输出）

**监听机制**:
- 监听 `ACTION_WRITE_MRD` action 完成事件（使用常量 `ACTION_WRITE_MRD`）
- 等待 Salesperson 完成 MRD 文档生成后触发

### 2. Architect (架构师)

**职责**: 系统设计、架构规划

**核心属性**:
```typescript
class Architect extends Role {
    name = "Architect"
    profile = "Architect"
    goal = "Design comprehensive system architecture and technical specifications"
    constraints = "Follow best practices, ensure scalability and maintainability"
    description = "Senior architect who creates robust system designs"
    // 监听: ACTION_WRITE_PRD action（来自 ProductManager）
    // Actions: WriteDesign
}
```

**工作流程**:
1. 监听 ProductManager 的 WritePRD action 输出（`watch([ACTION_WRITE_PRD])`）
2. 接收产品需求文档（PRD）
3. 设计系统架构和技术规格（WriteDesign）
4. 生成设计文档
5. 发布给 Engineer 和 ProjectManager（通过 WriteDesign action 输出）

**监听机制**:
- 监听 `ACTION_WRITE_PRD` action 完成事件（使用常量 `ACTION_WRITE_PRD`）
- 等待 ProductManager 完成 PRD 文档生成后触发

### 3. ProjectManager (项目经理)

**职责**: 任务拆分、子项目设计、任务生成

**核心属性**:
```typescript
class ProjectManager extends Role {
    name = "ProjectManager"
    profile = "ProjectManager"
    goal = "Break down projects into minimal granularity tasks, provide sub-project design and task generation support for engineers"
    constraints = "Ensure tasks are minimal granularity, independent, testable, and deliverable. Provide clear task descriptions and acceptance criteria."
    description = "Experienced project manager who specializes in task breakdown and project planning"
    // 监听: ACTION_WRITE_PRD 和 ACTION_WRITE_DESIGN actions（来自 ProductManager 和 Architect）
    // Actions: BreakdownTasks, WriteSubProjectDesign, GenerateTask
}
```

**工作流程**:
1. 监听 ProductManager 的 WritePRD 和 Architect 的 WriteDesign actions（`watch([ACTION_WRITE_PRD, ACTION_WRITE_DESIGN])`）
2. 等待 PRD 和系统设计文档都完成后，进行任务拆分（BreakdownTasks）
   - 需要同时获取 PRD 和 Design 文档内容
   - 优先从 `rc.news` 中查找，如果不存在则从 `rc.memory` 中查找
   - 基于 PRD 和设计文档进行拆分
   - 确保任务符合最小颗粒度（1-3天可完成）
   - 识别任务依赖关系
   - 定义任务优先级和验收标准
   - 需要 workspaceOptions（applicationId 和 version）来组织工作区文件结构
3. 生成子项目设计（WriteSubProjectDesign）
   - 基于任务拆分文档（BreakdownTasks）和设计文档（WriteDesign）
   - 优先从 `rc.news` 中查找，如果不存在则从 `rc.memory` 中查找
   - 将相关任务组织成子项目
   - 为每个子项目提供详细技术设计
   - 定义子项目间的接口和依赖
   - 需要 workspaceOptions 来组织工作区文件结构
4. 生成详细任务说明（GenerateTask）
   - 基于任务拆分文档（BreakdownTasks），可选子项目设计（WriteSubProjectDesign）
   - 优先从 `rc.news` 中查找，如果不存在则从 `rc.memory` 中查找
   - 为工程师提供清晰的任务描述
   - 包含技术实现指导和代码示例
   - 需要 workspaceOptions 来组织工作区文件结构

**特殊处理**:
- BreakdownTasks 需要同时等待 PRD 和 Design 都完成
- 如果缺少任一文档，会等待直到两者都可用（返回 null）
- 会从消息历史（`rc.news` 和 `rc.memory`）中查找所需的文档内容
- 所有 Actions 都需要 workspaceOptions 参数（包含 applicationId 和 version）

**输出产物**:
- 任务拆分文档（TASK_BREAKDOWN.md）
  - 任务列表（ID、名称、类型、优先级、工时、依赖）
  - 任务描述、输入、输出、验收标准
  - 技术要点和注意事项
- 子项目设计文档（SUB_PROJECT_DESIGN.md）
  - 子项目概述和目标
  - 技术架构设计
  - API 接口设计
  - 数据模型设计
- 任务说明文档（TASK_DESCRIPTION.md）
  - 详细开发指南
  - 技术实现方案
  - 代码示例

**核心原则**:
- 任务拆分符合最小颗粒度原则
- 每个任务独立、可测试、可交付
- 为工程师提供清晰的决策支撑

### 4. Engineer (工程师)

**职责**: 代码实现

**核心属性**:
```typescript
class Engineer extends Role {
    name = "Engineer"
    profile = "Engineer"
    goal = "Implement high-quality code based on ProductManager and Architect outputs, executing subtasks according to task breakdown"
    constraints = "Follow coding standards, write clean and maintainable code"
    description = "Skilled engineer who brings designs to life through code and executes subtasks based on task breakdown"
    // 监听: ACTION_WRITE_PRD, ACTION_WRITE_DESIGN, ACTION_BREAKDOWN_TASKS actions
    // Actions: WriteCode, ExecuteSubtask
}
```

**工作流程**:
1. 监听 ProductManager 的 WritePRD、Architect 的 WriteDesign 和 ProjectManager 的 BreakdownTasks actions（`watch([ACTION_WRITE_PRD, ACTION_WRITE_DESIGN, ACTION_BREAKDOWN_TASKS])`）
2. 接收设计文档和任务拆分文档
3. 编写代码（WriteCode）
   - 如果存在任务拆分，会基于任务拆分进行代码生成
   - 支持自动代码生成模式（通过 `ENGINEER_AUTO_CODE` 环境变量控制，值为 `'true'` 或 `'1'`）
   - 可以基于子任务逐个生成代码
   - 需要 workspaceOptions（applicationId 和 version），applicationId 不能为 `'default'`
   - 支持代码完整性检查和自动补全
4. 执行子任务（ExecuteSubtask）
   - 基于任务拆分中的具体任务描述
   - 根据设计文档和任务说明实现代码
   - 支持增量开发模式
   - 需要从消息历史中提取任务拆分文档

**特殊处理**:
- `act()` 方法被重写，根据不同的 action 名称调用不同的处理方法
- WriteCode 会检查是否存在任务拆分，如果存在则基于任务拆分进行代码生成
- ExecuteSubtask 需要从任务拆分文档中提取任务信息
- 支持自动代码生成模式（`ENGINEER_AUTO_CODE=true`），可以自动执行所有子任务
- 需要 workspaceOptions（applicationId 和 version）来组织工作区文件结构
- applicationId 必须提供且不能使用 `'default'`，以防止不同应用之间的文件冲突

### 5. QA Engineer (QA 工程师)

**职责**: 执行测试设计工作流，从可测性审查到测试用例评审，最终给出 QA 结论

**核心属性**:
```typescript
class QAEngineer extends Role {
    name = "QAEngineer"
    profile = "QAEngineer"
    goal = "Execute QA workflow from testability review to final QA conclusion, ensuring quality and functional correctness"
    constraints = "Focus on code quality, functional correctness, comprehensive test coverage, and systematic QA process. Execute QA workflow in order: testability review -> test plan -> test cases -> test case review -> QA conclusion"
    description = "Experienced QA engineer who executes QA workflow including testability review, test planning, test case design, and final QA conclusion"
    // 监听: ACTION_WRITE_PRD, ACTION_WRITE_CODE, ACTION_COVERAGE_QUALITY_CHECK actions
    // Actions: TestabilityReview, WriteTestPlan, WriteTest, TestCaseReview, QAConclusion
}
```

**5 步 QA 工作流**:

QAEngineer 实现测试设计工作流，包含以下 5 个 Actions（按顺序执行）：

| 步骤 | Action | 说明 | 输出文件 |
|------|--------|------|----------|
| 1 | TestabilityReview | 需求可测性检查 | TESTABILITY_REVIEW.md |
| 2 | WriteTestPlan | 制定测试计划 | TEST_PLAN.md |
| 3 | WriteTest | 测试用例生成 | TEST.md |
| 4 | TestCaseReview | 用例评审与补充 | TEST_CASES_REVIEWED.md |
| 5 | QAConclusion | 给出 QA 结论 | QA_CONCLUSION.md |

**工作流程详解**:

1. **TestabilityReview（可测性审查）**
   - 审查 PRD 和代码的可测性
   - 识别难以测试或无法测试的需求
   - 提供改进建议

2. **WriteTestPlan（制定测试计划）**
   - 基于可测性审查结果制定测试计划
   - 包含测试范围、测试策略、测试资源规划
   - 读取 PRD 和代码作为输入

3. **WriteTest（测试用例生成）**
   - 基于 PRD 和代码生成测试用例
   - 包含单元测试和集成测试

4. **TestCaseReview（用例评审与补充）**
   - 审查测试用例的完整性
   - 补充边界条件、异常情况、负面测试用例

5. **QAConclusion（QA 结论）**
   - 综合所有测试结果（包括 AutomationEngineer 的覆盖率报告）
   - 给出最终 QA 结论（通过/阻断/需修改）

**监听机制**:
- 监听 `ACTION_WRITE_PRD`、`ACTION_WRITE_CODE` 和 `ACTION_COVERAGE_QUALITY_CHECK` actions
- 等待 ProductManager 完成 PRD、Engineer 完成代码后触发测试设计流程
- 等待 AutomationEngineer 完成覆盖率检查后触发 QAConclusion
- 使用 BY_ORDER 模式按顺序执行所有 5 个 Actions

**输出产物**:
- 可测性审查报告（TESTABILITY_REVIEW.md）
- 测试计划（TEST_PLAN.md）
- 测试用例文档（TEST.md）
- 审查后的测试用例（TEST_CASES_REVIEWED.md）
- QA 结论报告（QA_CONCLUSION.md）

### 5.1 Automation Engineer (自动化工程师)

**职责**: 执行自动化测试工作流，包括自动化规划、执行和覆盖率检查

**核心属性**:
```typescript
class AutomationEngineer extends Role {
    name = "AutomationEngineer"
    profile = "AutomationEngineer"
    goal = "Execute automation test workflow including planning, execution and coverage quality check"
    constraints = "Focus on automation feasibility assessment, technology selection, test execution and coverage analysis. Execute automation workflow in order: automation planning -> automation execution -> coverage quality check"
    description = "Experienced automation engineer who handles automation test planning, execution and coverage quality analysis"
    // 监听: ACTION_TEST_CASE_REVIEW action（来自 QAEngineer）
    // Actions: AutomationPlanning, AutomationExecution, CoverageQualityCheck
}
```

**3 步自动化测试工作流**:

AutomationEngineer 实现自动化测试工作流，包含以下 3 个 Actions（按顺序执行）：

| 步骤 | Action | 说明 | 输出文件 |
|------|--------|------|----------|
| 1 | AutomationPlanning | 自动化测试拆解与评估 | AUTOMATION_PLAN.md |
| 2 | AutomationExecution | 自动化用例实现与执行 | tests/automated_tests.md |
| 3 | CoverageQualityCheck | 测试覆盖率与质量自检 | COVERAGE_REPORT.md, QUALITY_CHECK.md |

**工作流程详解**:

1. **AutomationPlanning（自动化测试规划）**
   - 评估测试用例的自动化可行性
   - 确定自动化优先级
   - 选择合适的自动化技术

2. **AutomationExecution（自动化测试执行）**
   - 实现自动化测试用例
   - 执行自动化测试
   - 收集执行结果

3. **CoverageQualityCheck（覆盖率与质量检查）**
   - 分析测试覆盖率
   - 进行质量自评
   - 生成覆盖率报告和质量检查报告

**监听机制**:
- 监听 `ACTION_TEST_CASE_REVIEW` action（来自 QAEngineer）
- 等待 QAEngineer 完成测试用例评审后触发
- 使用 BY_ORDER 模式按顺序执行所有 3 个 Actions

**输出产物**:
- 自动化测试计划（AUTOMATION_PLAN.md）
- 自动化测试结果（tests/automated_tests.md）
- 覆盖率报告（COVERAGE_REPORT.md）
- 质量检查报告（QUALITY_CHECK.md）

**与 QAEngineer 的协作**:
```
QAEngineer                           AutomationEngineer
    │                                      │
    ├─ TestabilityReview                   │
    ├─ WriteTestPlan                       │
    ├─ WriteTest                           │
    ├─ TestCaseReview ─────────────────────┤
    │                                      ├─ AutomationPlanning
    │                                      ├─ AutomationExecution
    │                                      ├─ CoverageQualityCheck
    ├─ QAConclusion ◄──────────────────────┘
    │
```

### 6. TeamLeader (团队领导)

**职责**: 协调、决策、任务分配

**核心属性**:
```typescript
class TeamLeader extends Role {
    name = "TeamLeader"
    profile = "TeamLeader"
    goal = "团队领导，负责协调各角色工作，制定开发计划，进行决策管理"
    constraints = "确保团队协作高效，决策合理"
    description = "我是一名经验丰富的团队领导，擅长协调团队工作，制定计划并做出关键决策。"
    // 监听: 无（不 watch 任何 action）
    // Actions: Coordinate
}
```

**工作流程**:
1. 不监听特定的 action（构造函数中不调用 `watch()`）
2. 重写 `act()` 方法，访问环境中的所有消息历史
3. 执行协调任务（Coordinate）
   - 从 `rc.env.history` 获取所有消息（如果可用）
   - 如果环境不可用，则回退到使用 `rc.news`
   - 将所有消息内容格式化后传递给 Coordinate action
   - 分析所有角色的工作状态
   - 制定开发计划
   - 进行决策管理
   - 协调团队工作

**特点**:
- 不监听特定的 action（构造函数中不调用 `watch()`）
- 重写 `act()` 方法以访问环境（Environment）的完整消息历史
- Coordinate action 会接收所有消息内容作为输入（格式化为字符串）
- 用于整体协调和决策，而非具体任务执行

### 7. DataAnalyst (数据分析师)

**职责**: 数据分析和可视化

**核心属性**:
```typescript
class DataAnalyst extends Role {
    name = "DataAnalyst"
    profile = "DataAnalyst"
    goal = "数据分析师，负责数据分析需求处理，生成分析代码和可视化"
    constraints = "确保分析代码的质量和可视化效果"
    description = "我是一名专业的数据分析师，擅长处理数据分析需求，生成完整的分析代码和数据可视化。"
    // 监听: 无（不 watch 任何 action，用于独立数据分析任务）
    // Actions: DataAnalysis
}
```

**工作流程**:
1. 接收数据分析需求（通过用户消息或直接调用）
2. 执行数据分析（DataAnalysis）
   - 数据加载和处理
   - 统计分析
   - 机器学习（如需要）
   - 数据可视化
3. 生成分析代码和可视化结果

**核心能力**:
- 数据加载和处理
- 统计分析
- 机器学习
- 数据可视化

**特点**:
- 不监听特定的 action（构造函数中不调用 `watch()`）
- 通常用于独立的数据分析任务
- 可以直接接收用户需求进行处理

---

## 已实现角色列表

✅ **Salesperson** - 需求收集、市场调研和业务分析，生成市场研究文档（MRD）
  - 监听: `'User'` 消息类型
  - Actions: WriteMRD, MRDReview, ImproveMRD
  
✅ **ProductManager** - 基于 MRD 编写 PRD 和产品规划
  - 监听: `ACTION_WRITE_MRD` action
  - Actions: WritePRD, PRDReview, ImprovePRD, SearchEnhancedQA
  
✅ **Architect** - 系统架构设计
  - 监听: `ACTION_WRITE_PRD` action
  - Actions: WriteDesign, DesignReview, ImproveDesign
  
✅ **ProjectManager** - 任务拆分、子项目设计
  - 监听: `ACTION_WRITE_PRD`, `ACTION_WRITE_DESIGN` actions
  - Actions: BreakdownTasks, WriteSubProjectDesign, SubProjectDesignReview
  - 特殊: 重写 `act()` 方法处理不同 action 的输入需求
  
✅ **Engineer** - 代码实现
  - 监听: `ACTION_WRITE_PRD`, `ACTION_WRITE_DESIGN`, `ACTION_BREAKDOWN_TASKS` actions
  - Actions: WriteCode, ExecuteSubtask, RunCode, FixBug
  - 特殊: 重写 `act()` 方法，支持自动代码生成模式（`ENGINEER_AUTO_CODE`）
  
✅ **QAEngineer** - 测试设计工作流执行
  - 监听: `ACTION_WRITE_PRD`, `ACTION_WRITE_CODE`, `ACTION_COVERAGE_QUALITY_CHECK` actions
  - Actions: TestabilityReview, WriteTestPlan, WriteTest, TestCaseReview, QAConclusion
  - 特殊: 使用 BY_ORDER 模式按顺序执行 5 步测试设计工作流

✅ **AutomationEngineer** - 自动化测试工作流执行
  - 监听: `ACTION_TEST_CASE_REVIEW` action
  - Actions: AutomationPlanning, AutomationExecution, CoverageQualityCheck
  - 特殊: 使用 BY_ORDER 模式按顺序执行 3 步自动化测试工作流
  
✅ **TeamLeader** - 团队协调和任务分配
  - 监听: 无（不 watch 任何 action）
  - Actions: Coordinate
  - 特殊: 重写 `act()` 方法，访问环境完整消息历史
  
✅ **DataAnalyst** - 数据分析和可视化
  - 监听: 无（不 watch 任何 action，独立任务）
  - Actions: DataAnalysis

## 自定义角色开发

系统采用配置驱动的动态加载架构，添加新角色只需修改少量文件，无需改动核心业务代码。

### 步骤 1: 创建角色类文件

在 `backend/src/roles/` 目录下创建角色文件：

```typescript
// backend/src/roles/CustomRole.ts
import { IRoleConfig, ACTION_SOME_ACTION } from '@mind2build/shared';
import { Role } from './Role';
import { Context } from '../core/context/Context';
import { CustomAction } from '../actions/CustomAction';

export class CustomRole extends Role {
    constructor(context: Context, name: string = 'CustomRole') {
        const config: IRoleConfig = {
            name,
            profile: 'CustomRole',
            goal: 'Custom Goal',
            constraints: 'Custom Constraints',
            description: 'Custom Description',
        };
        
        super(config, context);
        
        // Watch for specific actions (optional)
        this.watch([ACTION_SOME_ACTION]);
        
        // Set actions
        this.setActions([new CustomAction()]);
    }
    
    // Optionally override act() method for custom behavior
    // async act(): Promise<Message | null> {
    //     // Custom implementation
    // }
}

export default CustomRole;
```

### 步骤 2: 注册到 ROLE_REGISTRY

修改 `backend/src/roles/index.ts`：

```typescript
// 添加 export
export { CustomRole } from './CustomRole';

// 在 ROLE_REGISTRY 中添加（这是唯一需要修改的代码文件）
export const ROLE_REGISTRY: Record<string, new (context: Context, name?: string) => Role> = {
  Salesperson,
  ProductManager,
  Architect,
  ProjectManager,
  Engineer,
  QAEngineer,
  AutomationEngineer,
  TeamLeader,
  DataAnalyst,
  CustomRole,  // 添加新角色
};
```

### 步骤 3: 运行数据库迁移

```bash
cd backend
npx ts-node --transpile-only src/database/migrations/init_role_action_definitions.ts
```

迁移脚本会自动从 ROLE_REGISTRY 读取角色信息并更新数据库。

### 注意事项

- 所有角色都需要 `IRoleConfig` 配置对象，包含 `name`, `profile`, `goal`, `constraints`, `description`
- 使用 `this.watch([...])` 来监听特定的 action（使用常量，如 `ACTION_WRITE_PRD`）
- 使用 `this.setActions([...])` 来设置角色可执行的 actions
- 可以重写 `act()` 方法来实现自定义的行为（如 ProjectManager, Engineer, TeamLeader）
- 监听 `'User'` 消息类型时使用字符串字面量，监听 action 时使用常量
- **核心文件零修改**: Controller、Service 等核心业务文件无需改动

### 架构优势

```
┌─────────────────────────────────────────┐
│  roles/index.ts (ROLE_REGISTRY)         │  ← 唯一需要修改的代码文件
├─────────────────────────────────────────┤
│  RoleActionFactory                      │  ← 自动从 REGISTRY 读取
├─────────────────────────────────────────┤
│  Database (role_definitions)            │  ← 元数据存储
├─────────────────────────────────────────┤
│  Controllers / Services                 │  ← 无需修改
└─────────────────────────────────────────┘
```

---

**参考**: 完整实现见源码 `backend/src/roles/`
