# Persistence Delta

## MODIFIED Requirements

### Requirement: JsonEnvelopeStorage
下列 JSON 字段 SHALL 以 `{ schemaVersion, data }` envelope 写入；新写入 MUST 使用 envelope，读取 MUST 兼容历史裸对象或裸数组：

- `tasks.constraints_json`、`tasks.acceptance_criteria_json`、`tasks.metadata_json`
- `agents.labels_json`
- `repair_goals.constraints_json`、`repair_goals.done_when_json`、`repair_goals.metadata_json`
- `eval_results.report_json`
- `plugin_configs.config_json`

#### Scenario: WriteRepairGoalMetadataEnvelope
- **WHEN** repository 写入 `repair_goals.metadata_json`
- **THEN** 存储内容包含 `schemaVersion` 与 `data` 字段

## ADDED Requirements

### Requirement: RepairGoalMetadata
`repair_goals` 表 SHALL 持久化 `metadata_json` 字段，用于区分 repair 来源并保存 completion-gate 上下文；缺失历史字段读取时 MUST fallback 为 `{}`。

#### Scenario: CompletionGateMetadataRoundTrip
- **WHEN** completion-gate failure 创建 repair goal
- **THEN** repository 保存 `metadata.repairSource = "completion-gate"`
- **AND** 后续读取 repair goal 时返回相同 metadata

#### Scenario: LegacyRepairGoalMetadataFallback
- **WHEN** 旧数据库行缺少 `metadata_json`
- **THEN** repository 读取的 `RepairGoal.metadata` 为 `{}`

### Requirement: RepairGoalMetadataMigration
系统 SHALL 提供增量 migration 为既有 `repair_goals` 表增加 `metadata_json`，默认 envelope 数据为 `{}`。

#### Scenario: ApplyRepairGoalMetadataMigration
- **WHEN** 运维执行 migration
- **THEN** 既有数据库获得 `repair_goals.metadata_json` 字段
- **AND** 新字段默认值为 `{ schemaVersion, data: {} }`
