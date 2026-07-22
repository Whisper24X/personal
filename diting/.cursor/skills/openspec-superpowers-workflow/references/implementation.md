# Implementation

负责第二大阶段：按 `tasks.md` 和 `plan.md` 执行 TDD 实现，并通过 Completion Gate。

## 输入

必须读取：

- `openspec/changes/<change-id>/workflow-state.md`
- `openspec/changes/<change-id>/tasks.md`
- `openspec/changes/<change-id>/plan.md`
- `openspec/changes/<change-id>/design.md`
- `openspec/changes/<change-id>/stage-reports/stage-1-preflight-spec.md`

## 进入闸门

阶段 1 未完成时不得实现。缺阶段 1 报告、`workflow-state.md` 未勾选 `phase-1-preflight-spec` 或 `phase-1-report` 时，停止并写入 `docs/feature/{{gitBranch}}/taskResult.md`。

还必须确认：

- OpenSpec 制品人工确认卡点已记录在阶段 1 报告。
- `design.md` / `plan.md` 已声明技术栈 Profile。
- `tasks.md` 中 autonomous task 与 `spec.md` Scenario 可追踪。

## TDD 铁律

没有先失败的测试，不得写生产实现代码。

每个 autonomous task 必须执行：

1. RED：写失败测试。
2. Verify RED：确认失败原因正确。
3. GREEN：写最小实现。
4. Verify GREEN：确认测试通过。
5. REFACTOR：整理代码并保持测试通过。

先写实现的代码必须删除并从 RED 重来。缺测试基础设施时，先实现测试基础设施 task，不得跳过测试。

## 1. 获取实现指引

标准模式下，提示用户或平台执行：

```bash
openspec instructions apply --change "<change-id>" --json
```

消费输出中的 `contextFiles`、`tasks` 和约束；不要把 instructions 的 `context` / `rules` 原样写入业务文件。

降级模式下直接读取：

```text
openspec/changes/<change-id>/tasks.md
openspec/changes/<change-id>/plan.md
openspec/specs/<change-id>/spec.md
```

## 2. 技术栈 Profile 命令

执行测试、构建和 lint 时优先使用项目现有命令。无项目约定时，按主 `SKILL.md` Profile 选择：

- Go：`go test ./path -run TestXxx -v`、`go test ./... -cover`。
- TypeScript：`npx vitest run path/to/foo.test.ts` 或 `npx jest path/to/foo.test.ts`。
- JavaScript：`npm test`、`node --test` 或 Jest。
- Android：`./gradlew :<module>:test --tests "FooTest"`。
- Python：`pytest path/to/test_foo.py -v`。
- Rust：`cargo test test_name`。
- Java：`mvn test -Dtest=FooTest` 或 `gradlew test --tests FooTest`。

多模块仓库必须限定到变更子模块。

## 3. RED / GREEN / REFACTOR 细则

### RED：写失败测试

1. 先创建或编辑测试文件，覆盖当前 task 的期望行为。
2. 测试文件位置遵循 Profile 的 test mapping。
3. 运行单测，必须看到失败输出。
4. 确认失败原因是功能未实现、契约缺失或断言不满足，而不是语法错误、导入错误或测试写错。

RED 自检：

- 测试文件是否已创建。
- 失败命令和关键输出是否记录到阶段报告草稿。
- 失败原因是否与当前 task 对齐。

任一不满足，不得进入 GREEN。

### GREEN：最小实现

只写足以让 RED 测试通过的生产代码。运行同一测试，必须看到 PASS。不要在 GREEN 阶段做无关重构、样式整理或扩大范围。

### REFACTOR：受测试保护的整理

在测试通过后整理命名、结构、重复代码和边界处理。重构后至少重跑当前 task 单测；涉及共享代码时重跑相关 test suite。

## 4. 测试基础设施缺失

不得以“项目没有测试基础设施”为由跳过测试。正确处理：

1. 将“搭建测试基础设施”作为第一个 autonomous task。
2. 添加 runner 配置、mock/fake、test helper 或必要依赖。
3. 用一个最小失败测试验证基础设施可运行。
4. 后续 task 基于该基础设施继续 TDD。

确实不适合自动化测试的 task（纯生成文件、纯静态资源、纯声明配置等）必须在 `tasks.md` 旁标注原因，并在 `design.md` 风险部分记录替代验证方式。

## 5. 常见跳过模式

遇到这些想法必须停止：

| 想法 | 正确做法 |
| --- | --- |
| 功能太简单，不需要测试 | 简单功能的测试也应简单，先写 RED |
| 先实现再补测试 | 删除实现，从 RED 重来 |
| 外部依赖太多没法测 | 用 interface、mock、fake 隔离 |
| UI 组件不好测 | 使用对应栈的组件测试或可执行替代验证 |
| 配置/路由/IDL 不需要测 | 测解析、注册、序列化或契约 |
| 最后统一补测试 | 每个 task 独立 RED-GREEN-REFACTOR |

## Tasks 勾选

- 已实现且验证通过的 autonomous task 才能勾选 `[x]`。
- 未验证、外部依赖阻断、人工任务保持 `[ ]`。
- `taskResult.md` 不能替代 `tasks.md` 勾选。
- 每次勾选前重新读取 `tasks.md`，只修改当前已完成项，不批量假定完成。

## 完成度闸门

实现结束前重新读取 `tasks.md`：

- 存在未完成 autonomous task：回到实现或写阻断，不得交接质检。
- 只剩人工任务或全部 autonomous task 已完成：允许交接质检 Agent 执行验证与 Code Review。
- `openspec/specs/<change-id>/spec.md` 中每个 Scenario 必须能追踪到实现、测试或明确的人工验证任务。

## 自动化测试物准备

实现阶段可准备：

- `openspec/specs/<change-id>/spec.md`
- `skills/api-change-auto-test/api-test/runtime.json` 的非敏感配置
- UI `TEST.md` 的输入材料

不得在实现阶段声称 API/UI 自动化通过。

实现阶段完成后不得继续执行基础验证总验收、API/UI 自动化、Code Review 或 Archive；这些工作由平台 handoff 后的质检 Agent 承接。

## 阶段报告

写入：

```text
openspec/changes/<change-id>/stage-reports/stage-2-implementation.md
```

报告包含：

- 技术栈 Profile 和实际使用命令。
- 完成 tasks 列表。
- 测试文件和实现文件清单。
- 每个 autonomous task 的 RED / GREEN / REFACTOR 摘要和关键输出。
- `tasks.md` 勾选结果。
- 自动化测试物准备情况。
- 未完成项、人工任务和阻断项。

完成后勾选：

- `phase-2-implementation`
- `phase-2-completion-gate`
- `phase-2-report`
