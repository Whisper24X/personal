# 生命周期对齐（add-openspec-autonomous-completion-gate）

真源：`openspec/changes/refactor-task-lifecycle-model/design.md` 冲突矩阵与 `cross-change-alignment.md`。

本 change 在 Goal Loop 中插入 completion-gate；历史 spec 用 Task 主状态 `repairing`、`done`、`needs_human` 描述 gate 与终态。对齐 `refactor-task-lifecycle-model` 后 gate 与 repair 写入 AttemptStage，终态为 `succeeded`，人工门禁为 `waiting + approval`。

## TaskStatus 映射

| 本 change 历史用语 | 新 TaskStatus | 备注 |
| --- | --- | --- |
| `done` | `succeeded` | 质量门禁与 PR 完成后终态 |
| `repairing` | `active` | 非 Task 主状态 |
| `needs_human` | `waiting` | 仅当任务匹配人工介入规则时 |
| `running` / `evaluating` | `active` | Attempt 阶段表达 |

## AttemptStage 映射

| 本 change 历史用语 | AttemptStage |
| --- | --- |
| completion-gate 执行 | `completion_checking` |
| gate 失败后 repair 迭代 | `repairing` |
| quality 评测 | `evaluating` |
| PR 创建 | `creating_pr` |
| 全流程成功 | `completed`（Attempt）+ Task `succeeded` |

## WaitReason 映射

| 场景 | WaitReason |
| --- | --- |
| completion-gate 预算耗尽且匹配人工策略 | `type=approval` 或 `human_input`（按规则） |
| 禁止静默跳过 gate 的人工确认 | `type=approval`, `source=completion-gate` |

## 命令映射

| 旧路径 / 历史语义 | 新命令 |
| --- | --- |
| gate failure 启动 repair | 推进 AttemptStage `repairing`；Task 保持 `active` |
| gate 通过并完成全流程 | `completeTask()` → `succeeded` |
| MUST NOT 结束为 `done` | MUST NOT 写入 Task `succeeded` 除非质量门禁通过 |
| repair 预算耗尽需人工 | `pauseForWait()` + WaitReason `approval` |

## 观测说明

RunStageStatus 的 `done` / `running` / `pending`（observability spec）表示步骤观测状态，与 TaskStatus 无关；本对齐仅约束 Task 主状态与 AttemptStage，不修改 observability 步骤枚举。
