# Task / TaskNode 状态机说明

## 文档信息

- 状态：Active
- 适用范围：AINative 任务执行链路
- 目标对象：`task.status`、`task_node.status`
- 当前实现基准：
  - `backend/src/tasks/application/task-status.service.ts`
  - `backend/src/tasks/application/task-interaction.service.ts`
  - `backend/src/tasks/application/task-node-execution.service.ts`
  - `frontend/src/views/tasks/detail.vue`

## 1. 背景

任务状态与任务节点状态都只保留 4 个状态值：

- `todo`
- `in_progress`
- `in_review`
- `done`

其中：

- `task.status` 表示任务级生命周期阶段
- `task_node.status` 表示节点级执行状态

二者虽然共用同一组枚举，但语义不完全相同，前后端不能混用。

## 2. 设计约束

当前状态机遵循以下硬约束：

1. `task.status` 只能保留 4 个状态，不新增任务状态。
2. `task_node.status` 也保留 4 个状态，不新增节点状态。
3. 不新增 `task_node` 的辅助原因字段，例如 `reviewReason`、`reviewType`。
4. `task.status` 从 `in_review` 到 `done`，只能由人工点击“完成”触发。
5. 只有当所有 `task_node.status` 都是 `done` 时，`task.status` 才能进入 `in_review`。
6. 某个节点处于 `in_review`，但并非所有节点都 `done` 时，`task.status` 仍然是 `in_progress`。

## 3. 状态定义

### 3.1 task.status

- `todo`
  - 任务尚未开始
  - 所有节点都处于 `todo`
  - 且任务仍处于初始未推进状态

- `in_progress`
  - 任务仍在处理中
  - 不要求当前一定有节点正在执行
  - 只要任务尚未进入“全部节点完成后的最终人工确认阶段”，通常都属于该状态

- `in_review`
  - 任务已完成所有节点执行
  - 但尚未人工点击“完成”
  - 这是任务级最终确认态，不等同于节点级 `in_review`

- `done`
  - 任务最终完成态
  - 只能由人工完成动作进入

### 3.2 task_node.status

- `todo`
  - 待执行
  - 或被重新排队后待再次执行

- `in_progress`
  - 节点正在执行

- `in_review`
  - 节点需要人工介入
  - 当前复用承载以下几类场景：
    - 节点执行成功但需要审批
    - 节点执行失败
    - 用户取消执行
    - worker 心跳超时

- `done`
  - 节点结果已被接受为完成

## 4. task.status 聚合规则

任务状态由所有节点状态聚合得到，当前规则如下：

1. 如果没有节点，返回 `todo`
2. 如果所有节点都是 `done`
   - 当前任务已是 `done`，则保持 `done`
   - 否则进入 `in_review`
3. 如果所有节点都是 `todo`
   - 当前任务仍是 `todo`，则保持 `todo`
   - 否则返回 `in_progress`
4. 其他所有情况，一律返回 `in_progress`

对应实现位于：

- `backend/src/tasks/application/task-status.service.ts`

### 4.1 规则解释

这套规则意味着：

- `task.in_review` 只保留给“所有节点都完成后的任务级最终确认”
- 节点级 `in_review` 不会直接把任务推成 `task.in_review`
- `task.in_progress` 是“处理中”，不是严格意义上的“执行中”
- `task.todo` 只保留给初始未开始态

### 4.2 典型组合示例

| 节点状态组合 | 当前 task.status | 说明 |
| --- | --- | --- |
| 全部 `todo`，任务当前也是 `todo` | `todo` | 初始未开始 |
| 全部 `todo`，但任务之前已推进过 | `in_progress` | 已重新排队，仍视为处理中 |
| 存在 `in_progress` | `in_progress` | 任务处理中 |
| 存在 `in_review`，且并非全 `done` | `in_progress` | 节点待人工处理，但任务尚未进入最终完成确认 |
| `done + todo` 混合 | `in_progress` | 任务处理中 |
| 全部 `done`，任务当前不是 `done` | `in_review` | 等待人工完成任务 |
| 全部 `done`，任务当前已是 `done` | `done` | 已人工完成 |

