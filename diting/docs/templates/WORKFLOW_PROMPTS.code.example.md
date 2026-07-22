# Diting OpenSpec 编程工作流

本文档随飞书看板任务下发到 Diting 任务工作区根目录 `{{workspacePath}}`，用于编排编程任务。执行器必须按本文档节点顺序推进，不要只依赖某个单独 skill。

## 适用场景

- 飞书看板任务附件已物化到 `{{workspacePath}}`。
- 任务包包含 `WORKFLOW_PROMPTS.md`、OpenSpec 制品、`openspec-superpowers-workflow` skill 包。
- 需要完成代码实现，并在实现完成后交由独立质检 Agent 执行自动化验证与 Code Review。

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

执行器可将 `skills/` 合并到 `.cursor/skills/`，但节点 prompt 必须优先识别任务包随附 skill。任务包缺失必须写入阻断结果，不得临时从当前开发机或互联网补齐。

## 全局硬约束

1. 禁止把真实 token、账号密码、生产凭据写入飞书附件、OpenSpec、`WORKFLOW_PROMPTS.md`、`api-test/runtime.json` 或 git。
2. 禁止 force push、reset、rebase 等破坏性 Git 操作。
3. 默认不 commit、不 push；只有任务或用户明确要求时才执行。
4. `openspec/changes/<change-id>/workflow-state.md` 是 workflow 完成判断真源。
5. `openspec/changes/<change-id>/tasks.md` 是 Diting Completion Gate 真源，但 `tasks.md` 全 `[x]` 不代表 workflow 全部完成。
6. 缺任务包、缺凭据、缺环境、缺权限时，先完成可独立完成部分，再写入 `docs/feature/{{gitBranch}}/taskResult.md`。
7. 最终结果必须明确为 `已完成`、`部分完成` 或 `未完成`，并说明验证和阻断。
8. OpenSpec CLI 命令默认由用户终端或 Diting 平台执行；Agent 负责消费输出、编写制品和检查格式。
9. OpenSpec 制品人工确认卡点不可跳过；实现代码只能在确认后开始。

## 可用变量

```text
{{taskId}}
{{taskTitle}}
{{taskPrompt}}
{{gitBranch}}
{{gitBaseBranch}}
{{gitWorktreePath}}
{{projectName}}
{{projectDefaultBranch}}
{{workspacePath}}
{{reposRoot}}
{{reposList}}
{{artifactsPath}}
{{workflowPromptsPath}}
```

## Agents 默认执行流程

编码 Agent 默认只执行：

1. `PreflightAndSpec`
2. `Implement`

质检 Agent 默认只执行：

3. `VerifyAndReview`

`Archive` 仅作为质检通过后的平台/人工后置步骤，不属于编码 Agent 或质检 Agent 的默认执行节点。

节点传递要求：

- `Implement` 必须消费 `PreflightAndSpec` 输出。
- `VerifyAndReview` 必须由质检 Agent 消费 `Implement` 输出、阶段 2 报告和平台生成的 `implementation-handoff.json`。
- `Archive` 必须消费 `VerifyAndReview` 输出和阶段 3 报告。
- 如果平台无法显式传递节点输出，后续节点必须从 `workflow-state.md`、`stage-reports/`、`tasks.md` 和 `taskResult.md` 恢复上下文。

恢复与修复续跑要求：

- 每个节点启动后的第一步必须读取 `openspec/changes/<change-id>/workflow-state.md`，并以该文件判断本节点是否已经完成。
- 如果本节点对应 phase 已全部 `[x]`，必须直接跳过该节点：不要重新执行测试、构建、API/UI 自动化、Code Review、OpenSpec CLI 或重写阶段报告。
- 跳过时只需简短输出“本节点已完成，已按 workflow-state 跳过”，并指出下一未完成阶段；不得进入本节点循环重试。
- 修复模式下只处理 `Repair goal` 指向的失败点，或 `workflow-state.md` 中第一个未完成阶段；不得从 `PreflightAndSpec` 重新开始复验整条 workflow。

## 节点 Prompt 模板

### PreflightAndSpec

