# Runtime Gaps

> 来源：[docs/architecture/diting-technical-design.md](../../docs/architecture/diting-technical-design.md)「Current architecture gaps」与 Implementation Notes

本文档记录**当前实现与目标架构的差距**，供 roadmap 与变更 proposal 引用。下列项 **不得** 作为已实现行为写入 `openspec/specs/`。

## 插件加载与校验

| 差距 | 说明 | 跟踪 |
| --- | --- | --- |
| 外置插件 bootstrap 校验不足 | 启动时仅校验 base RuntimePlugin 形状，kind-specific 方法可能延迟到 scheduler 首次调用才失败 | [diting-open-tasks.md](../../docs/architecture/diting-open-tasks.md) §10A |
| 整 kind 外置替换 | 外置 loader 不支持「同 kind 多外置插件」；execution 外置会移除 Codex+Cursor | spec: plugins / configuration |
| 动态配置通道未建模 | plugin config 影响 enable/priority，任意 config payload 传入 init 但非完整动态运行时配置 | open-tasks §17 |

## 任务与集成耦合

| 差距 | 说明 |
| --- | --- |
| source 字段双重语义 | `tasks.source` 同时表示业务来源与 task-integration 插件标识，耦合 persisted provenance 与插件实例 |
| readiness 窄于真实链路 | readiness 检查 environment/execution/observability-governance；log 为 de facto 必需，task-integration/quality 影响业务完整性但不入门禁 |

## 运行时分层（已对齐部分）

下列已在 spec 中约束，此处仅作差距对照锚点：

- Core 框架无关 — **已实现**（overview spec）
- SQLite + migration — **已实现**（persistence spec）
- Goal Loop 停止条件 — **已实现**（repair-loop spec）
- 文件日志替代 execution_logs 写入 — **已实现**（persistence、observability spec）

## 目标模块未产品化

来自 [target-architecture.md](./target-architecture.md)，尚未作为 SHALL 承诺：

- Identity & Access 全量鉴权
- Notification 通道生产化
- 分布式调度与多活
- 完整 Console BFF 与前端控制台（见 open-tasks §14）

## 维护约定

- 差距消除并行为稳定后：在对应 `openspec/changes/` 中提 proposal，archive 时合并到 main spec，并从本文档移除或标为「已关闭」
- 新发现差距：追加表格行并链到 open-tasks 条目
