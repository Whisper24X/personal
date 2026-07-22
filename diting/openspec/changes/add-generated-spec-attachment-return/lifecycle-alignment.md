# 生命周期对齐（add-generated-spec-attachment-return）

真源：`openspec/changes/refactor-task-lifecycle-model/design.md` 冲突矩阵与 `cross-change-alignment.md`。

本 change 在 product workflow 上增加生成 OpenSpec 本地路径返回与附件缺失人工介入；历史 spec 使用 `needs_human`、`blocked`、`queued` 表达等待与恢复。对齐 `refactor-task-lifecycle-model` 后按下列映射阅读与实现。

## TaskStatus 映射

| 本 change 历史用语 | 新 TaskStatus | 备注 |
| --- | --- | --- |
| `queued` | `ready` | 审核修改后等待 product agent |
| `needs_human` | `waiting` | OpenSpec review 或路径元数据人工介入 |
| `blocked` | `waiting` | 路径元数据缺失且 fail-closed |
| `running` / `evaluating` / `repairing` | `active` | 阶段写入 RunAttempt.stage |

## WaitReason 映射

| 场景 | WaitReason |
| --- | --- |
| OpenSpec review 等待（含路径已写入 metadata） | `type=approval`, `source=openspec-review` |
| 生成 OpenSpec 路径缺失、等待 Meegle 回复或人工补充路径 | `type=external_reply`；`externalRef` 指向 Meegle 审核线程或路径干预入口 |
| review 回复 `【需要修改】` 后等待重新生成 | 清除或更新 WaitReason 后 `resumeTask()` → `ready` |

## 命令映射

| 旧路径 / 历史语义 | 新命令 |
| --- | --- |
| 路径缺失进入人工等待 | `pauseForWait()` + WaitReason `external_reply` |
| review 通过后 handoff | `resumeTask()` 或 `completeTask()`（product）+ 创建 programming `draft`/`ready` |
| `【需要修改】` 恢复修订 | `resumeTask()` → `ready` |

## AttemptStage

生成、校验 OpenSpec 与返回路径属于 product agent 执行阶段，MUST 在 RunAttempt `executing` 等阶段记录，不写入 Task 主状态。
