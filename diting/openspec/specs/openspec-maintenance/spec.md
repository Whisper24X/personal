# OpenSpec Maintenance Specification

> 基线：当前实现（截至 2026-06）
> 参考：openspec/config.yaml、docs/architecture/index.md

## Purpose

定义 diting 仓库中 OpenSpec 与 docs/architecture 双轨文档的分工、更新流程与 AI 读档顺序。

## Requirements

### Requirement: SpecsAsNormativeSource
`openspec/specs/<capability>/spec.md` SHALL 作为已实现系统行为的工程规范真源；Requirement MUST 使用 SHALL/MUST，每条 MUST 至少一个 `#### Scenario`。

#### Scenario: SpecHasScenario
- **WHEN** 新增 Requirement 到 main spec
- **THEN** 同 Requirement 下存在至少一个 Scenario

### Requirement: NarrativeDocsReference
`docs/architecture/diting-*.md` SHALL 保留为叙事与运维参考，README 链接 MUST 继续指向该目录；与 spec 冲突时以 spec 为工程约束优先。

#### Scenario: ReadmeLinksPreserved
- **WHEN** 贡献者从 README 打开技术设计文档
- **THEN** 路径仍为 docs/architecture/diting-technical-design.md

### Requirement: DesignForTargetAndGaps
未实现能力、目标架构与 runtime gaps MUST 写在 `openspec/design/` 或 `docs/architecture/diting-open-tasks.md`，MUST NOT 以 SHALL 写入 main spec。

#### Scenario: GapNotInSpec
- **WHEN** 功能仅在 roadmap 中规划
- **THEN** openspec/specs 中无对应 SHALL Requirement

### Requirement: ChangeWorkflow
新功能或行为变更 MUST 通过 `openspec/changes/<name>/`（proposal → delta specs → design → tasks）迭代；archive 时 MUST 评估是否将 delta 合并到 main specs。

#### Scenario: ArchiveSyncSpecs
- **WHEN** change 完成并 archive 且含 delta specs
- **THEN** 维护者 MUST 选择 sync 到 openspec/specs 或明确跳过理由

### Requirement: DualTrackSyncOnBehaviorChange
当实现变更影响对外行为时，PR MUST 更新相关 openspec/specs，并 MUST 评估是否同步更新对应 diting-*.md 叙事文档。

#### Scenario: ApiChangeUpdatesSpec
- **WHEN** 新增 HTTP 端点
- **THEN** http-api spec 与 diting-api.md 至少其一在同 PR 或后续 PR 更新

### Requirement: ArchiveSyncNarrativeDocs
OpenSpec change 归档且 main spec 已合并时，维护者 MUST 按 skill `openspec-archive-sync-docs` 同步 `docs/architecture/diting-*.md` 与 `README.md`（用户明确跳过除外）。

#### Scenario: ArchiveUpdatesApiDoc
- **WHEN** archive 合并了 http-api delta 且用户未跳过叙事同步
- **THEN** diting-api.md 反映新端点或约定，README Changelog 记录对外可见变更

### Requirement: AiReadOrder
AI 助手处理 diting 任务时 MUST 按序读取：openspec/config.yaml context → 相关 openspec/specs → openspec/design（若涉及目标/差距）→ 活跃 openspec/changes → docs/architecture 详细参考。

#### Scenario: MinimalContextPollution
- **WHEN** 实现局部 API 修复
- **THEN** 优先读取 http-api spec 而非全文 architecture-description

### Requirement: ValidationBeforeMerge
合并涉及 spec 变更的 PR MUST 通过 `openspec validate --specs --all`。

#### Scenario: ValidateSpecsCi
- **WHEN** CI 或维护者校验 specs
- **THEN** openspec validate 无结构错误

## Technical Notes

- 索引：docs/architecture/index.md
- CLI：openspec validate、openspec change、openspec archive
- 归档叙事同步：`.claude/skills/openspec-archive-sync-docs/SKILL.md`（与 `openspec-archive-change` 步骤 6 衔接）
