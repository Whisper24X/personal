# 生命周期对齐（add-meegle-child-issue-repair-loop）

真源：`openspec/changes/refactor-task-lifecycle-model/design.md` 冲突矩阵与 `cross-change-alignment.md`。

本 change 用 Meegle 父 issue 下「任务」子工单承载人工修复方案；历史 spec 使用 `needs_human` → `queued` 表达等待与恢复。对齐 `refactor-task-lifecycle-model` 后按下列映射阅读与实现。

## TaskStatus 映射

| 本 change 历史用语 | 新 TaskStatus | 备注 |
| --- | --- | --- |
| `needs_human` | `waiting` | 等待子工单 `【开发中】` 前缀描述 |
| `blocked` | `waiting` | 子工单创建失败或 Meegle 能力不可用 |
| `queued` | `ready` | 子工单方案就绪后恢复父任务调度 |
| `repairing` | `active` | repair 迭代为 RunAttempt.stage `repairing` |

## WaitReason 映射

| 场景 | WaitReason |
| --- | --- |
| 等待 Meegle 子 issue 人工方案 | `type=external_reply`, `source=meegle-child-issue`；`externalRef` 为子 issue ID 或幂等键 |
| 子工单创建失败 | `type=external_reply` 或 `environment_blocked`；`recoverableBy=integration` 或 `operator` |

## 命令映射

| 旧路径 / 历史语义 | 新命令 |
| --- | --- |
| quality failed 进入人工等待 | `pauseForWait()` + WaitReason `external_reply` |
| 子描述 `【开发中】` 就绪、父任务恢复 | `resumeTask()` → `ready`（非 `queued`） |
| 显式同步 `ready: true` | 等价于 `resumeTask()` 成功 |

## AttemptStage

父任务在 repair loop 中 MUST 保持 Task `active`，repair goal 与迭代阶段写入 RunAttempt `repairing`；`needs_human` 语义仅通过 `waiting + WaitReason` 表达，repair goal 状态字段对齐 WaitReason 而非旧 Task 主状态名。
