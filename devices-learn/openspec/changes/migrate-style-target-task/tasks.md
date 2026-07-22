# Tasks: migrate-style-target-task

> 流水线：Audit -> Code -> Quality。每个实现 task 严格 RED -> GREEN -> REFACTOR。

## 0. Audit

- [ ] 对比 master style/target/task 业务文件与 refact-tmp 空 handler
- [ ] 梳理第三方任务系统接口清单，确认 `internal/data/rpc` 落点与接口定义
- [ ] 标记「创建 style/target 后触发任务完成」的联动副作用与容错策略

## 1. 第三方 RPC（data/rpc）

- [ ] RED/GREEN：在 `internal/data/rpc` 封装任务系统 HTTP/gRPC 客户端，定义 Repo 接口
- [ ] 在 `internal/data` 的 Task Repo 中组合调用 rpc 客户端

## 2. Style

- [ ] DI：注入 `UserLearnStyleRepo` 与 Task 接口
- [ ] RED/GREEN/REFACTOR：CreateUserStyle（含触发任务完成）、GetUserStyle、GetLearnStylePaper

## 3. Target

- [ ] DI：注入 `UserLearnTargetRepo` 与 Task 接口
- [ ] RED/GREEN/REFACTOR：CreateUserLearnTarget（含触发任务完成）、GetUserLearnTarget、GetSchoolScoresTotalSubject

## 4. Task

- [ ] RED/GREEN/REFACTOR：TaskFinish、TaskListApi、TaskReward（经 rpc 层）

## 5. Quality Gate

- [ ] `make wire`
- [ ] `gofmt -w` 已改文件
- [ ] `go test ./internal/biz/... ./internal/data/...`
- [ ] `make lint`
- [ ] `make build` 并清理构建产物
- [ ] tasks.md 全部勾选；Service 仅透传、HTTP Gateway 已注册；第三方调用全部在 data/rpc
