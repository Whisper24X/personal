# 即思即成（Mind2Build）角色系统设计文档

**文档版本**: v1.2  
**创建日期**: 2025-12-24
**最后更新**: 2025-12-25（根据代码实现更新角色监听机制和 Actions）

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
    // 监听: WriteMRD action（来自 Salesperson）
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
- 监听 `WriteMRD` action 完成事件
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
    // 监听: WritePRD action（来自 ProductManager）
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
- 监听 `WritePRD` action 完成事件
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
    // 监听: WritePRD 和 WriteDesign actions（来自 ProductManager 和 Architect）
    // Actions: BreakdownTasks, WriteSubProjectDesign, GenerateTask
}
```

**工作流程**:
1. 监听 ProductManager 的 WritePRD 和 Architect 的 WriteDesign actions（`watch([ACTION_WRITE_PRD, ACTION_WRITE_DESIGN])`）
2. 等待 PRD 和系统设计文档都完成后，进行任务拆分（BreakdownTasks）
   - 需要同时获取 PRD 和 Design 文档内容
   - 基于 PRD 和设计文档进行拆分
   - 确保任务符合最小颗粒度（1-3天可完成）
   - 识别任务依赖关系
   - 定义任务优先级和验收标准
3. 生成子项目设计（WriteSubProjectDesign）
   - 基于任务拆分文档和设计文档
   - 将相关任务组织成子项目
   - 为每个子项目提供详细技术设计
   - 定义子项目间的接口和依赖
4. 生成详细任务说明（GenerateTask）
   - 基于任务拆分文档
   - 为工程师提供清晰的任务描述
   - 包含技术实现指导和代码示例

**特殊处理**:
- BreakdownTasks 需要同时等待 PRD 和 Design 都完成
- 如果缺少任一文档，会等待直到两者都可用
- 会从消息历史（memory）中查找所需的文档内容

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
    // 监听: WritePRD, WriteDesign, BreakdownTasks actions
    // Actions: WriteCode, ExecuteSubtask
}
```

**工作流程**:
1. 监听 ProductManager 的 WritePRD、Architect 的 WriteDesign 和 ProjectManager 的 BreakdownTasks actions（`watch([ACTION_WRITE_PRD, ACTION_WRITE_DESIGN, ACTION_BREAKDOWN_TASKS])`）
2. 接收设计文档和任务拆分文档
3. 编写代码（WriteCode）
   - 如果存在任务拆分，会基于任务拆分进行代码生成
   - 支持自动代码生成模式（通过 `ENGINEER_AUTO_CODE` 环境变量控制）
   - 可以基于子任务逐个生成代码
4. 执行子任务（ExecuteSubtask）
   - 基于任务拆分中的具体任务描述
   - 根据设计文档和任务说明实现代码
   - 支持增量开发模式

**特殊处理**:
- WriteCode 会检查是否存在任务拆分，如果存在则基于任务拆分进行代码生成
- ExecuteSubtask 需要从任务拆分文档中提取任务信息
- 支持自动代码生成模式，可以自动执行所有子任务
- 需要 applicationId 和 version 信息来组织工作区文件结构

### 5. QA Engineer (QA 工程师)

**职责**: 测试用例编写和执行

**核心属性**:
```typescript
class QAEngineer extends Role {
    name = "QAEngineer"
    profile = "QAEngineer"
    goal = "质量保证工程师，负责编写测试用例和执行质量保证"
    constraints = "确保代码质量和功能正确性"
    // 监听: WriteCode action（来自 Engineer）
    // Actions: WriteTest
}
```

**工作流程**:
1. 监听 Engineer 的 WriteCode action 输出（`watch([ACTION_WRITE_CODE])`）
2. 接收生成的代码
3. 编写测试用例（WriteTest）
4. 生成测试代码文件
5. 报告测试结果

**监听机制**:
- 监听 `WriteCode` action 完成事件
- 等待 Engineer 完成代码生成后触发

### 6. TeamLeader (团队领导)

**职责**: 协调、决策、任务分配

**核心属性**:
```typescript
class TeamLeader extends Role {
    name = "TeamLeader"
    profile = "TeamLeader"
    goal = "团队领导，负责协调各角色工作，制定开发计划，进行决策管理"
    constraints = "确保团队协作高效，决策合理"
    // 监听: 所有广播消息（不监听特定 action）
    // Actions: Coordinate
}
```

**工作流程**:
1. 自动接收所有广播消息（不需要 watch 特定 action）
2. 访问环境中的所有消息历史
3. 执行协调任务（Coordinate）
   - 分析所有角色的工作状态
   - 制定开发计划
   - 进行决策管理
   - 协调团队工作

**特点**:
- 不监听特定的 action，而是接收所有广播消息
- 可以访问环境（Environment）的完整消息历史
- Coordinate action 会接收所有消息内容作为输入
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
    // 监听: 无特定监听（独立数据分析任务）
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
- 不监听特定的 action，通常用于独立的数据分析任务
- 可以直接接收用户需求进行处理

---

## 已实现角色列表

✅ **Salesperson** - 需求收集、市场调研和业务分析，生成市场研究文档（MRD）
  - 监听: User 消息
  - Actions: WriteMRD
  
✅ **ProductManager** - 基于 MRD 编写 PRD 和产品规划
  - 监听: WriteMRD action
  - Actions: WritePRD, SearchEnhancedQA
  
✅ **Architect** - 系统架构设计
  - 监听: WritePRD action
  - Actions: WriteDesign
  
✅ **ProjectManager** - 任务拆分、子项目设计、任务生成
  - 监听: WritePRD, WriteDesign actions
  - Actions: BreakdownTasks, WriteSubProjectDesign, GenerateTask
  
✅ **Engineer** - 代码实现
  - 监听: WritePRD, WriteDesign, BreakdownTasks actions
  - Actions: WriteCode, ExecuteSubtask
  
✅ **QAEngineer** - 测试用例编写
  - 监听: WriteCode action
  - Actions: WriteTest
  
✅ **TeamLeader** - 团队协调和任务分配
  - 监听: 所有广播消息
  - Actions: Coordinate
  
✅ **DataAnalyst** - 数据分析和可视化
  - 监听: 无特定监听（独立任务）
  - Actions: DataAnalysis

## 自定义角色开发

**示例**:
```typescript
import { Role } from './Role';
import { BaseAction } from '../actions/BaseAction';

class CustomRole extends Role {
    name = "CustomName";
    profile = "Custom Profile";
    goal = "Custom Goal";
    
    constructor() {
        super();
        this.setActions([CustomAction]);
        this._watch([SomeAction]);
    }
}
```

---

**参考**: 完整实现见源码 `backend/src/roles/`
