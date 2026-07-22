# 插件开发规范索引

插件实现的**完整指南**与示例见 [`docs/architecture/diting-plugin-development.md`](../../architecture/diting-plugin-development.md)；**工程规范真源**见 [`openspec/specs/plugins/spec.md`](../../../openspec/specs/plugins/spec.md)。

## 文档

- [implementation-constraints.md](./implementation-constraints.md) — 各 kind 最小约束与外置注册要点（一页清单）

## 默认内置栈

宿主按 kind 顺序编排：`log` → `task-integration` → `environment` → `execution` → `quality` → `observability-governance`。外置包通过 `DITING_PLUGIN_*_PACKAGE` **整 kind 替换**内置实现（配置非空时该 kind 仅保留外置返回的单个插件）。

详见根 [`README.md`](../../../README.md)「内置插件栈」与架构文档。
