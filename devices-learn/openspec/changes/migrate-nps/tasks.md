# Tasks: migrate-nps

> 流水线：Audit -> Code -> Quality。每个实现 task 严格 RED -> GREEN -> REFACTOR。

## 0. Audit

- [ ] 对比 master nps/nps_case/nps_go_learn_scene_num 业务与 refact-tmp 空 handler
- [ ] 梳理 MQ consumer、Cron summary、下载路由在 master 的注册方式，确认新框架 `internal/server/{cron,rabbitmq,http}.go` 落点
- [ ] 识别需补的自定义 Data 方法（多维度聚合查询、缓存）

## 1. 查询与提交

- [ ] DI：注入 `NpRepo`、`NpsSummaryRepo`、`NpsGoLearnSceneNumRepo`
- [ ] RED/GREEN/REFACTOR：GetNpsPopup、SubmitNpsAnswer、ListNpsShadow

## 2. 多维度统计

- [ ] RED/GREEN/REFACTOR：Trend / StageTrend / WordCloud / DeepUse / NewOld / ModelDevice / DesktopVersion / OnionVersion 共 8 个 shadow 查询

## 3. 汇总

- [ ] RED/GREEN/REFACTOR：GenerateNpsSummaryShadow（接口 + 可复用于 Cron）

## 4. 异步与下载链路

- [ ] 恢复 NPS MQ consumer，注册到 RabbitMQ server
- [ ] 恢复 Cron summary 任务，调用汇总逻辑
- [ ] 补齐下载自定义 HTTP 路由（如 master 提供）
- [ ] 确认 Cron/RabbitMQ server 已纳入 `cmd/devices-learn/main.go` app server 列表

## 5. Quality Gate

- [ ] `make wire`
- [ ] `gofmt -w` 已改文件
- [ ] `go test ./internal/biz/... ./internal/data/... ./internal/server/...`
- [ ] `make lint`
- [ ] `make build` 并清理构建产物
- [ ] tasks.md 全部勾选；MQ/Cron 实际纳入运行而非仅定义
