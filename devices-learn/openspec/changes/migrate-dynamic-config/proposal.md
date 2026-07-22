# Proposal: migrate-dynamic-config

## Why

`dynamic_learn_config`、`dynamic_function_config`、`dynamic_dock_config`（含 v2）三组表驱动配置在 `refact-tmp` 仅有空 handler，UseCase 未注入 Repo。需按 `master` 业务逻辑补齐，对齐线上行为。延续 `migrate-learn-config` 确立的 DI 模式。

## What Changes

- DynamicLearnConfig：`BatchCreateDynamicLearnConfig`、`QueryDynamicLearnConfigListApi`、`QueryDynamicLearnConfigShadowList`、`StoreDynamicLearnConfig`、`UpdateDynamicLearnConfigStatus`。
- DynamicFunctionConfig：`QueryDynamicFunctionConfigListApi`、`QueryDynamicFunctionConfigListShadow`、`StoreDynamicFunctionConfig`、`UpdateDynamicFunctionConfigStatus`。
- DynamicDockConfig：`QueryDynamicDockConfigListApi(+V2)`、`QueryDynamicDockConfigListShadow(+V2)`、`StoreDynamicDockConfig(+V2)`、`UpdateDynamicDockConfigStatus(+V2)`。
- 各 UseCase 构造函数注入对应 Repo（`DynamicLearnConfigRepo`/`DynamicFunctionConfigRepo`/`DynamicDockConfigRepo`/`DynamicDockConfigV2Repo`，均已在 data ProviderSet 注册）。
- Data 层优先复用生成 Repo；缓存清理、复杂过滤等按需补自定义方法。`make wire`。

## Impact

- Affected specs: `dynamic-config`
- Affected code: `internal/biz/dynamiclearnconfig_v1_*`、`internal/biz/dynamicfunctionconfig_v1_*`、`internal/biz/dynamicdockconfig_v1_*`、对应 `internal/data/*.go`、`wire_gen.go`（生成）。
- 不改动 schema/proto/API 契约与生成物。本组无外部 RPC；如有统一走 `internal/data/rpc`。
- 行为蓝本：`master:internal/biz/dynamic_learn_config.go`、`dynamic_dock_config.go`、`dynamic_function_config.go` 等。
