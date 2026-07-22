# Design: migrate-proxy-diagnosis

> 总纲见 `docs/superpowers/specs/2026-06-17-devices-learn-migration-design.md`。

## 技术栈 Profile

`go`（同总纲）。

## 行为蓝本

`master:internal/biz/{user,desktop,course_learn,diagnosis}.go` 与 `master:internal/data/diagnosis.go` 等。本组以无表/聚合/代理查询为主，核心是组合多个外部后端结果。

## 关键设计

- 所有外部 HTTP/gRPC 客户端落 `internal/data/rpc`，按服务划分文件。
- `internal/data` 内的聚合 Repo 负责编排多个 rpc 调用与 DTO 拼装，Biz 仅依赖 Repo 接口。
- 不为单纯转发再包一层；仅聚合/转换才在 Data 增方法。

## 风险

- 外部服务多、测试环境可能阻塞端到端验证：用 mock/fake 隔离 rpc，单测覆盖聚合与错误分支；端到端阻塞时记录阻塞项。

## Open Questions

- `UserExamFinishNotice`/`UserExamResultReport` 是否为外部回调入口（影响鉴权与幂等设计）。
