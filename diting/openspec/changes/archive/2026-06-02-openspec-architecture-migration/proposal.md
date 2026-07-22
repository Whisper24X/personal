## Why

`docs/architecture/` 叙事文档与工程约束混杂，无法被 OpenSpec / AI 稳定引用。需要将已实现行为沉淀为 `openspec/specs/`，并与原有 `diting-*.md` 双轨并存，供归档与代码审查使用。

## What Changes

- 新增 `openspec/specs/` 下 13 个 capability 规范（SHALL/MUST + Scenario）
- 新增 `openspec/design/` 目标架构与 runtime gaps 摘要
- 新增 `docs/architecture/index.md` 双轨导航
- 扩充 `openspec/config.yaml` 项目 context 与 rules
- 新增 skill `openspec-archive-sync-docs`，并接入 `openspec-archive-change` 归档流程
- **保留** 全部 `docs/architecture/diting-*.md` 与 README 现有链接

## Capabilities

### New Capabilities

- `overview`: 系统定位与架构原则
- `task-lifecycle`: 任务状态机与命令边界
- `scheduler`: 调度与 Agent
- `execution-orchestration`: Goal Loop 与 WORKFLOW_PROMPTS
- `repair-loop`: 修复循环停止条件
- `human-intervention`: needs_human / recover
- `plugins`: 插件 kind、外置替换、运行时选择
- `persistence`: SQLite schema 与 envelope
- `http-api`: Fastify HTTP API 约定
- `configuration`: 环境变量与启动校验
- `observability`: 日志、SSE、trace 聚合
- `governance`: 命令策略与 diff 阈值
- `openspec-maintenance`: 双轨文档分工与归档同步

### Modified Capabilities

（无：本次为从零建立 main specs，非修改既有 spec）

## Impact

- 文档：`openspec/`、`docs/architecture/index.md`、`.claude/`、`.cursor/`、`.codex/` skills
- 代码：无运行时行为变更
- README：归档后补充 Changelog 与可选 OpenSpec 入口说明
