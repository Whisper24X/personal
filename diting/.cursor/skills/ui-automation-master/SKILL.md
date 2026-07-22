---
name: ui-automation-master
description: UI 自动化产品化总入口。Use when Diting workflow needs UI case preparation, Playwright execution, repair rerun, or final UI automation closure.
---

# UI Automation Master

这是 Diting UI 自动化唯一面向 workflow / 用户的入口。`SKILL.md` 只保留发现、编排和全局护栏；具体阶段由子 skills 执行。

## Quick Start

1. 定位当前任务目录与 `TEST.md`、执行报告、improve 链产物。
2. 根据“阶段路由”只进入一个子 skill，不要一次性执行多个阶段。
3. 子阶段完成后重新读取产物状态，再决定下一跳。
4. 最终完成必须来自 `run` 的 Playwright 重跑证据 + 指标结果，以及 `repair` 的归档标记。

## Stage Skills

| 阶段 | 子 skill | 职责 |
| --- | --- | --- |
| `Prep` | `ui-automation-prep` | 生成或优化可执行 `TEST.md` |
| `Run` | `ui-automation-run` | 使用 `playwright-skill` 执行、采证、算指标、产出 review bridge |
| `Repair` | `ui-automation-repair` | 分析 pending issues、最小修复、本地验证、最终归档 |

## 任务包结构

```text
{{workspacePath}}/
├── WORKFLOW_PROMPTS.md
├── skills/
│   ├── ui-automation-master/
│   ├── ui-automation-prep/
│   ├── ui-automation-run/
│   ├── ui-automation-repair/
│   └── playwright-skill/
└── docs/feature/{{gitBranch}}/
    └── tasks/{{taskId}}/
        ├── TEST.md
        └── artifacts/playwright/
```

如果任务包 skills 已合并到 `.cursor/skills/`，可读取合并后的路径。两处都缺失时，记录任务包缺失阻断，不得临时从当前开发机或互联网补齐。

## 阶段路由

按当前任务目录中的产物判断下一步：

1. 没有 `TEST.md`，或 `TEST.md` 未满足 BDD / 属性表 / 可执行路径要求 -> `ui-automation-prep`。
2. 已有合格 `TEST.md`，但没有 `testExecutionResult.md` -> `ui-automation-run`。
3. `improveExecuteResult.md` 标记 `本地修复完成，等待 run 重跑`，或 `improveVerifyResult.md` 标记 `待 run 验证` -> `ui-automation-run`。
4. `testExecutionResult.md` 第一行是 `未完成`，且 `testReview.md` / `improveReviewResult.md` 中存在可修复 pending issues -> `ui-automation-repair`。
5. `testExecutionResult.md` 第一行是 `已完成`，但 `improveVerifyResult.md` 未标记 `run 验证通过，归档完成`，且曾进入 repair -> `ui-automation-repair` 做最终归档。
6. `testExecutionResult.md` 第一行是 `已完成`，且未进入 repair 或 `improveVerifyResult.md` 已标记 `run 验证通过，归档完成` -> UI 自动化收口完成。

## 关键约束

- `master` 只做编排，不直接生成用例、不跑浏览器、不修代码。
- `run` 必须使用 `playwright-skill`；不得使用 MCP、CDP、browser-mcp 或 DevTools MCP 作为执行器。
- UI 自动化统一按浏览器可执行形态收口：原生小程序不作为 Playwright 直接执行目标；若目标仓是 Taro 跨端项目，默认使用目标仓启动时提供的 H5 形态作为执行入口。
- 只有不存在可用 H5 入口、或需求明确依赖原生小程序专属能力时，相关 case 才标注为不可 UI 自动化或 `SKIPPED_NOT_EXECUTABLE`。
- `run` 负责执行、采证、算指标、复盘、重跑。
- `repair` 负责 bridge 转写、分析、根因定位、最小修复、本地验证。
- `repair` 不能在 UI 重跑前宣称最终完成。
- 最终闭环由 `run` 的重跑证据 + 指标结果触发 `repair` 归档；`repair` 完成归档后，`master` 才进入收口完成状态。
- 无 Playwright 脚本、截图/trace/网络/console/DOM 证据或指标结果，不得宣称 UI 自动化通过。

## 路由规则

- 如果当前任务上下文明确，直接按该任务目录判断。
- 如果存在多个候选任务目录，先选当前正在处理的那个；仍不明确时再问用户一次。
- workflow 只调用 `ui-automation-master`；不要从 workflow prompt 直接串联子 skill。
