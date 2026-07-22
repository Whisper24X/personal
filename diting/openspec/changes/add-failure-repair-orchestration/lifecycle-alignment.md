# 生命周期对齐（add-failure-repair-orchestration）

真源：`openspec/changes/refactor-task-lifecycle-model/design.md` 冲突矩阵与 `cross-change-alignment.md`。

本 change 用 failure repair strategy 直接驱动 `blocked`、`needs_human`、`repairing` 等 Task 主状态迁移。对齐 `refactor-task-lifecycle-model` 后 strategy 只产出 `pauseForWait()`、Attempt 阶段推进或 `failTask()`，不直接写入旧主状态名。

## TaskStatus 映射

| 本 change 历史用语 | 新 TaskStatus | 备注 |
| --- | --- | --- |
| `blocked`（strategy `blocked`） | `waiting` | 通过 `pauseForWait()` |
| `needs_human`（strategy `needs_human`） | `waiting` | 通过 `pauseForWait()` |
| `repairing` | `active` | RunAttempt.stage `repairing` |
| `running` / `evaluating` | `active` | RunAttempt.stage `executing` / `evaluating` |
| `queued` | `ready` | 恢复调度 |
| preflight `blocked` → `queued` | `waiting` → `ready` | `resumeTask()` |

## WaitReason 映射（strategy → pauseForWait）

| failure repair strategy | WaitReason.type | 典型 source |
| --- | --- | --- |
| `blocked`（环境、配置、预检） | `environment_blocked` 或 `policy_blocked` | `preflight`、`pull_request-config` |
| `needs_human`（权限、认证、人工决策） | `human_input` | `pull_request-permission`、`failure-repair` |
| `skip_with_record` | 无 Task 迁移 | 仅 metadata |

## 命令映射

| 旧路径 / 历史语义 | 新命令 |
| --- | --- |
| strategy `blocked` | `pauseForWait()` + `environment_blocked` 或 `policy_blocked` |
| strategy `needs_human` | `pauseForWait()` + `human_input` |
| strategy `auto_repair` | 推进 AttemptStage `repairing`，Task 保持 `active` |
| `blocked` → `queued` 恢复 | `resumeTask()` |
| preflight 失败 | `pauseForWait()` + `policy_blocked`（非 Task `blocked`） |

## AttemptStage

`FailureRepairStateTransitions` 中的 `running → needs_human`、`evaluating → blocked`、`repairing → blocked` MUST 重写为：Task 保持 `active` 或经 `pauseForWait()` 进入 `waiting`；执行阶段变化 ONLY 写入 RunAttempt.stage。
