# Verify And Review

负责第三大阶段：基础验证、适用的 API/UI 自动化、Code Review 和修复闭环。该阶段只由质检 Agent 执行；不得承担需求实现。

## 输入

必须读取：

- `openspec/changes/<change-id>/workflow-state.md`
- `openspec/changes/<change-id>/tasks.md`
- `openspec/changes/<change-id>/design.md`
- `openspec/changes/<change-id>/plan.md`
- `openspec/changes/<change-id>/stage-reports/stage-2-implementation.md`
- `artifacts/implementation-handoff.json`

## 进入闸门

阶段 2 未完成时不得验证。缺阶段 2 报告，或 `workflow-state.md` 未勾选 `phase-2-implementation`、`phase-2-completion-gate`、`phase-2-report` 时，停止并写入 `docs/feature/{{gitBranch}}/taskResult.md`。

还必须确认：

- `tasks.md` 中 autonomous task 已完成或有明确阻断。
- 阶段 2 报告包含 RED / GREEN / REFACTOR 证据。
- `design.md` 或阶段 2 报告包含技术栈 Profile。

## 基础验证

按技术栈 Profile 执行：

- build / compile
- typecheck（如支持）
- test
- lint / static analysis
- 编辑器诊断
- OpenSpec Scenario 覆盖核对

没有运行命令并看到输出，不得声称通过。

### 1. 评审基线

确定 diff 基线，供测试存在性、Code Review 和报告使用：

```bash
BASE_BRANCH=${BASE_BRANCH:-$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@')}
if [ -z "$BASE_BRANCH" ]; then
  for b in master main develop; do
    if git show-ref --verify --quiet "refs/heads/$b" || git show-ref --verify --quiet "refs/remotes/origin/$b"; then
      BASE_BRANCH=$b
      break
    fi
  done
fi
[ -n "$BASE_BRANCH" ] || BASE_BRANCH=master
BASE_SHA=$(git merge-base HEAD "$BASE_BRANCH")
HEAD_SHA=$(git rev-parse HEAD)
echo "BASE_BRANCH=$BASE_BRANCH BASE_SHA=$BASE_SHA HEAD_SHA=$HEAD_SHA"
```

### 2. 构建 / 类型检查

按项目命令或 Profile 执行 build / compile。TypeScript、Python 等有独立 typecheck 时也执行。命令失败必须修复后重跑，不得跳过。

常见示例：

- Go：`go build ./...`
- TypeScript：`npm run build`、`npx tsc --noEmit`
- Android：`./gradlew assembleDebug`
- Python：`python -m build`、`mypy .` / `pyright`
- Rust：`cargo build`
- Java：`mvn compile` / `gradlew compileJava`

### 3. 测试存在性验证

检查本次变更中每个新增或修改的实现源文件是否有对应测试。按 Profile 的 test mapping 推导：

| Profile | 实现文件 | 对应测试 |
| --- | --- | --- |
| `go` | `foo.go` | 同目录 `foo_test.go` |
| `typescript` | `foo.ts(x)` | 同目录 `foo.test.ts(x)` 或 `foo.spec.ts(x)` |
| `javascript` | `foo.js(x)` | `foo.test.js(x)` 或 `__tests__/foo.js` |
| `android` | `src/main/.../Foo.kt` | `src/test/.../FooTest.kt` 或 `src/androidTest/...` |
| `python` | `foo.py` | `test_foo.py` 或 `tests/test_foo.py` |
| `rust` | `foo.rs` | 同文件 `#[cfg(test)]` 或 `tests/` 集成测试 |
| `java` | `Foo.java` | `src/test/java/.../FooTest.java` |

豁免项必须在阶段报告中说明：

- 纯生成文件。
- 纯静态资源或声明文件。
- `design.md` 已标注无自动化测试且提供替代验证。

发现缺测试时回到 `Implement` 补写，不得继续。

### 4. 测试运行

运行全量或受影响范围测试。若项目测试成本高，可先运行受影响测试，再运行 CI 等价命令；无法全量运行必须在报告中说明原因和风险。

### 5. Lint / 静态分析 / 编辑器诊断

按优先级执行：

1. 项目已有 lint / static analysis 命令。
2. Profile 默认 lint 命令。
3. Cursor `ReadLints` 检查已修改文件。

### 6. OpenSpec Scenario 覆盖

读取 `openspec/specs/<change-id>/spec.md`，逐条核对每个 Scenario 的 WHEN/THEN 是否有：

- 对应实现代码。
- 对应测试或自动化 case。
- 或明确的人工验证任务。

遗漏时回到实现或补充任务。

## API 自动化

当存在 API spec 或任务要求接口自动化时，调用 `api-change-auto-test`。