```text
使用 `openspec-superpowers-workflow` skill 执行前置检查与规格阶段，并读取 `references/preflight-spec.md`。

任务信息：
- 任务 ID：{{taskId}}
- 任务标题：{{taskTitle}}
- 原始需求：
{{taskPrompt}}

仓库与工作区：
- 项目：{{projectName}}
- 当前分支：{{gitBranch}}
- 基线分支：{{gitBaseBranch}}
- 工作目录：{{gitWorktreePath}}
- 工作区根：{{workspacePath}}
- 仓库列表：
{{reposList}}

执行要求：
1. 先读取 `workflow-state.md`；若 `phase-1-preflight-spec` 与 `phase-1-report` 已为 `[x]`，立即跳过本节点，不要复验或改写阶段 1 报告。
2. 优先从 `{{workspacePath}}/skills/openspec-superpowers-workflow/` 读取主 skill 与 `references/preflight-spec.md`；若已合并到 `.cursor/skills/`，可使用合并后的 skill 包。
3. 定位 change-id 与 OpenSpec 真源，不要重复创建 PRD/MRD/OpenSpec change，除非任务明确要求。
4. 恢复模式下校验 `proposal.md`、`design.md`、`plan.md`、`tasks.md`、`workflow-state.md` 和至少一个 `spec.md` 是否存在；交互新建或补齐模式下不得先写 OpenSpec 制品。
5. 识别技术栈 Profile，并记录到阶段报告。
6. 初始化或恢复 `workflow-state.md`，从第一个未完成阶段继续。
7. 标准模式下只消费用户终端或 Diting 平台提供的 OpenSpec CLI 输出；降级模式下可手动检查或创建制品，但不得跳过实质内容。
8. 交互模式下必须先执行 Brainstorming：一次只问一个澄清问题，提出 2-3 个候选方案，并在用户明确确认推荐方案后才能进入 Superpowers design。
9. Product Agent 首轮如尚未收到人工回复，必须先将 Brainstorming 问题写入飞书评论，并提示用户用 `【回复】` 前缀回复；随后以需要人工输入的阻断结果结束本轮，不得返回 review-ready 成功结果。
10. 收到 `【回复】` 人工回复前，不得创建或更新 OpenSpec 制品，不得勾选 `phase-1-brainstorming`、`phase-2-openspec-artifacts`、`phase-1-preflight-spec` 或 `phase-1-report`。
11. “信息不足时做最小必要假设”只适用于已经完成首轮人工交互后仍无法确认的低风险细节；不得用最小假设跳过首轮 Brainstorming 交互。
12. OpenSpec 制品 review-ready 后，只能在 stdout 与 workspace 产物中留下摘要；不得自行调用 `meegle comment add` 写 review-ready 评论，也不得自行创建评审入口。Diting 平台会在执行器成功退出后统一创建 OpenSpec review 子任务。
13. 先生成并审批 `docs/superpowers/specs/YYYY-MM-DD-<change-id>-design.md`，再生成并审批 `docs/superpowers/plans/YYYY-MM-DD-<change-id>-plan.md`。
14. 用户确认 Superpowers design / plan 后，才能迁移为 OpenSpec `design.md` / `plan.md`，并创建或更新 `proposal.md`、`tasks.md` 和 `spec.md`。
15. 确认 OpenSpec 制品完整承接 Superpowers design / plan 后，删除临时 `docs/superpowers/` design / plan 文档；无法删除时写入阶段报告说明原因。
16. 进入实现前必须展示 `proposal.md`、`spec.md`、`tasks.md`、`design.md`、`plan.md` 和技术栈 Profile，并等待用户明确确认人工卡点。
17. 缺关键制品或 skill 时，写入 `docs/feature/{{gitBranch}}/taskResult.md`，结论为 `未完成` 或 `部分完成`，不得进入实现。
18. 完成后写入 `openspec/changes/<change-id>/stage-reports/stage-1-preflight-spec.md`，并勾选 `phase-1-preflight-spec`、`phase-1-report`。

输出要求：
- 简短说明 change-id、规格路径、技术栈 Profile、是否允许进入 `Implement`。
- 不要把真实凭据写入任何文件。
```

推荐配置：

- `requiresApproval: true`
- `loopEnabled: true`
- `maxLoops: 5`

### Implement

