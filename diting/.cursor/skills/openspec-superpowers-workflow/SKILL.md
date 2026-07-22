---
name: openspec-superpowers-workflow
description: Use when a Diting task package provides WORKFLOW_PROMPTS.md and OpenSpec artifacts for feature development, verification, review, or archive work.
---

# OpenSpec Superpowers Workflow

这是 Diting 飞书任务的 OpenSpec 工作流入口。`SKILL.md` 只保留发现、编排和全局护栏；阶段细节放在 `references/`，按当前节点读取。

## Quick Start

1. 读取任务包根目录的 `WORKFLOW_PROMPTS.md`。
2. 读取 `openspec/changes/<change-id>/workflow-state.md`。
3. 先识别当前 Agent 角色，再选择节点：编码 Agent 只执行 `PreflightAndSpec -> Implement`；质检 Agent 只执行 `VerifyAndReview`；`Archive` 仅在平台明确调度归档时执行。
4. 根据当前节点只读取一个阶段 reference，不要一次性加载所有阶段细节。
5. 阶段完成后写入 `stage-reports/`，再基于文件证据更新 `workflow-state.md`。

## 全局模式

OpenSpec CLI 在 Agent 的非交互式 Shell 环境中可能静默失败。所有 `openspec` CLI 命令默认由用户终端或 Diting 平台执行；Agent 负责读取输出、编写制品、检查格式和修复内容。

- 标准模式：用户或平台执行 `/opsx-new`、`/opsx-continue`、`openspec instructions`、`openspec validate`、`openspec archive`，Agent 消费输出并写入制品。
- 交互规格模式：`PreflightAndSpec` 必须执行 Brainstorming，一次只问一个问题；用户确认候选方案后，先生成并审批 `docs/superpowers` 的 design / plan，再迁移为 OpenSpec 制品并删除临时 Superpowers 文档；进入实现前必须再次等待人工确认卡点。
- 降级模式：CLI 不可用或无输出时，Agent 按 reference 中的格式手动创建/检查制品，但不得跳过该步骤的实质内容。
- Diting 无交互模式：只校验和推进已物化制品；缺关键制品时写入 `docs/feature/{{gitBranch}}/taskResult.md` 并停止，不重新发起需求澄清或创建 OpenSpec change。

## 技术栈 Profile

`PreflightAndSpec` 必须在进入实现前识别技术栈 Profile，并写入 `design.md` 或阶段报告。后续 TDD、构建、测试、lint 均按该 Profile 或项目已有等价命令执行。

识别优先级：

1. 用户或任务包明确指定。
2. `design.md` / `plan.md` 中的 Tech Stack 字段。
3. 子模块特征文件：`go.mod`、`package.json`、`tsconfig.json`、`build.gradle`、`pyproject.toml`、`Cargo.toml`、`pom.xml`。
4. CI / Makefile / package scripts。
5. 仍无法确定时询问用户，不得默认假设。

常用 Profile：

| Profile | 特征 | 核心命令 |
| --- | --- | --- |
| `go` | `go.mod` | `go test ./...`、`go build ./...`、`golangci-lint run ./...` |
| `typescript` | `package.json` + `tsconfig.json` | `npm test` / `vitest`、`npm run build`、`npm run lint` |
| `javascript` | `package.json` | `npm test`、`npm run build`、`npm run lint` |
| `android` | Gradle + `AndroidManifest.xml` | `./gradlew test`、`./gradlew assembleDebug`、`./gradlew lint` |
| `python` | `pyproject.toml` / `requirements.txt` | `pytest`、`mypy` / `pyright`、`ruff check` |
| `rust` | `Cargo.toml` | `cargo test`、`cargo build`、`cargo clippy` |
| `java` | `pom.xml` / Gradle | `mvn test` / `gradlew test`、compile、checkstyle/SpotBugs |

多模块仓库必须把命令限定到变更子模块，优先复用项目已有 `make`、`npm scripts`、Gradle task 或 CI 命令。

## Stage References

