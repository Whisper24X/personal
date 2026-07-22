# Design: migrate-learn-config

> 总纲见迁移总设计：`docs/superpowers/specs/2026-06-17-devices-learn-migration-design.md`（拆解策略、DI 模式、生成物保护、技术栈 Profile 等共用约定）。本文件仅记录 learn_config domain 的具体设计。

## 技术栈 Profile

`go`：`build=make build`、`test_single=go test ./internal/biz/... -run TestXxx -v`、`test_all=go test ./... -cover`、`lint=make lint`、`test_mapping=foo.go->foo_test.go`。

## 行为蓝本

源自 `master:internal/biz/learn_config.go`，5 个方法行为见 `proposal.md` 与 `specs/learn-config/spec.md`。关键点：

- CSV 标题须为 `名称|字段名|类型` 三段，类型仅 `string`/`number`；严格校验空行、换行符、列数一致。
- `StoreLearnConfig` 复用 `ParseLearnConfigCsvFile`，按 `id` 空/非空分新增/更新。
- 列表查询 `updatedAt desc`，pageSize 规整（<0 或 >1000 -> 100）。
- 按 key 查询走「本地缓存 -> Redis 缓存 -> 回源回填」三级。

## Data 层策略

- 优先调用 `devices_learn_repo.ILearnConfigRepo` 生成方法。
- 自定义方法仅限：缓存读写（本地 + Redis）、按 key 查询启用配置、按 offset 分页。缓存 Key 集中到 `internal/data/cache/cachekey.go`。

## 风险

- master 使用旧 `model.SLearnConfigSchema`，新框架使用 `devices_learn_repo` 生成模型，迁移时需做 DTO/字段映射，注意 `Data` 字段（JSON）与 proto `google.protobuf.Struct` 的序列化一致性。

## Open Questions

- 本地缓存实现是否已在新框架提供（master 有 `QueryLearnConfigItemByLocalCache`）；若无，确认放置位置。
