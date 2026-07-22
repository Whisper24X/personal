# Tasks: migrate-proxy-diagnosis

> 流水线：Audit -> Code -> Quality。每个实现 task 严格 RED -> GREEN -> REFACTOR。

## 0. Audit

- [ ] 对比 master user/desktop/course_learn/diagnosis 业务与 refact-tmp 空 handler
- [ ] 梳理全部外部服务接口，确认 `internal/data/rpc` 落点与 Repo 接口定义
- [ ] 标记需新增/恢复的聚合 Data repo（User、Desktop、Topic/CourseLearn、Diagnosis、ProblemChange）

## 1. 第三方 RPC + 聚合 Repo

- [ ] RED/GREEN：在 `internal/data/rpc` 封装各外部客户端
- [ ] 在 `internal/data` 实现聚合 Repo，组合调用 rpc 客户端

## 2. User

- [ ] DI + RED/GREEN/REFACTOR：QueryIfUserCanRenewal、QueryScholarBasicInfo

## 3. Desktop

- [ ] DI + RED/GREEN/REFACTOR：QueryDailyData

## 4. CourseLearn

- [ ] DI + RED/GREEN/REFACTOR：GetTopicFinishedByCvsIds、GetTopicScoreByIds

## 5. Diagnosis

- [ ] DI + RED/GREEN/REFACTOR：10 个诊断方法（列表/教材/考试选择/结果上报）

## 6. Quality Gate

- [ ] `make wire`
- [ ] `gofmt -w` 已改文件
- [ ] `go test ./internal/biz/... ./internal/data/...`
- [ ] `make lint`
- [ ] `make build` 并清理构建产物
- [ ] tasks.md 全部勾选；第三方调用全部在 data/rpc；Service 仅透传、HTTP Gateway 已注册
