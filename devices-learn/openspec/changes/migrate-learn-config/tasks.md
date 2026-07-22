# Tasks: migrate-learn-config

> 流水线（backend-dev「只改业务逻辑」）：Audit -> Code -> Quality
> 每个实现 task 严格 RED -> GREEN -> REFACTOR；测试与实现同目录（`foo.go` -> `foo_test.go`）。

## 0. Audit

- [ ] 对比 `master:internal/biz/learn_config.go` 与 `refact-tmp` 5 个空 handler，确认方法签名与 proto 一致
- [ ] 确认 `internal/data/gorm/devices_learn_repo` 中 `ILearnConfigRepo` 已具备的生成方法，识别需补的自定义方法（缓存、按 key、按 offset）

## 1. 测试基础设施

- [ ] 确认 `internal/biz` 包测试可运行；如缺 mock/testutil，补 `LearnConfigRepo` 的 mock/fake（RED 前置）

## 2. DI 基线（确立迁移 DI 模式）

- [ ] RED：写 `learnconfig_v1_learnconfig_test.go`，断言构造函数注入 Repo 后 UseCase 可用
- [ ] GREEN：修改 `NewLearnConfigV1LearnConfigUseCase` 注入 `LearnConfigRepo`
- [ ] 执行 `make wire`，确认 `wire_gen.go` 编译通过

## 3. ParseLearnConfigCsvFile

- [ ] RED：测试合法 CSV 解析、空文件/非法标题/类型错误/列数不一致的报错分支
- [ ] GREEN：实现 CSV 下载与解析、校验、number/string 转换
- [ ] REFACTOR：抽取校验逻辑，保持可读

## 4. StoreLearnConfig

- [ ] RED：测试 id 为空新增、id 非空更新、id 非空记录不存在三分支
- [ ] GREEN：实现解析 + 新增/更新，Data 层优先复用生成 Repo
- [ ] REFACTOR

## 5. QueryLearnConfigListShadow

- [ ] RED：测试 pageSize 规整（<0 / >1000）、offset 计算、列表与总数返回
- [ ] GREEN：实现分页查询（`updatedAt desc`）
- [ ] REFACTOR

## 6. QueryLearnConfigByKey

- [ ] RED：测试命中本地缓存、命中 Redis 缓存、缓存未命中回源回填
- [ ] GREEN：实现缓存优先 + 回源；缓存 Key 归 `internal/data/cache/cachekey.go`
- [ ] REFACTOR

## 7. UpdateLearnConfigStatus

- [ ] RED：测试状态更新成功并清理缓存
- [ ] GREEN：实现按 id 更新状态 + 缓存清理
- [ ] REFACTOR

## 8. Quality Gate

- [ ] `make wire`
- [ ] `gofmt -w` 已改 Go 文件
- [ ] `go test ./internal/biz/... ./internal/data/...`
- [ ] `make lint`
- [ ] `make build` 并清理多余构建产物
- [ ] `tasks.md` 全部勾选；确认 Service 仅透传、HTTP Gateway 已注册
