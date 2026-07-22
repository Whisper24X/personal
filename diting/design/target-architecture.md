# 目标架构摘要

> 完整目标态说明见 [docs/architecture/diting-architecture-description.md](../../docs/architecture/diting-architecture-description.md)

## 系统定位

diting 是 AI 工程执行控制平台：统一管理任务接入、调度、工作区准备、执行器调用、质量评估、自动修复、人工接管与观测治理。定位为**执行控制器**与**控制平面**，而非单纯任务系统或单一 Agent。

## 六层架构（目标态）

| 层 | 职责 | 不负责 |
| --- | --- | --- |
| Presentation | Web 控制台、HTTP API、SSE/Webhook | 状态流转、调度、插件业务 |
| Application | 用例编排、事务、事件发布 | 领域规则本身 |
| Domain | 实体、状态机、聚合边界 | 框架与 IO |
| Domain Service / Policy | 调度/修复/路由/风险策略 | 流程顺序（属 Application） |
| Infrastructure | DB、日志、插件加载、Git/CLI | 业务语义 |
| Extension | 可替换插件实现 | 核心状态机 |

## 核心模块清单（目标态）

目标态建议模块（当前实现程度不一，详见 [diting-open-tasks.md](../../docs/architecture/diting-open-tasks.md)）：

1. Identity & Access — 鉴权、审计（本地优先阶段未产品化）
2. Task Intake — 人工/外部任务标准化与幂等
3. Task Lifecycle — 状态机与关联维护
4. Scheduler — 扫描、排序、分配、过载恢复
5. Agent Capacity — Agent 与 AgentLease 模型
6. Workspace — 镜像、worktree、产物路径
7. Execution Orchestration — 执行编排与会话
8. Quality Evaluation — 统一 EvaluationReport
9. Repair Loop — 修复计划与停止信号
10. Human Intervention — HumanReview 与恢复
11. Plugin Management — 生命周期、能力矩阵、manifest
12. Observability — 事件、timeline、trace、健康快照
13. Governance & Risk — 命令/Diff/密钥策略
14. Notification — 通知路由（骨架阶段）
15. Console BFF — 控制台聚合（部分实现 ops-view）

## 设计原则（摘录）

- 核心领域稳定，变化点外置为插件
- 读写分离、编排与规则分离
- 事件优先、可恢复优先、宿主轻量
- 架构风格：模块化单体 + Ports and Adapters + 领域服务编排

## 非目标（第一阶段）

分布式多活、强多租户、PB 级日志分析、组织级权限平台、跨区域高可用——不作为第一阶段中心。

## 与当前 spec 的关系

- **已实现且已写入 spec 的行为**：以 `openspec/specs/` 为准
- **上表未完全落地的模块**：仅在本 design 与 open-tasks 中跟踪，不得写入 spec 的 SHALL 条款

## 延伸阅读

- [module-map.md](./module-map.md) — 模块协作与推荐目录
- [runtime-gaps.md](./runtime-gaps.md) — 现状与目标差距
