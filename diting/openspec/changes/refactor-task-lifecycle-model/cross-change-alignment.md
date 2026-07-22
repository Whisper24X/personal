# 跨 Change 生命周期对齐（refactor-task-lifecycle-model）

真源：`design.md` 冲突矩阵与历史状态迁移规则。

## 全局 TaskStatus 映射

| 旧 Task 主状态 | 新 Task 主状态 | 备注 |
| --- | --- | --- |
| `created` / `validated` / `pending` | `draft` | 入队由 `submitTask()` 推进 |
| `queued` | `ready` | 可调度 |
| `running` / `evaluating` / `repairing` | `active` | 执行阶段写入 RunAttempt.stage |
| `needs_human` / `blocked` | `waiting` | 原因写入 WaitReason |
| `done` | `succeeded` | 终态 |
| `failed` / `cancelled` | 不变 | |

## 命令映射

| 旧命令/路径 | 新命令 |
| --- | --- |
| `queueTask` / validate+queue | `submitTask` |
| `recoverTask` / blocked→queued | `resumeTask` |
| `blockTask` / `markNeedsHuman` | `pauseForWait` |
| `retryTask` from failed | `retryTask`（仅 `failed→ready`） |
| claim SQL | `ready→active` + RunAttempt |

## 各活跃 change 专用映射

见各 change 目录下 `lifecycle-alignment.md`。
