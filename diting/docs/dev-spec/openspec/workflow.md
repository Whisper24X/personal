# OpenSpec 工作流

本文从 [`openspec-maintenance`](../../../openspec/specs/openspec-maintenance/spec.md) 与 [`openspec/config.yaml`](../../../openspec/config.yaml) 提炼日常开发流程。**规范真源仍在 `openspec/specs/`**，本文不替代 spec 条文。

## Change 迭代

新功能或行为变更应通过 `openspec/changes/<name>/` 迭代，典型顺序：

1. **proposal** — 说明动机与 Capabilities（kebab-case 目录名）
2. **delta specs** — 在 change 内编写 spec 增量
3. **design** — 目标架构或实现要点（若需要）
4. **tasks** — 可执行任务清单
5. **archive** — 评估是否将 delta 合并到 `openspec/specs/`

未实现能力、roadmap 项 MUST 写在 `openspec/design/` 或 [`diting-open-tasks.md`](../../architecture/diting-open-tasks.md)，不得以 SHALL 写入 main spec。

## 合并前校验

涉及 spec 变更的 PR 合并前须通过：

```bash
openspec validate --specs --all
```

## 双轨同步（概要）

- 实现变更影响对外行为时：更新相关 `openspec/specs`，并评估是否同步 [`docs/architecture/diting-*.md`](../../architecture/index.md)。
- archive 且 main spec 已合并时：按 skill `openspec-archive-sync-docs` 同步叙事文档与根 `README.md` Changelog（除非明确跳过）。

详见 [documentation/dual-track-docs.md](../documentation/dual-track-docs.md)。

## AI 读档顺序

处理 diting 实现或审查任务时，建议按序阅读：

1. [`openspec/config.yaml`](../../../openspec/config.yaml) 的 `context`
2. 相关的 [`openspec/specs/<capability>/spec.md`](../../../openspec/specs/)
3. [`openspec/design/`](../../../openspec/design/)（若涉及目标或差距）
4. 活跃的 [`openspec/changes/`](../../../openspec/changes/)
5. [`docs/architecture/`](../../architecture/index.md) 详细参考（局部修复优先读对应 capability 的 spec，避免通读长文）

## Spec 撰写规则（摘自 config）

- 正文中文；标识符、路径、环境变量、HTTP 路径保留英文
- 每条 Requirement 使用 SHALL/MUST，且至少一个 `#### Scenario`
- 未实现能力不得写入 spec
