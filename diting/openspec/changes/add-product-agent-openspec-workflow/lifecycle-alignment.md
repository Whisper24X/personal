# 生命周期对齐（add-product-agent-openspec-workflow）

真源：`openspec/changes/refactor-task-lifecycle-model/design.md` 冲突矩阵与 `cross-change-alignment.md`。

本 change 用 product task 的 OpenSpec 生成、审核与 programming handoff 描述任务流转；历史 spec 使用 `queued`、`needs_human`、`blocked` 等旧 Task 主状态名。对齐 `refactor-task-lifecycle-model` 后按下列映射阅读与实现。

## TaskStatus 映射

| 本 change 历史用语 | 新 TaskStatus | 备注 |
| --- | --- | --- |
| `created` / `validated` / `pending` | `draft` | 入队由 `submitTask()` 推进 |
| `queued` | `ready` | product agent 可调度或审核后重新修订 |
| `running` / `evaluating` / `repairing` | `active` | 阶段写入 RunAttempt.stage，不写入 Task 主状态 |
| `needs_human` | `waiting` | OpenSpec review 或人工门禁 |
| `blocked` | `waiting` | 预检失败或 programming 缺少 approved OpenSpec |
| `done` | `succeeded` | 终态 |

## WaitReason 映射

| 场景 | WaitReason |
| --- | --- |
| OpenSpec review 等待（product driver 创建审核入口后） | `type=approval`, `source=openspec-review`；`externalRef` 指向 Meegle 审核入口或 OpenSpec revision |
| 预检失败、缺少 approved OpenSpec | `type=policy_blocked` 或 `environment_blocked`（按失败类别） |
| 人工补充信息（非 review） | `type=human_input` |

## 命令映射

| 旧路径 / 历史语义 | 新命令 |
| --- | --- |
| product task 进入 OpenSpec review | `pauseForWait()` + WaitReason `approval` / `openspec-review` |
| `【需要修改】` 后恢复 product agent 修订 | `resumeTask()` → `ready`（非 `queued`） |
| `blocked` → `queued` 预检恢复 | `resumeTask()` 或 `submitTask()` |
| `POST /api/tasks/:id/needs-human` | `pauseForWait()` |
| programming handoff 后继续调度 | `resumeTask()` → `ready` |

## AttemptStage

product agent 执行、quality 评测与 repair 迭代 MUST 推进当前 RunAttempt 的 `AttemptStage`（如 `executing`、`evaluating`、`repairing`），Task 主状态保持 `active`。
