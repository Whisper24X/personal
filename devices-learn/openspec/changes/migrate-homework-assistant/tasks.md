# Tasks: migrate-homework-assistant

> 流水线：Audit -> Code -> Quality。每个实现 task 严格 RED -> GREEN -> REFACTOR。

## 0. Audit

- [ ] 对比 master homework_assistant 业务与 refact-tmp 18 个空 handler
- [ ] 梳理第三方清单（yc_oss、TAL/OpenAI、题目搜索、资源服务），确认 `internal/data/rpc` 落点与接口
- [ ] 梳理异步批量搜题与排行 Cron 的运行机制与 server 注册

## 1. 第三方 RPC（data/rpc）

- [ ] RED/GREEN：恢复/封装 yc_oss、TAL/OpenAI、搜索、资源服务客户端，定义 Repo 接口

## 2. 搜题

- [ ] DI：注入 `HomeworkAssistantRecordRepo` 等
- [ ] RED/GREEN/REFACTOR：SearchQuestion、QueryRecommendTopicsSearch、BatchSearchQuestionAsync、RegisterSearchDevices

## 3. 整页批改

- [ ] RED/GREEN/REFACTOR：HomeworkFullPageCorrection、QueryHomeworkFullPageCorrectionDetailById、UpdateQuestionCorrectionResult

## 4. 记录与报告查询

- [ ] RED/GREEN/REFACTOR：QuerySearchRecordList、QuerySearchResultById、QueryCorrectionRecordList、QueryHomeworkAssistantReport、QueryHomeworkTaskWrongQuestionCount、QueryHomeworkTaskWrongQuestionRectificationInfo

## 5. 错题订正与分数排行

- [ ] DI：注入 `HomeworkAssistantRectificationRecordRepo`、`HomeworkAssistantScoreRepo`、`HomeworkAssistantCorrectionRecordRepo`、`HomeworkAssistantUserStudyStatisticRepo`
- [ ] RED/GREEN/REFACTOR：StoreWrongQuestionRectificationInfo、StoreHomeworkAssistantRectificationScore、StoreHomeworkAssistantTaskScore、QueryHomeworkAssistantScoreRankList、GenerateRankList
- [ ] 恢复排行生成 Cron，纳入 app server

## 6. Quality Gate

- [ ] `make wire`
- [ ] `gofmt -w` 已改文件
- [ ] `go test ./internal/biz/... ./internal/data/... ./internal/server/...`
- [ ] `make lint`
- [ ] `make build` 并清理构建产物
- [ ] tasks.md 全部勾选；第三方全部在 data/rpc；Cron 实际纳入运行；OSS 签名/上传在 data 层