任务包要求：

- `skills/api-change-auto-test/`
- `skills/api-change-auto-test/api-test/runtime.json`
- `.env.local.template` 或鉴权变量说明

执行门禁：

1. API parser 只认反引号包裹的 `` `METHOD /path` ``。
2. 0 endpoint 不算通过。
3. token 只能来自运行环境或 `.env.local`，不得来自飞书附件真实值。
4. `check-auth-ready` 通过且 backend health ready 后执行：

```bash
export SKILL_WORKSPACE_ROOT="{{workspacePath}}"
bash skills/api-change-auto-test/scripts/run-api-change-suite.sh smoke <change-id>
```

`smoke` 通过后会自动衔接 full。读取：

```text
tmp/api-test-reports/<change-id>/summary.md
```

smoke 或 full 任一失败，不得声称接口验证通过。

## UI 自动化

当存在 UI 变更、`TEST.md` 或任务要求 UI 自动化时，调用 `skills/ui-automation-master/SKILL.md` 作为主入口。workflow reference 不直接串联子 reference，除非该 UI skill 明确要求。

```text
ui-automation-master/SKILL.md -> ui-automation-prep | ui-automation-run | ui-automation-repair
```

规则：

- UI 执行必须使用 `playwright-skill`；不得使用 MCP、CDP、browser-mcp 或 DevTools MCP 作为执行器。
- 原生小程序不作为 Playwright 直接执行目标；Taro 跨端项目优先使用目标仓启动时的 H5 入口测试，并在 `TEST.md` 标注为 `H5端`。
- `ui-automation-prep` 生成或优化 `TEST.md`，必须包含 `覆盖范围`、`本轮是否执行`、`环境前提`、`不执行原因`。
- `ui-automation-run` 只执行 `本轮是否执行=是` 的浏览器可执行 case，并产出 Playwright 证据、指标和 review bridge。
- `SKIPPED_*` 不计入失败率。
- 无 Playwright 脚本、截图/trace、DOM、console、网络和指标证据不得落结论。
- 正确 case 的 FAIL 必须进入 `ui-automation-repair` 最小修复，再由 `ui-automation-run` 重跑。
- 最终收口必须回到 `ui-automation-master` 判断。

标准输出路径：

```text
docs/<branch>/tasks/<taskId>/testExecutionReport.md
docs/<branch>/tasks/<taskId>/testExecutionResult.md
docs/<branch>/tasks/<taskId>/artifacts/playwright/
```

## Code Review

基础验证和适用的自动化测试完成后执行 code review：

- 使用 `subagent_type="code-reviewer"`，或当前环境的等价代码评审能力。
- 提供 `proposal.md`、`spec.md`、`design.md`、`plan.md`、阶段 2 报告、`BASE_SHA`、`HEAD_SHA`。
- Review 重点：正确性、需求覆盖、测试质量、错误处理、安全、可维护性、与项目模式一致性。

- CRITICAL：修复并完整重跑验证。
- IMPORTANT：修复并重跑受影响验证。
- SUGGESTION：记录到阶段报告或 `design.md` Open Questions。
- Code Review 发现问题后的修复仍归属本阶段闭环；修复后必须回到基础验证和适用自动化重跑，再更新阶段报告。

## 阶段报告

写入：

```text
openspec/changes/<change-id>/stage-reports/stage-3-verification-review.md
```

同时写入供 Diting 读取的结构化报告：

```text
artifacts/code-review-report.json
```

最小结构：

```json
{
  "schemaVersion": "diting.codeReviewReport.v1",
  "passed": true,
  "summary": "基础验证、适用自动化和 Code Review 均通过",
  "findings": [],
  "checks": [
    { "name": "build", "status": "passed", "summary": "命令和结果摘要" },
    { "name": "test", "status": "passed", "summary": "命令和结果摘要" },
    { "name": "code-review", "status": "passed", "summary": "review 结论" }
  ]
}
```

报告包含：

- 技术栈 Profile、`BASE_SHA`、`HEAD_SHA`。
- build / typecheck / test / lint / ReadLints 命令与结果。
- 测试存在性检查结果和豁免项。
- OpenSpec Scenario 覆盖结果。
- API 自动化适用性、命令、summary 路径和结论；不适用时说明 N/A。
- UI 自动化适用性、`TEST.md`、Playwright 证据路径和结论；不适用时说明 N/A。
- Code Review 结果、问题修复和重跑验证。
- 是否允许进入 Archive。

完成后勾选：

- `phase-3-verification-review`
- `phase-3-api-automation`（适用或明确 N/A）
- `phase-3-ui-automation`（适用或明确 N/A）
- `phase-3-code-review`
- `phase-3-report`
