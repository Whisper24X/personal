# Workflow Configuration Migration Guide

## 概述

本文档说明当 `defaultWorkflowConfig.ts` 中的配置发生变化（新增/删除/修改 actions 或 roles）时，如何正确执行数据迁移。

## 迁移脚本

### 主要迁移脚本

**`migrate_workflow_config_from_default.ts`** - 通用迁移脚本

这个脚本会自动检测数据库配置与 `defaultWorkflowConfig.ts` 中标准配置的差异，并执行迁移：

- ✅ 更新 `application_workflows.workflow_config`
- ✅ 更新 `workflow_executions.workflow_snapshot`
- ✅ 智能映射 `workflow_executions.steps`
- ✅ 调整 `workflow_executions.current_position`

**使用方法**:
```bash
pnpm exec tsx src/database/migrations/migrate_workflow_config_from_default.ts
```

### 特殊迁移脚本

**`update_workflows_breakdown_tasks.ts`** 和 **`update_workflow_executions_breakdown_tasks.ts`**

这些是针对特定 action（`BreakdownTasks`）替换的迁移脚本。如果未来有类似的 action 替换需求，可以参考这些脚本创建新的迁移。

## 迁移流程

### 1. 配置变更前的准备

1. **备份数据库**
   ```bash
   pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **检查当前配置**
   - 查看 `defaultWorkflowConfig.ts` 中的当前配置
   - 确认要进行的变更（新增/删除/修改）

3. **评估影响范围**
   - 检查是否有运行中的 workflow executions
   - 评估变更对现有数据的影响

### 2. 代码变更

1. **更新 `defaultWorkflowConfig.ts`**
   - 修改 `defaultWorkflowConfig` 中的 roles 和 actions
   - 更新 `actionRelevanceMap`（如果相关）

2. **更新相关代码**
   - 检查并更新所有引用配置的代码
   - 确保没有硬编码的 action/role 名称（除了必要的业务逻辑）

3. **运行测试**
   - 确保代码变更不会破坏现有功能
   - 测试新的配置是否正确工作

### 3. 执行迁移

1. **运行通用迁移脚本**
   ```bash
   pnpm exec tsx src/database/migrations/migrate_workflow_config_from_default.ts
   ```

2. **验证迁移结果**
   - 检查迁移脚本的输出日志
   - 验证数据库中的数据是否正确更新
   - 检查是否有错误或警告

3. **手动验证（如需要）**
   ```sql
   -- 检查 workflow configs
   SELECT id, name, workflow_config FROM application_workflows LIMIT 5;
   
   -- 检查 workflow executions
   SELECT id, workflow_snapshot, steps, current_position 
   FROM workflow_executions 
   WHERE state = 'running' 
   LIMIT 5;
   ```

### 4. 特殊情况处理

#### 新增 Action

如果新增了 action：

1. ✅ 迁移脚本会自动检测并添加到 workflow configs
2. ✅ 迁移脚本会自动为新的 action 创建 pending steps
3. ⚠️ 需要手动检查 `actionRelevanceMap` 是否需要更新
4. ⚠️ 需要手动检查 `RoleActionExecutor` 是否需要特殊处理逻辑

#### 删除 Action

如果删除了 action：

1. ✅ 迁移脚本会自动从 workflow configs 中移除
2. ✅ 迁移脚本会智能处理 steps：
   - COMPLETED/RUNNING 状态的 steps → 映射到角色的第一个 action
   - PENDING/FAILED 状态的 steps → 删除
3. ⚠️ 需要手动清理 `actionRelevanceMap` 中的相关条目
4. ⚠️ 需要手动清理 `RoleActionExecutor` 中的相关处理逻辑

#### 修改 Action 顺序

如果修改了 action 的顺序：

1. ✅ 迁移脚本会自动更新 workflow configs 中的顺序
2. ✅ 迁移脚本会更新 steps 中的 `actionIndex`
3. ✅ 迁移脚本会调整 `current_position` 如果指向的位置发生变化

#### 新增 Role

如果新增了 role：

1. ✅ 迁移脚本会自动添加到 workflow configs
2. ✅ 迁移脚本会自动创建对应的 steps
3. ⚠️ 需要确保 `role_definitions` 表中存在对应的角色定义
4. ⚠️ 需要确保 `action_definitions` 表中存在角色使用的所有 actions

#### 删除 Role

如果删除了 role：

1. ✅ 迁移脚本会自动从 workflow configs 中移除
2. ✅ 迁移脚本会删除该角色的所有 steps
3. ⚠️ 需要手动检查是否有运行中的 executions 使用了该角色

## 无法用迁移脚本修复的问题

以下问题需要手动修复代码，迁移脚本无法处理：

### 1. 运行时硬编码逻辑

**位置**: 
- `WorkflowExecutor.ts` - 已修复，现在使用 `actionRelevanceMap`
- `RoleActionExecutor.ts` - 包含必要的业务逻辑硬编码（已添加注释说明）

**处理方式**: 
- 检查这些文件中的硬编码逻辑
- 如果新增/删除 action，需要手动更新相关代码

### 2. 特殊处理逻辑

**位置**: 
- `WorkflowExecutor.ts` - 第一个 action 的特殊处理（已改为动态检测）
- `RoleActionExecutor.ts` - 不同 action 的特殊输入处理

**处理方式**: 
- 如果新增的 action 需要特殊处理，需要手动添加逻辑
- 如果删除的 action 有特殊处理，需要手动移除相关代码

### 3. 前端代码

**位置**: `frontend/src/views/platform/PlatformWorkflow.vue`

**处理方式**: 
- 前端代码通常是动态读取配置，一般不需要修改
- 如果 workflow config 结构大幅变化，可能需要更新前端显示逻辑

## 检查清单

在执行迁移前，请确认：

- [ ] 数据库已备份
- [ ] `defaultWorkflowConfig.ts` 已更新
- [ ] `actionRelevanceMap` 已更新（如需要）
- [ ] 所有硬编码的 action/role 引用已检查
- [ ] 代码已通过测试
- [ ] 迁移脚本已运行
- [ ] 迁移结果已验证
- [ ] 运行中的 executions 状态正常

## 常见问题

### Q: 迁移脚本会修改运行中的 executions 吗？

A: 是的，迁移脚本会更新所有 executions 的 `workflow_snapshot`、`steps` 和 `current_position`。但是：
- 对于 COMPLETED 状态的 steps，会智能映射到新配置
- 对于 RUNNING 状态的 executions，会调整 current_position 到有效位置
- 对于 PENDING/FAILED 状态的 steps，如果对应的 action 被删除，会被移除

### Q: 如果迁移失败怎么办？

A: 
1. 迁移脚本使用事务，失败会自动回滚
2. 检查错误日志，找出问题原因
3. 修复问题后重新运行迁移脚本
4. 如果数据已损坏，从备份恢复

### Q: 可以多次运行迁移脚本吗？

A: 可以。迁移脚本是幂等的，多次运行不会造成问题。脚本会：
- 比较当前配置和标准配置
- 只在有差异时才更新
- 不会重复更新相同的数据

## 最佳实践

1. **统一配置源**: 所有配置都应该从 `defaultWorkflowConfig.ts` 导入
2. **避免硬编码**: 除非是必要的业务逻辑，否则避免硬编码 action/role 名称
3. **添加注释**: 对于必要的硬编码，添加注释说明原因
4. **测试迁移**: 在开发环境先测试迁移脚本
5. **文档更新**: 配置变更时同步更新相关文档

## 相关文件

- `config/defaultWorkflowConfig.ts` - 配置源文件（项目根目录）
- `backend/src/database/migrations/migrate_workflow_config_from_default.ts` - 通用迁移脚本
- `backend/src/workflow/WorkflowExecutor.ts` - 工作流执行器
- `backend/src/roles/RoleActionExecutor.ts` - Action 执行器
- `backend/src/api/controllers/RoleActionExecutionController.ts` - Action 执行控制器
