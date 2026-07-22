# Proposal: migrate-learn-config

## Why

`refact-tmp` 分支的 `learn_config` domain 已生成 proto、GORM repo、service 与 `internal/biz` 空 handler，但 5 个 RPC 方法当前全部返回空响应，`LearnConfigV1LearnConfigUseCase` 构造函数只注入 `logger`、未注入 Repo。需要按 `master` 分支业务逻辑全量补齐，使该 domain 在新框架下行为对齐线上。

本 change 同时作为整个迁移的 **pilot**：确立「UseCase 注入 Repo + `make wire`」的依赖注入模式，供后续 5 个 change 套用。

## What Changes

- 为 `LearnConfigV1LearnConfigUseCase` 注入 `LearnConfigRepo`（已在 `internal/data/data.go` ProviderSet 注册），替换「只有 logger」的构造函数。
- 按 `master:internal/biz/learn_config.go` 补齐 5 个 RPC 业务逻辑：
  - `ParseLearnConfigCsvFile`：下载并解析 CSV，校验标题格式（`视频ID|id|string`）、字段类型（string/number）、空行/换行符，输出结构化数据。
  - `StoreLearnConfig`：解析 CSV 后按 `id` 为空与否执行新增或更新。
  - `QueryLearnConfigListShadow`：分页查询（默认/上限 pageSize 处理、`updatedAt desc` 排序、总数返回）。
  - `QueryLearnConfigByKey`：按 key 列表查询，含本地缓存 + Redis 缓存路径。
  - `UpdateLearnConfigStatus`：按 id 更新状态（-1 删除 / 1 启用）。
- Data 层 `internal/data/learnconfig.go` 优先复用生成 Repo；仅缓存读写、按 offset 查询、按 key 查询等生成 Repo 未覆盖的能力补自定义方法。
- 依赖注入变化后执行 `make wire`。

## Impact

- Affected specs: `learn-config`（新增能力规格）
- Affected code:
  - `internal/biz/learnconfig_v1_learnconfig.go`（构造函数注入 Repo）
  - `internal/biz/learnconfig_v1_learnconfig_*.go`（5 个 handler 实现）
  - `internal/data/learnconfig.go`（自定义 Data 方法，按需）
  - `cmd/devices-learn/wire_gen.go`（`make wire` 生成，不手改）
- 不改动：数据库 schema、`api/learn_config/v1/*.proto`、API 契约、生成物文件。
- 第三方接口：本 domain 无外部 RPC（CSV 通过文件 URL 读取），如需远程读取统一走 `internal/data/rpc`。
