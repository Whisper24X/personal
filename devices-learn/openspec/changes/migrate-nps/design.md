# Design: migrate-nps

> 总纲见 `docs/superpowers/specs/2026-06-17-devices-learn-migration-design.md`。

## 技术栈 Profile

`go`（同总纲）。

## 行为蓝本

`master:internal/biz/{nps,nps_case,nps_go_learn_scene_num}.go` 及对应 data / MQ consumer / Cron / 下载路由注册。

## 关键设计

- 汇总逻辑做成可复用方法，接口 `GenerateNpsSummaryShadow` 与 Cron 任务共用。
- MQ consumer 与 Cron server 必须实际纳入 Kratos app server 列表运行（避免只定义不运行）。
- 下载路由若非 proto 定义，走 server 层自定义 HTTP 注册，不改 proto。
- 多维度统计查询优先用生成 Repo + 必要的自定义聚合方法。

## 风险

- MQ/Cron 在新框架的注册方式可能与 master 不同，需先确认 server 装配模式再迁移。

## Open Questions

- 下载路由的鉴权与导出格式；MQ 消息体契约是否与 master 完全一致。
