# Proposal: migrate-nps

## Why

NPS 链路在 `refact-tmp` 仅有空 handler，且 MQ consumer、Cron summary 任务、自定义下载路由在新框架尚未恢复。需按 master 业务全量补齐 NPS 弹窗、提交、汇总与多维度统计查询，并恢复异步与定时链路。

## What Changes

- 查询/提交：`GetNpsPopup`、`SubmitNpsAnswer`、`ListNpsShadow`。
- 多维度统计 shadow：`GetNpsTrendListShadow`、`GetStageNpsTrendListShadow`、`GetNpsWordCloudShadow`、`GetNpsDeepUseUserListShadow`、`GetNpsNewOldUserListShadow`、`GetNpsModelDeviceListShadow`、`GetNpsDesktopVersionListShadow`、`GetNpsOnionVersionListShadow`。
- 汇总：`GenerateNpsSummaryShadow`。
- 异步/定时：恢复 NPS MQ consumer 与 Cron summary 任务，纳入 Kratos app server。
- 自定义下载路由：在 `internal/server/http.go` 补齐 NPS 下载自定义 HTTP 注册（如需）。
- UseCase 注入 `NpRepo`、`NpsSummaryRepo`、`NpsGoLearnSceneNumRepo`。`make wire`。

## Impact

- Affected specs: `nps`
- Affected code: `internal/biz/nps_v1_*`、`internal/data/{np,npssummary,npsgolearnscenenum}.go`、`internal/server/{http,cron,rabbitmq}.go`、`wire_gen.go`（生成）。
- 不改动 schema/proto/API 契约与生成物；若下载路由需新增非 proto HTTP，归入 server 自定义注册。
- 行为蓝本：`master:internal/biz/{nps,nps_case,nps_go_learn_scene_num}.go` 与对应 data / server 注册。
