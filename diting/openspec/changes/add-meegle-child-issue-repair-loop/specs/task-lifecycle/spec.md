## MODIFIED Requirements

### Requirement: LifecycleTerminologyAlignment
本 change 用 Meegle 父 issue 下「任务」子工单承载人工修复方案；历史中 `needs_human` 表示等待子工单 `【开发中】` 前缀描述、`queued` 表示子方案就绪后恢复父任务调度。对齐 `refactor-task-lifecycle-model` 后：子工单等待 MUST 使用 `waiting + WaitReason(type=external_reply, source=meegle-child-issue, externalRef=<child issue>)`；子描述就绪后 MUST 使用 `resumeTask()` 进入 `ready`（非 `queued`）；`repairing` MUST 为 RunAttempt.stage，Task 主状态保持 `active`；`needs_human` 与 `blocked` 读写为 `waiting`。

#### Scenario: LegacyStatusNamesMapToSevenStateModel
- **WHEN** 读者或实现引用本 change 中的历史 Task 状态名
- **THEN** MUST 按 `openspec/changes/refactor-task-lifecycle-model/lifecycle-alignment.md` 或本目录 `lifecycle-alignment.md` 映射到 7 态模型
- **AND** 执行阶段 MUST NOT 写入 Task 主状态
