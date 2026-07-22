# Tasks: migrate-dynamic-config

> 流水线：Audit -> Code -> Quality。每个实现 task 严格 RED -> GREEN -> REFACTOR。

## 0. Audit

- [ ] 对比 master 三组 dynamic config 业务文件与 refact-tmp 空 handler，列出方法与字段映射
- [ ] 识别生成 Repo 已覆盖能力与需补的自定义方法（缓存清理、过滤）

## 1. DynamicLearnConfig

- [ ] DI：构造函数注入 `DynamicLearnConfigRepo`
- [ ] RED/GREEN/REFACTOR：BatchCreate、QueryListApi、QueryShadowList、Store、UpdateStatus（逐方法）

## 2. DynamicFunctionConfig

- [ ] DI：注入 `DynamicFunctionConfigRepo`
- [ ] RED/GREEN/REFACTOR：QueryListApi、QueryListShadow、Store、UpdateStatus

## 3. DynamicDockConfig（v1 + v2）

- [ ] DI：注入 `DynamicDockConfigRepo` 与 `DynamicDockConfigV2Repo`
- [ ] RED/GREEN/REFACTOR：v1 四方法 + v2 四方法

## 4. Quality Gate

- [ ] `make wire`
- [ ] `gofmt -w` 已改文件
- [ ] `go test ./internal/biz/... ./internal/data/...`
- [ ] `make lint`
- [ ] `make build` 并清理构建产物
- [ ] tasks.md 全部勾选；Service 仅透传、HTTP Gateway 已注册
