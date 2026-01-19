# 状态管理操作文档

本文档详细说明了状态管理方案，采用状态机模式，使流程更清晰可控。

## 目录

1. [概述](#一概述)
2. [方案设计](#二方案设计)
3. [设计原则](#三设计原则)
4. [状态机设计](#四状态机设计)
5. [数据库设计](#五数据库设计)
6. [核心类和接口](#六核心类和接口)
7. [状态转换规则](#七状态转换规则)
8. [工作流执行流程](#八工作流执行流程)
9. [重置流程详解](#九重置流程详解)
10. [接口设计](#十接口设计)
11. [错误处理和最佳实践](#十一错误处理和最佳实践)
12. [注意事项](#十二注意事项)
13. [更新日志](#十三更新日志)

---

## 一、概述

### 1.1 设计目标

状态管理系统采用状态机模式，实现以下目标：

- **清晰的状态定义**：明确定义所有可能的状态和状态转换规则
- **原子性操作**：每个状态转换操作都是原子的，确保状态一致性
- **顺序执行保证**：通过数据库字段（`role_order`、`action_order`）保证角色和action的执行顺序
- **可追溯性**：所有状态变更都有明确的调用路径和日志记录

### 1.2 核心概念

- **统一状态管理器（StateManager）**：所有状态读写的唯一入口，统一管理角色和action的所有状态
- **工作流状态**：管理每个 action 的执行状态（pending/running/completed/failed）
- **运行状态**：管理当前正在执行的 role 和 action
- **确认状态**：管理用户确认流程（只有最后一个action完成后才触发）
- **步骤状态**：管理分步骤执行流程的内部步骤状态（如StepwiseDocumentGenerator的步骤状态）

---

## 二、方案设计

### 2.1 整体架构方案

#### 2.1.1 架构概述

状态管理系统采用分层架构设计，分为应用层、统一状态管理层和数据持久层。**所有状态读写都必须通过统一状态管理器（StateManager）**，确保状态管理的一致性和可追溯性：

```
┌─────────────────────────────────────────────────────────┐
│                    前端应用层                             │
│  - 轮询接口获取状态                                       │
│  - 显示工作流进度                                         │
│  - 处理用户确认操作                                       │
└────────────────────┬────────────────────────────────────┘
                     │ HTTP API
┌────────────────────▼────────────────────────────────────┐
│                  应用层 (Application Layer)               │
│  - SessionWorkflowExecutor (工作流执行引擎)              │
│  - InteractiveController (API控制器)                     │
│  - RoleProcessor (角色处理器)                            │
│  - StepwiseDocumentGenerator (分步骤文档生成器)          │
│  - BaseAction (Action基类)                                │
│  - BaseRole (Role基类)                                    │
└────────────────────┬────────────────────────────────────┘
                     │ 所有状态操作都通过StateManager
┌────────────────────▼────────────────────────────────────┐
│        统一状态管理层 (Unified State Management Layer)    │
│  ┌────────────────────────────────────────────────────┐  │
│  │  StateManager (统一状态管理器) ⭐ 核心组件           │  │
│  │  - 统一的状态读写接口                                │  │
│  │  - 状态转换逻辑                                       │  │
│  │  - 状态一致性保证                                     │  │
│  │  - 状态变更日志记录                                   │  │
│  │  - 工作流状态管理（整合原WorkflowTracker功能）        │  │
│  │  - 运行状态管理                                       │  │
│  │  - 确认状态管理                                       │  │
│  │  - RoleContext状态管理（state和todo）                │  │
│  └────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────┐  │
│  │  StepStateTracker (步骤状态跟踪器)                  │  │
│  │  - 分步骤执行流程状态管理                             │  │
│  │  - StepwiseDocumentGenerator步骤状态                │  │
│  │  - 作为StateManager的内部实现                        │  │
│  └────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────┐  │
│  │  WorkflowCancellationManager (取消管理器)            │  │
│  │  - 取消操作管理                                       │  │
│  └────────────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│              数据持久层 (Persistence Layer)               │
│  - InteractiveSessionWorkflowRepository (数据仓库)        │
│  - 数据库操作                                             │
│  - 事务管理                                               │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                    PostgreSQL 数据库                      │
│  - interactive_session_workflows (工作流状态表)          │
│  - interactive_session_running_state (运行状态表)        │
│  - interactive_session_step_state (步骤状态表，可选)     │
└─────────────────────────────────────────────────────────┘
```

**核心原则**：
- ✅ **所有状态读写必须通过StateManager**：禁止直接访问Repository或数据库
- ✅ **统一接口**：所有组件（Role、Action、StepwiseDocumentGenerator）都通过StateManager读写状态
- ✅ **状态一致性**：StateManager确保所有状态操作的一致性和原子性
- ✅ **可追溯性**：所有状态变更都通过StateManager记录日志

#### 2.1.2 核心组件

**1. StateManager（统一状态管理器）** ⭐ **核心组件**
- **职责**：所有状态读写的统一入口，统一管理角色、action和步骤的所有状态
- **设计原则**：
  - 所有状态操作必须通过StateManager，禁止直接访问Repository或数据库
  - 提供统一的状态读写接口
  - 确保状态操作的一致性和原子性
  - 记录所有状态变更日志
- **关键方法**：
  - `getActionStatus()`: 获取action状态
  - `setActionStatus()`: 设置action状态
  - `getRunningState()`: 获取运行状态
  - `setRunningState()`: 设置运行状态
  - `getStepState()`: 获取步骤状态（用于StepwiseDocumentGenerator）
  - `setStepState()`: 设置步骤状态
  - `onActionStart()`: Action开始执行（统一入口）
  - `onActionComplete()`: Action完成（统一入口）
  - `onActionError()`: Action失败（统一入口）
  - `resetWorkflow()`: 重置工作流（统一入口）

**2. SessionWorkflowExecutor（工作流执行引擎）**
- **职责**：工作流主循环，按顺序执行角色和action
- **状态管理**：所有状态操作通过StateManager
- **关键方法**：
  - `executeWorkflowLoop()`: 主循环，持续监控和执行工作流
  - `processRole()`: 处理单个角色，按action_order顺序执行actions
  - `tryMoveToNextRole()`: 切换到下一个角色

**3. WorkflowTracker（已移除）** ⚠️ **重要变更**
- **状态**：WorkflowTracker已被完全移除
- **功能整合**：WorkflowTracker的所有功能已直接整合到StateManager中
- **迁移说明**：所有使用WorkflowTracker的地方已改为使用StateManager
- **原功能**：现在通过StateManager的方法提供：
  - `onRoleStart()` → `StateManager.onActionStart()`
  - `onRoleComplete()` → `StateManager.onActionComplete()`
  - `onRoleError()` → `StateManager.onActionError()`
  - `resetWorkflowFromRole()` → `StateManager.resetWorkflow()`

**3. StepStateTracker（步骤状态跟踪器）**
- **职责**：分步骤执行流程的状态管理，作为StateManager的内部实现
- **状态管理**：通过StateManager统一接口对外提供服务
- **使用场景**：StepwiseDocumentGenerator的分步骤状态管理
- **关键方法**：
  - `onStepStart()`: 步骤开始（内部实现）
  - `onStepComplete()`: 步骤完成（内部实现）
  - `onStepError()`: 步骤失败（内部实现）
  - `resetSteps()`: 重置步骤状态（内部实现）

**4. InteractiveSessionWorkflowRepository（数据仓库）**
- **职责**：数据库操作，状态持久化
- **访问方式**：只能被StateManager及其内部组件（StepStateTracker）调用
- **重要变更**：WorkflowTracker已移除，不再作为独立组件
- **关键方法**：
  - `initializeWorkflow()`: 初始化工作流
  - `updateWorkflowItemStatus()`: 更新action状态
  - `getRunningState()`: 获取运行状态
  - `isLastActionForRole()`: 检查是否为最后一个action

**6. WorkflowCancellationManager（取消管理器）**
- **职责**：管理取消操作，通过AbortController实现
- **关键方法**：
  - `cancelProject()`: 取消项目所有操作
  - `clearCancellation()`: 清除取消标志

#### 2.1.3 统一状态管理器架构

状态管理系统采用统一状态管理器架构，**所有状态读写都必须通过StateManager**：

```
┌─────────────────────────────────────────────────────────┐
│  应用层 (Application Layer)                              │
│  - SessionWorkflowExecutor                               │
│  - InteractiveController                                 │
│  - StepwiseDocumentGenerator                            │
│  - BaseAction / BaseRole                                 │
│                                                          │
│  所有组件都通过StateManager读写状态                      │
│  ❌ 禁止直接访问Repository或数据库                       │
└──────────────┬──────────────────────────────────────────┘
               │ 统一状态接口
┌──────────────▼──────────────────────────────────────────┐
│  统一状态管理层 (Unified State Management Layer)        │
│  ┌────────────────────────────────────────────────────┐ │
│  │  StateManager (统一状态管理器)                     │ │
│  │  - 统一的状态读写接口                              │ │
│  │  - 状态转换逻辑                                     │ │
│  │  - 状态一致性保证                                   │ │
│  │  - 状态变更日志记录                                 │ │
│  └──────────┬──────────────────────┬──────────────────┘ │
│             │                      │                    │
│  ┌────────────────────────────────────────────────────┐ │
│  │  StepStateTracker (步骤状态跟踪器)                 │ │
│  │  - 作为StateManager的内部实现                      │ │
│  │  - 管理StepwiseDocumentGenerator的步骤状态         │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  注意：WorkflowTracker已移除，功能已整合到StateManager  │
└──────────────────────────────────────────────────────────┘
              │
              │ 只能被StateManager调用
┌─────────────▼──────────────────────▼────────────────────┐
│  数据持久层 (Persistence Layer)                           │
│  - InteractiveSessionWorkflowRepository                  │
│  - 数据库操作                                            │
│                                                          │
│  ❌ 禁止应用层直接访问                                    │
└──────────────────────────────────────────────────────────┘
```

**统一状态管理器设计原则**：

1. **单一入口原则**：
   - 所有状态读写必须通过StateManager
   - 禁止直接访问Repository或数据库
   - 确保状态操作的一致性和可追溯性

2. **统一接口设计**：
   ```typescript
   // StateManager统一接口
   class StateManager {
     // Action状态管理
     getActionStatus(projectId, role, action): Promise<ActionStatus>
     setActionStatus(projectId, role, action, status): Promise<void>
     
     // 运行状态管理
     getRunningState(projectId): Promise<RunningState>
     setRunningState(projectId, role, action): Promise<void>
     
     // 步骤状态管理（用于StepwiseDocumentGenerator）
     getStepState(projectId, role, action, stepId): Promise<StepState>
     setStepState(projectId, role, action, stepId, status): Promise<void>
     
     // 统一的事件接口
     onActionStart(projectId, role, action): Promise<void>
     onActionComplete(projectId, role, action): Promise<void>
     onActionError(projectId, role, action, error): Promise<void>
   }
   ```

3. **组件集成方式**：
   - **BaseAction**：通过StateManager读写action状态
   - **BaseRole**：通过StateManager读写role状态
   - **StepwiseDocumentGenerator**：通过StateManager读写步骤状态
   - **SessionWorkflowExecutor**：通过StateManager管理整个工作流状态

#### 2.1.4 状态分类与管理

**工作流状态 (Workflow State)**
- **存储位置**: `interactive_session_workflows` 表（参见[5.1 数据库设计](#51-interactive_session_workflows)）
- **管理对象**: 每个 role-action 对的状态
- **状态值**: `PENDING`, `RUNNING`, `COMPLETED`, `FAILED`（参见[5.1 状态值说明](#51-interactive_session_workflows)）
- **访问方式**: 通过`StateManager.getActionStatus()`和`StateManager.setActionStatus()`

**运行状态 (Running State)**
- **存储位置**: `interactive_session_running_state` 表（参见[5.2 数据库设计](#52-interactive_session_running_state)）
- **管理对象**: 当前执行的 role 和 action
- **字段**: `current_role`, `current_action`（参见[5.2 字段说明](#52-interactive_session_running_state)）
- **访问方式**: 通过`StateManager.getRunningState()`和`StateManager.setRunningState()`

**确认状态 (Confirmation State)**
- **存储位置**: `interactive_session_running_state` 表（参见[5.2 数据库设计](#52-interactive_session_running_state)）
- **管理对象**: 用户确认流程
- **字段**: `requires_confirmation`, `confirmation_role`（参见[5.2 字段说明](#52-interactive_session_running_state)）
- **访问方式**: 通过`StateManager.getConfirmationStatus()`和`StateManager.setConfirmationRequired()`

**步骤状态 (Step State)** ⭐ **新增**
- **存储位置**: 可选，可以存储在`interactive_session_step_state`表或内存中
- **管理对象**: 分步骤执行流程的内部步骤状态（如StepwiseDocumentGenerator的步骤状态）
- **状态值**: `PENDING`, `RUNNING`, `COMPLETED`, `FAILED`
- **访问方式**: 通过`StateManager.getStepState()`和`StateManager.setStepState()`
- **使用场景**: StepwiseDocumentGenerator的分步骤文档生成流程

**Action Idle状态 (Idle State)** ⭐ **新增**
- **存储位置**: 不直接存储，通过StateManager查询`items`中的状态来判断
- **管理对象**: 角色没有待执行的action时的状态
- **判断规则**: 
  - 如果角色的所有actions状态都是`COMPLETED`，则角色处于`IDLE`状态
  - 如果角色没有`PENDING`的action，且当前没有`RUNNING`的action，则角色处于`IDLE`状态
- **访问方式**: 通过`StateManager.getRoleActionsStatus()`查询角色的所有actions状态，然后判断是否idle
- **显示规则**: Action idle状态必须根据StateManager中的状态来决定是否显示，禁止使用内存状态或其他非StateManager的状态
- **使用场景**: 前端UI显示角色空闲状态，判断角色是否还有待执行的action

**RoleContext状态 (RoleContext State)** ⭐ **新增 - 统一使用数据库**
- **存储位置**: `interactive_session_running_state` 表（参见[5.2 数据库设计](#52-interactive_session_running_state)）
- **管理对象**: RoleContext的`state`和`todo`字段
- **字段**: 
  - `role_state` (INT): 存储RoleContext.state值（-1表示初始/终止状态，>=0表示action索引）
  - `role_todo_action` (VARCHAR): 存储RoleContext.todo对应的action名称（NULL表示无待执行action）
- **访问方式**: 通过`StateManager.getRoleContextState()`和`StateManager.setRoleContextState()`
- **重要原则**: 
  - **数据库为唯一数据源**：`rc.state`和`rc.todo`统一使用数据库管理，禁止在Role类中直接修改
  - **执行器负责同步**：执行器在执行前从数据库读取state和todo，同步到RoleContext内存
  - **Role类只读取**：`think()`和`act()`方法只读取内存状态，不修改内存状态
  - **状态更新通过StateManager**：所有state和todo的更新必须通过StateManager更新数据库

### 2.2 技术方案

#### 2.2.1 状态管理方案

**状态机模式**：
- 采用有限状态机（FSM）模式管理状态
- 明确定义状态和转换规则
- 禁止非法状态转换

**状态分离**：
- **工作流状态**：存储在`interactive_session_workflows`表
- **运行状态**：存储在`interactive_session_running_state`表
- **确认状态**：存储在`interactive_session_running_state`表

**状态一致性保证**：
- **统一状态管理器**：所有状态读写必须通过StateManager，确保状态操作的一致性
- **单一数据源**：所有状态存储在数据库中，不使用内存缓存
- **原子操作**：每个状态转换操作都是原子的，由StateManager保证
- **事务保证**：使用数据库事务确保一致性，由StateManager统一管理
- **禁止直接访问**：禁止直接访问Repository或数据库，所有操作必须通过StateManager

#### 2.2.2 顺序执行方案

**核心原则**：
- **一定要确保角色和action的顺序是正确的**：顺序错误会导致工作流执行混乱，必须严格保证顺序的正确性
- **所有的状态、角色和action的顺序都通过数据库中获取，不允许直接从内存中获取**：
  - 角色顺序必须从数据库`role_order`字段获取，按`role_order ASC`排序
  - Action顺序必须从数据库`action_order`字段获取，按`action_order ASC`排序
  - 状态查询必须从数据库读取，按`role_order ASC, action_order ASC`排序
  - 禁止使用内存中的角色数组或action数组来确定顺序
  - 禁止使用代码中硬编码的顺序来确定执行顺序

**顺序保证机制**：
- 使用数据库字段（`role_order`、`action_order`）存储顺序
- 初始化时设置顺序字段
- 查询时按顺序字段排序（从数据库查询，不允许从内存获取）
- 执行时严格按照顺序（基于数据库查询结果）

**确认时机控制**：
- 通过`isLastActionForRole()`方法判断是否为最后一个action
- 只有最后一个action完成时才触发确认流程
- 非最后action完成时自动继续执行下一个action

#### 2.2.3 重置方案

**重置范围**：
- 基于`role_order`字段确定下游角色
- 自动重置指定角色及其所有下游角色

**重置步骤**：
1. 停止正在执行的操作（通过AbortController）
2. 重置数据库状态（所有相关actions → PENDING）
3. 重置内存状态（RoleContext和action状态）
4. 回退到重置角色的第一个action
5. 清除确认状态
6. 清除取消标志

**资源清理**：
- 停止大模型调用（通过abortSignal）
- 停止异步操作和轮询任务
- 清理外部资源（如Cursor Agent）

### 2.3 数据流方案

#### 2.3.1 状态更新流程

```
前端轮询
  ↓
GET /api/interactive/:projectId/running
  ↓
InteractiveController.getRunningState()
  ↓
InteractiveSessionWorkflowRepository.getRunningState()
  ↓
查询数据库 (interactive_session_running_state, interactive_session_workflows)
  ↓
返回状态给前端
```

#### 2.3.2 状态转换流程

```
Action执行开始
  ↓
StateManager.onActionStart()
  ↓
InteractiveSessionWorkflowRepository.clearAllRunningStatuses()
  ↓
InteractiveSessionWorkflowRepository.updateWorkflowItemStatus()
  ↓
数据库更新 (status: PENDING → RUNNING)
  ↓
InteractiveSessionWorkflowRepository.updateRunningState()
  ↓
数据库更新 (current_role, current_action, role_state, role_todo_action)
```

#### 2.3.3 确认流程

```
Action执行完成
  ↓
WorkflowTracker.onRoleComplete()
  ↓
检查是否为最后一个action (isLastActionForRole())
  ↓
如果是最后一个action:
  → WorkflowTracker.setConfirmationRequired()
  → 数据库更新 (requires_confirmation: TRUE)
  → 前端轮询检测到确认状态
  → 显示确认对话框
```

### 2.4 扩展性方案

#### 2.4.1 新增角色和Action

**步骤**：
1. 在角色定义中添加新角色和actions
2. 调用`initializeWorkflow()`时会自动设置`role_order`和`action_order`
3. 工作流执行器会自动识别并执行新角色

**注意事项**：
- `role_order`和`action_order`在初始化时自动设置
- 新增角色会自动添加到工作流末尾
- 新增action会自动添加到角色末尾

#### 2.4.2 状态扩展

**扩展状态值**：
- 当前支持：PENDING, RUNNING, COMPLETED, FAILED
- 如需扩展，需要：
  1. 更新数据库表结构（status字段）
  2. 更新状态机定义
  3. 更新状态转换规则
  4. 更新相关代码逻辑

#### 2.4.3 性能优化方案

**查询优化**：
- 使用数据库索引（project_id, role_order, action_order）
- 批量查询多个状态
- 避免频繁的数据库查询

**缓存策略**：
- 后端不使用内存缓存，保证数据一致性
- 前端可以缓存状态，但需要定期刷新
- 使用轮询机制获取最新状态

### 2.5 安全性方案

#### 2.5.1 状态一致性保护

**机制**：
- 使用数据库事务保证原子性
- 使用唯一约束防止重复记录
- 使用外键约束保证数据完整性

**检查**：
- 定期检查状态一致性
- 自动修复不一致状态
- 记录修复日志

#### 2.5.2 并发控制

**机制**：
- `clearAllRunningStatuses()`确保同一时间只有一个action在运行
- 使用数据库锁防止并发更新
- 使用乐观锁处理并发冲突

#### 2.5.3 错误恢复

**机制**：
- 状态更新失败不中断工作流执行
- 记录所有错误日志
- 提供状态修复工具
- 支持手动重置工作流

---

## 三、设计原则

### 3.1 单一职责原则

- **工作流状态**：管理每个 action 的执行状态（pending/running/completed/failed）
- **运行状态**：管理当前正在执行的 role 和 action
- **确认状态**：管理用户确认流程

### 3.2 状态机模式

- 明确定义所有可能的状态
- 明确定义状态之间的转换规则
- 禁止非法状态转换

### 3.3 原子性操作

- 每个状态转换操作都是原子的
- 确保状态一致性

### 3.4 可追溯性

- 所有状态变更都有明确的调用路径
- 关键操作都有日志记录

### 3.5 顺序执行保证

- **一定要确保角色和action的顺序是正确的**：顺序错误会导致工作流执行混乱，必须严格保证顺序的正确性
- **所有的状态、角色和action的顺序都通过数据库中获取，不允许直接从内存中获取**：
  - 角色顺序必须从数据库`role_order`字段获取，按`role_order ASC`排序
  - Action顺序必须从数据库`action_order`字段获取，按`action_order ASC`排序
  - 状态查询必须从数据库读取，按`role_order ASC, action_order ASC`排序
  - 禁止使用内存中的角色数组或action数组来确定顺序
  - 禁止使用代码中硬编码的顺序来确定执行顺序
- 通过数据库字段（`role_order`、`action_order`）保证执行顺序
- 严格按照顺序执行，不会跳过任何action
- 只有最后一个action完成后才弹出确认框

---

## 四、状态机设计

### 4.1 Action 状态机

```
┌─────────┐
│ PENDING │ ◄─── 初始化/重置
└────┬────┘
     │ onRoleStart()
     ▼
┌─────────┐
│ RUNNING │ ◄─── 执行中（同一时间只能有一个）
└────┬────┘
     │ onRoleComplete() / onRoleError()
     ├──────────┬──────────┐
     ▼          ▼          ▼
┌──────────┐ ┌────────┐ ┌────────┐
│COMPLETED │ │ FAILED │ │ PENDING│ (回退)
└──────────┘ └────────┘ └────────┘
```

**状态定义**：
- `PENDING`: 待执行，初始状态
- `RUNNING`: 执行中，只能有一个 action 处于此状态
- `COMPLETED`: 已完成，最终状态
- `FAILED`: 执行失败，最终状态
- `IDLE`: 空闲状态，角色没有待执行的action（通过StateManager判断）

**转换规则**：
- `PENDING` → `RUNNING`: 通过 `onRoleStart()`
- `RUNNING` → `COMPLETED`: 通过 `onRoleComplete()`
- `RUNNING` → `FAILED`: 通过 `onRoleError()`
- `COMPLETED` → `PENDING`: 通过 `resetWorkflowFromRole()` (重新生成)
- `FAILED` → `PENDING`: 通过 `resetWorkflowFromRole()` (重新生成)
- `IDLE`: 当角色没有待执行的action时，通过StateManager判断并显示

**Action Idle状态判断规则**：
- **判断条件**：通过StateManager查询角色的所有actions状态
  - 如果角色的所有actions状态都是`COMPLETED`，则角色处于`IDLE`状态
  - 如果角色没有pending的action，且当前没有running的action，则角色处于`IDLE`状态
- **显示规则**：Action idle状态必须通过StateManager的状态来决定是否显示
  - ✅ 前端通过查询`items`中该角色的所有actions状态来判断是否显示idle
  - ✅ 禁止使用内存状态或其他非StateManager的状态来判断idle
  - ✅ 确保idle状态的显示与StateManager中的状态保持一致

### 4.2 运行状态机

```
┌──────────────┐
│ NULL         │ ◄─── 无运行状态
└──────┬───────┘
       │ setRunningState(role, null)
       ▼
┌──────────────┐
│ ROLE_ONLY    │ ◄─── 只有角色，无 action
└──────┬───────┘
       │ onRoleStart(action)
       ▼
┌──────────────┐
│ ROLE_ACTION  │ ◄─── 角色 + action
└──────┬───────┘
       │ onRoleComplete() / clearState()
       ▼
┌──────────────┐
│ NULL/ROLE_ONLY│
└──────────────┘
```

**状态定义**：
- `NULL`: `current_role = null, current_action = null`
- `ROLE_ONLY`: `current_role != null, current_action = null`
- `ROLE_ACTION`: `current_role != null, current_action != null`

### 4.3 确认状态

**确认时机**：
- **触发条件**：只有当前角色的**最后一个action**（`action_order`最大）执行完成后才触发
- **非最后action**：如果当前action不是角色的最后一个action，执行完成后自动继续执行下一个action，不弹出确认框

**状态转换**：
- `false` → `true`: 通过 `setConfirmationRequired(role)`（最后一个action完成时）
- `true` → `false`: 通过 `clearConfirmationRequired()`（用户确认后）

---

## 五、数据库设计

### 5.1 interactive_session_workflows

**表名**: `interactive_session_workflows`  
**用途**: 存储所有角色和 action 的状态，每个 role-action 对对应一条记录

**表结构**:

| 字段名 | 数据类型 | 说明 | 约束 | 默认值 |
|--------|---------|------|------|--------|
| `id` | UUID | 主键ID | PRIMARY KEY | `uuid_generate_v4()` |
| `project_id` | UUID | 项目ID | NOT NULL, FOREIGN KEY → `projects(id)` ON DELETE CASCADE | |
| `role` | VARCHAR(100) | 角色名称 | NOT NULL | |
| `action` | VARCHAR(100) | Action 名称 | NOT NULL | |
| `status` | VARCHAR(20) | 状态值 | NOT NULL | `'pending'` |
| `role_order` | INT | 角色在工作流中的执行顺序（从0开始） | NULL | |
| `action_order` | INT | Action在角色中的执行顺序（从0开始） | NULL | |
| `created_at` | TIMESTAMP | 创建时间 | NOT NULL | `NOW()` |
| `updated_at` | TIMESTAMP | 更新时间 | NOT NULL | `NOW()` |

**约束**:
- 主键: `PRIMARY KEY (id)`
- 唯一约束: `UNIQUE(project_id, role, action)` - 确保每个项目的每个 role-action 对只有一条记录
- 外键: `FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE`

**索引**:
```sql
CREATE INDEX idx_interactive_session_workflows_project_id 
ON interactive_session_workflows(project_id);

CREATE INDEX idx_interactive_session_workflows_status 
ON interactive_session_workflows(status);

CREATE INDEX idx_interactive_session_workflows_role 
ON interactive_session_workflows(role);

CREATE INDEX idx_interactive_session_workflows_role_order 
ON interactive_session_workflows(project_id, role_order);

CREATE INDEX idx_interactive_session_workflows_action_order 
ON interactive_session_workflows(project_id, role, action_order);
```

**顺序保证**（权威定义，其他章节引用此定义）:
- `role_order` (INT, NULL): 角色在工作流中的执行顺序（从0开始），通过数据库字段保证，查询时按此字段排序
- `action_order` (INT, NULL): Action在角色中的执行顺序（从0开始），通过数据库字段保证，查询时按此字段排序
- 角色和action的顺序完全由数据库中的`role_order`和`action_order`字段来保证，确保执行顺序的一致性

**状态值说明**（权威定义，其他章节引用此定义）:
- `status` (VARCHAR(20), NOT NULL, DEFAULT 'pending'): 工作流项状态
  - `pending`: 待执行，初始状态
  - `running`: 执行中，同一时间只能有一个 action 处于此状态
  - `completed`: 已完成，最终状态
  - `failed`: 执行失败，最终状态

**DDL**:
```sql
CREATE TABLE IF NOT EXISTS interactive_session_workflows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  role VARCHAR(100) NOT NULL,
  action VARCHAR(100),
  status VARCHAR(20) DEFAULT 'pending',
  role_order INT,
  action_order INT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(project_id, role, action)
);

COMMENT ON TABLE interactive_session_workflows IS 
'交互式会话工作流表，存储交互式会话中所有角色和行动的状态';

COMMENT ON COLUMN interactive_session_workflows.status IS 
'工作流项状态: pending, running, completed, failed';

COMMENT ON COLUMN interactive_session_workflows.role_order IS 
'角色在工作流中的执行顺序（从0开始）';

COMMENT ON COLUMN interactive_session_workflows.action_order IS 
'Action在角色中的执行顺序（从0开始）';
```

### 5.2 interactive_session_running_state

**表名**: `interactive_session_running_state`  
**用途**: 存储当前运行状态和确认状态，每个项目只有一条记录

**表结构**:

| 字段名 | 数据类型 | 说明 | 约束 | 默认值 |
|--------|---------|------|------|--------|
| `id` | UUID | 主键ID | PRIMARY KEY | `uuid_generate_v4()` |
| `project_id` | UUID | 项目ID | NOT NULL, UNIQUE, FOREIGN KEY → `projects(id)` ON DELETE CASCADE | |
| `current_role` | VARCHAR(100) | 当前运行的角色 | NULL | |
| `current_action` | VARCHAR(100) | 当前运行的 action | NULL | |
| `requires_confirmation` | BOOLEAN | 是否需要确认 | NOT NULL | `FALSE` |
| `confirmation_role` | VARCHAR(100) | 等待确认的角色 | NULL | |
| `role_state` | INT | RoleContext.state值（-1表示初始/终止状态，>=0表示action索引） | NULL | |
| `role_todo_action` | VARCHAR(100) | RoleContext.todo对应的action名称（NULL表示无待执行action） | NULL | |
| `created_at` | TIMESTAMP | 创建时间 | NOT NULL | `NOW()` |
| `updated_at` | TIMESTAMP | 更新时间 | NOT NULL | `NOW()` |

**约束**:
- 主键: `PRIMARY KEY (id)`
- 唯一约束: `UNIQUE(project_id)` - 确保每个项目只有一条运行状态记录
- 外键: `FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE`

**索引**:
```sql
CREATE INDEX idx_interactive_session_running_state_project_id 
ON interactive_session_running_state(project_id);

CREATE INDEX idx_interactive_session_running_state_confirmation 
ON interactive_session_running_state(project_id, requires_confirmation) 
WHERE requires_confirmation = TRUE;
```

**字段说明**（权威定义，其他章节引用此定义）:
- `current_role` (VARCHAR(100), NULL): 当前正在执行的角色，`NULL` 表示无运行状态
- `current_action` (VARCHAR(100), NULL): 当前正在执行的 action，`NULL` 表示只有角色无具体 action
- `requires_confirmation` (BOOLEAN, NOT NULL, DEFAULT FALSE): `TRUE` 表示需要用户确认才能继续
- `confirmation_role` (VARCHAR(100), NULL): 等待确认的角色名称，仅在 `requires_confirmation = TRUE` 时有值
- `role_state` (INT, NULL): RoleContext.state值，`-1`表示初始/终止状态，`>=0`表示当前执行的action索引（在BY_ORDER模式下）
- `role_todo_action` (VARCHAR(100), NULL): RoleContext.todo对应的action名称，`NULL`表示无待执行action

**DDL**:
```sql
CREATE TABLE IF NOT EXISTS interactive_session_running_state (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID UNIQUE NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  "current_role" VARCHAR(100),
  current_action VARCHAR(100),
  requires_confirmation BOOLEAN DEFAULT FALSE,
  confirmation_role VARCHAR(100),
  role_state INT,
  role_todo_action VARCHAR(100),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE interactive_session_running_state IS 
'交互式会话运行状态表，存储当前运行的角色和行动';

COMMENT ON COLUMN interactive_session_running_state.requires_confirmation IS 
'是否需要人工确认，TRUE表示当前角色最后一个Action已完成，等待人工确认';

COMMENT ON COLUMN interactive_session_running_state.confirmation_role IS 
'等待确认的角色名称';

COMMENT ON COLUMN interactive_session_running_state.role_state IS 
'RoleContext.state值：-1表示初始/终止状态，>=0表示当前执行的action索引';

COMMENT ON COLUMN interactive_session_running_state.role_todo_action IS 
'RoleContext.todo对应的action名称：NULL表示无待执行action';
```

### 5.3 数据库关系图

```
┌─────────────────┐
│    projects     │
│  (id: UUID)     │
└────────┬────────┘
         │
         │ ON DELETE CASCADE
         │
    ┌────┴─────────────────────────────────────┐
    │                                            │
    ▼                                            ▼
┌──────────────────────────┐      ┌──────────────────────────────┐
│interactive_session_      │      │interactive_session_running_  │
│workflows                 │      │state                         │
│                          │      │                              │
│project_id (FK)           │      │project_id (FK, UNIQUE)      │
│role                      │      │current_role                 │
│action                    │      │current_action               │
│status                    │      │requires_confirmation        │
└──────────────────────────┘      │confirmation_role            │
                                  └──────────────────────────────┘
```

**关系说明**:
- `interactive_session_workflows`: 一个项目可以有多个 workflow items（多个 role-action 对）
- `interactive_session_running_state`: 一个项目只有一条运行状态记录（1:1 关系）
- 两个表都通过 `project_id` 关联到 `projects` 表
- 删除项目时，相关的工作流和运行状态记录会自动删除（CASCADE）

---

## 六、核心类和接口

### 6.1 StateManager（统一状态管理器）⭐ **核心组件**

**位置**: `backend/src/orchestration/StateManager.ts`（新建）  
**职责**: 所有状态读写的统一入口，统一管理角色、action和步骤的所有状态

**设计原则**：
- ✅ **单一入口**：所有状态读写必须通过StateManager
- ✅ **统一接口**：提供统一的状态读写接口
- ✅ **状态一致性**：确保所有状态操作的一致性和原子性
- ✅ **可追溯性**：记录所有状态变更日志

**核心方法**:

**Action状态管理**:
- `getActionStatus(projectId, role, action)` - 获取action状态
- `setActionStatus(projectId, role, action, status)` - 设置action状态
- `getRoleActionsStatus(projectId, role)` - 获取角色的所有action状态

**运行状态管理**:
- `getRunningState(projectId)` - 获取当前运行状态
- `setRunningState(projectId, role, action)` - 设置运行状态
- `clearRunningState(projectId)` - 清除运行状态

**RoleContext状态管理**（state和todo）:
- `getRoleContextState(projectId, role)` - 获取角色的state和todo状态
- `setRoleContextState(projectId, role, state, todo)` - 设置角色的state和todo状态
- `clearRoleContextState(projectId, role)` - 清除角色的state和todo状态（重置为state=-1, todo=null）

**确认状态管理**:
- `getConfirmationStatus(projectId)` - 获取确认状态
- `setConfirmationRequired(projectId, role)` - 设置确认要求
- `clearConfirmationRequired(projectId)` - 清除确认要求

**步骤状态管理**（用于StepwiseDocumentGenerator）:
- `getStepState(projectId, role, action, stepId)` - 获取步骤状态
- `setStepState(projectId, role, action, stepId, status)` - 设置步骤状态
- `getAllStepStates(projectId, role, action)` - 获取所有步骤状态
- `resetStepStates(projectId, role, action)` - 重置步骤状态

**Action Idle状态管理**:
- `getRoleActionsStatus(projectId, role)` - 获取角色的所有actions状态（用于判断idle）
- `isRoleIdle(projectId, role)` - 判断角色是否处于idle状态（可选便捷方法）
  - 内部实现：查询角色的所有actions状态，如果所有actions都是`COMPLETED`，或没有`PENDING`且没有`RUNNING`的action，则返回`true`

**统一的事件接口**:
- `onActionStart(projectId, role, action)` - Action开始执行（统一入口）
- `onActionComplete(projectId, role, action)` - Action完成（统一入口）
- `onActionError(projectId, role, action, error)` - Action失败（统一入口）
- `resetWorkflow(projectId, role)` - 重置工作流（统一入口）

**初始化**:
- `initialize(projectId, roles)` - 初始化工作流，设置role_order和action_order

**接口设计示例**:
```typescript
export class StateManager {
  private projectId: string;
  private repository: InteractiveSessionWorkflowRepository;
  private stepStateTracker: StepStateTracker;
  
  constructor(projectId: string, team: Team) {
    this.projectId = projectId;
    this.repository = new InteractiveSessionWorkflowRepository();
    this.stepStateTracker = new StepStateTracker(projectId);
  }
  
  // Action状态管理（整合原WorkflowTracker功能）
  async getActionStatus(role: string, action: string): Promise<ActionStatus> {
    return await this.repository.isActionCompleted(this.projectId, role, action)
      ? ActionStatus.COMPLETED
      : await this.getActionStatusFromDB(role, action);
  }
  
  async setActionStatus(role: string, action: string, status: ActionStatus): Promise<void> {
    await this.repository.updateWorkflowItemStatus(this.projectId, role, action, status);
    this.logStateChange('action', role, action, status);
  }
  
  // RoleContext状态管理（state和todo）
  async getRoleContextState(role: string): Promise<{state: number, todo: string | null}> {
    const runningState = await this.repository.getRunningState(this.projectId);
    return {
      state: runningState?.role_state ?? -1,
      todo: runningState?.role_todo_action ?? null
    };
  }
  
  async setRoleContextState(role: string, state: number, todo: string | null): Promise<void> {
    await this.repository.updateRunningState(
      this.projectId, 
      role, 
      null, // current_action保持原值
      undefined, // requires_confirmation保持原值
      undefined, // confirmation_role保持原值
      state,
      todo
    );
    this.logStateChange('roleContext', role, null, { state, todo });
  }
  
  // 步骤状态管理（用于StepwiseDocumentGenerator）
  async getStepState(role: string, action: string, stepId: string): Promise<StepState> {
    return await this.stepStateTracker.getStepState(role, action, stepId);
  }
  
  async setStepState(role: string, action: string, stepId: string, status: StepState): Promise<void> {
    await this.stepStateTracker.setStepState(role, action, stepId, status);
    this.logStateChange('step', role, action, status, stepId);
  }
  
  // 统一的事件接口（整合原WorkflowTracker功能）
  async onActionStart(role: string, action: string): Promise<void> {
    // 清除所有RUNNING状态
    await this.repository.clearAllRunningStatuses(this.projectId);
    // 设置当前action为RUNNING
    await this.setActionStatus(role, action, ActionStatus.RUNNING);
    // 更新运行状态
    await this.repository.updateRunningState(this.projectId, role, action);
    // 更新RoleContext状态
    const actionIndex = await this.getActionIndex(role, action);
    await this.setRoleContextState(role, actionIndex, action);
  }
  
  async onActionComplete(role: string, action: string, message?: any): Promise<void> {
    await this.setActionStatus(role, action, ActionStatus.COMPLETED);
    // 检查是否为最后一个action
    const isLastAction = await this.isLastActionForRole(role, action);
    if (isLastAction) {
      await this.setConfirmationRequired(role);
    }
  }
  
  // 记录状态变更日志
  private logStateChange(type: string, role: string, action: string | null, status: any, stepId?: string): void {
    logger.info('StateManager: State changed', {
      projectId: this.projectId,
      type,
      role,
      action,
      status,
      stepId,
      timestamp: new Date().toISOString(),
    });
  }
}
```

### 6.2 WorkflowTracker（已移除）⚠️ **重要变更**

**状态**: WorkflowTracker已被完全移除  
**功能整合**: WorkflowTracker的所有功能已直接整合到StateManager中  
**迁移说明**: 所有使用WorkflowTracker的地方已改为使用StateManager

**原功能迁移对照表**:
- `WorkflowTracker.initialize()` → `StateManager.initialize()`
- `WorkflowTracker.onRoleStart()` → `StateManager.onActionStart()`
- `WorkflowTracker.onRoleComplete()` → `StateManager.onActionComplete()`
- `WorkflowTracker.onRoleError()` → `StateManager.onActionError()`
- `WorkflowTracker.onRoleIdle()` → `StateManager.onActionIdle()`
- `WorkflowTracker.getCurrentState()` → `StateManager.getRunningState()`
- `WorkflowTracker.setRunningState()` → `StateManager.setRunningState()`
- `WorkflowTracker.clearState()` → `StateManager.clearRunningState()`
- `WorkflowTracker.getWorkflowItems()` → `StateManager.getWorkflowItems()`
- `WorkflowTracker.getWorkflowStructure()` → `StateManager.getWorkflowStructure()`
- `WorkflowTracker.isActionCompleted()` → `StateManager.isActionCompleted()`
- `WorkflowTracker.areAllRoleActionsCompleted()` → `StateManager.areAllRoleActionsCompleted()`
- `WorkflowTracker.getRoleActionsStatus()` → `StateManager.getRoleActionsStatus()`
- `WorkflowTracker.setConfirmationRequired()` → `StateManager.setConfirmationRequired()`
- `WorkflowTracker.clearConfirmationRequired()` → `StateManager.clearConfirmationRequired()`
- `WorkflowTracker.isConfirmationRequired()` → `StateManager.getConfirmationStatus()`
- `WorkflowTracker.resetWorkflowFromRole()` → `StateManager.resetWorkflow()`

### 6.3 StepStateTracker（步骤状态跟踪器）⭐ **新增**

**位置**: `backend/src/orchestration/StepStateTracker.ts`（新建）  
**职责**: 分步骤执行流程的状态管理，被StateManager调用

**使用场景**: StepwiseDocumentGenerator的分步骤文档生成流程

**核心方法**:
- `getStepState(role, action, stepId)` - 获取步骤状态
- `setStepState(role, action, stepId, status)` - 设置步骤状态
- `getAllStepStates(role, action)` - 获取所有步骤状态
- `resetStepStates(role, action)` - 重置步骤状态
- `onStepStart(role, action, stepId)` - 步骤开始
- `onStepComplete(role, action, stepId)` - 步骤完成
- `onStepError(role, action, stepId, error)` - 步骤失败

**步骤状态定义**:
```typescript
export enum StepState {
  PENDING = 'pending',    // 待执行
  RUNNING = 'running',    // 执行中
  COMPLETED = 'completed', // 已完成
  FAILED = 'failed'       // 执行失败
}

export interface StepStateInfo {
  stepId: string;         // 步骤ID（如 'outline', 'section-1', 'merge'）
  stepName: string;        // 步骤名称（如 '生成目录', '生成章节1', '合并文档'）
  status: StepState;      // 步骤状态
  startTime?: Date;        // 开始时间
  endTime?: Date;         // 结束时间
  error?: string;          // 错误信息（如果失败）
}
```

**StepwiseDocumentGenerator集成示例**:
```typescript
export class StepwiseDocumentGenerator {
  private action: BaseAction;
  private config: StepwiseGenerationConfig;
  private stateManager: StateManager;
  private role: string;
  
  constructor(action: BaseAction, config: StepwiseGenerationConfig, stateManager: StateManager) {
    this.action = action;
    this.config = config;
    this.stateManager = stateManager;
    this.role = action.role?.profile || 'Unknown';
  }
  
  async generate(input: string): Promise<IActionOutput> {
    // Step 1: 生成目录
    await this.stateManager.setStepState(this.role, this.action.name, 'outline', StepState.RUNNING);
    const outline = await this.generateOutline(input);
    await this.stateManager.setStepState(this.role, this.action.name, 'outline', StepState.COMPLETED);
    
    // Step 2: 解析章节列表
    await this.stateManager.setStepState(this.role, this.action.name, 'parse-sections', StepState.RUNNING);
    const sections = this.parseSections(outline);
    await this.stateManager.setStepState(this.role, this.action.name, 'parse-sections', StepState.COMPLETED);
    
    // Step 3: 按章节生成内容
    for (let i = 0; i < sections.length; i++) {
      const stepId = `section-${sections[i].number}`;
      await this.stateManager.setStepState(this.role, this.action.name, stepId, StepState.RUNNING);
      const content = await this.generateSection(input, outline, sections[i]);
      await this.stateManager.setStepState(this.role, this.action.name, stepId, StepState.COMPLETED);
    }
    
    // ... 其他步骤
    
    return result;
  }
}
```

### 6.4 InteractiveSessionWorkflowRepository

**位置**: `backend/src/database/repositories/InteractiveSessionWorkflowRepository.ts`  
**职责**: 数据持久层，负责数据库操作

**访问方式**: 只能被StateManager及其内部组件（WorkflowTracker、StepStateTracker）调用

**核心方法**:
- `initializeWorkflow()` - 初始化工作流，设置role_order和action_order
- `updateRunningState()` - 更新运行状态
- `getRunningState()` - 获取运行状态
- `updateWorkflowItemStatus()` - 更新 action 状态
- `resetWorkflowFromRole()` - 重置角色及后续所有角色的actions为PENDING
- `clearAllRunningStatuses()` - 清除所有运行状态
- `setConfirmationRequired()` - 设置确认要求
- `clearConfirmationRequired()` - 清除确认要求
- `isLastActionForRole()` - 检查action是否为角色的最后一个action（基于action_order）
- `getFirstActionForRole()` - 获取角色的第一个action（action_order最小）
- `getDownstreamRoles()` - 获取下游角色列表（基于role_order）

**注意**: Repository的方法只能被StateManager及其内部组件调用，应用层禁止直接访问。

### 6.5 SessionWorkflowExecutor

**位置**: `backend/src/orchestration/SessionWorkflowExecutor.ts`  
**职责**: 应用层，工作流执行引擎

**状态管理**: 所有状态操作通过StateManager

**核心方法**:
- `executeWorkflowLoop()` - 工作流主循环，按role_order和action_order顺序执行
- `processRole()` - 处理角色，按action_order顺序执行actions
- `tryMoveToNextRole()` - 尝试切换到下一个角色（按role_order顺序）
- `findNextIncompleteRole()` - 查找下一个未完成的角色（基于role_order）

**状态操作示例**:
```typescript
// 通过StateManager进行状态操作
await this.stateManager.onActionStart(role.profile, action.name);
// ... 执行action
await this.stateManager.onActionComplete(role.profile, action.name);
```

### 6.4 关键操作汇总表

| 操作 | 方法 | 层级 | 状态转换 | 原子性 | 调用时机 |
|------|------|------|---------|--------|---------|
| **初始化工作流** | `initializeWorkflow()` | Repository | 未初始化 → 运行中 | ✅ | 项目创建时 |
| **Action 开始** | `onRoleStart()` | WorkflowTracker | PENDING → RUNNING | ✅ | Action 执行前 |
| **Action 完成** | `onRoleComplete()` | WorkflowTracker | RUNNING → COMPLETED | ✅ | Action 执行后 |
| **Action 失败** | `onRoleError()` | WorkflowTracker | RUNNING → FAILED | ✅ | Action 出错时 |
| **设置运行状态** | `setRunningState()` | WorkflowTracker | NULL ↔ ROLE_ONLY ↔ ROLE_ACTION | ✅ | 角色切换时 |
| **清除运行状态** | `clearState()` | WorkflowTracker | ROLE_* → NULL | ✅ | 角色完成/切换时 |
| **重置工作流** | `resetWorkflowFromRole()` | WorkflowTracker | COMPLETED/FAILED/RUNNING → PENDING | ✅ | 重置角色时 |
| **请求确认** | `setConfirmationRequired()` | Repository | requires_confirmation: false → true | ✅ | **最后一个action完成时** |
| **清除确认** | `clearConfirmationRequired()` | Repository | requires_confirmation: true → false | ✅ | 用户确认后 |
| **清除所有运行** | `clearAllRunningStatuses()` | Repository | RUNNING → PENDING | ✅ | 开始新 action 前 |
| **检查最后action** | `isLastActionForRole()` | Repository | - | ✅ | Action完成时检查 |

---

## 七、状态转换规则

### 7.1 Action 状态转换

| 当前状态 | 操作 | 目标状态 | 前置条件 | 后置操作 |
|---------|------|---------|---------|---------|
| `PENDING` | `onRoleStart()` | `RUNNING` | 无其他 RUNNING 状态 | 清除其他 RUNNING 状态 |
| `RUNNING` | `onRoleComplete()` | `COMPLETED` | 执行成功 | 更新运行状态 |
| `RUNNING` | `onRoleError()` | `FAILED` | 执行失败 | 清除运行状态 |
| `COMPLETED` | `resetWorkflowFromRole()` | `PENDING` | 用户重新生成 | 清除确认状态 |
| `FAILED` | `resetWorkflowFromRole()` | `PENDING` | 用户重新生成 | 清除确认状态 |

### 8.2 运行状态转换

| 当前状态 | 操作 | 目标状态 | 说明 |
|---------|------|---------|------|
| `NULL` | `setRunningState(role, null)` | `ROLE_ONLY` | 切换到新角色 |
| `ROLE_ONLY` | `onRoleStart(action)` | `ROLE_ACTION` | 开始执行 action |
| `ROLE_ACTION` | `onRoleComplete()` | `ROLE_ONLY` | Action 完成，角色继续 |
| `ROLE_ACTION` | `clearState()` | `NULL` | 角色完成或切换 |
| `ROLE_ONLY` | `clearState()` | `NULL` | 角色完成或切换 |

### 8.3 确认状态转换

| 当前状态 | 操作 | 目标状态 | 说明 |
|---------|------|---------|------|
| `false` | `setConfirmationRequired(role)` | `true` | **最后一个action完成**，需要确认 |
| `true` | `clearConfirmationRequired()` | `false` | 用户确认后清除 |

### 8.4 状态一致性保证

#### 8.4.1 状态一致性总体原则

**核心原则**：
1. **数据库为唯一数据源**：所有状态以数据库为准，内存状态仅作为执行时的临时缓存
2. **执行器负责同步**：执行器在调用`think()`之前从数据库同步状态到内存
3. **Role类只读取**：`think()`和`act()`方法只读取内存状态，不修改内存状态
4. **状态更新通过WorkflowTracker**：所有状态更新通过`WorkflowTracker`更新数据库，执行器负责同步到内存

**状态类型**：
- **Action状态**：PENDING、RUNNING、COMPLETED、FAILED（存储在数据库）
- **运行状态**：NULL、ROLE_ONLY、ROLE_ACTION（存储在数据库）
- **确认状态**：requires_confirmation、confirmation_role（存储在数据库）
- **内存状态**：RoleContext状态（`rc.todo`、`rc.state`）由执行器从数据库同步，不直接修改

#### 8.4.2 Action状态一致性保证

**数据库状态（权威数据源）**：
- 存储在`interactive_session_workflows`表的`status`字段
- 状态值：`pending`、`running`、`completed`、`failed`
- 每个role-action对对应一条记录

**内存状态（运行时缓存）**：
- 存储在`Role.actions[].status`字段（仅用于执行时的临时缓存）
- 执行器在调用`think()`之前从数据库同步到内存

**同步机制**：

1. **状态更新时只更新数据库**：
```typescript
// onRoleStart() - Action开始执行
async onRoleStart(role: string, action: string) {
  // 1. 清除所有RUNNING状态（数据库）
  await this.repository.clearAllRunningStatuses(this.projectId);
  
  // 2. 更新数据库状态: PENDING → RUNNING
  await this.repository.updateWorkflowItemStatus(
    this.projectId, role, action, 'running'
  );
  
  // 3. 更新运行状态（数据库）
  await this.repository.updateRunningState(this.projectId, role, action);
  
  // 注意：不直接修改内存状态，执行器会在下次调用think()前同步
}

// onRoleComplete() - Action完成
async onRoleComplete(role: string, action: string) {
  // 1. 更新数据库状态: RUNNING → COMPLETED
  await this.repository.updateWorkflowItemStatus(
    this.projectId, role, action, 'completed'
  );
  
  // 2. 更新运行状态（数据库）
  await this.repository.updateRunningState(this.projectId, role, null);
  
  // 注意：不直接修改内存状态，执行器会在下次调用think()前同步
}
```

2. **执行器同步机制**：
```typescript
// SessionWorkflowExecutor.processRole() - 处理角色前同步状态
private async processRole(roles: any[], env: Environment, roleIndex: number) {
  const role = roles[roleIndex];
  
  // Step 0: 从数据库同步状态到内存（数据库是唯一数据源）
  await this.syncRoleStateFromDatabase(role);
  
  // Step 1: 调用think()（只读取内存状态，不修改）
  await role.observe();
  const hasTodo = await role.think();
  
  // Step 2: 执行action
  if (hasTodo) {
    const message = await role.act();
    // 执行完成后，WorkflowTracker更新数据库状态
    await this.workflowTracker.onRoleComplete(role, message);
  }
}
```

3. **重置时只更新数据库**：
- 重置时只更新数据库状态
- 执行器会在下次处理角色时从数据库同步状态到内存

**一致性检查**：
```typescript
// 检查Action状态一致性
async checkActionStateConsistency(projectId: string) {
  // 1. 从数据库获取所有workflow items状态
  const dbItems = await repository.getWorkflowItems(projectId);
  
  // 2. 检查内存状态
  for (const dbItem of dbItems) {
    const roleInstance = getRoleInstance(dbItem.role);
    if (roleInstance) {
      const actionInstance = roleInstance.actions.find(
        a => a.name === dbItem.action
      );
      
      // 3. 如果内存状态与数据库不一致，修复内存状态
      if (actionInstance && actionInstance.status !== dbItem.status) {
        logger.warn(`Action state inconsistency detected: ${dbItem.role}-${dbItem.action}, DB: ${dbItem.status}, Memory: ${actionInstance.status}`);
        actionInstance.status = dbItem.status; // 以数据库为准
      }
    }
  }
}
```

#### 8.4.3 运行状态一致性保证

**运行状态唯一性**：
- **规则**: 同一时间只能有一个 action 处于 RUNNING 状态
- **实现**: `onRoleStart()` 中调用 `clearAllRunningStatuses()` 清除所有 RUNNING 状态

**运行状态与 Action 状态同步**：
- **规则**: 运行状态中的 `current_action` 必须对应一个 RUNNING 状态的 action
- **实现**: 
  - `onRoleStart()`: 同时更新运行状态和 action 状态
  - `onRoleComplete()`: 同时更新运行状态和 action 状态

**数据库运行状态（权威数据源）**：
- 存储在`interactive_session_running_state`表
- 字段：`current_role`、`current_action`
- 每个项目只有一条记录（`UNIQUE(project_id)`）

**内存运行状态**：
- 不存储内存运行状态，所有查询都从数据库读取
- `getCurrentState()`方法只从数据库读取，不使用内存缓存

**同步机制**：
```typescript
// 运行状态更新（数据库和内存同步）
async setRunningState(role: string | null, action: string | null) {
  // 1. 更新数据库运行状态
  await this.repository.updateRunningState(this.projectId, role, action);
  
  // 2. 不更新内存状态（内存不存储运行状态）
  // 所有查询都从数据库读取，确保一致性
}

// 运行状态查询（只从数据库读取）
async getCurrentState(): Promise<WorkflowState> {
  // 只从数据库读取，不使用内存缓存
  const dbState = await this.repository.getRunningState(this.projectId);
  return {
    role: dbState?.current_role || null,
    action: dbState?.current_action || null,
  };
}
```

**一致性检查**：
```typescript
// 检查运行状态一致性
async checkRunningStateConsistency(projectId: string) {
  // 1. 从数据库获取运行状态
  const runningState = await repository.getRunningState(projectId);
  
  // 2. 检查是否有RUNNING状态的action
  const runningActions = await repository.getRunningActions(projectId);
  
  // 3. 如果运行状态有action但数据库中没有RUNNING的action，清除运行状态
  if (runningState?.current_action && runningActions.length === 0) {
    logger.warn('Running state inconsistency: action in running state but no RUNNING action in database');
    await repository.updateRunningState(projectId, null, null);
  }
  
  // 4. 如果有RUNNING状态的action但运行状态中没有，更新运行状态
  if (runningActions.length > 0) {
    const runningAction = runningActions[0];
    if (runningState?.current_role !== runningAction.role ||
        runningState?.current_action !== runningAction.action) {
      logger.warn('Running state inconsistency: RUNNING action exists but running state mismatch');
      await repository.updateRunningState(
        projectId, 
        runningAction.role, 
        runningAction.action
      );
    }
  }
}
```

#### 8.4.4 RoleContext状态一致性保证

**RoleContext状态**：
- `status`: RoleStatus（IDLE、THINKING、ACTING等）
- `state`: number（-1表示初始/终止状态）
- `todo`: BaseAction | null（当前待执行的action）

**重要原则**：
- **数据库是唯一数据源**：`rc.todo`和`rc.state`不直接修改，由执行器从数据库同步
- **Role类只读取**：`think()`和`act()`方法只读取内存状态，不修改内存状态
- **执行器负责同步**：执行器在调用`think()`之前从数据库同步状态到内存

**同步机制**：

1. **执行器同步状态**：
```typescript
// SessionWorkflowExecutor.syncRoleStateFromDatabase() - 从数据库同步到内存
private async syncRoleStateFromDatabase(role: any): Promise<void> {
  // 1. 从数据库获取运行状态
  const currentState = await this.workflowTracker.getCurrentState();
  
  // 2. 如果数据库中有运行中的action，同步到内存
  if (currentState.role === role.profile && currentState.action) {
    const isActionCompleted = await this.stateChecker.isActionCompleted(
      role.profile, currentState.action
    );
    if (!isActionCompleted) {
      // 同步到内存
      const actionInstance = role.actions.find(a => a.name === currentState.action);
      if (actionInstance) {
        const actionIndex = role.actions.findIndex(a => a.name === currentState.action);
        if (actionIndex >= 0) {
          role.rc.state = actionIndex;
          role.rc.todo = actionInstance;
          role.rc.todo.status = 'pending';
          role.rc.status = 'pending';
        }
      }
    }
  } else {
    // 3. 如果没有运行状态，查找第一个pending action
    const roleActionsStatus = await this.workflowTracker.getRoleActionsStatus(role.profile);
    const firstPendingAction = roleActionsStatus.find(a => a.status === 'pending');
    if (firstPendingAction) {
      const actionInstance = role.actions.find(a => a.name === firstPendingAction.action);
      if (actionInstance) {
        const actionIndex = role.actions.findIndex(a => a.name === firstPendingAction.action);
        if (actionIndex >= 0) {
          role.rc.state = actionIndex;
          role.rc.todo = actionInstance;
          role.rc.todo.status = 'pending';
          role.rc.status = 'pending';
        }
      }
    }
  }
}
```

2. **RoleThinker不再修改状态**：
```typescript
// RoleThinker.thinkByOrder() - 只读取，不修改
private thinkByOrder(): boolean {
  // 如果已经有todo（由执行器从数据库同步），直接使用
  if (this.rc.todo !== null) {
    return true;
  }
  
  // 没有todo，返回false，执行器会处理
  return false;
}

// 注意：移除了所有设置rc.todo和rc.state的逻辑
// - 移除了continueSequence()中的状态设置
// - 移除了startNewSequence()中的状态设置
// - 移除了handleNoRelevantMessages()中的状态设置
```

3. **RoleActionExecutor不再修改状态**：
```typescript
// RoleActionExecutor.handleSequenceContinuation() - 不修改rc.todo和rc.state
private handleSequenceContinuation(): void {
  // 不修改rc.todo或rc.state
  // 执行器会在下次调用think()前从数据库同步
  
  // 只清理news（不影响状态管理）
  if (!hasMoreActions) {
    this.rc.news = [];
  }
}
```

4. **重置时不修改内存状态**：
```typescript
// resetWorkflowFromRole() - 只更新数据库，不修改内存状态
async resetWorkflowFromRole(role: string): Promise<void> {
  // 1. 重置数据库状态
  await this.repository.resetWorkflowFromRole(this.projectId, role);
  
  // 2. 重置action内存状态（匹配数据库）
  for (const action of roleInstance.actions) {
    if (action.status && action.status !== ActionStatus.PENDING) {
      action.status = ActionStatus.PENDING;
    }
  }
  
  // 3. 不修改rc.todo和rc.state - 执行器会从数据库同步
  // 设置运行状态到重置角色的第一个action（数据库）
  await this.setRunningState(role, firstAction);
}
```

**一致性检查**：
```typescript
// 检查RoleContext状态一致性
async checkRoleContextConsistency(projectId: string) {
  // 1. 从数据库获取运行状态
  const runningState = await repository.getRunningState(projectId);
  
  // 2. 检查RoleContext状态
  if (runningState?.current_role) {
    const roleInstance = getRoleInstance(runningState.current_role);
    if (roleInstance && roleInstance.rc) {
      // 如果数据库有运行状态但RoleContext状态不一致，修复RoleContext
      if (runningState.current_action) {
        if (roleInstance.rc.status !== RoleStatus.ACTING) {
          logger.warn(`RoleContext status inconsistency: ${runningState.current_role}, expected ACTING`);
          roleInstance.rc.status = RoleStatus.ACTING;
        }
      } else {
        if (roleInstance.rc.status !== RoleStatus.IDLE) {
          logger.warn(`RoleContext status inconsistency: ${runningState.current_role}, expected IDLE`);
          roleInstance.rc.status = RoleStatus.IDLE;
        }
      }
    }
  }
}
```

#### 8.4.5 确认状态一致性保证

**确认状态与角色状态同步**：
- **规则**: `confirmation_role` 必须对应一个已完成**最后一个action**的角色
- **实现**: 
  - `RoleProcessor.handleActionExecutionResult()` 中检查当前action是否为角色的最后一个action（通过`isLastActionForRole()`方法，基于`action_order`字段判断）
  - 只有最后一个action完成时才调用`setConfirmationRequired()`
  - 非最后一个action完成时，继续执行下一个action，不弹出确认框

**数据库确认状态（权威数据源）**：
- 存储在`interactive_session_running_state`表
- 字段：`requires_confirmation`（BOOLEAN）、`confirmation_role`（VARCHAR）
- 每个项目只有一条记录

**确认状态同步机制**：
```typescript
// 设置确认状态（幂等性保证）
async setConfirmationRequired(role: string) {
  // 1. 检查当前确认状态
  const currentStatus = await this.repository.getConfirmationStatus(this.projectId);
  
  // 2. 如果已经是相同角色的确认状态，则跳过（幂等性）
  if (currentStatus.required && currentStatus.role === role) {
    logger.info(`Confirmation already set for role ${role}, skipping`);
    return;
  }
  
  // 3. 验证：确认角色必须已完成最后一个action
  const isLastAction = await this.repository.isLastActionForRole(
    this.projectId, role, getLastCompletedAction(role)
  );
  if (!isLastAction) {
    throw new Error(`Cannot set confirmation for role ${role}: not the last action`);
  }
  
  // 4. 更新数据库确认状态
  await this.repository.setConfirmationRequired(this.projectId, role);
}

// 清除确认状态
async clearConfirmationRequired() {
  // 1. 更新数据库确认状态
  await this.repository.clearConfirmationRequired(this.projectId);
  
  // 2. 确保状态已清除
  const status = await this.repository.getConfirmationStatus(this.projectId);
  if (status.required) {
    throw new Error('Failed to clear confirmation status');
  }
}
```

**确认状态一致性检查**：
```typescript
// 检查确认状态一致性
async checkConfirmationStateConsistency(projectId: string) {
  // 1. 从数据库获取确认状态
  const confirmationStatus = await repository.getConfirmationStatus(projectId);
  
  // 2. 如果确认状态存在，验证对应的角色是否已完成最后一个action
  if (confirmationStatus.required && confirmationStatus.role) {
    const role = confirmationStatus.role;
    const lastAction = await repository.getLastActionForRole(projectId, role);
    const lastActionStatus = await repository.getActionStatus(
      projectId, role, lastAction
    );
    
    // 3. 如果最后一个action不是COMPLETED，清除确认状态
    if (lastActionStatus !== 'completed') {
      logger.warn(`Confirmation state inconsistency: role ${role} last action is not completed`);
      await repository.clearConfirmationRequired(projectId);
    }
    
    // 4. 检查是否有其他pending的action（不应该有确认状态）
    const hasPendingActions = await repository.hasPendingActions(projectId, role);
    if (hasPendingActions) {
      logger.warn(`Confirmation state inconsistency: role ${role} has pending actions`);
      await repository.clearConfirmationRequired(projectId);
    }
  }
  
  // 5. 如果所有items已完成，清除确认状态
  const allItemsCompleted = await repository.areAllItemsCompleted(projectId);
  if (allItemsCompleted && confirmationStatus.required) {
    logger.info('All items completed, clearing confirmation status');
    await repository.clearConfirmationRequired(projectId);
  }
}
```

#### 8.4.6 防止确认弹出框重复弹出

> **注意**：详细的防止确认弹出框重复弹出机制请参考[11.4.2 防止确认弹出框重复弹出](#1142-防止确认弹出框重复弹出)章节。

**核心机制**：
1. **后端幂等性检查**：`setConfirmationRequired()`方法在设置前检查当前状态，避免重复设置
2. **数据库唯一性保证**：`UNIQUE(project_id)`约束确保每个项目只有一条记录
3. **前端防重复显示**：维护`lastConfirmationRole`变量，记录上次显示的确认角色
4. **及时清除状态**：用户确认操作后立即清除确认状态

#### 8.4.7 Running接口数据一致性保证

> **注意**：Running接口的详细数据一致性保证说明请参考[11.4.1 Running接口数据一致性](#1141-running接口数据一致性)章节。

**核心原则**：
- 数据库是单一数据源（Single Source of Truth）
- 所有状态字段必须与数据库保持一致
- 消息队列仅作为辅助数据源，必须与数据库角色匹配

**数据结构**：
```typescript
interface RunningResponse {
  success: boolean;
  running: {
    role: string | null;      // 当前运行的角色（来自数据库 current_role）
    action: string | null;    // 当前运行的action（来自数据库 current_action）
  };
  items: Array<{              // 所有workflow items（来自数据库 status）
    role: string;
    action: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
  }>;
  requiresConfirmation: boolean;  // 是否需要确认（来自数据库 requires_confirmation）
  confirmationRequired: {         // 确认详情（null如果不需要确认）
    role: string;                 // 等待确认的角色（必须与数据库 confirmation_role 一致）
    action: string;               // 最后一个完成的action
    content: string | null;        // 确认内容（来自消息队列）
    outputFiles: Array<any>;       // 输出文件列表（来自消息队列）
    instructContent: any;          // 指令内容（来自消息队列）
  } | null;
}
```

**关键保证**：
- ✅ `confirmationRequired.role`始终与数据库`confirmation_role`一致
- ✅ `requiresConfirmation`始终与数据库`requires_confirmation`一致
- ✅ `items`状态始终与数据库`status`一致
- ✅ `running`状态始终与数据库`current_role`和`current_action`一致

#### 8.4.8 状态一致性检查与恢复机制

**定期一致性检查**：
```typescript
// 定期检查所有状态一致性
async checkAllStateConsistency(projectId: string) {
  const issues: string[] = [];
  
  // 1. 检查Action状态一致性
  try {
    await this.checkActionStateConsistency(projectId);
  } catch (error: any) {
    issues.push(`Action state consistency check failed: ${error.message}`);
  }
  
  // 2. 检查运行状态一致性
  try {
    await this.checkRunningStateConsistency(projectId);
  } catch (error: any) {
    issues.push(`Running state consistency check failed: ${error.message}`);
  }
  
  // 3. 检查RoleContext状态一致性
  try {
    await this.checkRoleContextConsistency(projectId);
  } catch (error: any) {
    issues.push(`RoleContext state consistency check failed: ${error.message}`);
  }
  
  // 4. 检查确认状态一致性
  try {
    await this.checkConfirmationStateConsistency(projectId);
  } catch (error: any) {
    issues.push(`Confirmation state consistency check failed: ${error.message}`);
  }
  
  // 5. 记录检查结果
  if (issues.length > 0) {
    logger.warn('State consistency check found issues', { projectId, issues });
  } else {
    logger.info('State consistency check passed', { projectId });
  }
  
  return issues;
}
```

**自动恢复机制**：
```typescript
// 自动修复状态不一致
async autoFixStateInconsistency(projectId: string) {
  // 1. 检查并修复Action状态不一致
  const dbItems = await repository.getWorkflowItems(projectId);
  for (const dbItem of dbItems) {
    const roleInstance = getRoleInstance(dbItem.role);
    if (roleInstance) {
      const actionInstance = roleInstance.actions.find(a => a.name === dbItem.action);
      if (actionInstance && actionInstance.status !== dbItem.status) {
        logger.info(`Auto-fixing action state: ${dbItem.role}-${dbItem.action}, ${actionInstance.status} → ${dbItem.status}`);
        actionInstance.status = dbItem.status; // 以数据库为准
      }
    }
  }
  
  // 2. 检查并修复运行状态不一致
  const runningState = await repository.getRunningState(projectId);
  const runningActions = await repository.getRunningActions(projectId);
  
  if (runningState?.current_action && runningActions.length === 0) {
    logger.info('Auto-fixing running state: clearing action');
    await repository.updateRunningState(projectId, runningState.current_role, null);
  }
  
  if (runningActions.length > 0) {
    const runningAction = runningActions[0];
    if (runningState?.current_role !== runningAction.role ||
        runningState?.current_action !== runningAction.action) {
      logger.info(`Auto-fixing running state: ${runningState?.current_role}-${runningState?.current_action} → ${runningAction.role}-${runningAction.action}`);
      await repository.updateRunningState(projectId, runningAction.role, runningAction.action);
    }
  }
  
  // 3. 检查并修复确认状态不一致
  await checkConfirmationStateConsistency(projectId);
  
  // 4. 检查并修复RoleContext状态不一致
  await checkRoleContextConsistency(projectId);
}
```

**状态一致性保证总结**：

| 状态类型 | 数据库字段 | 内存字段 | 同步时机 | 一致性保证 |
|---------|----------|---------|---------|-----------|
| **Action状态** | `interactive_session_workflows.status` | `Role.actions[].status` | 状态更新时 | ✅ 数据库为权威，内存同步 |
| **运行状态** | `interactive_session_running_state.current_role/action` | 无（只从数据库读取） | 状态更新时 | ✅ 只从数据库读取，无内存缓存 |
| **确认状态** | `interactive_session_running_state.requires_confirmation/confirmation_role` | 无（只从数据库读取） | 状态更新时 | ✅ 只从数据库读取，幂等性保证 |
| **RoleContext状态** | 无（运行时状态） | `RoleContext.status/state/todo` | 状态更新时 | ✅ 与数据库Action状态同步 |

**关键保证**：
- ✅ 所有状态以数据库为准（单一数据源）
- ✅ 状态更新时数据库和内存同时更新
- ✅ 状态查询时优先使用数据库状态
- ✅ 定期检查状态一致性，自动修复不一致状态
- ✅ 所有状态转换操作都是原子的
- ✅ 防止重复设置和重复显示

### 8.5 状态查询优先级

#### 8.5.1 运行状态查询
```
1. 数据库 running_state 表 (单一数据源)
2. 不使用内存缓存
3. 每次查询都从数据库读取
```

#### 8.5.2 Action 状态查询
```
1. 数据库 workflows 表 (单一数据源)
2. 按 role_order 和 action_order 字段排序（通过数据库字段保证顺序）
3. 状态优先级: RUNNING > COMPLETED > FAILED > PENDING
```

### 8.6 状态更新时机

| 操作 | 更新时机 | 说明 |
|------|---------|------|
| `onRoleStart()` | Action 开始执行前 | 确保状态先于执行更新 |
| `onRoleComplete()` | Action 执行完成后 | 确保执行成功后再更新 |
| `onRoleError()` | Action 执行失败时 | 立即更新失败状态 |
| `setRunningState()` | 角色切换时 | 在 `processRole()` 前设置 |
| `clearState()` | 角色完成或切换时 | 在切换到下一个角色前清除 |
| `setConfirmationRequired()` | 最后一个action完成时 | 只有当前角色的最后一个action（`action_order`最大）完成时才调用 |

---

## 八、工作流执行流程

### 8.1 流程设计原则

#### 9.1.1 流程清晰性
- **单一入口**：每个流程都有明确的入口点
- **状态明确**：每个步骤的状态都是明确的
- **路径清晰**：流程路径清晰，易于理解和追踪

#### 9.1.2 流程可控性
- **可中断**：流程可以在任何阶段被中断和重置
- **可恢复**：流程可以从任意状态恢复执行
- **可追溯**：所有流程步骤都有日志记录

#### 9.1.3 流程一致性
- **状态一致**：流程中的状态转换保持一致
- **顺序一致**：严格按照定义的顺序执行
- **结果一致**：相同输入产生相同结果

### 9.2 核心流程图

#### 9.2.1 工作流初始化流程

```
开始
  ↓
创建项目
  ↓
initializeWorkflow(projectId, roles)
  ↓
检查是否已初始化
  ├─ 是 → 返回
  └─ 否 → 继续
  ↓
遍历roles数组
  ↓
对每个role:
  ├─ 遍历actions数组
  ├─ 创建workflow记录
  ├─ 设置role_order = roleIndex
  ├─ 设置action_order = actionIndex
  └─ 设置status = PENDING
  ↓
初始化运行状态
  ├─ current_role = NULL
  ├─ current_action = NULL
  └─ requires_confirmation = FALSE
  ↓
完成
```

#### 9.2.2 Action执行流程

```
开始
  ↓
检查是否有pending的action
  ├─ 否 → 等待/结束
  └─ 是 → 继续
  ↓
获取下一个pending的action（按role_order, action_order排序）
  ↓
设置运行状态
  ├─ setRunningState(role, null)  // ROLE_ONLY
  └─ onRoleStart(role, action)     // ROLE_ACTION
  ↓
清除所有RUNNING状态（确保唯一性）
  ↓
更新action状态: PENDING → RUNNING
  ↓
执行action
  ├─ 成功 → onRoleComplete()
  │   ├─ 更新状态: RUNNING → COMPLETED
  │   ├─ 更新运行状态: ROLE_ACTION → ROLE_ONLY
  │   └─ 检查是否为最后一个action
  │       ├─ 是 → setConfirmationRequired()
  │       └─ 否 → 继续执行下一个action
  └─ 失败 → onRoleError()
      ├─ 更新状态: RUNNING → FAILED
      └─ 清除运行状态: ROLE_ACTION → NULL
  ↓
完成
```

#### 9.2.3 确认流程

```
Action完成
  ↓
检查是否为最后一个action (isLastActionForRole())
  ├─ 否 → 继续执行下一个action（不弹出确认框）
  └─ 是 → 继续
  ↓
setConfirmationRequired(role)
  ├─ requires_confirmation = TRUE
  └─ confirmation_role = role
  ↓
前端轮询检测到确认状态
  ↓
显示确认对话框
  ↓
用户选择操作
  ├─ continue → 清除确认，切换到下一个角色
  ├─ edit → 处理编辑，清除确认，继续
  ├─ regenerate → 重置当前角色及下游角色
  └─ skip → 跳过当前角色
  ↓
clearConfirmationRequired()
  ├─ requires_confirmation = FALSE
  └─ confirmation_role = NULL
  ↓
完成
```

#### 9.2.4 角色切换流程

```
当前角色所有actions完成
  ↓
setConfirmationRequired(role)
  ↓
用户确认 (continue)
  ↓
clearConfirmationRequired()
  ↓
tryMoveToNextRole()
  ├─ clearState()  // 清除当前运行状态
  └─ findNextIncompleteRole()  // 查找下一个未完成的角色
  ↓
找到下一个角色
  ├─ 有 → setRunningState(nextRole, null)
  └─ 无 → 工作流完成
  ↓
继续执行下一个角色
```

#### 9.2.5 重置流程

```
用户触发重置 (resetWorkflowFromRole)
  ↓
Step 1: 停止正在执行的操作
  ├─ workflowCancellationManager.cancelProject()
  ├─ 触发 AbortController.abort()
  ├─ 停止所有RUNNING的action
  ├─ 停止所有大模型调用
  ├─ 停止所有异步操作
  └─ 清理LLM资源
  ↓
Step 2: 重置数据库状态
  ├─ 查询目标角色的role_order
  ├─ 重置所有下游角色的actions: status → PENDING
  └─ 清除所有RUNNING状态
  ↓
Step 3: 清空Message.content
  ├─ 获取当前角色及所有下游角色列表
  ├─ 清空数据库中这些角色的Message.content
  └─ 确保重置后不会使用旧的消息内容
  ↓
Step 4: 重置内存状态
  ├─ 重置RoleContext状态
  └─ 重置action内存状态
  ↓
Step 5: 回退到第一个action
  ├─ 获取重置角色的第一个action (action_order最小)
  └─ setRunningState(role, firstAction)
  ↓
Step 6: 清除确认状态
  ├─ requires_confirmation = FALSE
  └─ confirmation_role = NULL
  ↓
Step 7: 清除取消标志
  └─ workflowCancellationManager.clearCancellation()
  ↓
工作流执行器检测到状态变化
  ↓
从第一个action开始重新执行
```

### 9.3 时序图

#### 9.3.1 Action执行时序图

```
前端              InteractiveController    WorkflowTracker    Repository        数据库
 │                        │                    │                │                │
 │  GET /running          │                    │                │                │
 ├───────────────────────>│                    │                │                │
 │                        │  getRunningState()  │                │                │
 │                        ├───────────────────>│                │                │
 │                        │                    │  query()       │                │
 │                        │                    ├───────────────>│                │
 │                        │                    │                │  SELECT       │
 │                        │                    │                ├───────────────>│
 │                        │                    │                │<───────────────┤
 │                        │                    │<───────────────┤                │
 │                        │<───────────────────┤                │                │
 │<───────────────────────┤                    │                │                │
 │                        │                    │                │                │
 │  Action执行开始        │                    │                │                │
 │                        │  onRoleStart()      │                │                │
 │                        ├───────────────────>│                │                │
 │                        │                    │  updateStatus()│                │
 │                        │                    ├───────────────>│                │
 │                        │                    │                │  UPDATE        │
 │                        │                    │                ├───────────────>│
 │                        │                    │                │<───────────────┤
 │                        │                    │<───────────────┤                │
 │                        │<───────────────────┤                │                │
 │                        │                    │                │                │
 │  Action执行完成        │                    │                │                │
 │                        │  onRoleComplete()   │                │                │
 │                        ├───────────────────>│                │                │
 │                        │                    │  updateStatus()│                │
 │                        │                    ├───────────────>│                │
 │                        │                    │                │  UPDATE        │
 │                        │                    │                ├───────────────>│
 │                        │                    │                │<───────────────┤
 │                        │                    │<───────────────┤                │
 │                        │<───────────────────┤                │                │
```

#### 9.3.2 确认流程时序图

```
前端              InteractiveController    WorkflowTracker    Repository        数据库
 │                        │                    │                │                │
 │  Action完成            │                    │                │                │
 │                        │  onRoleComplete()   │                │                │
 │                        ├───────────────────>│                │                │
 │                        │                    │  isLastAction() │                │
 │                        │                    ├───────────────>│                │
 │                        │                    │                │  SELECT       │
 │                        │                    │                ├───────────────>│
 │                        │                    │                │<───────────────┤
 │                        │                    │<───────────────┤                │
 │                        │                    │  setConfirmation()│              │
 │                        │                    ├───────────────>│                │
 │                        │                    │                │  UPDATE       │
 │                        │                    │                ├───────────────>│
 │                        │                    │                │<───────────────┤
 │                        │<───────────────────┤                │                │
 │                        │                    │                │                │
 │  GET /running          │                    │                │                │
 ├───────────────────────>│                    │                │                │
 │                        │  getRunningState()  │                │                │
 │                        ├───────────────────>│                │                │
 │                        │                    │  query()       │                │
 │                        │                    ├───────────────>│                │
 │                        │                    │                │  SELECT       │
 │                        │                    │                ├───────────────>│
 │                        │                    │                │<───────────────┤
 │                        │                    │<───────────────┤                │
 │                        │<───────────────────┤                │                │
 │<───────────────────────┤                    │                │                │
 │  显示确认对话框        │                    │                │                │
 │                        │                    │                │                │
 │  POST /confirm         │                    │                │                │
 ├───────────────────────>│                    │                │                │
 │                        │  handleConfirm()    │                │                │
 │                        ├───────────────────>│                │                │
 │                        │                    │  clearConfirmation()│            │
 │                        │                    ├───────────────>│                │
 │                        │                    │                │  UPDATE       │
 │                        │                    │                ├───────────────>│
 │                        │                    │                │<───────────────┤
 │                        │                    │<───────────────┤                │
 │                        │<───────────────────┤                │                │
 │<───────────────────────┤                    │                │                │
```

### 9.4 异常流程

#### 9.4.1 错误处理流程

```
Action执行中
  ↓
发生错误
  ↓
捕获异常
  ├─ AbortError (取消) → 返回null，不标记为失败
  └─ 其他错误 → 继续
  ↓
onRoleError(role, action, error)
  ├─ 更新状态: RUNNING → FAILED
  ├─ 清除运行状态
  └─ 记录错误日志
  ↓
工作流暂停或继续（取决于错误类型）
```

#### 9.4.2 状态不一致恢复流程

```
检测到状态不一致
  ↓
记录警告日志
  ↓
自动修复
  ├─ 运行状态有action但数据库中没有RUNNING的action
  │   └─ clearState()  // 清除运行状态
  └─ 其他不一致情况
      └─ 根据具体情况修复
  ↓
记录修复日志
  ↓
通知管理员（可选）
```

### 9.3 顺序执行规则

#### 9.3.1 执行顺序保证

**核心原则**：
- **一定要确保角色和action的顺序是正确的**：顺序错误会导致工作流执行混乱，必须严格保证顺序的正确性
- **所有的状态、角色和action的顺序都通过数据库中获取，不允许直接从内存中获取**：
  - 角色顺序必须从数据库`role_order`字段获取，按`role_order ASC`排序
  - Action顺序必须从数据库`action_order`字段获取，按`action_order ASC`排序
  - 状态查询必须从数据库读取，按`role_order ASC, action_order ASC`排序
  - 禁止使用内存中的角色数组或action数组来确定顺序
  - 禁止使用代码中硬编码的顺序来确定执行顺序

**执行顺序规则**：
- **角色顺序**：严格按照`role_order`字段的顺序执行角色（从小到大），必须从数据库查询获取
- **Action顺序**：在每个角色内，严格按照`action_order`字段的顺序执行action（从小到大），必须从数据库查询获取
- **顺序字段**：`role_order`和`action_order`在`initializeWorkflow()`时设置，保证执行顺序的一致性
- **查询顺序**：所有查询都按`role_order ASC, action_order ASC`排序，必须从数据库查询，不允许从内存获取

#### 9.3.2 确认时机控制
- **检查方法**：使用`isLastActionForRole(projectId, role, action)`检查当前action是否为角色的最后一个action
- **判断逻辑**：比较当前action的`action_order`与角色的最大`action_order`
- **确认触发**：
  - ✅ **最后一个action完成**：弹出确认框等待用户确认
  - ❌ **非最后action完成**：自动继续执行下一个action，不弹出确认框

### 9.4 完整工作流状态流转

**核心规则**：
1. **顺序执行**：严格按照 `role_order` 和 `action_order` 字段的顺序执行角色和action
2. **确认时机**：只有当前角色的**最后一个action**（`action_order`最大）执行完成后，才弹出确认框等待用户确认
3. **非最后action**：如果当前action不是角色的最后一个action，执行完成后自动继续执行下一个action，不弹出确认框

```
项目创建
  ↓
initializeWorkflow()
  → 所有 actions = PENDING
  → 设置 role_order 和 action_order（保证执行顺序）
  → 运行状态 = NULL
  ↓
executeWorkflowLoop() 开始
  ↓
setRunningState('Salesperson', null)
  → 运行状态: NULL → ROLE_ONLY
  ↓
processRole('Salesperson')
  ↓
onRoleStart('Salesperson', 'WriteMRD')  // action_order = 0 (第一个action)
  → 清除所有 RUNNING 状态
  → 'WriteMRD' = RUNNING
  → 运行状态: ROLE_ONLY → ROLE_ACTION
  ↓
action 执行中...
  ↓
onRoleComplete('Salesperson', 'WriteMRD')
  → 'WriteMRD' = COMPLETED
  → 运行状态: ROLE_ACTION → ROLE_ONLY
  ↓
检查：WriteMRD 是否为最后一个action？
  → 否（action_order = 0，不是最大action_order）
  → 继续执行下一个action（不弹出确认框）
  ↓
onRoleStart('Salesperson', 'MRDReview')  // action_order = 1 (第二个action)
  → 'MRDReview' = RUNNING
  → 运行状态: ROLE_ONLY → ROLE_ACTION
  ↓
action 执行中...
  ↓
onRoleComplete('Salesperson', 'MRDReview')
  → 'MRDReview' = COMPLETED
  → 运行状态: ROLE_ACTION → ROLE_ONLY
  ↓
检查：MRDReview 是否为最后一个action？
  → 是（action_order = 1，是最大action_order）
  → 弹出确认框等待用户确认
  ↓
setConfirmationRequired('Salesperson')
  → requires_confirmation = TRUE
  → confirmation_role = 'Salesperson'
  ↓
[等待用户确认]
  ↓
用户确认 (continue/edit/regenerate/skip)
  ↓
clearConfirmation()
  → requires_confirmation = FALSE
  ↓
switchToNextRole('ProductManager')
  → 运行状态: ROLE_ONLY → NULL
  → 运行状态: NULL → ROLE_ONLY (ProductManager)
  ↓
继续执行下一个角色（按role_order顺序）...
```

### 9.5 执行流程示例

**场景**：Salesperson角色有3个actions（action_order: 0, 1, 2）

```
1. 执行第一个action（action_order = 0）
   → onRoleStart('Salesperson', 'WriteMRD')
   → 'WriteMRD' = RUNNING
   → 执行完成
   → onRoleComplete('Salesperson', 'WriteMRD')
   → 'WriteMRD' = COMPLETED
   → 检查：isLastActionForRole() → false（action_order = 0，不是最大）
   → 继续执行下一个action（不弹出确认框）

2. 执行第二个action（action_order = 1）
   → onRoleStart('Salesperson', 'MRDReview')
   → 'MRDReview' = RUNNING
   → 执行完成
   → onRoleComplete('Salesperson', 'MRDReview')
   → 'MRDReview' = COMPLETED
   → 检查：isLastActionForRole() → false（action_order = 1，不是最大）
   → 继续执行下一个action（不弹出确认框）

3. 执行第三个action（action_order = 2，最后一个）
   → onRoleStart('Salesperson', 'FinalReview')
   → 'FinalReview' = RUNNING
   → 执行完成
   → onRoleComplete('Salesperson', 'FinalReview')
   → 'FinalReview' = COMPLETED
   → 检查：isLastActionForRole() → true（action_order = 2，是最大）
   → 弹出确认框等待用户确认
   → setConfirmationRequired('Salesperson')
```

### 9.6 错误处理流程

```
action 执行中...
  ↓
发生错误
  ↓
onRoleError(role, action, error)
  → action 状态: RUNNING → FAILED
  → 运行状态: ROLE_ACTION → NULL
  ↓
[记录错误日志]
  ↓
工作流暂停或继续（取决于错误类型）
```

---

## 九、重置流程详解

### 9.1 重置概述

#### 10.1.1 重置范围
- **基于role_order**：重置操作基于`role_order`字段确定下游角色
- **包含当前角色**：重置指定角色及其所有下游角色（`role_order >= targetRoleOrder`）
- **自动识别**：无需手动指定下游角色，系统自动识别

#### 10.1.2 重置目标
1. **停止正在执行的操作**：停止所有正在执行的action、大模型调用和异步操作
2. **重置数据库状态**：将所有相关actions的状态重置为`PENDING`（除了重置角色的第一个action设置为`RUNNING`）
3. **清空Message.content**：清空数据库中所有Message.content字段中涉及到当前角色和下游所有角色的信息，确保重置后不会使用旧的消息内容
4. **重置内存状态**：重置RoleContext和action的内存状态为`PENDING`（重置角色的第一个action为`RUNNING`）
5. **中断并清空StepwiseDocumentGenerator**：中断所有正在执行的StepwiseDocumentGenerator，清空其状态和临时信息
6. **回退到第一个action并设置为RUNNING**：重置后回退到重置角色的第一个action（`action_order`最小），并将其状态设置为`RUNNING`
7. **清除确认状态**：清除所有确认相关的状态
8. **顺序保证**：重置后仍然保持"按角色和action顺序执行，只有最后一个action完成后弹出确认框"的规则

### 10.2 重置步骤详解

#### Step 1: 停止正在执行的操作

这一步需要彻底停止所有正在执行的操作，包括：

1. **停止正在执行的action**：通过`AbortController`取消所有正在运行的操作
2. **停止正在执行的大模型调用**：中断所有正在进行的LLM API请求（通过`abortSignal`检查）
3. **停止异步操作**：取消所有异步任务和轮询操作（如`CursorLLM.waitForAgentCompletion`）
4. **清理外部资源**：清理Cursor Agent等外部资源（调用`llm.cleanup()`）

```typescript
// 1.1 取消所有正在运行的操作
workflowCancellationManager.cancelProject(projectId);
// 这会触发 AbortController.abort()，设置 abortSignal.aborted = true
// 所有使用该 signal 的操作都会检测到取消状态

// 1.2 停止正在执行的大模型调用
// BaseAction.aask() 方法会检查 abortSignal.aborted
if (this.abortSignal?.aborted) {
  throw new Error('Action was cancelled');
}
// RoleActionExecutor.act() 会捕获 AbortError，返回 null
// 这样正在执行的 LLM 调用会被中断

// 1.3 停止正在执行的异步操作
// - 所有使用 abortSignal 的操作都会检查取消状态
// - 正在执行的 HTTP 请求会被中断（如果支持 AbortSignal）
// - 正在轮询的操作（如 CursorLLM.waitForAgentCompletion）会检测取消状态

// 1.4 清理 Cursor Agent（如果有）
const roles = team.getEnvironment().getRoles();
for (const roleInstance of roles) {
  if (roleInstance.llm && typeof roleInstance.llm.cleanup === 'function') {
    try {
      await roleInstance.llm.cleanup();
      logger.info(`Cleaned up LLM resources for role ${roleInstance.profile}`);
    } catch (error: any) {
      logger.warn(`Failed to cleanup LLM for role ${roleInstance.profile}`, {
        error: error.message,
      });
    }
  }
}
```

#### Step 2: 重置数据库状态

```typescript
// 查询目标角色的role_order
const roleOrderResult = await query(
  `SELECT DISTINCT role_order 
   FROM interactive_session_workflows 
   WHERE project_id = $1 AND role = $2 
   LIMIT 1`,
  [projectId, role]
);
const targetRoleOrder = roleOrderResult.rows[0].role_order;

// 重置所有下游角色的actions状态为PENDING（包括COMPLETED、FAILED、RUNNING）
UPDATE interactive_session_workflows 
SET status = 'pending', updated_at = NOW()
WHERE project_id = projectId 
  AND role_order IS NOT NULL 
  AND role_order >= targetRoleOrder;

// 清除所有RUNNING状态，确保干净的重置
UPDATE interactive_session_workflows 
SET status = 'pending'
WHERE project_id = projectId AND status = 'running';
```

#### Step 3: 清空Message.content中涉及当前角色和下游角色的信息

重置时需要清空数据库中所有Message.content字段中涉及到当前角色和下游所有角色的信息，确保重置后不会使用旧的消息内容。

```typescript
// 获取目标角色及其所有下游角色的列表
const targetRoleOrder = roleOrderResult.rows[0].role_order;
const downstreamRolesResult = await query(
  `SELECT DISTINCT role 
   FROM interactive_session_workflows 
   WHERE project_id = $1 
     AND role_order IS NOT NULL 
     AND role_order >= $2`,
  [projectId, targetRoleOrder]
);
const downstreamRoles = downstreamRolesResult.rows.map(row => row.role);

// 清空Message.content中涉及这些角色的信息
// 方法1: 删除这些角色相关的消息（推荐）
await query(
  `DELETE FROM messages 
   WHERE project_id = $1 
     AND role_type = ANY($2)`,
  [projectId, downstreamRoles]
);

// 方法2: 或者清空content字段（如果希望保留消息记录）
// await query(
//   `UPDATE messages 
//    SET content = '', 
//        instruct_content = NULL,
//        updated_at = NOW()
//    WHERE project_id = $1 
//      AND role_type = ANY($2)`,
//   [projectId, downstreamRoles]
// );
```

**重要说明**：
- **清空范围**：需要清空当前重置角色及其所有下游角色（基于`role_order`字段确定）的所有消息内容
- **清空内容**：`Message.content`字段必须清空，确保重置后不会使用旧的消息内容影响后续执行
- **清空时机**：在重置数据库状态之后、重置内存状态之前执行
- **清空方式**：可以选择删除消息记录或清空content字段，根据业务需求决定

#### Step 4: 重置action内存状态（匹配数据库）

```typescript
// 获取下游角色列表
const downstreamRoles = await getDownstreamRoles(projectId, role);

// 重置每个下游角色的action内存状态（匹配数据库）
for (const roleName of downstreamRoles) {
  const role = roles.find(r => r.profile === roleName);
  if (role && role.rc) {
    // 重置所有action的内存状态为PENDING（匹配数据库）
    for (const action of role.actions) {
      if (action.status && action.status !== ActionStatus.PENDING) {
        action.status = ActionStatus.PENDING;
      }
    }
    
    // 注意：不修改rc.todo和rc.state
    // 执行器会在下次处理角色时从数据库同步状态
  }
}
```

#### Step 5: 中断并清空StepwiseDocumentGenerator

```typescript
// 获取下游角色列表
const downstreamRoles = await getDownstreamRoles(projectId, role);

// 中断并清空所有使用StepwiseDocumentGenerator的action
for (const roleName of downstreamRoles) {
  const roleInstance = roles.find(r => r.profile === roleName);
  if (roleInstance) {
    // 遍历所有actions，查找使用StepwiseDocumentGenerator的action
    for (const action of roleInstance.actions) {
      // 如果action正在执行（RUNNING状态），需要中断
      if (action.status === ActionStatus.RUNNING) {
        // 1. 通过AbortSignal中断正在执行的逻辑
        // （AbortSignal已在Step 1中通过WorkflowCancellationManager设置）
        
        // 2. 如果action使用了StepwiseDocumentGenerator，调用reset方法
        if (action.documentGenerator && typeof action.documentGenerator.reset === 'function') {
          await action.documentGenerator.reset();
          // reset方法内部会：
          // - 通过StateManager重置所有步骤状态
          // - 清空生成状态（isGenerating = false）
          // - 清理临时文件（可选）
        }
        
        // 3. 清空StepwiseDocumentGenerator的引用
        action.documentGenerator = undefined;
      }
    }
  }
}
```

#### Step 6: 回退到重置角色的第一个action并设置为RUNNING

```typescript
// 获取重置角色的第一个action（action_order最小）
const firstActionResult = await query(
  `SELECT action 
   FROM interactive_session_workflows 
   WHERE project_id = $1 AND role = $2 
     AND action IS NOT NULL
   ORDER BY COALESCE(action_order, 999) ASC
   LIMIT 1`,
  [projectId, role]
);
const firstAction = firstActionResult.rows[0]?.action;

if (firstAction) {
  // 1. 将重置角色的第一个action设置为RUNNING状态
  await query(
    `UPDATE interactive_session_workflows 
     SET status = 'running', updated_at = NOW()
     WHERE project_id = $1 AND role = $2 AND action = $3`,
    [projectId, role, firstAction]
  );
  
  // 2. 清除所有其他RUNNING状态（确保唯一性）
  await query(
    `UPDATE interactive_session_workflows 
     SET status = 'pending', updated_at = NOW()
     WHERE project_id = $1 AND status = 'running' 
       AND NOT (role = $2 AND action = $3)`,
    [projectId, role, firstAction]
  );
  
  // 3. 更新运行状态（可选，用于向后兼容，但主要状态在items中）
  UPDATE interactive_session_running_state 
  SET current_role = role,
      current_action = firstAction,
      requires_confirmation = FALSE,
      confirmation_role = NULL
  WHERE project_id = projectId;
}
```

#### Step 7: 清除确认状态

```typescript
// 清除确认状态
UPDATE interactive_session_running_state 
SET requires_confirmation = FALSE,
    confirmation_role = NULL
WHERE project_id = projectId;
```

#### Step 8: 清除取消标志

```typescript
workflowCancellationManager.clearCancellation(projectId);
// 允许后续操作继续执行
```

### 10.3 重置后的执行流程

重置完成后，工作流执行器会检测到状态变化，然后：

1. **检测RUNNING action**：发现重置角色的第一个action状态为`RUNNING`
2. **从第一个action开始执行**：从重置角色的第一个action（`action_order`最小，状态为`RUNNING`）开始执行
3. **按顺序执行**：严格按照`action_order`顺序执行，不会跳过任何action
4. **确认时机**：只有最后一个action完成后才弹出确认框

**重要说明**：
- ✅ 重置后，重置角色的第一个action状态为`RUNNING`，工作流执行器会立即检测到并开始执行
- ✅ 所有其他action状态为`PENDING`，等待顺序执行
- ✅ StepwiseDocumentGenerator已被中断并清空，不会影响后续执行

**示例**：重置Engineer角色

```
重置前状态：
- Engineer: WriteCode (action_order=0, COMPLETED)
- Engineer: WriteTests (action_order=1, RUNNING) ← 正在执行
- Engineer: CodeReview (action_order=2, PENDING)
- QAEngineer: TestExecution (action_order=0, PENDING)

重置操作：
→ resetWorkflowFromRole('Engineer')
→ 停止WriteTests的执行
→ 重置Engineer和QAEngineer的所有actions为PENDING
→ 回退到Engineer的第一个action（WriteCode）

重置后状态：
- Engineer: WriteCode (action_order=0, RUNNING) ← 第一个action设置为RUNNING
- Engineer: WriteTests (action_order=1, PENDING)
- Engineer: CodeReview (action_order=2, PENDING)
- QAEngineer: TestExecution (action_order=0, PENDING)

执行流程：
→ WriteCode状态为RUNNING，工作流执行器立即开始执行
→ WriteCode完成 → 继续WriteTests（不弹出确认框）
→ WriteTests完成 → 继续CodeReview（不弹出确认框）
→ CodeReview完成 → 弹出确认框（最后一个action）
```

### 10.4 资源清理机制

#### 10.4.1 取消机制
- `WorkflowCancellationManager`使用`AbortController`管理取消操作
- `RoleActionExecutor.act()`获取`abortSignal`并设置到action上
- `BaseAction.aask()`检查`abortSignal.aborted`，如果已取消则抛出错误
- 所有使用`abortSignal`的操作都会检测取消状态

#### 10.4.2 资源清理清单

1. **正在执行的大模型调用**
   - **机制**：通过`AbortController`和`abortSignal`实现
   - **检查点**：`BaseAction.aask()`方法中检查`abortSignal.aborted`
   - **效果**：如果已取消，立即抛出`'Action was cancelled'`错误
   - **处理**：`RoleActionExecutor.act()`捕获`AbortError`，返回`null`，不标记为失败

2. **正在执行的HTTP请求**
   - **机制**：如果HTTP客户端支持`AbortSignal`，请求会被中断
   - **检查点**：HTTP请求配置中传入`signal: abortSignal`
   - **效果**：请求被取消，不会继续等待响应

3. **正在轮询的操作**
   - **示例**：`CursorLLM.waitForAgentCompletion()`轮询agent状态
   - **机制**：在轮询循环中检查`abortSignal.aborted`
   - **效果**：如果已取消，立即退出轮询循环

4. **Cursor Agent资源**
   - **清理方法**：`CursorLLM.cleanup()`调用`cursorAgentClient.deleteAgent(agentId)`
   - **时机**：重置时遍历所有角色的LLM，调用`cleanup()`方法
   - **效果**：删除正在运行的agent，释放资源

5. **内存中的状态**
   - **RoleContext状态**：重置为`IDLE`，清除`todo`
   - **Action状态**：重置为`PENDING`
   - **运行状态**：清除`current_role`和`current_action`

6. **数据库状态**
   - **Workflow状态**：所有相关actions重置为`PENDING`
   - **Message.content**：清空当前角色及下游角色的Message.content字段
   - **运行状态**：清除运行状态和确认状态
   - **确认状态**：清除`requires_confirmation`和`confirmation_role`

**重置操作的完整性保证**：
- 重置操作必须确保所有资源都被正确清理
- 如果某个资源清理失败，记录警告日志但不中断重置流程
- 重置后创建新的`AbortController`，为后续操作提供干净的取消机制

### 10.5 基类重置支持

#### 10.5.1 BaseRole和BaseAction重置支持

**设计目标**：
- 重新设计角色和action的base类，在重置时支持可以重置之前正在运行中的流程
- 确保重置操作能够正确停止并清理正在执行的action和角色状态

**BaseAction重置支持**：

```typescript
// BaseAction 需要支持重置机制
export abstract class BaseAction {
  // ... 现有属性 ...
  
  // AbortSignal用于取消正在执行的操作
  protected abortSignal?: AbortSignal;
  
  /**
   * 设置AbortSignal，用于取消正在执行的操作
   */
  setAbortSignal(signal: AbortSignal): void {
    this.abortSignal = signal;
  }
  
  /**
   * 重置Action状态，清理正在执行的流程
   * 在重置时调用，确保正在执行的action能够被正确停止
   */
  async reset(): Promise<void> {
    // 1. 检查是否有正在执行的操作
    if (this.status === ActionStatus.RUNNING) {
      // 2. 如果有abortSignal，触发取消
      if (this.abortSignal && !this.abortSignal.aborted) {
        // 注意：abortSignal由WorkflowCancellationManager统一管理
        // 这里只做状态重置，实际的取消由AbortController触发
      }
      
      // 3. 重置状态为PENDING
      this.status = ActionStatus.PENDING;
      
      // 4. 清理action特定的资源（由子类实现）
      await this.cleanup();
    }
  }
  
  /**
   * 清理action特定的资源
   * 子类可以重写此方法来实现特定的清理逻辑
   */
  protected async cleanup(): Promise<void> {
    // 默认实现为空，子类可以重写
  }
  
  /**
   * 执行action时检查取消状态
   */
  protected checkCancellation(): void {
    if (this.abortSignal?.aborted) {
      throw new Error('Action was cancelled');
    }
  }
}
```

**BaseRole重置支持**：

```typescript
// BaseRole 需要支持重置机制
export abstract class BaseRole {
  // ... 现有属性 ...
  
  /**
   * 重置角色状态，清理正在执行的流程
   * 在重置时调用，确保正在执行的角色能够被正确停止
   */
  async reset(): Promise<void> {
    // 1. 重置所有actions的状态
    if (this.actions && Array.isArray(this.actions)) {
      for (const action of this.actions) {
        if (action.status === ActionStatus.RUNNING) {
          await action.reset();
        } else {
          // 重置非RUNNING状态的action为PENDING
          action.status = ActionStatus.PENDING;
        }
      }
    }
    
    // 2. 重置RoleContext状态（由执行器负责同步，这里只做清理）
    if (this.rc) {
      // 注意：不直接修改rc.todo和rc.state
      // 执行器会在下次处理角色时从数据库同步
      this.rc.status = RoleStatus.IDLE;
    }
    
    // 3. 清理角色特定的资源（由子类实现）
    await this.cleanup();
  }
  
  /**
   * 清理角色特定的资源
   * 子类可以重写此方法来实现特定的清理逻辑
   */
  protected async cleanup(): Promise<void> {
    // 默认实现为空，子类可以重写
    // 例如：清理LLM资源、清理临时文件等
  }
}
```

**Role重置支持（具体实现）**：

```typescript
// Role 类需要实现重置机制
export class Role extends BaseRole {
  // ... 现有属性 ...
  
  /**
   * 重置角色状态，清理正在执行的流程
   */
  async reset(): Promise<void> {
    // 1. 调用父类重置方法
    await super.reset();
    
    // 2. 清理LLM资源（如果有）
    if (this.llm && typeof this.llm.cleanup === 'function') {
      try {
        await this.llm.cleanup();
        logger.info(`Cleaned up LLM resources for role ${this.profile}`);
      } catch (error: any) {
        logger.warn(`Failed to cleanup LLM for role ${this.profile}`, {
          error: error.message,
        });
      }
    }
    
    // 3. 清理thinker和executor的状态
    if (this.thinker) {
      // 清理thinker的状态（如果需要）
    }
    if (this.actionExecutor) {
      // 清理executor的状态（如果需要）
    }
  }
}
```

**重置调用流程**：

```typescript
// WorkflowTracker.resetWorkflowFromRole() 中调用重置
async resetWorkflowFromRole(role: string): Promise<void> {
  // Step 1: 停止正在执行的操作（通过AbortController）
  workflowCancellationManager.cancelProject(this.projectId);
  
  // Step 2: 重置数据库状态
  await this.repository.resetWorkflowFromRole(this.projectId, role);
  
  // Step 3: 重置角色和action的内存状态
  const downstreamRoles = await this.repository.getDownstreamRoles(this.projectId, role);
  for (const roleName of downstreamRoles) {
    const roleInstance = roles.find(r => r.profile === roleName);
    if (roleInstance) {
      // 调用角色的reset方法
      await roleInstance.reset();
    }
  }
  
  // Step 4: 回退到第一个action（数据库操作）
  // ...
}
```

#### 10.5.2 StepwiseDocumentGenerator重置支持与状态管理

**设计目标**：
- StepwiseDocumentGenerator中也需要新增在重置时支持可以重置之前正在运行中的流程
- 确保分步骤文档生成过程中的所有步骤都能被正确停止和清理
- **通过StateManager统一管理步骤状态**，确保状态的一致性和可追溯性

**StepwiseDocumentGenerator状态管理集成**：

```typescript
export class StepwiseDocumentGenerator {
  private action: BaseAction;
  private config: StepwiseGenerationConfig;
  private stateManager: StateManager;  // ⭐ 新增：统一状态管理器
  
  // 用于跟踪当前执行步骤
  private currentStep: number = 0;
  private isGenerating: boolean = false;
  private abortSignal?: AbortSignal;
  
  // 角色和action信息（用于状态管理）
  private role: string;
  private actionName: string;
  
  constructor(action: BaseAction, config: StepwiseGenerationConfig, stateManager: StateManager) {
    this.action = action;
    this.config = config;
    this.stateManager = stateManager;  // ⭐ 注入StateManager
    this.role = action.role?.profile || 'Unknown';
    this.actionName = action.name;
  }
  
  /**
   * 设置AbortSignal，用于取消正在执行的操作
   */
  setAbortSignal(signal: AbortSignal): void {
    this.abortSignal = signal;
    // 同时设置到action上
    if (this.action && typeof this.action.setAbortSignal === 'function') {
      this.action.setAbortSignal(signal);
    }
  }
  
  /**
   * 重置生成器状态，清理正在执行的流程
   * 在重置时调用，确保正在执行的文档生成能够被正确停止
   */
  async reset(): Promise<void> {
    // 1. 检查是否有正在执行的生成流程
    if (this.isGenerating) {
      // 2. 如果有abortSignal，触发取消
      if (this.abortSignal && !this.abortSignal.aborted) {
        // 注意：abortSignal由WorkflowCancellationManager统一管理
        // 这里只做状态重置，实际的取消由AbortController触发
      }
      
      // 3. 通过StateManager重置所有步骤状态
      await this.stateManager.resetStepStates(this.role, this.actionName);
      
      // 4. 重置生成状态
      this.isGenerating = false;
      this.currentStep = 0;
      
      // 5. 清理临时文件（可选，根据需求决定是否删除已生成的文件）
      // await this.cleanupGeneratedFiles();
    }
    
    // 6. 重置action状态（通过StateManager）
    await this.stateManager.setActionStatus(this.role, this.actionName, ActionStatus.PENDING);
  }
  
  /**
   * 执行分步骤生成（增强版本，支持取消检查和状态管理）
   */
  async generate(input: string): Promise<IActionOutput> {
    this.isGenerating = true;
    this.currentStep = 0;
    
    try {
      // 通过StateManager标记action开始执行
      await this.stateManager.onActionStart(this.role, this.actionName);
      
      // Step 1: 生成目录
      this.currentStep = 1;
      this.checkCancellation();
      await this.stateManager.setStepState(this.role, this.actionName, 'outline', StepState.RUNNING);
      const outline = await this.generateOutline(input);
      await this.saveToWorkspace('00-outline.md', outline);
      await this.stateManager.setStepState(this.role, this.actionName, 'outline', StepState.COMPLETED);
      
      // Step 2: 解析章节列表
      this.currentStep = 2;
      this.checkCancellation();
      await this.stateManager.setStepState(this.role, this.actionName, 'parse-sections', StepState.RUNNING);
      const parsedSections = this.parseSections(outline);
      await this.stateManager.setStepState(this.role, this.actionName, 'parse-sections', StepState.COMPLETED);
      
      // Step 3: 按章节生成内容
      for (let i = 0; i < parsedSections.length; i++) {
        const section = parsedSections[i];
        const stepId = `section-${section.number}`;
        this.checkCancellation();
        await this.stateManager.setStepState(this.role, this.actionName, stepId, StepState.RUNNING);
        const sectionContent = await this.generateSection(input, outline, section);
        await this.saveToWorkspace(`${String(section.number).padStart(2, '0')}-section-${section.number}.md`, sectionContent);
        await this.stateManager.setStepState(this.role, this.actionName, stepId, StepState.COMPLETED);
      }
      
      // Step 4: 审核章节（如果配置）
      if (this.config.buildSectionReviewPrompt) {
        this.checkCancellation();
        await this.stateManager.setStepState(this.role, this.actionName, 'review-sections', StepState.RUNNING);
        const reviews = await this.reviewSections(sectionContents, parsedSections, outline);
        await this.stateManager.setStepState(this.role, this.actionName, 'review-sections', StepState.COMPLETED);
      }
      
      // Step 5: 合并所有章节
      this.checkCancellation();
      await this.stateManager.setStepState(this.role, this.actionName, 'merge', StepState.RUNNING);
      const mergedContent = this.mergeSections(outline, sectionContents, parsedSections);
      await this.saveToWorkspace(this.config.mainFileName, mergedContent);
      await this.stateManager.setStepState(this.role, this.actionName, 'merge', StepState.COMPLETED);
      
      // 通过StateManager标记action完成
      await this.stateManager.onActionComplete(this.role, this.actionName);
      
      return result;
    } catch (error: any) {
      // 如果是取消错误，通过StateManager标记步骤失败
      if (error.message === 'Action was cancelled' || 
          (this.abortSignal?.aborted && error.name === 'AbortError')) {
        const currentStepId = this.getCurrentStepId();
        if (currentStepId) {
          await this.stateManager.setStepState(this.role, this.actionName, currentStepId, StepState.FAILED);
        }
        await this.stateManager.onActionError(this.role, this.actionName, error);
        logger.info('StepwiseDocumentGenerator: Generation cancelled', {
          currentStep: this.currentStep,
        });
        return null;
      }
      
      // 其他错误，标记当前步骤和action失败
      const currentStepId = this.getCurrentStepId();
      if (currentStepId) {
        await this.stateManager.setStepState(this.role, this.actionName, currentStepId, StepState.FAILED);
      }
      await this.stateManager.onActionError(this.role, this.actionName, error);
      throw error;
    } finally {
      this.isGenerating = false;
      this.currentStep = 0;
    }
  }
  
  /**
   * 获取当前步骤ID
   */
  private getCurrentStepId(): string | null {
    switch (this.currentStep) {
      case 1: return 'outline';
      case 2: return 'parse-sections';
      case 3: return 'generate-sections';
      case 4: return 'review-sections';
      case 5: return 'merge';
      default: return null;
    }
  }
  
  /**
   * 检查取消状态
   */
  private checkCancellation(): void {
    if (this.abortSignal?.aborted) {
      throw new Error('Action was cancelled');
    }
  }
  
  /**
   * 清理已生成的文件（可选）
   */
  private async cleanupGeneratedFiles(): Promise<void> {
    // 根据需求决定是否删除已生成的文件
    // 如果重置后需要重新生成，可以删除临时文件
    // 如果需要保留部分结果，可以只删除未完成的文件
    try {
      const workspaceDir = this.config.workspaceDir;
      if (workspaceDir && fsSync.existsSync(workspaceDir)) {
        // 删除临时文件或未完成的文件
        // 具体实现根据需求决定
      }
    } catch (error: any) {
      logger.warn('Failed to cleanup generated files', { error: error.message });
    }
  }
}
```

**在Action中使用StepwiseDocumentGenerator时的状态管理集成**：

```typescript
// 使用StepwiseDocumentGenerator的Action需要支持重置和状态管理
export class WritePRD extends BaseAction {
  private documentGenerator?: StepwiseDocumentGenerator;
  private stateManager?: StateManager;  // ⭐ 新增：统一状态管理器
  
  /**
   * 设置StateManager（由执行器注入）
   */
  setStateManager(stateManager: StateManager): void {
    this.stateManager = stateManager;
  }
  
  /**
   * 执行action
   */
  async run(input: string): Promise<IActionOutput> {
    if (!this.stateManager) {
      throw new Error('StateManager is required for WritePRD action');
    }
    
    // 创建documentGenerator，传入StateManager
    this.documentGenerator = new StepwiseDocumentGenerator(this, config, this.stateManager);
    
    // 设置abortSignal
    if (this.abortSignal) {
      this.documentGenerator.setAbortSignal(this.abortSignal);
    }
    
    // 执行生成（内部会通过StateManager管理步骤状态）
    return await this.documentGenerator.generate(input);
  }
  
  /**
   * 重置Action状态，清理正在执行的流程
   */
  async reset(): Promise<void> {
    // 1. 调用父类重置方法
    await super.reset();
    
    // 2. 重置documentGenerator（内部会通过StateManager重置步骤状态）
    if (this.documentGenerator && typeof this.documentGenerator.reset === 'function') {
      await this.documentGenerator.reset();
    }
    
    // 3. 清理documentGenerator引用
    this.documentGenerator = undefined;
  }
  
  /**
   * 清理action特定的资源
   */
  protected async cleanup(): Promise<void> {
    // 清理documentGenerator相关的资源
    if (this.documentGenerator) {
      await this.documentGenerator.reset();
      this.documentGenerator = undefined;
    }
  }
}
```

**重置调用流程（通过StateManager）**：

```typescript
// 在重置时，通过StateManager统一管理重置操作
async resetWorkflowFromRole(role: string): Promise<void> {
  // Step 1: 停止正在执行的操作
  workflowCancellationManager.cancelProject(this.projectId);
  
  // Step 2: 通过StateManager重置工作流（统一入口）
  await this.stateManager.resetWorkflow(role);
  // 内部会：
  // - 重置数据库状态（通过Repository）
  // - 重置所有步骤状态（通过StepStateTracker）
  // - 重置action状态（通过WorkflowTracker）
  
  // Step 3: 中断并清空StepwiseDocumentGenerator
  const downstreamRoles = await this.repository.getDownstreamRoles(this.projectId, role);
  for (const roleName of downstreamRoles) {
    const roleInstance = roles.find(r => r.profile === roleName);
    if (roleInstance) {
      // 遍历所有actions，查找使用StepwiseDocumentGenerator的action
      for (const action of roleInstance.actions) {
        // 如果action正在执行（RUNNING状态），需要中断
        if (action.status === ActionStatus.RUNNING) {
          // 如果action使用了StepwiseDocumentGenerator，调用reset方法
          if (action.documentGenerator && typeof action.documentGenerator.reset === 'function') {
            await action.documentGenerator.reset();
            // reset方法内部会：
            // - 通过StateManager重置所有步骤状态
            // - 清空生成状态（isGenerating = false）
            // - 清理临时文件（可选）
          }
          // 清空StepwiseDocumentGenerator的引用
          action.documentGenerator = undefined;
        }
      }
      
      // 调用角色的reset方法，这会递归调用所有actions的reset方法
      await roleInstance.reset();
    }
  }
  
  // Step 4: 回退到第一个action并设置为RUNNING（通过StateManager）
  const firstAction = await this.repository.getFirstActionForRole(this.projectId, role);
  if (firstAction) {
    // 将第一个action设置为RUNNING状态
    await this.stateManager.setActionStatus(role, firstAction, ActionStatus.RUNNING);
    // 清除所有其他RUNNING状态（确保唯一性）
    await this.stateManager.clearAllRunningStatuses(this.projectId, role, firstAction);
  }
}
```

**关键要点**：
- ✅ **统一状态管理**：所有状态操作（包括重置）都必须通过StateManager
- ✅ BaseAction和BaseRole都需要实现`reset()`方法，支持重置正在执行的流程
- ✅ StepwiseDocumentGenerator需要实现`reset()`方法，支持重置正在执行的文档生成流程
- ✅ **StepwiseDocumentGenerator必须通过StateManager管理步骤状态**，确保状态的一致性和可追溯性
- ✅ 所有重置方法都需要检查`abortSignal`，确保能够响应取消信号
- ✅ 重置时需要清理所有相关资源，包括LLM资源、临时文件等
- ✅ 重置操作应该是幂等的，多次调用不应该产生副作用
- ✅ 重置时不应该删除已完成的工作成果，除非明确需要重新生成
- ✅ **禁止直接访问Repository或数据库**，所有状态操作必须通过StateManager

---

## 十、接口设计

### 10.1 接口设计原则

#### 11.1.1 RESTful设计原则
- **资源导向**：接口以资源为中心，使用名词表示资源
- **HTTP方法**：使用标准HTTP方法（GET、POST、PUT、DELETE）
- **状态码**：使用标准HTTP状态码表示结果
- **统一格式**：请求和响应使用统一的JSON格式

#### 11.1.2 接口规范
- **路径规范**：使用小写字母和连字符，层级清晰
- **参数规范**：路径参数使用`:projectId`格式，查询参数使用snake_case
- **响应规范**：统一响应格式，包含success、data、error字段
- **错误处理**：统一的错误响应格式和错误码

#### 11.1.3 接口版本管理
- **版本控制**：通过路径前缀`/api/v1/`进行版本控制
- **向后兼容**：新版本保持向后兼容
- **废弃策略**：废弃接口提前通知，逐步下线

### 11.2 接口分类

#### 11.2.1 状态查询接口
**特点**：
- 主要用于前端轮询获取最新状态
- 响应速度快，数据实时
- 支持批量查询

**接口列表**（详细说明请参考[10.8 API 接口详细说明](#108-api-接口详细说明)章节）：
- `GET /api/interactive/:projectId/running` - 获取运行状态（主要轮询接口，参见[10.8.2.2](#10822-获取运行状态轮询接口)）
- `GET /api/interactive/:projectId/workflow` - 获取工作流信息（参见[10.8.2.1](#10821-获取工作流信息)）
- `GET /api/interactive/:projectId` - 获取会话信息（参见[10.8.3.2](#10832-获取会话信息)）

#### 11.2.2 状态操作接口
**特点**：
- 用于修改状态的操作
- 需要验证前置条件
- 保证原子性

**接口列表**（详细说明请参考[10.8 API 接口详细说明](#108-api-接口详细说明)章节）：
- `POST /api/interactive/:projectId/confirm` - 确认操作（参见[10.8.2.3](#10823-确认操作)）
- `POST /api/interactive/:projectId/reset-workflow` - 重置工作流（参见[10.8.2.4](#10824-重置工作流)）

#### 11.2.3 会话管理接口
**特点**：
- 管理会话生命周期
- 支持CRUD操作
- 包含统计信息

**接口列表**（详细说明请参考[10.8 API 接口详细说明](#108-api-接口详细说明)章节）：
- `POST /api/interactive` - 创建会话（参见[10.8.3.1](#10831-创建会话)）
- `GET /api/interactive` - 列出所有会话（参见[10.8.3.4](#10834-列出所有会话)）
- `GET /api/interactive/:projectId` - 获取会话信息（参见[10.8.3.2](#10832-获取会话信息)）
- `DELETE /api/interactive/:projectId` - 删除会话（参见[10.8.3.3](#10833-删除会话)）
- `GET /api/interactive-stats` - 获取统计信息（参见[10.8.3.5](#10835-获取统计信息)）

### 11.3 接口设计模式

#### 11.3.1 轮询模式
**适用场景**：前端需要实时获取状态更新

**实现方式**：
```typescript
// 前端轮询实现
async function pollRunningState(projectId: string) {
  const interval = setInterval(async () => {
    const response = await fetch(`/api/interactive/${projectId}/running`);
    const data = await response.json();
    
    // 更新UI
    updateUI(data);
    
    // 如果工作流完成，停止轮询
    if (isWorkflowCompleted(data)) {
      clearInterval(interval);
    }
  }, 1000); // 每秒轮询一次
}
```

**优化建议**：
- 使用指数退避策略
- 支持长轮询（Long Polling）
- 考虑使用WebSocket替代轮询

#### 11.3.2 确认模式
**适用场景**：需要用户确认才能继续

**实现方式**：
```typescript
// 确认操作
async function handleConfirm(projectId: string, action: string, modifiedContent?: string) {
  const response = await fetch(`/api/interactive/${projectId}/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action, // 'continue' | 'edit' | 'regenerate' | 'skip'
      modifiedContent
    })
  });
  
  return await response.json();
}
```

#### 11.3.3 重置模式
**适用场景**：需要重置工作流状态

**实现方式**：
```typescript
// 重置工作流
async function resetWorkflow(projectId: string, role: string) {
  const response = await fetch(`/api/interactive/${projectId}/reset-workflow`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role })
  });
  
  return await response.json();
}
```

### 11.4 接口数据一致性保证

#### 11.4.1 Running接口数据一致性

**接口**: `GET /api/interactive/:projectId/running`  
**详细接口说明**: 请参考[10.8.2.2 获取运行状态（轮询接口）](#10822-获取运行状态轮询接口)章节

**核心原则**：
- 数据库是单一数据源（Single Source of Truth）
- 所有状态字段必须与数据库保持一致
- 消息队列仅作为辅助数据源，必须与数据库角色匹配

**数据源优先级**：
1. **数据库状态**（权威数据源）：
   - `requires_confirmation` ← `interactive_session_running_state.requires_confirmation`（参见[5.2 数据库字段说明](#52-interactive_session_running_state)）
   - `confirmation_role` ← `interactive_session_running_state.confirmation_role`（参见[5.2 数据库字段说明](#52-interactive_session_running_state)）
   - `items[].status` ← `interactive_session_workflows.status`（参见[5.1 数据库字段说明](#51-interactive_session_workflows)）
   - **当前运行状态**：通过查找`items`中`status`为`running`的项来确定，与数据库`interactive_session_workflows.status`一致

2. **消息队列**（辅助数据源）：
   - `confirmationRequired.content` ← 消息队列中的`confirmation_required`消息
   - `confirmationRequired.outputFiles` ← 消息队列
   - `confirmationRequired.instructContent` ← 消息队列
   - **重要**：只有当消息队列中的`role`与数据库`confirmation_role`匹配时才使用

**一致性检查逻辑**：

```typescript
// Running接口数据一致性保证
async getRunning(projectId: string) {
  // 1. 从数据库获取所有状态（单一数据源）
  const confirmationStatus = await repository.getConfirmationStatus(projectId);
  const workflowItems = await repository.getWorkflowItems(projectId);
  
  // 2. 使用数据库状态作为基础
  let requiresConfirmation = confirmationStatus.required || false;
  const confirmationRoleFromDB = confirmationStatus.role;
  
  // 3. 获取当前运行状态（从items中查找status为running的项）
  const runningItem = workflowItems.find(item => item.status === 'running');
  const currentRunning = runningItem ? {
    role: runningItem.role,
    action: runningItem.action
  } : null;
  
  // 4. 获取确认详情（必须与数据库角色匹配）
  let confirmationRequired = null;
  if (requiresConfirmation && confirmationRoleFromDB) {
    // 从消息队列查找匹配的确认消息
    const confirmationMessage = findConfirmationMessageByRole(
      confirmationRoleFromDB  // 必须匹配数据库角色
    );
    
    if (confirmationMessage) {
      confirmationRequired = {
        role: confirmationRoleFromDB,  // 使用数据库角色（权威）
        action: confirmationMessage.data.action,
        content: confirmationMessage.data.content,
        outputFiles: confirmationMessage.data.outputFiles || [],
        instructContent: confirmationMessage.data.instructContent,
      };
    } else {
      // Fallback: 使用数据库状态
      const lastCompletedAction = workflowItems
        .filter(item => item.role === confirmationRoleFromDB && item.status === 'completed')
        .sort((a, b) => (b.action_order || 0) - (a.action_order || 0))[0];
      
      confirmationRequired = {
        role: confirmationRoleFromDB,
        action: lastCompletedAction?.action || null,
        content: null,
        outputFiles: [],
        instructContent: null,
      };
    }
  }
  
  // 5. 数据完整性检查
  // 如果所有items已完成，清除确认状态
  const allItemsCompleted = workflowItems.every(item => item.status === 'completed');
  if (allItemsCompleted) {
    requiresConfirmation = false;
    confirmationRequired = null;
  }
  
  // 6. 确保返回数据的一致性（已移除running字段，统一使用items）
  return {
    success: true,
    items: workflowItems,              // 来自数据库，包含所有状态信息
    requiresConfirmation,               // 来自数据库
    confirmationRequired,              // 角色来自数据库，内容可能来自消息队列
  };
}
```

**数据结构**：
```typescript
interface RunningResponse {
  success: boolean;
  items: Array<{              // 所有workflow items（来自数据库 status）
    role: string;
    action: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
  }>;
  requiresConfirmation: boolean;  // 是否需要确认（来自数据库 requires_confirmation）
  confirmationRequired: {         // 确认详情（null如果不需要确认）
    role: string;                 // 等待确认的角色（必须与数据库 confirmation_role 一致）
    action: string;               // 最后一个完成的action
    content: string | null;        // 确认内容（来自消息队列）
    outputFiles: Array<any>;       // 输出文件列表（来自消息队列）
    instructContent: any;          // 指令内容（来自消息队列）
  } | null;
}
```

**关键保证**：
- ✅ `confirmationRequired.role`始终与数据库`confirmation_role`一致
- ✅ `requiresConfirmation`始终与数据库`requires_confirmation`一致
- ✅ `items`状态始终与数据库`status`一致
- ✅ **当前运行状态**：通过查找`items`中`status`为`running`的项来确定，确保与数据库状态一致
- ✅ 即使消息队列数据缺失，也能返回完整的数据结构
- ⚠️ **已移除`running`字段**：统一使用`items`中的状态，避免数据冗余和不一致

#### 11.4.2 防止确认弹出框重复弹出

**问题场景**：
- 前端轮询`/running`接口时，可能多次检测到相同的确认状态
- 如果前端没有防重复机制，会导致弹出框重复显示

**后端防护**：
1. **幂等性保证**：
   - `setConfirmationRequired()`方法在设置前检查当前状态
   - 如果已经是相同角色的确认状态，则跳过设置（幂等性）

2. **状态清除时机**：
   - 用户确认操作后立即清除确认状态
   - 重置操作时清除确认状态
   - 确保确认状态及时清除

**前端防护**：
1. **状态记录**：
   - 维护`lastConfirmationRole`变量，记录上次显示的确认角色
   - 只有当新确认角色与上次不同时才显示弹出框

2. **防重复显示逻辑**：

```typescript
// 前端防重复显示实现
let lastConfirmationRole: string | null = null;
let isConfirmationDialogShown = false;

function handleRunningResponse(response: RunningResponse) {
  const { requiresConfirmation, confirmationRequired } = response;
  
  if (requiresConfirmation && confirmationRequired) {
    const currentRole = confirmationRequired.role;
    
    // 只有当角色不同或对话框未显示时才显示
    if (currentRole && 
        (currentRole !== lastConfirmationRole || !isConfirmationDialogShown)) {
      showConfirmationDialog(confirmationRequired);
      lastConfirmationRole = currentRole;
      isConfirmationDialogShown = true;
    }
  } else {
    // 确认状态清除时，重置记录
    if (isConfirmationDialogShown) {
      lastConfirmationRole = null;
      isConfirmationDialogShown = false;
    }
  }
}

// 确认操作后清除状态
async function handleConfirm(action: string) {
  await confirmAction(action);
  lastConfirmationRole = null;
  isConfirmationDialogShown = false;
}
```

**防护机制总结**：
- ✅ 后端：幂等性检查，防止重复设置确认状态
- ✅ 后端：及时清除确认状态
- ✅ 前端：记录上次显示的确认角色，防止重复显示
- ✅ 前端：确认操作后清除状态记录

### 11.5 接口安全设计

#### 11.5.1 认证授权
- **认证方式**：使用JWT Token或Session
- **授权检查**：每个接口都进行权限验证
- **项目隔离**：确保用户只能访问自己的项目

#### 11.5.2 参数验证
- **类型验证**：验证参数类型和格式
- **范围验证**：验证参数取值范围
- **必填验证**：验证必填参数是否存在

#### 11.5.3 错误处理
- **统一错误格式**：所有错误使用统一格式
- **错误码规范**：使用标准HTTP状态码
- **错误信息**：提供清晰的错误信息

### 11.6 接口性能设计

#### 11.6.1 查询优化
- **索引优化**：使用数据库索引加速查询
- **批量查询**：支持批量查询减少请求次数
- **缓存策略**：前端可以缓存，后端不使用缓存

#### 11.6.2 响应优化
- **数据精简**：只返回必要的数据
- **分页支持**：大数据量支持分页
- **压缩传输**：使用gzip压缩响应数据

#### 11.6.3 并发控制
- **限流策略**：限制单个用户的请求频率
- **队列处理**：长时间操作使用队列异步处理
- **超时控制**：设置合理的超时时间

### 12.7 接口文档规范

#### 12.6.1 文档结构
- **接口概述**：接口的功能和用途
- **请求说明**：请求方法、路径、参数
- **响应说明**：响应格式、状态码、字段说明
- **示例代码**：请求和响应示例

#### 10.7.2 文档维护
- **及时更新**：接口变更时及时更新文档
- **版本管理**：文档与接口版本保持一致
- **示例完整**：提供完整的请求和响应示例

### 10.8 API 接口详细说明

#### 10.8.1 接口概览

所有接口的基础路径: `/api/interactive/:projectId`

> **注意**：接口分类说明请参考[11.2 接口分类](#112-接口分类)章节。

| 方法 | 路径 | 功能 | 详细说明 |
|------|------|------|----------|
| GET | `/interactive` | 列出所有会话 | [10.8.3.4 列出所有会话](#10834-列出所有会话) |
| POST | `/interactive` | 创建会话 | [10.8.3.1 创建会话](#10831-创建会话) |
| GET | `/interactive-stats` | 获取统计信息 | [10.8.3.5 获取统计信息](#10835-获取统计信息) |
| GET | `/interactive/:projectId` | 获取会话信息 | [10.8.3.2 获取会话信息](#10832-获取会话信息) |
| DELETE | `/interactive/:projectId` | 删除会话 | [10.8.3.3 删除会话](#10833-删除会话) |
| GET | `/interactive/:projectId/workflow` | 获取工作流信息 | [10.8.2.1 获取工作流信息](#10821-获取工作流信息) |
| GET | `/interactive/:projectId/running` | 获取运行状态 | [10.8.2.2 获取运行状态](#10822-获取运行状态轮询接口) |
| POST | `/interactive/:projectId/confirm` | 确认操作 | [10.8.2.3 确认操作](#10823-确认操作) |
| POST | `/interactive/:projectId/reset-workflow` | 重置工作流 | [10.8.2.4 重置工作流](#10824-重置工作流) |
| GET | `/interactive/:projectId/poll` | 轮询消息 | [10.8.4.1 轮询消息](#10841-轮询消息) |
| POST | `/interactive/:projectId/action` | 发送用户操作 | [10.8.4.2 发送用户操作](#10842-发送用户操作) |

### 10.8.2 核心状态管理接口

#### 10.8.2.1 获取工作流信息

**接口**: `GET /api/interactive/:projectId/workflow`

**功能**: 获取工作流结构、所有 workflow items 的状态和当前运行状态

**路径参数**:
- `projectId` (string, required): 项目ID

**响应**:
```json
{
  "success": true,
  "roles": [
    {
      "role": "Salesperson",
      "actions": [
        {
          "name": "WriteMRD",
          "description": "编写市场需求文档"
        },
        {
          "name": "MRDReview",
          "description": "评审市场需求文档"
        }
      ]
    }
  ],
  "items": [
    {
      "role": "Salesperson",
      "action": "WriteMRD",
      "status": "completed"
    },
    {
      "role": "Salesperson",
      "action": "MRDReview",
      "status": "running"
    }
  ]
}
```

**字段说明**:
- `roles`: 工作流结构，包含所有角色及其 actions
- `items`: 所有 workflow items 的状态列表（按role_order ASC, action_order ASC排序）
  - **当前运行状态**：通过查找`items`中`status`为`running`的项来确定当前运行的role和action

**状态码**:
- `200 OK`: 成功
- `404 Not Found`: 会话不存在
- `500 Internal Server Error`: 服务器错误

##### 10.8.2.2 获取运行状态（轮询接口）

**接口**: `GET /api/interactive/:projectId/running`

**功能**: 获取所有 workflow items 状态和确认状态（前端主要轮询接口）

**路径参数**:
- `projectId` (string, required): 项目ID

**响应**:
```json
{
  "success": true,
  "items": [
    {
      "role": "Salesperson",
      "action": "WriteMRD",
      "status": "completed"
    },
    {
      "role": "ProductManager",
      "action": "WritePRD",
      "status": "running"
    }
  ],
  "requiresConfirmation": false,
  "confirmationRequired": null
}
```

**确认状态响应示例**:
```json
{
  "success": true,
  "items": [
    {
      "role": "ProductManager",
      "action": "WritePRD",
      "status": "completed"
    }
  ],
  "requiresConfirmation": true,
  "confirmationRequired": {
    "role": "ProductManager",
    "action": "WritePRD",
    "content": "PRD内容...",
    "outputFiles": [
      {
        "path": "workspace/xxx/PRD.md",
        "type": "file"
      }
    ],
    "instructContent": {}
  }
}
```

**字段说明**:
- `items`: 所有 workflow items 的状态列表（按role_order ASC, action_order ASC排序）
  - `role`: 角色名称
  - `action`: Action 名称
  - `status`: 状态值（`pending`、`running`、`completed`、`failed`）
  - **当前运行状态**：通过查找`items`中`status`为`running`的项来确定当前运行的role和action
  - **Action Idle状态判断**：通过StateManager查询`items`中该角色的所有actions状态来判断
    - 如果角色的所有actions状态都是`completed`，则角色处于`idle`状态
    - 如果角色没有`pending`的action，且当前没有`running`的action，则角色处于`idle`状态
    - ⚠️ **重要**：Action idle状态必须根据StateManager中的状态来决定是否显示，禁止使用内存状态或其他非StateManager的状态
- `requiresConfirmation`: 是否需要用户确认（boolean）
- `confirmationRequired`: 确认详情，`null` 表示不需要确认
  - `role`: 等待确认的角色
  - `action`: 最后一个完成的 action
  - `content`: 确认内容
  - `outputFiles`: 输出文件列表
  - `instructContent`: 指令内容

**重要变更**：
- ⚠️ **已移除`running`字段**：不再单独返回`running`字段，统一使用`items`中的状态
- ✅ **当前运行状态获取方式**：前端通过查找`items`中`status`为`running`的项来确定当前运行的role和action
- ✅ **状态一致性**：所有状态信息统一在`items`中，避免数据不一致

**状态码**:
- `200 OK`: 成功
- `404 Not Found`: 会话不存在
- `500 Internal Server Error`: 服务器错误

**使用场景**:
- 前端定期轮询此接口获取最新状态
- 用于显示工作流进度和确认对话框
- 用于判断和显示action idle状态

**Action Idle状态显示规则**:
- **判断方式**：前端通过查询`items`中该角色的所有actions状态来判断是否显示idle
  ```typescript
  // 前端判断action idle状态的示例
  function isRoleIdle(items: WorkflowItem[], role: string): boolean {
    const roleItems = items.filter(item => item.role === role);
    
    // 如果角色的所有actions都是completed，则角色处于idle状态
    const allCompleted = roleItems.every(item => item.status === 'completed');
    if (allCompleted) {
      return true;
    }
    
    // 如果角色没有pending的action，且当前没有running的action，则角色处于idle状态
    const hasPending = roleItems.some(item => item.status === 'pending');
    const hasRunning = roleItems.some(item => item.status === 'running');
    
    if (!hasPending && !hasRunning) {
      return true;
    }
    
    return false;
  }
  ```
- **重要原则**：
  - ✅ Action idle状态必须根据StateManager中的状态（`items`中的状态）来决定是否显示
  - ✅ 禁止使用内存状态或其他非StateManager的状态来判断idle
  - ✅ 确保idle状态的显示与StateManager中的状态保持一致
  - ✅ 前端应该通过查询`items`来判断idle状态，而不是依赖其他数据源

**数据一致性保证**:
- 详细的数据一致性保证说明请参考[11.4.1 Running接口数据一致性](#1141-running接口数据一致性)章节
- 数据结构定义请参考[8.4.7 Running接口数据一致性保证](#847-running接口数据一致性保证)章节

##### 10.8.2.3 确认操作

**接口**: `POST /api/interactive/:projectId/confirm`

**功能**: 处理用户确认操作（continue/edit/regenerate/skip），清除确认状态

**路径参数**:
- `projectId` (string, required): 项目ID

**请求体**:
```json
{
  "action": "continue",
  "modifiedContent": "修改后的内容（可选，edit时必需）"
}
```

**action 值说明**:
- `continue`: 继续，进入下一个角色
- `edit`: 编辑，使用 `modifiedContent` 修改内容后继续
- `regenerate`: 重新生成，重置当前角色的所有 actions 为 pending
- `skip`: 跳过，跳过当前角色

**响应**:
```json
{
  "success": true,
  "message": "Confirmation processed successfully",
  "role": "ProductManager",
  "action": "continue"
}
```

**重新生成响应**:
```json
{
  "success": true,
  "message": "ProductManager role regenerated - all actions reset to pending",
  "role": "ProductManager",
  "action": "regenerate"
}
```

**错误响应**:
```json
{
  "error": "No confirmation required",
  "alreadyCleared": true
}
```

**状态码**:
- `200 OK`: 成功
- `400 Bad Request`: 缺少必需字段 `action`
- `404 Not Found`: 会话不存在
- `500 Internal Server Error`: 服务器错误

**状态转换**:
1. 验证确认状态（`requiresConfirmation = true`）
2. 如果是 `regenerate`:
   - 调用`resetWorkflowFromRole()`重置当前角色及所有下游角色的所有 actions 为 `PENDING`
   - 停止正在执行的action
   - 重置数据库状态和内存状态
   - 清空Message.content中涉及当前角色和下游角色的信息
   - 回退到重置角色的第一个action
   - 清除确认状态
3. 如果是其他操作:
   - 处理用户操作（通过 session）
   - 清除确认状态
4. 工作流执行器检测到状态变化，继续执行（按顺序执行，只有最后一个action完成后才弹出确认框）

##### 10.8.2.4 重置工作流

**接口**: `POST /api/interactive/:projectId/reset-workflow`

**功能**: 重置指定角色及其所有下游角色的工作流状态

**路径参数**:
- `projectId` (string, required): 项目ID

**请求体**:
```json
{
  "role": "Architect"
}
```

**响应**:
```json
{
  "success": true,
  "message": "Workflow reset from role Architect and all downstream roles"
}
```

**状态转换**:
- **停止正在执行的操作**：
  - 停止正在执行的action（通过`AbortController`）
  - 停止正在执行的大模型调用（中断LLM API请求）
  - 停止所有异步操作和轮询任务
  - 清理外部资源（如Cursor Agent）
- **重置数据库状态**：重置指定角色及所有下游角色的所有 actions 为 `PENDING`（基于数据库`role_order`字段确定下游关系），**重置角色的第一个action设置为`RUNNING`**
- **清空Message.content**：清空数据库中所有Message.content字段中涉及到当前角色和下游所有角色的信息，确保重置后不会使用旧的消息内容影响后续执行
- **中断并清空StepwiseDocumentGenerator**：中断所有正在执行的StepwiseDocumentGenerator，清空其状态和临时信息
- **重置内存状态**：重置RoleContext和action的内存状态为`PENDING`（重置角色的第一个action为`RUNNING`）
- **回退到第一个action并设置为RUNNING**：设置重置角色的第一个action（`action_order`最小）状态为`RUNNING`，工作流执行器会立即检测到并开始执行
- **同步更新运行状态**（可选，用于向后兼容）：
  - 设置`current_role = role, current_action = firstAction`（但主要状态在`items`中）
  - 清除`requiresConfirmation`字段（设为`FALSE`）
  - 清除`confirmationRequired`字段（设为`null`）
- **顺序保证**：重置后仍然保持"按角色和action顺序执行，只有最后一个action完成后弹出确认框"的规则

**角色顺序**（通过数据库`role_order`字段保证，用于确定下游角色）:
```
Salesperson → ProductManager → Architect → ProjectManager → Engineer → QAEngineer
```

**重要说明**:
- **顺序执行**：角色和action的执行顺序完全由数据库中的`role_order`和`action_order`字段来保证
- **确认时机**：只有当前角色的最后一个action（`action_order`最大）执行完成后，才弹出确认框等待用户确认
- **重置范围**：重置操作会自动识别并重置所有下游角色（基于`role_order`），无需手动指定
- **重置完整性**：重置时会停止正在执行的action，重置数据库状态和内存状态，中断并清空StepwiseDocumentGenerator，回退到重置角色的第一个action并设置为`RUNNING`
- **状态一致性**：重置后必须同时更新`items`状态（第一个action为`RUNNING`）、`requiresConfirmation`和`confirmationRequired`字段，确保状态一致性
- **StepwiseDocumentGenerator中断**：重置时必须中断所有正在执行的StepwiseDocumentGenerator，清空其状态和临时信息，确保不会影响后续执行

**状态码**:
- `200 OK`: 成功
- `400 Bad Request`: 缺少必需字段 `role`
- `404 Not Found`: 会话不存在
- `500 Internal Server Error`: 服务器错误

#### 10.8.3 会话管理接口

##### 10.8.3.1 创建会话

**接口**: `POST /api/interactive`

**功能**: 创建新的交互式会话

**请求体**:
```json
{
  "name": "项目名称",
  "idea": "项目想法",
  "description": "项目描述（可选）",
  "investment": 10.0,
  "projectId": "项目ID（可选，如果提供则使用现有项目）",
  "applicationId": "应用ID（可选）",
  "userId": "用户ID（可选）"
}
```

**响应**:
```json
{
  "projectId": "7a57c6c4-f51f-468d-bb35-1beaa6068e0f",
  "config": {
    "name": "项目名称",
    "idea": "项目想法",
    "description": "项目描述",
    "investment": 10.0
  }
}
```

**状态码**:
- `200 OK`: 成功
- `400 Bad Request`: 缺少必需字段 `name` 或 `idea`
- `409 Conflict`: 项目名称重复
- `500 Internal Server Error`: 服务器错误

#### 10.8.3.2 获取会话信息

**接口**: `GET /api/interactive/:projectId`

**功能**: 获取会话的详细信息

**路径参数**:
- `projectId` (string, required): 项目ID

**响应**:
```json
{
  "session": {
    "projectId": "7a57c6c4-f51f-468d-bb35-1beaa6068e0f",
    "config": {
      "name": "项目名称",
      "idea": "项目想法",
      "investment": 10.0
    },
    "isPaused": false,
    "isStarted": true,
    "lastActivity": "2025-01-XXT00:00:00Z",
    "costReport": {
      "totalCost": 0.5,
      "tokenUsage": {}
    },
    "messageHistory": [
      {
        "role": "Salesperson",
        "causeBy": "WriteMRD",
        "contentPreview": "..."
      }
    ],
    "messageQueueLength": 0
  }
}
```

**状态码**:
- `200 OK`: 成功
- `404 Not Found`: 会话不存在
- `500 Internal Server Error`: 服务器错误

#### 10.8.3.3 删除会话

**接口**: `DELETE /api/interactive/:projectId`

**功能**: 删除指定项目的会话

**路径参数**:
- `projectId` (string, required): 项目ID

**响应**:
```json
{
  "message": "Session deleted successfully"
}
```

**状态码**:
- `200 OK`: 成功
- `404 Not Found`: 会话不存在
- `500 Internal Server Error`: 服务器错误

#### 10.8.3.4 列出所有会话

**接口**: `GET /api/interactive`

**功能**: 获取所有交互式会话列表

**响应**:
```json
{
  "sessions": [
    {
      "projectId": "7a57c6c4-f51f-468d-bb35-1beaa6068e0f",
      "config": {
        "name": "项目名称",
        "idea": "项目想法"
      },
      "isPaused": false,
      "isStarted": true
    }
  ]
}
```

**状态码**:
- `200 OK`: 成功
- `500 Internal Server Error`: 服务器错误

#### 10.8.3.5 获取统计信息

**接口**: `GET /api/interactive-stats`

**功能**: 获取会话管理器的统计信息

**响应**:
```json
{
  "stats": {
    "totalSessions": 10,
    "activeSessions": 2,
    "completedSessions": 8
  }
}
```

**状态码**:
- `200 OK`: 成功
- `500 Internal Server Error`: 服务器错误

### 10.8.4 轮询模式接口（可选）

#### 10.8.4.1 轮询消息

**接口**: `GET /api/interactive/:projectId/poll`

**功能**: 轮询获取会话的新消息（用于不支持 WebSocket 的场景）

**路径参数**:
- `projectId` (string, required): 项目ID

**查询参数**:
- `lastMessageId` (string, optional): 上次获取的最后一条消息ID

**响应**:
```json
{
  "messages": [
    {
      "id": "message-id",
      "type": "role_start",
      "role": "Salesperson",
      "action": "WriteMRD",
      "content": "消息内容",
      "timestamp": "2025-01-XXT00:00:00Z"
    }
  ],
  "lastMessageId": "message-id",
  "hasMore": false
}
```

**状态码**:
- `200 OK`: 成功
- `404 Not Found`: 会话不存在
- `500 Internal Server Error`: 服务器错误

#### 10.8.4.2 发送用户操作

**接口**: `POST /api/interactive/:projectId/action`

**功能**: 发送用户操作（轮询模式）

**路径参数**:
- `projectId` (string, required): 项目ID

**请求体**:
```json
{
  "action": "continue",
  "modifiedContent": "修改后的内容（可选）"
}
```

**响应**:
```json
{
  "success": true,
  "message": "Action processed successfully"
}
```

**状态码**:
- `200 OK`: 成功
- `400 Bad Request`: 缺少必需字段 `action`
- `404 Not Found`: 会话不存在
- `500 Internal Server Error`: 服务器错误

### 10.8.5 接口使用流程

#### 10.8.5.1 前端轮询流程

```
1. 创建会话
   POST /api/interactive
   → 获取 projectId

2. 开始轮询运行状态
   GET /api/interactive/:projectId/running
   → 获取items状态、确认状态（当前运行状态从items中status为running的项获取）

3. 如果 requiresConfirmation = true
   → 显示确认对话框
   → 用户选择操作（continue/edit/regenerate/skip）

4. 发送确认
   POST /api/interactive/:projectId/confirm
   → 清除确认状态

5. 继续轮询
   GET /api/interactive/:projectId/running
   → 检测状态变化，更新UI

6. 重复步骤 2-5，直到工作流完成
```

#### 10.8.5.2 重新生成流程

```
1. 用户点击重新生成
   POST /api/interactive/:projectId/confirm
   {
     "action": "regenerate"
   }

2. 后端处理
   → resetWorkflowFromRole(role)
   → clearConfirmationRequired()
   → clearState()

3. 前端继续轮询
   GET /api/interactive/:projectId/running
   → 检测到 items 状态变化（重置角色的第一个action状态为running）
   → 显示加载状态

4. 工作流执行器检测到 RUNNING action
   → 立即开始执行重置角色的第一个action（状态为RUNNING）
   → 按顺序执行后续actions

5. 前端更新UI
   → 显示执行进度（从items中status为running的项获取当前运行状态）
```

---

## 十一、错误处理和最佳实践

### 11.1 错误处理

#### 11.1.1 状态更新失败

**场景**: 数据库更新失败  
**处理**: 
- 记录错误日志
- 不中断工作流执行
- 返回错误状态给调用者

```typescript
try {
  await updateWorkflowItemStatus(role, action, status);
} catch (error) {
  logger.error('状态更新失败', { role, action, status, error });
  // 不抛出异常，允许工作流继续
}
```

#### 11.1.2 非法状态转换

**场景**: 尝试将 COMPLETED 状态转换为 RUNNING  
**处理**: 
- 记录警告日志
- 允许转换（重新生成场景）
- 或拒绝转换并返回错误

```typescript
async transitionToRunning(role, action) {
  const currentStatus = await getActionStatus(role, action);
  
  if (currentStatus === COMPLETED || currentStatus === FAILED) {
    // 重新生成场景，允许转换
    logger.warn('从最终状态转换到 RUNNING', { role, action, currentStatus });
  }
  
  // 执行转换
}
```

#### 11.1.3 状态不一致恢复

**场景**: 检测到运行状态与 action 状态不一致  
**处理**: 
- 自动修复：清除运行状态
- 记录修复日志
- 通知管理员

```typescript
async checkStateConsistency(projectId) {
  const runningState = await getRunningState(projectId);
  const runningAction = await getRunningAction(projectId);
  
  if (runningState.action && !runningAction) {
    // 不一致：运行状态有 action，但数据库中没有 RUNNING 的 action
    logger.warn('状态不一致，自动修复', { runningState });
    await clearState();
  }
}
```

### 11.2 最佳实践

#### 11.2.1 状态更新原则

1. **单一数据源**: 所有状态都存储在数据库中，不使用内存缓存
2. **原子操作**: 每个状态转换操作都是原子的
3. **及时更新**: 状态更新应该及时，不延迟
4. **一致性检查**: 定期检查状态一致性

#### 11.2.2 状态查询原则

1. **实时查询**: 每次查询都从数据库读取最新状态
2. **批量查询**: 需要多个状态时，使用批量查询
3. **缓存策略**: 前端可以缓存，但需要定期刷新

#### 11.2.3 状态转换原则

1. **明确转换**: 每个状态转换都有明确的触发条件
2. **验证转换**: 转换前验证当前状态和目标状态
3. **记录日志**: 所有状态转换都记录日志
4. **错误处理**: 转换失败时有明确的错误处理策略

#### 11.2.4 代码组织原则

1. **分层清晰**: 应用层、状态管理层、数据持久层分离
2. **职责单一**: 每个类和方法只负责一个职责
3. **接口统一**: 状态操作通过统一的接口进行
4. **可测试性**: 状态操作易于单元测试

---

## 十二、注意事项

1. **统一状态管理器（最重要）** ⭐: 
   - **所有状态读写必须通过StateManager**：禁止直接访问Repository或数据库
   - **单一入口原则**：StateManager是所有状态操作的唯一入口
   - **统一接口**：所有组件（Role、Action、StepwiseDocumentGenerator）都通过StateManager读写状态
   - **状态一致性保证**：StateManager确保所有状态操作的一致性和原子性
   - **可追溯性**：所有状态变更都通过StateManager记录日志

2. **状态一致性（重要）**: 
   - **数据库为唯一数据源**：所有状态以数据库为准，内存状态仅作为执行时的临时缓存
   - **执行器负责同步**：执行器在调用`think()`之前从数据库同步状态到内存
   - **Role类只读取**：`think()`和`act()`方法只读取内存状态，不修改内存状态
   - **Action状态一致性**：数据库`interactive_session_workflows.status`是权威数据源，内存`Role.actions[].status`由执行器同步
   - **运行状态一致性**：数据库`interactive_session_running_state`是权威数据源，运行状态只从数据库读取
   - **确认状态一致性**：数据库`requires_confirmation`和`confirmation_role`是权威数据源
   - **步骤状态一致性**：步骤状态通过StateManager统一管理，确保StepwiseDocumentGenerator的状态一致性
   - **RoleContext状态一致性**：`rc.todo`和`rc.state`不直接修改，由执行器从数据库同步
   - **状态更新只更新数据库**：状态更新时只更新数据库，执行器负责同步到内存
   - **状态查询从数据库读取**：所有状态查询都从数据库读取，不使用内存缓存

3. **并发控制**: 
   - `clearAllRunningStatuses()` 确保同一时间只有一个 action 在运行
   - 使用数据库事务保证原子性
   - StateManager统一管理并发控制，确保状态操作的一致性

4. **顺序执行（重要）**: 
   - **一定要确保角色和action的顺序是正确的**：顺序错误会导致工作流执行混乱，必须严格保证顺序的正确性
   - **所有的状态、角色和action的顺序都通过数据库中获取，不允许直接从内存中获取**：
     - 角色顺序必须从数据库`role_order`字段获取，按`role_order ASC`排序
     - Action顺序必须从数据库`action_order`字段获取，按`action_order ASC`排序
     - 状态查询必须从数据库读取，按`role_order ASC, action_order ASC`排序
     - 禁止使用内存中的角色数组或action数组来确定顺序
     - 禁止使用代码中硬编码的顺序来确定执行顺序
   - 角色和action的执行顺序完全由数据库中的`role_order`和`action_order`字段来保证
   - 严格按照顺序执行，不会跳过任何action
   - 只有当前角色的最后一个action（`action_order`最大）执行完成后，才弹出确认框等待用户确认
   - 非最后action完成时，自动继续执行下一个action，不弹出确认框

5. **重置操作**: 
   - 重置操作会自动重置指定角色及其所有下游角色（基于`role_order`字段确定下游关系）
   - **停止正在执行的操作**：
     - 停止正在执行（RUNNING）的action（通过`AbortController`）
     - 停止正在执行的大模型调用（中断LLM API请求）
     - 停止所有异步操作和轮询任务
     - 清理外部资源（如Cursor Agent）
   - **清空Message.content**：
     - 清空数据库中所有Message.content字段中涉及到当前角色和下游所有角色的信息
     - 确保重置后不会使用旧的消息内容影响后续执行
     - 清空范围基于`role_order`字段确定下游角色关系
   - **基类重置支持**：
     - **BaseRole和BaseAction重置支持**：重新设计角色和action的base类，在重置时支持可以重置之前正在运行中的流程
       - `BaseAction`需要实现`reset()`方法，支持重置正在执行的action
       - `BaseRole`需要实现`reset()`方法，支持重置正在执行的角色及其所有actions
       - 所有重置方法都需要检查`abortSignal`，确保能够响应取消信号
       - 重置时需要清理所有相关资源，包括LLM资源、临时文件等
     - **StepwiseDocumentGenerator重置支持**：StepwiseDocumentGenerator中也需要新增在重置时支持可以重置之前正在运行中的流程
       - `StepwiseDocumentGenerator`需要实现`reset()`方法，支持重置正在执行的文档生成流程
       - 需要在每个步骤之间检查取消状态，确保能够及时响应重置请求
       - 重置时需要清理已生成的临时文件（根据需求决定是否删除）
   - **状态同步重置**：
     - 重置数据库状态：所有相关actions的`status`字段重置为`PENDING`
     - 清空Message.content：清空当前角色及下游角色的Message.content字段
     - 重置action内存状态：`Role.actions[].status`重置为`PENDING`（匹配数据库）
     - 重置运行状态：`current_role`和`current_action`重置为重置角色的第一个action（数据库）
     - 重置确认状态：`requires_confirmation`重置为`FALSE`，`confirmation_role`重置为`NULL`（数据库）
     - **不修改rc.todo和rc.state**：执行器会在下次处理角色时从数据库同步
   - 重置后回退到重置角色的第一个action（`action_order`最小）
   - **状态一致性保证**：重置后只更新数据库状态，执行器负责同步到内存
   - 重置后仍然保持"按角色和action顺序执行，只有最后一个action完成后弹出确认框"的规则

6. **状态查询**: 
   - 所有状态查询都通过StateManager从数据库读取，不使用内存缓存
   - 前端可以缓存，但需要定期刷新
   - 禁止直接访问Repository或数据库

7. **StepwiseDocumentGenerator状态管理**: 
   - **必须通过StateManager管理步骤状态**：所有步骤状态读写都通过StateManager
   - **步骤状态定义**：每个步骤都有唯一ID（如'outline', 'section-1', 'merge'）
   - **状态转换**：步骤状态转换（PENDING → RUNNING → COMPLETED/FAILED）通过StateManager统一管理
   - **重置支持**：重置时通过StateManager重置所有步骤状态
   - **状态查询**：可以通过StateManager查询当前步骤状态和进度

8. **Action Idle状态管理**: 
   - **必须通过StateManager判断idle状态**：Action idle状态必须根据StateManager中的状态来决定是否显示
   - **判断规则**：
     - 如果角色的所有actions状态都是`COMPLETED`，则角色处于`IDLE`状态
     - 如果角色没有`PENDING`的action，且当前没有`RUNNING`的action，则角色处于`IDLE`状态
   - **显示规则**：
     - ✅ 前端通过查询`items`中该角色的所有actions状态来判断是否显示idle
     - ✅ 禁止使用内存状态或其他非StateManager的状态来判断idle
     - ✅ 确保idle状态的显示与StateManager中的状态保持一致
   - **访问方式**：通过`StateManager.getRoleActionsStatus()`查询角色的所有actions状态，然后判断是否idle

8. **错误处理**: 
   - 状态更新失败不应中断工作流执行
   - 记录所有错误日志
   - StateManager统一处理状态操作错误

9. **性能优化**: 
   - 批量查询多个状态（通过StateManager）
   - 避免频繁的数据库查询
   - StateManager可以缓存常用状态查询结果（可选）

---

## 十三、更新日志

- 2026-01-15: **完全重构状态管理系统**：
  - **移除WorkflowTracker**：WorkflowTracker的所有功能已直接整合到StateManager中，不再作为独立组件
  - **统一状态管理**：实现StateManager作为所有状态读写的唯一入口
  - **数据库为唯一数据源**：移除所有内存状态，包括RoleContext的state和todo，统一使用数据库管理
  - **RoleContext状态统一**：state和todo存储在数据库`interactive_session_running_state`表的`role_state`和`role_todo_action`字段
  - **状态同步机制**：执行器负责从数据库同步state和todo到RoleContext内存，Role类只读取不修改
  - **StepwiseDocumentGenerator集成**：集成StateManager管理步骤状态，实现reset()方法支持中断和回滚
  - **回滚机制完善**：实现完整的回滚流程，包括停止任务、重置状态、清空消息、重置步骤状态
  - **顺序执行保证**：基于数据库的role_order和action_order字段保证执行顺序
  - **数据库迁移**：添加step_state表和role_context_state字段的迁移文件
  - **组件重构**：重构BaseAction、BaseRole、SessionWorkflowExecutor、InteractiveSession等组件
- 2025-01-XX: 重新设计状态管理方案，采用状态机模式
- 2025-01-XX: 明确状态转换规则和操作接口
- 2025-01-XX: 添加状态一致性保证和错误处理机制
- 2025-01-XX: 完善状态流转图和最佳实践
- 2025-01-XX: 添加`role_order`和`action_order`字段，通过数据库保证角色和action的执行顺序
- 2025-01-XX: 明确重置操作需要同时更新`running`、`requiresConfirmation`和`confirmationRequired`字段
- 2025-01-XX: 明确重置操作会自动重置该角色及所有下游角色
- 2025-01-XX: **重构角色和action流转流程**：
  - 明确"只有当前角色的最后一个action执行完成后，才弹出确认框等待用户确认"的规则
  - 明确重置流程：停止正在执行的action，重置数据库状态和内存状态，回退到重置角色的第一个action
  - 添加顺序执行和重置流程的详细说明章节
  - 保证功能的内聚和清晰，确保顺序执行和回退的正确性
  - **补充重置逻辑**：
    - 明确重置时需要停止所有正在执行的大模型调用（通过`AbortController`）
    - 明确需要清理LLM资源（如Cursor Agent）
    - 明确需要停止所有异步操作和轮询任务
    - 完善资源清理机制说明
- 2025-01-XX: **文档重新整理**：
  - 优化章节结构，将数据库设计提前
  - 合并重复的流程说明
  - 整合重置流程相关内容
  - 改进文档可读性和逻辑性
- 2025-01-XX: **新增章节**：
  - **新增"方案设计"章节**：
    - 整体架构方案（应用层、状态管理层、数据持久层）
    - 技术方案（状态管理、顺序执行、重置方案）
    - 数据流方案（状态更新、状态转换、确认流程）
    - 扩展性方案（新增角色、状态扩展、性能优化）
    - 安全性方案（状态一致性保护、并发控制、错误恢复）
  - **新增"流程设计"章节**：
    - 流程设计原则（清晰性、可控性、一致性）
    - 核心流程图（初始化、Action执行、确认、角色切换、重置）
    - 时序图（Action执行时序、确认流程时序）
    - 异常流程（错误处理、状态不一致恢复）
  - **新增"接口设计"章节**：
    - 接口设计原则（RESTful设计、接口规范、版本管理）
    - 接口分类（状态查询、状态操作、会话管理）
    - 接口设计模式（轮询模式、确认模式、重置模式）
    - 接口安全设计（认证授权、参数验证、错误处理）
    - 接口性能设计（查询优化、响应优化、并发控制）
    - 接口文档规范（文档结构、文档维护）
- 2025-01-XX: **防止重复弹出和数据一致性保证**：
  - **防止确认弹出框重复弹出**：
    - 添加幂等性检查机制（`setConfirmationRequired()`方法）
    - 数据库唯一性保证（`UNIQUE(project_id)`约束）
    - 前端防重复显示逻辑（记录`lastConfirmationRole`）
    - 确认状态清除时机说明
  - **Running接口数据一致性保证**：
    - 明确数据源优先级（数据库为单一数据源）
    - 数据一致性检查逻辑（角色匹配、状态验证）
    - 数据结构保证（确保返回数据的一致性）
    - 异常处理机制（fallback策略）
  - **状态一致性保证扩展**：
    - 添加"防止确认弹出框重复弹出"小节（7.4.6）
    - 添加"Running接口数据一致性保证"小节（7.4.7）
    - 在接口设计章节添加"接口数据一致性保证"小节（12.4）
- 2025-01-XX: **全面状态一致性保证**：
  - **扩展状态一致性保证章节**（7.4）：
    - 添加状态一致性总体原则（7.4.1）
    - 添加Action状态一致性保证（7.4.2）：数据库和内存状态同步机制
    - 扩展运行状态一致性保证（7.4.3）：运行状态唯一性和同步机制
    - 添加RoleContext状态一致性保证（7.4.4）：RoleContext状态与数据库同步
    - 扩展确认状态一致性保证（7.4.5）：确认状态同步和验证机制
    - 添加状态一致性检查与恢复机制（7.4.8）：定期检查和自动修复
  - **状态一致性保证总结表**：
    - 列出所有状态类型及其一致性保证机制
    - 明确数据库字段、内存字段、同步时机和一致性保证
  - **更新注意事项章节**：
    - 强调状态一致性的重要性
    - 明确所有状态类型的一致性要求
    - 强调数据库为单一数据源的原则
- 2025-01-XX: **文档重构**：
  - **合并重复章节**：
    - 合并"流程设计"和"工作流执行流程"为一个章节（第八章）
    - 合并"接口设计"和"API接口设计"为一个章节（第十章，API接口详细说明作为10.8小节）
    - 合并"状态分层架构"到"方案设计"章节（作为2.1.3和2.1.4小节）
  - **修正章节编号**：
    - 统一修正所有章节和子章节的编号
    - 确保编号连续性和一致性
    - 修正了所有章节编号错误（如"三、设计原则"下的"2.1"改为"3.1"）
  - **优化文档结构**：
    - 删除重复的类和方法说明
    - 合并重复的流程图和时序图到"工作流执行流程"章节
    - 统一接口设计说明，将API接口详细说明作为接口设计章节的子章节
  - **更新目录**：
    - 更新目录结构，从16个章节优化为13个章节
    - 确保目录链接正确
    - 删除重复的章节引用
- 2025-01-14: **统一使用数据库，移除内存状态直接修改**：
  - **架构变更**：
    - 数据库为唯一数据源：所有状态以数据库为准，内存状态仅作为执行时的临时缓存
    - 执行器负责同步：执行器在调用`think()`之前从数据库同步状态到内存
    - Role类只读取：`think()`和`act()`方法只读取内存状态，不修改内存状态
  - **代码修改**：
    - `RoleThinker`：移除所有设置`rc.todo`和`rc.state`的逻辑，只检查是否存在（由执行器同步）
    - `RoleActionExecutor`：移除所有修改`rc.todo`和`rc.state`的逻辑
    - `Engineer/ProjectManager/TeamLeader`：移除所有`rc.todo = null`和`rc.state = -1`的设置
    - `SessionWorkflowExecutor`：增强`syncRoleStateFromDatabase()`方法，确保从数据库同步状态
    - `WorkflowTracker.resetWorkflowFromRole()`：移除对`rc.todo`和`rc.state`的直接修改
  - **文档更新**：
    - 更新"状态一致性总体原则"：明确数据库为唯一数据源，执行器负责同步
    - 更新"RoleContext状态一致性保证"：说明执行器同步机制，Role类只读取
    - 更新"重置流程"：说明重置时只更新数据库，不修改内存状态
    - 更新"注意事项"：强调数据库为唯一数据源，状态更新只更新数据库
- 2025-01-XX: **基类重置支持**：
  - **BaseRole和BaseAction重置支持**：
    - 重新设计角色和action的base类，在重置时支持可以重置之前正在运行中的流程
    - `BaseAction`需要实现`reset()`方法，支持重置正在执行的action
    - `BaseRole`需要实现`reset()`方法，支持重置正在执行的角色及其所有actions
    - 所有重置方法都需要检查`abortSignal`，确保能够响应取消信号
    - 重置时需要清理所有相关资源，包括LLM资源、临时文件等
  - **StepwiseDocumentGenerator重置支持**：
    - StepwiseDocumentGenerator中也需要新增在重置时支持可以重置之前正在运行中的流程
    - `StepwiseDocumentGenerator`需要实现`reset()`方法，支持重置正在执行的文档生成流程
    - 需要在每个步骤之间检查取消状态，确保能够及时响应重置请求
    - 重置时需要清理已生成的临时文件（根据需求决定是否删除）
  - **文档更新**：
    - 在"重置流程详解"章节新增"10.5 基类重置支持"小节，详细说明BaseRole、BaseAction和StepwiseDocumentGenerator的重置支持机制
    - 在"注意事项"章节的"重置操作"部分补充基类重置支持的说明
    - 提供完整的代码示例和调用流程说明
- 2025-01-XX: **接口和重置流程优化**：
  - **Running接口优化**：
    - 移除`running`字段，统一使用`items`中的状态
    - 当前运行状态通过查找`items`中`status`为`running`的项来确定
    - 简化接口结构，避免数据冗余和不一致
  - **重置流程增强**：
    - 重置角色的第一个action设置为`RUNNING`状态，工作流执行器立即检测到并开始执行
    - 新增StepwiseDocumentGenerator中断和清空机制，确保所有正在执行的步骤都被正确中断
    - 完善重置步骤，确保所有新增均被回退（角色和action状态、正在执行中逻辑、消息内容、StepwiseDocumentGenerator）
  - **Action Idle状态管理**：
    - 新增Action Idle状态的定义和判断规则
    - Action idle状态必须根据StateManager中的状态来决定是否显示
    - 前端通过查询`items`中该角色的所有actions状态来判断是否显示idle
    - 禁止使用内存状态或其他非StateManager的状态来判断idle
- 2025-01-XX: **统一状态管理器重构**：
  - **新增StateManager（统一状态管理器）**：
    - 所有状态读写的统一入口，统一管理角色、action和步骤的所有状态
    - 提供统一的状态读写接口（getActionStatus、setActionStatus、getStepState、setStepState等）
    - 确保状态操作的一致性和原子性
    - 记录所有状态变更日志
  - **StepwiseDocumentGenerator状态管理集成**：
    - StepwiseDocumentGenerator必须通过StateManager管理步骤状态
    - 所有步骤状态读写都通过StateManager（getStepState、setStepState）
    - 重置时通过StateManager重置所有步骤状态
  - **架构重构**：
    - 所有组件（Role、Action、StepwiseDocumentGenerator）都通过StateManager读写状态
    - 禁止直接访问Repository或数据库
    - WorkflowTracker和StepStateTracker作为StateManager的内部实现
  - **文档更新**：
    - 更新"方案设计"章节，说明统一状态管理器架构
    - 更新"核心类和接口"章节，新增StateManager和StepStateTracker说明
    - 更新"重置流程详解"章节，说明通过StateManager进行重置
    - 更新"注意事项"章节，强调统一状态管理器的使用
