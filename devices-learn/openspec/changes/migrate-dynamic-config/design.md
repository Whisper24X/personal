# Design: migrate-dynamic-config

> 总纲见 `docs/superpowers/specs/2026-06-17-devices-learn-migration-design.md`。

## 技术栈 Profile

`go`（同总纲）。

## 行为蓝本

`master:internal/biz/dynamic_learn_config.go`、`dynamic_dock_config.go`、`dynamic_function_config.go`。三组均为表驱动配置：`shadow` 接口面向后台（全量 + 分页），`api` 接口面向设备（仅启用项）。

## Data 层策略

优先复用 `devices_learn_repo` 生成 Repo；自定义方法仅限缓存清理与复杂过滤。dock_config v2 使用独立 `DynamicDockConfigV2Repo`，v1/v2 逻辑隔离。

## 风险

- v1/v2 dock 配置字段差异需逐字段核对；shadow 与 api 过滤规则不可混用。

## Open Questions

- 各配置的缓存清理范围（按 key / 全量）以 master 实现为准确认。
