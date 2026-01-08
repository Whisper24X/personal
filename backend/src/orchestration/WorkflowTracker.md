# WorkflowTracker 使用指南

## 概述

`WorkflowTracker` 是一个通用的工作流状态跟踪器，可以用于任何包含角色（Roles）和动作（Actions）的团队（Team）。它提供了完整的状态跟踪、持久化和查询功能。

## 核心功能

1. **工作流初始化** - 自动注册所有角色和它们的动作到数据库
2. **执行状态跟踪** - 实时跟踪当前运行的角色和动作
3. **状态持久化** - 所有状态都保存在数据库中，支持服务重启后恢复
4. **状态查询** - 提供多种查询接口获取工作流状态

## 使用示例

### 基本使用

```typescript
import { WorkflowTracker } from './orchestration/WorkflowTracker';
import { Team } from './orchestration/Team';
import { Context } from './core/context/Context';

// 创建团队
const ctx = new Context();
const team = new Team(ctx);
team.hire([
  new Salesperson(ctx),
  new ProductManager(ctx),
  // ... 其他角色
]);

// 创建工作流跟踪器
const tracker = new WorkflowTracker(
  'session-id-123',  // 会话ID
  'project-id-456',  // 项目ID（可选）
  team                // 团队实例
);

// 初始化工作流（注册所有角色和动作）
await tracker.initialize();

// 执行角色时跟踪状态
const role = team.getEnvironment().getRoles()[0];

// 角色开始执行前
await tracker.onRoleStart(role);

// 执行角色
const message = await role.run();

// 角色执行完成后
await tracker.onRoleComplete(role, message);

// 如果角色出错
try {
  await role.run();
} catch (error) {
  await tracker.onRoleError(role, error);
}

// 如果角色空闲（无动作执行）
await tracker.onRoleIdle(role);

// 清除当前运行状态（移动到下一个角色时）
await tracker.clearState();

// 查询当前运行状态
const currentState = await tracker.getCurrentState();
console.log(`当前运行: ${currentState.role} - ${currentState.action}`);

// 获取所有工作流项
const items = await tracker.getWorkflowItems();
items.forEach(item => {
  console.log(`${item.role}.${item.action}: ${item.status}`);
});

// 获取工作流结构
const structure = tracker.getWorkflowStructure();
structure.forEach(roleInfo => {
  console.log(`角色: ${roleInfo.role}`);
  roleInfo.actions.forEach(action => {
    console.log(`  - ${action.name}: ${action.description}`);
  });
});
```

### 在 InteractiveSession 中的使用

`InteractiveSession` 已经集成了 `WorkflowTracker`，可以直接使用：

```typescript
// 获取当前运行状态
const runningState = await session.getCurrentRunning();

// 获取工作流信息
const workflowInfo = session.getWorkflowInfo();
```

## API 参考

### 构造函数

```typescript
constructor(
  sessionId: string,
  projectId: string | null,
  team: Team
)
```

### 方法

#### `initialize(): Promise<void>`
初始化工作流，注册所有角色和动作到数据库。

#### `onRoleStart(role: Role): Promise<void>`
跟踪角色开始执行。在调用 `role.run()` 之前调用。

#### `onRoleComplete(role: Role, message: Message | null): Promise<void>`
跟踪角色执行完成。在 `role.run()` 完成后调用。

#### `onRoleError(role: Role, error: Error): Promise<void>`
跟踪角色执行错误。

#### `onRoleIdle(role: Role): Promise<void>`
跟踪角色空闲状态（无动作执行）。

#### `clearState(): Promise<void>`
清除当前运行状态。

#### `getCurrentState(): Promise<WorkflowState>`
获取当前运行状态。优先从数据库读取，确保数据可靠性。

#### `getWorkflowItems(): Promise<WorkflowItem[]>`
获取所有工作流项及其状态。

#### `getWorkflowStructure(): Array<{role: string, actions: Array<{name: string, description: string}>}>`
获取工作流结构（所有角色和它们的动作）。

## 状态管理

### 状态生命周期

```
角色开始执行 → onRoleStart()
    ↓
role.run() 执行中
    ↓
执行完成 → onRoleComplete()
    ↓
等待用户确认（保持运行状态）
    ↓
用户确认 → clearState() 或继续下一个角色
```

### 状态类型

- `pending` - 待执行
- `running` - 正在执行
- `completed` - 已完成
- `failed` - 执行失败

## 数据库结构

`WorkflowTracker` 使用以下数据库表：

1. `interactive_session_workflows` - 存储所有角色和动作
2. `interactive_session_running_state` - 存储当前运行状态

## 最佳实践

1. **总是调用 initialize()** - 在开始工作流之前初始化
2. **及时更新状态** - 在角色执行的关键节点调用相应的跟踪方法
3. **错误处理** - 使用 `onRoleError()` 跟踪错误，确保状态一致性
4. **状态查询** - 使用 `getCurrentState()` 获取最新状态，它会优先从数据库读取

## 扩展性

`WorkflowTracker` 设计为通用组件，可以用于：
- InteractiveSession
- 非交互式工作流
- 自定义工作流执行器
- 任何需要跟踪角色和动作执行状态的场景

