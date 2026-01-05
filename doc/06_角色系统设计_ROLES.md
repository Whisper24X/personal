# 即思即成（Mind2Build）角色系统设计文档

**文档版本**: v1.1  
**创建日期**: 2025-12-24
**最后更新**: 2025-12-25

## 核心角色

### 0. Salesperson (销售)

**职责**: 收集需求、进行市场调研和业务分析，产出市场研究文档（MRD）

**核心属性**:
```typescript
class Salesperson extends Role {
    name = "Salesperson"
    profile = "Salesperson"
    goal = "Collect customer requirements, conduct market research and business analysis, produce Market Research Document (MRD)"
    // Actions: UserRequirement, WriteMRD, MRDReview
}
```

**工作流程**:
1. 接收用户原始需求（UserRequirement）
2. 与用户沟通确认需求细节
3. 进行目标价值分析和需求价值分析
4. 进行市场调研和竞品分析
5. 生成业务流程分析
6. 编写市场研究文档（MRD - Market Research Document）
7. 发布 MRD 给 ProductManager

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
    profile = "Product Manager"
    goal = "Create detailed PRD based on Market Research Document (MRD)"
    // Actions: WritePRD, PRDReview, SearchEnhancedQA
}
```

**工作流程**:
1. 接收销售的市场研究文档（MRD）
2. 使用 RAG 检索历史 PRD 文档（如可用）
3. 基于 MRD 和历史 PRD 编写产品需求文档 PRD（WritePRD）
4. 发布 PRD 给 Architect

### 2. Architect (架构师)

**职责**: 系统设计、架构规划

**核心属性**:
```typescript
class Architect extends Role {
    name = "Architect"
    profile = "Architect"
    goal = "Design complete software system"
    // Actions: WriteDesign
}
```

**工作流程**:
1. 接收 PRD（订阅 WritePRD）
2. 设计系统架构（WriteDesign）
3. 生成设计文档
4. 发布给 Engineer

### 3. ProjectManager (项目经理)

**职责**: 任务拆分、子项目设计、任务生成

**核心属性**:
```typescript
class ProjectManager extends Role {
    name = "ProjectManager"
    profile = "ProjectManager"
    goal = "Break down projects into minimal granularity tasks, provide sub-project design and task generation support for engineers"
    // Actions: BreakdownTasks, WriteSubProjectDesign, GenerateTask, CodeReview
}
```

**工作流程**:
1. 接收 PRD 和系统设计文档（订阅 WritePRD 和 WriteDesign）
2. 进行任务拆分（BreakdownTasks）
   - 基于 PRD 和设计文档
   - 确保任务符合最小颗粒度（1-3天可完成）
   - 识别任务依赖关系
   - 定义任务优先级和验收标准
3. 生成子项目设计（WriteSubProjectDesign）
   - 将相关任务组织成子项目
   - 为每个子项目提供详细技术设计
   - 定义子项目间的接口和依赖
4. 生成详细任务说明（GenerateTask）
   - 为工程师提供清晰的任务描述
   - 包含技术实现指导和代码示例
5. 进行代码审查（CodeReview）
   - 审查代码质量和规范性
   - 提供改进建议和代码示例
   - 评估代码完成度和质量

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
- 代码审查报告（CODE_REVIEW.md）
  - 代码质量评估
  - 改进建议
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
    goal = "Write elegant code"
    // Actions: WriteCode, ExecuteSubtask
}
```

**工作流程**:
1. 接收设计文档（订阅 WriteDesign）
2. 接收任务说明（来自 ProjectManager）
3. 编写代码（WriteCode）
4. 执行子任务（ExecuteSubtask）
5. 输出源代码

**注意**: 现在可以通过 ProjectManager 获得任务拆分、子项目设计和代码审查支持

### 5. QA Engineer (QA 工程师)

**职责**: 测试用例编写和执行

**核心属性**:
```typescript
class QAEngineer extends Role {
    name = "QAEngineer"
    profile = "QAEngineer"
    goal = "Write comprehensive test cases"
    // Actions: WriteTest
}
```

**工作流程**:
1. 接收代码（订阅 WriteCode）
2. 编写测试（WriteTest）
3. 执行测试
4. 报告问题

### 6. TeamLeader (团队领导)

**职责**: 协调、决策、任务分配

**核心属性**:
```typescript
class TeamLeader extends Role {
    name = "TeamLeader"
    profile = "TeamLeader"
    goal = "Coordinate team work and make decisions"
    // Actions: Coordinate
}
```

**特点**: 监听所有消息，协调团队工作

### 7. DataAnalyst (数据分析师)

**职责**: 数据分析和可视化

**核心属性**:
```typescript
class DataAnalyst extends Role {
    name = "DataAnalyst"
    profile = "DataAnalyst"
    goal = "Analyze data and create visualizations"
    // Actions: DataAnalysis
}
```

**核心能力**:
- 数据加载和处理
- 统计分析
- 机器学习
- 数据可视化

---

## 已实现角色列表

✅ **Salesperson** - 需求收集、市场调研和业务分析，生成市场研究文档（MRD）  
✅ **ProductManager** - 基于 MRD 编写 PRD 和产品规划  
✅ **Architect** - 系统架构设计  
✅ **ProjectManager** - 任务拆分、子项目设计、代码审查  
✅ **Engineer** - 代码实现  
✅ **QAEngineer** - 测试用例编写  
✅ **TeamLeader** - 团队协调和任务分配  
✅ **DataAnalyst** - 数据分析和可视化

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