```text
使用 `openspec-superpowers-workflow` skill 执行实现阶段，并读取 `references/implementation.md`。

输入：
- 原始需求：
{{taskPrompt}}
- 工作目录：{{gitWorktreePath}}
- 工作区根：{{workspacePath}}

执行要求：
1. 先读取 `workflow-state.md`；若 `phase-2-implementation`、`phase-2-completion-gate` 与 `phase-2-report` 已为 `[x]`，立即跳过本节点，不要复验测试/构建或改写阶段 2 报告。
2. 读取 `workflow-state.md`、`tasks.md`、`plan.md`、`design.md` 和阶段 1 报告。
3. 若阶段 1 未完成，停止并写入 `taskResult.md`。
4. 对每个 autonomous task 严格执行 RED -> GREEN -> REFACTOR。
5. 没有先失败的测试，不得写生产实现代码。
6. 缺测试基础设施时，先实现测试基础设施 task，不得跳过测试。
7. 本轮已实现且验证通过的 autonomous task 才能在 `tasks.md` 勾选 `[x]`。
8. 人工任务、外部依赖阻断任务、未验证任务保持 `[ ]`。
9. 可准备 API HTTP spec 或 `api-test/runtime.json` 的非敏感配置，但不要在本阶段声称 API/UI 自动化通过。
10. 完成后写入 `openspec/changes/<change-id>/stage-reports/stage-2-implementation.md`，并按完成度闸门更新 `workflow-state.md`。

输出要求：
- 简短说明完成的 tasks、实现阶段验证结果和仍阻断项。
- 不要执行 `VerifyAndReview`、API/UI 自动化、Code Review 或 OpenSpec Archive；实现完成后由平台生成 handoff 并交给质检 Agent。
- 不要 commit/push，除非任务明确要求。
```

推荐配置：

- `requiresApproval: false`
- `loopEnabled: true`
- `maxLoops: 3`

### VerifyAndReview

```text
【质检 Agent 专属】使用 `openspec-superpowers-workflow` skill 执行验证与 Code Review 阶段，并读取 `references/verify-review.md`。

输入：
- 原始需求：
{{taskPrompt}}
- 工作目录：{{gitWorktreePath}}
- 工作区根：{{workspacePath}}
- 产物归档目录：{{artifactsPath}}
- 编码交接产物：`{{artifactsPath}}/implementation-handoff.json`

执行要求：
1. 先读取 `workflow-state.md`；若 `phase-3-verification-review`、`phase-3-api-automation`、`phase-3-ui-automation`、`phase-3-code-review` 与 `phase-3-report` 已为 `[x]`，立即跳过本节点，不要重跑验证、自动化或 Code Review。
2. 读取 `workflow-state.md`、`tasks.md`、阶段 2 报告、`{{artifactsPath}}/implementation-handoff.json` 和 OpenSpec spec。
3. 若实现阶段或完成度闸门未完成，停止并写入 `taskResult.md`。
4. 按技术栈 Profile 执行构建、类型检查、测试、lint 和编辑器诊断。
5. 检查变更实现文件是否存在对应测试；缺测试时回到实现阶段补写。
6. 核对 OpenSpec Scenario 是否有实现和测试证据。

API 自动化：
7. 如果存在 API spec 或任务要求接口自动化，读取 `skills/api-change-auto-test/`。
8. API parser 只认反引号包裹的 `METHOD /path`；0 endpoint 不得视为通过。
9. 校验 `api-test/runtime.json`、鉴权环境和后端 health。
10. 执行 `run-api-change-suite.sh smoke <change-id>`；该命令通过后会自动衔接 full。
11. 读取 `tmp/api-test-reports/<change-id>/summary.md`，smoke/full 任一失败则验证失败。

UI 自动化：
12. 如果存在 UI 变更、`TEST.md` 或任务要求 UI 自动化，调用 `skills/ui-automation-master/` 判断下一步。
13. UI 执行必须使用 `playwright-skill`；不得使用 MCP、CDP、browser-mcp 或 DevTools MCP 作为执行器。
14. 原生小程序不作为 Playwright 直接执行目标；Taro 跨端项目优先使用目标仓启动时的 H5 入口测试，并在 `TEST.md` 标注为 `H5端`。
15. `ui-automation-prep` 必须生成或优化 `TEST.md`，并包含覆盖范围、本轮是否执行、环境前提和不执行原因。
16. `ui-automation-run` 只执行 `本轮是否执行=是` 的浏览器可执行 case；`SKIPPED_*` 不计入失败率。
17. 无 Playwright 脚本、截图/trace、DOM、console、网络和指标证据不得落结论。
18. 正确 case 的 FAIL 必须进入 `ui-automation-repair` 最小修复，再回到 `ui-automation-master` 收口判断。

Code Review：
19. 基础验证和适用的自动化测试完成后，执行 code review。
20. CRITICAL/IMPORTANT 必须修复并重跑受影响验证；SUGGESTION 记录到阶段报告或 `design.md` Open Questions。
21. 完成后写入 `openspec/changes/<change-id>/stage-reports/stage-3-verification-review.md`，并更新 `workflow-state.md`。
22. 同步写入 `{{artifactsPath}}/code-review-report.json`，供 Diting 读取质检结果。JSON 至少包含 `schemaVersion`、`passed`、`summary`、`findings`、`checks`，其中 `passed` 必须与阶段 3 报告结论一致。

输出要求：
- 简短说明基础验证、API 自动化、UI 自动化、Code Review 结果。
- 将 API/UI 报告路径复制或索引到 `{{artifactsPath}}`（如平台提供）。
- 明确说明若发现缺测试或质量问题，已写明修复要求并由平台生成 `quality-repair-handoff.json` 交回编码 Agent；质检 Agent 不直接承担需求实现。
```

