# Proposal: migrate-homework-assistant

## Why

Homework Assistant 是最复杂的 domain：搜题、整页批改、错题订正、记录查询、分数排行、异步批量搜题、设备注册等，依赖 yc_oss、TAL/OpenAI、题目搜索、资源服务等多个第三方，并含排行生成 Cron。`refact-tmp` 仅有空 handler，第三方调用与 Cron 尚未恢复。需按 master 全量补齐。

## What Changes

- 搜题：`SearchQuestion`、`QueryRecommendTopicsSearch`、`BatchSearchQuestionAsync`（异步）、`RegisterSearchDevices`。
- 批改：`HomeworkFullPageCorrection`、`QueryHomeworkFullPageCorrectionDetailById`、`UpdateQuestionCorrectionResult`。
- 记录查询：`QuerySearchRecordList`、`QuerySearchResultById`、`QueryCorrectionRecordList`、`QueryHomeworkAssistantReport`、`QueryHomeworkTaskWrongQuestionCount`、`QueryHomeworkTaskWrongQuestionRectificationInfo`。
- 错题订正：`StoreWrongQuestionRectificationInfo`、`StoreHomeworkAssistantRectificationScore`。
- 分数与排行：`StoreHomeworkAssistantTaskScore`、`QueryHomeworkAssistantScoreRankList`、`GenerateRankList`（含排行生成 Cron）。
- 第三方（yc_oss、TAL/OpenAI、题目搜索、资源服务）全部封装到 `internal/data/rpc`；UseCase 注入对应 Repo。`make wire`。

## Impact

- Affected specs: `homework-assistant`
- Affected code: `internal/biz/homeworkassistant_v1_*`、对应 `internal/data/homeworkassistant*.go`、`internal/data/rpc/*`（yc_oss/TAL/OpenAI/搜索/资源）、`internal/server/cron.go`（排行 Cron）、`wire_gen.go`（生成）。
- 不改动 schema/proto/API 契约与生成物；OSS 签名/上传走 data 层。
- 行为蓝本：`master:internal/biz/homework_assistant.go`、`master:internal/data/rpc/yc_oss.go` 等。
