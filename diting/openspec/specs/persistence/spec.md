# Persistence Specification

> 基线：当前实现（截至 2026-06）
> 参考：docs/architecture/diting-database-schema.md

## Purpose

定义 diting 服务端 SQLite 持久化 schema、JSON envelope 约定与迁移入口，保证任务、执行、评测与插件配置数据的一致存储。

## Requirements

### Requirement: SqliteDefaultLocation
系统 SHALL 使用 SQLite 作为默认持久化后端，默认数据库文件路径为 `.diting/sqlite/diting.sqlite`，并 MUST 支持通过环境变量 `DATABASE_FILE` 覆盖。

#### Scenario: DefaultDatabasePath
- **WHEN** 未设置 `DATABASE_FILE` 启动服务
- **THEN** 系统使用 `.diting/sqlite/diting.sqlite` 作为数据库文件

### Requirement: MigrationRunner
系统 SHALL 通过 `npm run migration:run -w apps/server` 执行 SQL 迁移，并在 `schema_migrations` 表记录已应用迁移。

#### Scenario: ApplyMigrations
- **WHEN** 运维执行 migration 命令
- **THEN** 未应用的迁移按序执行并写入 `schema_migrations`

### Requirement: TaskUniqueExternalId
`tasks` 表 SHALL 对 `(source, external_id)` 在 `external_id IS NOT NULL` 时施加唯一约束。

#### Scenario: DuplicateExternalTask
- **WHEN** 插入相同 `source` 与 `external_id` 且两者均非空的任务
- **THEN** 持久化层 MUST 拒绝重复并返回错误

### Requirement: RepairGoalOnePerTask
`repair_goals` 表 SHALL 对 `task_id` 施加唯一约束，每个任务至多一条 repair goal 记录。

#### Scenario: SingleRepairGoal
- **WHEN** 为同一 `task_id` 创建第二条 repair goal
- **THEN** 系统 MUST 按 upsert 或唯一约束语义处理，不得产生多条活跃 goal

### Requirement: JsonEnvelopeStorage
下列 JSON 字段 SHALL 以 `{ schemaVersion, data }` envelope 写入；新写入 MUST 使用 envelope，读取 MUST 兼容历史裸对象或裸数组：

- `tasks.constraints_json`、`tasks.acceptance_criteria_json`、`tasks.metadata_json`
- `agents.labels_json`
- `repair_goals.constraints_json`、`repair_goals.done_when_json`
- `eval_results.report_json`
- `plugin_configs.config_json`

#### Scenario: WriteEnvelope
- **WHEN** repository 写入 `tasks.metadata_json`
- **THEN** 存储内容包含 `schemaVersion` 与 `data` 字段

### Requirement: ExecutionLogsLegacyTable
`execution_logs` 表 SHALL 保留在 schema 中以兼容历史迁移，但运行时 MUST NOT 向该表写入新日志；任务与 trace 日志 MUST 写入仓库根目录 `logs/` 文件体系。

#### Scenario: NoDbLogWrites
- **WHEN** 任务执行产生结构化日志
- **THEN** 日志写入 `logs/` 树而非 `execution_logs` 表

### Requirement: EvalPassedBooleanMapping
`eval_results.passed` SHALL 在 SQLite 中以 integer 存储，repository 层 MUST 映射为 boolean。

#### Scenario: ReadEvalResult
- **WHEN** 查询 eval_results 记录
- **THEN** 调用方收到 boolean 类型的 `passed` 字段

### Requirement: LegacyMigrationScript
系统 SHALL 提供 `npm run migration:legacy -w apps/server`，用于识别旧 NestJS/TypeORM 表、重命名为 `legacy_*`、运行当前迁移并回填新 schema。

#### Scenario: LegacyUpgrade
- **WHEN** 本地存在旧表结构并执行 legacy 迁移脚本
- **THEN** 旧表重命名且新 schema 迁移与回填完成

## Technical Notes

- 实现：`apps/server/src/diting/migrations/`、`apps/server/src/diting/repositories.ts`、`apps/server/src/run-migrations.ts`
- 依赖：configuration（`DATABASE_FILE`）