推荐配置：

- `requiresApproval: false`
- `loopEnabled: true`
- `maxLoops: 3`

### Archive

```text
【平台/人工后置步骤】使用 `openspec-superpowers-workflow` skill 执行归档阶段，并读取 `references/archive.md`。

输入：
- 原始需求：
{{taskPrompt}}
- 工作目录：{{gitWorktreePath}}
- 工作区根：{{workspacePath}}

执行要求：
1. 本节点不属于编码 Agent 或质检 Agent 的默认执行流程；仅在平台明确调度归档时运行。
2. 先读取 `workflow-state.md`；若 `phase-4-archive` 与 `phase-4-report` 已为 `[x]`，立即跳过本节点，不要重复执行 validate/archive。
3. 读取 `workflow-state.md`、`tasks.md`、阶段 3 报告和 `{{artifactsPath}}/code-review-report.json`。
4. 若验证、自动化测试或 Code Review 未完成，停止并写入 `taskResult.md`。
5. 检查 `proposal.md`、`design.md`、`plan.md`、`tasks.md`、`specs/`、`stage-reports/` 是否完整。
6. 标准模式下提示或调用平台执行 `openspec validate <change-id> --strict`；Agent 不依赖非交互 Shell 静默执行 OpenSpec CLI。
7. validate 通过后，提示或调用平台执行 `openspec archive <change-id> --yes`。
8. 只有用户或任务明确要求时，才 commit/push。
9. 写入 `openspec/changes/<change-id>/stage-reports/stage-4-archive.md`。
10. final 前重新读取 `workflow-state.md`；全部 `[x]` 才能声称 workflow 完成。

输出要求：
- 最终结论只能是 `已完成`、`部分完成` 或 `未完成`。
- 必须说明归档、验证、commit/push 状态和阻断项。
```

推荐配置：

- `requiresApproval: false`
- `loopEnabled: false`
- `maxLoops: 1`

## 任务包清单

飞书看板下发任务时建议包含：

- `WORKFLOW_PROMPTS.md`
- `openspec/changes/<change-id>/proposal.md`
- `openspec/changes/<change-id>/design.md`
- `openspec/changes/<change-id>/plan.md`
- `openspec/changes/<change-id>/tasks.md`
- `openspec/changes/<change-id>/workflow-state.md`
- `openspec/changes/<change-id>/specs/*/spec.md`
- `skills/openspec-superpowers-workflow/SKILL.md`
- `skills/openspec-superpowers-workflow/references/preflight-spec.md`
- `skills/openspec-superpowers-workflow/references/implementation.md`
- `skills/openspec-superpowers-workflow/references/verify-review.md`
- `skills/openspec-superpowers-workflow/references/archive.md`
- API 任务：`skills/api-change-auto-test/`、`api-test/runtime.json`、`.env.local.template`
- UI 任务：`skills/ui-automation-master/`、`skills/ui-automation-prep/`、`skills/ui-automation-run/`、`skills/ui-automation-repair/`
- Playwright 任务：`skills/playwright-skill/SKILL.md`、`skills/playwright-skill/references/`、`skills/playwright-skill/scripts/`

禁止包含：

- 真实 token
- 真实账号密码
- 生产凭据
- `.env.local` 真实值

## 结果文件

阻断或最终结果写入：

```text
docs/feature/{{gitBranch}}/taskResult.md
```

建议格式：

```markdown
# Task Result

状态：已完成 / 部分完成 / 未完成

## 已完成
- ...

## 未完成
- ...

## 阻断
- ...

## 验证
- ...

## 产物
- ...
```