## 5. task_node.status 迁移规则

节点状态不通过统一聚合函数计算，而是由调度、执行和交互入口显式迁移。

### 5.1 主要迁移

- `todo -> in_progress`
  - 调度器领取可执行节点时发生

- `in_progress -> todo`
  - 节点循环执行时，下一轮继续排队

- `in_progress -> in_review`
  - 节点成功但需要审批
  - 节点执行失败
  - 用户取消执行
  - worker 心跳超时

- `in_progress -> done`
  - 节点成功，且不需要审批

- `in_review -> done`
  - 人工审批通过

- `in_review -> todo`
  - 人工重试
  - 用户回复导致节点回退

- `done -> todo`
  - repeat
  - reset
  - reply fallback 复用已完成节点

### 5.2 节点级 in_review 的定位

节点级 `in_review` 统一表示“不能自动继续推进，必须人工介入”。

这一定义是当前实现的关键约束。虽然该状态承载多种具体原因，但系统行为保持一致：

- 进入 `in_review` 后，节点不会自动继续执行
- 必须通过人工动作把节点推进到 `done` 或回退到 `todo`

## 6. 任务级动作门禁

### 6.1 execute

任务允许执行，需同时满足：

- 没有 `in_progress` 节点
- 没有 `in_review` 节点
- 存在可执行的 `todo` 节点

这意味着：

- 即使 `task.status = in_progress`
- 只要任务当前仍有可执行 `todo` 节点，且没有 running / review 节点
- 仍允许继续点击“开始”

### 6.2 complete

任务允许完成，需同时满足：

- `task.status = in_review`
- 所有节点都是 `done`
- 当前没有运行中的节点

### 6.3 cancel

- 只对当前 `in_progress` 节点生效
- 取消后节点进入 `in_review`
- 任务随后重新聚合

## 7. 前端展示约束

### 7.1 任务状态文案

任务级文案应使用：

- `todo` -> `待执行`
- `in_progress` -> `处理中`
- `in_review` -> `待完成`
- `done` -> `已完成`

### 7.2 节点状态文案

节点级文案应使用：

- `todo` -> `待执行`
- `in_progress` -> `执行中`
- `in_review` -> `待处理`
- `done` -> `已完成`

### 7.3 是否正在执行

前端判断“是否正在执行”时，必须优先看节点：

- `nodes.some((node) => node.status === 'in_progress')`

不能仅凭 `task.status === in_progress` 判断为“执行中”，因为该状态现在表示的是任务仍在处理中，而不是一定有节点在跑。

## 8. 不变量

下列规则应始终成立：

1. `task.status = done` 时，所有节点必然都是 `done`
2. `task.status = in_review` 时，所有节点必然都是 `done`
3. 只要存在非 `done` 节点，任务就不能进入 `done`
4. 只要存在非 `done` 节点，任务就不能进入 `in_review`
5. 节点级 `in_review` 不等于任务级 `in_review`

## 9. 维护要求

后续若修改状态机，必须同步检查以下位置：

- 后端聚合逻辑：`TaskStatusService`
- 后端动作门禁：`TaskInteractionService`
- 节点执行结果落库：`TaskNodeExecutionService`
- 前端详情页按钮门禁：`frontend/src/views/tasks/detail.vue`
- 前端状态文案：任务与节点文案必须分别维护
- 相关单测：`task-status.service.spec.ts`、`task-interaction.service.spec.ts`、`frontend/src/views/tasks/__tests__/detail.spec.ts`

## 10. 当前结论

当前实现的统一口径是：

- `task.status` 表示任务级生命周期
- `task_node.status` 表示节点级执行状态
- `task.in_review` 是任务完成前的最终人工确认态
- `task_node.in_review` 是节点需要人工介入的中间态

二者不能混为同一语义。