| 节点 | Reference |
| --- | --- |
| `PreflightAndSpec` | [`references/preflight-spec.md`](references/preflight-spec.md) |
| `Implement` | [`references/implementation.md`](references/implementation.md) |
| `VerifyAndReview` | [`references/verify-review.md`](references/verify-review.md) |
| `Archive` | [`references/archive.md`](references/archive.md)，仅平台/人工后置归档 |

## 任务包结构

```text
{{workspacePath}}/
├── WORKFLOW_PROMPTS.md
├── openspec/
│   ├── changes/<change-id>/
│   │   ├── proposal.md
│   │   ├── design.md
│   │   ├── plan.md
│   │   ├── tasks.md
│   │   └── workflow-state.md
│   └── specs/<change-id>/spec.md
├── skills/
│   ├── openspec-superpowers-workflow/
│   │   ├── SKILL.md
│   │   └── references/
│   │       ├── preflight-spec.md
│   │       ├── implementation.md
│   │       ├── verify-review.md
│   │       └── archive.md
│   ├── api-change-auto-test/
│   │   └── api-test/
│   │       └── runtime.json
│   ├── ui-automation-master/
│   │   └── SKILL.md
│   ├── ui-automation-prep/
│   │   └── SKILL.md
│   ├── ui-automation-run/
│   │   └── SKILL.md
│   ├── ui-automation-repair/
│   │   └── SKILL.md
│   └── playwright-skill/
│       ├── SKILL.md
│       ├── references/
│       └── scripts/
```

如果 Diting 已将任务包 `skills/` 合并到 `.cursor/skills/`，可读取合并后的路径。两处都缺失时，记录任务包缺失阻断，不得临时从当前开发机或互联网补齐。

## 编排规则

1. 以 `WORKFLOW_PROMPTS.md` 的节点顺序为准，但必须按 Agent 角色隔离执行：编码 Agent 只负责规格恢复与实现，质检 Agent 只负责验证、自动化和 Code Review。
2. 质检节点必须消费上游阶段报告与 `artifacts/implementation-handoff.json`；如果平台无法显式传递节点输出，从 `workflow-state.md`、`stage-reports/`、`tasks.md` 和 `taskResult.md` 恢复上下文。
3. 进入阶段前先确认上游阶段已在 `workflow-state.md` 勾选；未完成时停止并写入阻断结果，不得跳阶段。
4. 阶段执行时只读取当前阶段 reference 文件；reference 文件不是独立 skill，不包含 YAML frontmatter。
5. 阶段完成后必须写入对应 `stage-reports/` 报告，并基于文件证据更新 `workflow-state.md`。
6. `taskResult.md` 只记录 Diting 节点结果或阻断，不替代 `tasks.md` 勾选，也不替代 `workflow-state.md`。
7. 恢复会话时必须重新读取文件真源；不得仅凭聊天摘要判断阶段完成。

## 核心护栏

- `workflow-state.md` 是 workflow 完成判断真源。
- `tasks.md` 是 Completion Gate 真源，但不代表全流程完成。
- `proposal.md`、`design.md`、`plan.md`、`tasks.md`、`openspec/specs/<change-id>/spec.md` 是规格阶段关键制品。
- OpenSpec 制品人工确认卡点不可跳过；实现代码只能在制品确认后开始。
- 不跳过 TDD。
- 编码 Agent 不执行基础验证总验收、API/UI 自动化、Code Review 或 Archive。
- 质检 Agent 不承担需求实现；发现缺测试或质量问题时写明修复要求并交回编码 Agent。
- 不跳过基础验证、API/UI 自动化适用分支和 Code Review。
- API 0 endpoint 不算通过。
- UI 无证据不得落结论。
- 生成 OpenSpec 规格时必须提前判定 UI 验证形态：小程序/Taro 场景只要能通过目标仓 H5 形态验证，就在 `spec.md` Scenario、`tasks.md` 验证方式和 `design.md` 风险约束中写明使用 H5；不得因为来源是小程序就默认标成人工验证或不可 UI 自动化。
- 真实凭据不得进入飞书附件或 git。
- 未明确要求时不 commit、不 push。
- 不使用 `git reset --hard`、force push 或回滚用户改动。
