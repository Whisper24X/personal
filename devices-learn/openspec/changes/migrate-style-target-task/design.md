# Design: migrate-style-target-task

> 总纲见 `docs/superpowers/specs/2026-06-17-devices-learn-migration-design.md`。

## 技术栈 Profile

`go`（同总纲）。

## 行为蓝本

`master:internal/biz/style.go`、`target.go`、`task.go`。style/target 基于本地表（`user_learn_style`、`user_learn_target`），task 主要代理第三方任务系统。

## 关键设计

- 第三方任务系统接口一律落 `internal/data/rpc`，Biz 仅依赖 Repo 接口，不直接发起 HTTP/gRPC。
- 「创建 style/target 成功 -> 触发任务完成」的副作用放在 Biz 编排层，调用 Task Repo；按 master 容错策略，任务侧失败不回滚主流程。

## 风险

- 跨 domain 联动的事务边界与容错需严格对齐 master，避免重复触发或漏触发。

## Open Questions

- 任务完成触发是否需幂等保护（防重复完成）。
