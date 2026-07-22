## MODIFIED Requirements

### Requirement: LifecycleTerminologyAlignment
本 change 在 Goal Loop 中插入 completion-gate；历史中 Task 主状态 `repairing` 表示 gate 失败后的 repair 迭代、终态 `done` 表示全流程完成、`needs_human` 表示需人工门禁。对齐 `refactor-task-lifecycle-model` 后：gate 执行 MUST 写入 RunAttempt.stage `completion_checking`；gate 失败 repair MUST 写入 AttemptStage `repairing` 且 Task 保持 `active`；全流程成功 MUST 使用 TaskStatus `succeeded`（非 `done`）；需人工时 MUST 使用 `waiting + WaitReason(type=approval)`；MUST NOT 修改 observability RunStageStatus 的 `done`、`running`、`pending` 步骤枚举。

#### Scenario: LegacyStatusNamesMapToSevenStateModel
- **WHEN** 读者或实现引用本 change 中的历史 Task 状态名
- **THEN** MUST 按 `openspec/changes/refactor-task-lifecycle-model/lifecycle-alignment.md` 或本目录 `lifecycle-alignment.md` 映射到 7 态模型
- **AND** 执行阶段 MUST NOT 写入 Task 主状态
