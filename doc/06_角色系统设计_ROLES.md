# 即思即成（Mind2Build）角色系统设计文档

**文档版本**: v1.0  
**创建日期**: 2025-12-24

## 核心角色

### 0. Salesperson (销售)

**职责**: 收集需求、产出需求说明文档

**核心属性**:
```javascript
class Salesperson extends RoleZero {
    name = "Sales"
    profile = "Salesperson"
    goal = "Collect customer requirements and produce requirement specification"
    tools = ["Browser", "Editor", "SearchEnhancedQA"]
}
```

**工作流程**:
1. 接收用户原始需求（UserRequirement）
2. 与用户沟通确认需求细节
3. 进行市场调研和竞品分析
4. 编写需求说明文档（RequirementSpecification）
5. 发布需求说明给 ProductManager

**输出产物**:
- 需求说明文档（RequirementSpecification.md）
  - 客户需求描述
  - 目标用户画像
  - 业务场景分析
  - 核心功能列表
  - 竞品分析
  - 初步预算和时间估算

### 1. ProductManager (产品经理)

**职责**: 基于需求说明编写 PRD、产品规划

**核心属性**:
```javascript
class ProductManager extends RoleZero {
    name = "Alice"
    profile = "Product Manager"
    goal = "Create detailed PRD based on requirement specification"
    tools = ["Browser", "Editor", "SearchEnhancedQA"]
}
```

**工作流程**:
1. 接收销售的需求说明（RequirementSpecification）
2. 准备文档（PrepareDocuments）
3. 编写产品需求文档 PRD（WritePRD）
4. 发布 PRD 给 Architect

### 2. Architect (架构师)

**职责**: 系统设计、架构规划

**核心属性**:
```python
class Architect(RoleZero):
    name: str = "Bob"
    profile: str = "Architect"
    goal: str = "Design complete software system"
    tools: list[str] = ["Editor", "Terminal"]
```

**工作流程**:
1. 接收 PRD（订阅 WritePRD）
2. 设计系统架构（WriteDesign）
3. 生成设计文档
4. 发布给 Engineer

### 3. Engineer (工程师)

**职责**: 代码实现

**核心属性**:
```python
class Engineer(RoleZero):
    name: str = "Engineer"
    profile: str = "Engineer"
    goal: str = "Write elegant code"
    tools: list[str] = ["Editor"]
```

**工作流程**:
1. 接收设计文档（订阅 WriteDesign）
2. 编写代码（WriteCode）
3. 代码审查（WriteCodeReview）
4. 输出源代码

### 4. QA Engineer (QA 工程师)

**职责**: 测试用例编写和执行

**工作流程**:
1. 接收代码（订阅 WriteCode）
2. 编写测试（WriteTest）
3. 执行测试
4. 报告问题

### 5. TeamLeader (团队领导)

**职责**: 协调、决策、任务分配

**特点**: 监听所有消息，协调团队工作

### 6. DataInterpreter (数据解释器)

**职责**: 数据分析和可视化

**核心能力**:
- 数据加载和处理
- 统计分析
- 机器学习
- 数据可视化

---

## 自定义角色开发

**示例**:
```python
from mind2build.roles.role import Role
from mind2build.actions import Action

class CustomRole(Role):
    name: str = "CustomName"
    profile: str = "Custom Profile"
    goal: str = "Custom Goal"
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.set_actions([CustomAction])
        self._watch([SomeAction])
```

---

**参考**: 完整实现见源码 `mind2build/roles/`
