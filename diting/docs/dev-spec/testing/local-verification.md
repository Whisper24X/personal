# 本地校验

## 单元与集成测试

根目录执行：

```bash
npm test
```

等价于依次运行：

- `apps/server` — Jest（`npm run test -w apps/server`）
- `apps/web` — Vitest（`npm run test -w apps/web`）

提交前**不**由 Git hook 自动跑全量测试；重大变更请在 PR 前自行执行 `npm test`。

## 提交前门禁（quality-gate）

每次 `git commit` 触发根 `pre-commit`，执行 `npm run quality-gate`。当前仅包含 **TypeScript 类型检查**：

| Workspace | 命令 |
| --- | --- |
| `apps/server` | `tsc --noEmit -p tsconfig.build.json`（含 `packages/core`、`packages/plugin-api` 源码路径） |
| `apps/web` | `tsc -b` |

详见 [`../repo/git-commit-quality-gates.md`](../repo/git-commit-quality-gates.md)。首次克隆后须 `npm install` 以安装 `husky`。

### 与 lint 的关系

本 monorepo **尚未**配置 ESLint 等 lint 脚本。引入后应在根 `quality-gate` 串联，勿在子 workspace 单独挂 hook。

## 运行时质量插件（任务执行链）

任务执行时，内置 **default-quality** 插件在目标仓工作区内串联 lint、类型检查、测试、构建与 diff 风险等（见 [`openspec/specs/plugins/spec.md`](../../../openspec/specs/plugins/spec.md) 与架构文档）。

这与**本仓库**的 `quality-gate` 职责不同：

| 范围 | 作用 |
| --- | --- |
| 本仓库 `quality-gate` | 保护 diting 宿主/控制台代码提交质量 |
| 任务 quality 插件 | 评测被克隆的目标项目代码 |

## 建议 PR 前检查

```bash
npm run quality-gate   # 或单独 npm run type-check
npm test
npm run build
```

涉及 OpenSpec spec 变更时另见 [`../openspec/workflow.md`](../openspec/workflow.md) 中的 `openspec validate --specs --all`。
