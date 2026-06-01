---
name: frontend-architecture
description: >-
  MUST use for AINative frontend architecture and directory design. Covers five-partition layout
  (app/pages/features/api/shared), dependency flow, data flow, feature public API, CLI renderer
  boundaries (inlined in references), and cross-product alignment semantics (multi-frontend).
  Normative text lives only under references/; repository-specific background is indexed below, not
  required to reuse this pack. Trigger when the user mentions 前端架构, 五分区, feature-first,
  依赖边界, SPA 分层, Pinia 归属, shared/api 约束, 架构规范, 公开 API, 或评审/对齐多前端职责。
---

# Frontend architecture

## When to use

- 规划或修改 `frontend/` 的目录、import 边界、新功能落点。
- 解释或实现「五分区」、路由守卫、跨 feature 引用、api/shared 分层。
- 与 **ainative-app** / **ainative-shadow** 对照职责时（不要求三端目录一致）。
- 「改接口 / 改 UI」时的分层检索：契约与请求层优先于大面积视图改动（见 `references/spa-architecture.md` 数据流）。

## Read order（规范必读）

1. **[`references/spa-architecture.md`](references/spa-architecture.md)** — **规范正文**：五分区、依赖矩阵、数据流、日常开发约束、SFC/命名基线、**CLI 渲染器边界（已内联）**。
2. **[`references/multi-frontend-alignment.md`](references/multi-frontend-alignment.md)** — 多产品线协作语义、分层角色概念映射、不必对齐清单。

## 规范与仓库背景

- **`references/` = 规范唯一来源**（依赖方向、公开入口、CLI 边界）。复制本 skill 目录到其它仓库时，**不依赖**本仓库 `docs/` 仍成立。
- 下列为 **AINative 仓库内**的补充材料（图示、用语表、项目沿革）；**与 `references/` 冲突时以 `references/` 为准**。

| 文档 | 用途 |
|------|------|
| [`docs/dev-spec/frontend/ARCHITECTURE.md`](../../../docs/dev-spec/frontend/ARCHITECTURE.md) | Web SPA 分层框图、与 app/shadow 的用语映射、构建与横切摘要（与规范同一套分层语义）。 |
| [`docs/technical/frontend-architecture-feasibility-analysis.md`](../../../docs/technical/frontend-architecture-feasibility-analysis.md) | **项目背景与历史**：可行性论证、分阶段实施记录、风险与细节目录树；**非**规范条文的替代物。 |
| `frontend/ARCHITECTURE.md`（若存在） | 可选的现状说明；**非**规范单一来源。 |

## Relationship to other skills

- **Vue 语法、SFC、组合式 API 细节**：沿用 [`vue-best-practices`](../vue-best-practices/SKILL.md) 与 [`vue-development-guides`](../vue-development-guides/SKILL.md)。
- 本 Skill 只管 **目录、依赖、数据流与跨产品线对齐语义**。

## Do not

- 将 `analysis/` 下历史稿、外部「九目录 / services」模板或任意归档当作**强制布局**；可执行条文以本目录 `references/` 为准。
- 将 dev-spec 或技术长文**当作**规范条文的替代品 —— **依赖方向、公开入口、CLI 边界**仅以 `references/spa-architecture.md` 为准。

## Pack layout (reusable)

复制整个 `.agents/skills/frontend-architecture/` 目录即可在其它仓库复用；**规范条文**在 `references/` 内。**不要求**附带本仓库的 `docs/technical/` 或其它项目文档。
