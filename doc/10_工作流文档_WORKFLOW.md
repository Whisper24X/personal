# 即思即成（Mind2Build）工作流文档

**Slogan**: 让所思，即所得

**文档版本**: v1.0  
**创建日期**: 2025-12-24

## 1. 标准软件开发流程

```
用户需求 → Salesperson(WriteRequirementSpec) → ProductManager(WritePRD) 
→ Architect(WriteDesign) → Engineer(WriteCode) → QA(WriteTest) → 输出项目
```

## 2. 数据分析流程

```
数据需求 → DataInterpreter → 数据加载 → 分析处理 
→ 可视化 → 输出结果
```

## 3. 增量开发流程

```
已有项目 + 新需求 → 分析现有代码 → 生成增量代码 
→ 合并到项目 → 输出更新
```

## 4. React 模式

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

## 5. 自定义工作流

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

---

**参考**: 实现示例见 examples/
