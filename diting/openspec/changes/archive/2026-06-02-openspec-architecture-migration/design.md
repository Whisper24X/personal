## Context

仓库已有 10 份 `docs/architecture/diting-*.md`，README 直接链接。OpenSpec 已 init（`schema: spec-driven`）但 `openspec/specs/` 为空。用户选择混合基线（spec=已实现）并保留原文档。

## Goals / Non-Goals

**Goals:**

- 建立 `openspec/specs/<capability>/spec.md` 作为工程约束真源
- `openspec/design/` 承载目标态摘要，避免把未实现能力写入 SHALL
- 双轨导航与归档后叙事同步 skill

**Non-Goals:**

- 删除或搬移 `diting-*.md`
- 创建 `docs/runbooks/`、`docs/roadmap/` 独立目录
- 修改应用代码行为

## Decisions

- **双轨**：spec 优先于叙事文档冲突；README 链接不变
- **capability 粒度**：按可测试域拆 13 个 spec，http-api 按资源域写 Requirement
- **归档同步**：`openspec-archive-sync-docs` 在 archive 后更新 diting-*.md 与 README Changelog

## Risks / Trade-offs

- [spec 与叙事漂移] → archive 流程强制/默认跑 sync-docs skill
- [重复维护] → design 用摘要+链接，不全文复制 architecture-description

## Migration Plan

1. 一次性写入 main specs 与 design 摘要
2. 本 change 回顾性归档，无 delta spec（main 已就位）
3. 后续功能变更走标准 change → delta → archive → sync docs

## Open Questions

无
