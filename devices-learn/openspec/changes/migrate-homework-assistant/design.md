# Design: migrate-homework-assistant

> 总纲见 `docs/superpowers/specs/2026-06-17-devices-learn-migration-design.md`。

## 技术栈 Profile

`go`（同总纲）。

## 行为蓝本

`master:internal/biz/homework_assistant.go` 与 `master:internal/data/rpc/yc_oss.go` 等第三方封装、排行 Cron。

## 关键设计

- 第三方（yc_oss、TAL/OpenAI、题目搜索、资源服务）全部落 `internal/data/rpc`，Biz 仅依赖 Repo 接口。
- OSS 上传/签名属于 data 层职责，不下放到 Biz。
- 异步批量搜题：接口创建任务后立即返回，后台执行；排行生成做成可复用方法，接口 `GenerateRankList` 与 Cron 共用。
- 复用 6 个 homework assistant 生成 Repo；仅复杂查询/缓存/签名补自定义方法。

## 风险

- 第三方（OpenAI/TAL）依赖与配额可能阻塞端到端验证：用 mock 隔离，单测覆盖编排与错误分支。
- 异步任务与 Cron 的运行注册需实际纳入 app server。

## Open Questions

- 异步批量搜题的任务存储介质（DB / MQ）；排行 Cron 触发周期与并发保护。
