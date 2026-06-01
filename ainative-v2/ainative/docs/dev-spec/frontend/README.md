# Frontend Dev Specs

Frontend-specific development constraints live here.

## Specs

- **Normative architecture (portable skill pack)**：`.agents/skills/frontend-architecture/` — 从 `SKILL.md` 读起，再读 `references/spa-architecture.md`、`references/multi-frontend-alignment.md`。Cursor 约束：`.cursor/rules/frontend-architecture-*.mdc`。不将 `analysis/` 或其它方案稿当作强制布局；CLI 边界见 `references/spa-architecture.md` §8。
- **Project background（本仓库沿革，非规范条文替代物）**：[`docs/technical/frontend-architecture-feasibility-analysis.md`](../../technical/frontend-architecture-feasibility-analysis.md) — 可行性论证、分阶段实施记录、风险与细节目录树；与 skill `references/` 冲突时以 **references** 为准。
- **Architecture one-pagers（本目录）**：[`ARCHITECTURE.md`](ARCHITECTURE.md)（Web SPA 五分区与分层摘要）、[`ARCHITECTURE_app.md`](ARCHITECTURE_app.md)、[`ARCHITECTURE_shadow.md`](ARCHITECTURE_shadow.md) — 与 `multi-frontend-alignment.md` 职责对照，**不要求**三端目录同构。
- **CLI renderer boundaries（可选补充）**：[`frontend-cli-renderer-boundaries.md`](frontend-cli-renderer-boundaries.md) — 与 skill `spa-architecture.md` §8 一致；条文以 **§8** 为准。
- **工具链守护**：`frontend/eslint.config.ts`（`boundaries/dependencies`、`max-lines` 默认 Vue **error@600**，豁免列表内巨型 SFC 可为 warn）；循环依赖门禁 **`pnpm --dir frontend run deps:circular:strict`**（根目录 `quality-gate` 已包含）。导入矩阵见 `.cursor/rules/frontend-architecture-imports.mdc`。跨 feature **仅**经公开入口；更严的 per-feature `capture` 见 `eslint.config.ts` 内注释。

仓库总入口：根目录 [`AGENTS.md`](../../../AGENTS.md)。
