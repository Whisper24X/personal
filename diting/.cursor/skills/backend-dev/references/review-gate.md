# Review Gate

## 目的

Review Gate 用于在脚本硬校验之后，复核 AI 生成的后端代码是否符合人类约定、分层职责和 `backend-dev` 规则。

脚本通过不代表 Review Gate 通过。脚本负责可机械判断的问题，Review Gate 负责语义、分层、边界和可维护性判断。

## 执行原则

- 审查者只审查 diff，不修改代码。
- 优先使用独立审查上下文；无法独立执行时，最终报告必须标注为 `self-review`。
- 不创建新的后端开发 skill，不绕过 `backend-dev` 统一入口。
- Review Gate 发现 `Blocker` 或 `Major` 时，必须回到对应步骤修复后重新执行 Quality Gate。
- 基础命令或 `compliance-verify.sh` 阻塞时，Review Gate 不能标记为通过。

## 输入

审查时必须读取：

- 本次 `git diff`。
- `SKILL.md`。
- `references/quality-gate.md`。
- `references/examples.md`，包括正向流程示例和反例库。
- 与本次变更相关的业务文件。
- 已执行的脚本验证结果。

## 严重级别

| Severity | 说明 | 处理要求 |
| --- | --- | --- |
| `Blocker` | 违反生成流程、注册、Wire、生成物、编译等硬性门禁 | 必须修复后重新执行 Quality Gate |
| `Major` | 分层职责错误、业务边界错误、数据访问方式明显偏离团队约定 | 必须修复后重新执行相关验证 |
| `Minor` | 局部可维护性、命名、注释、错误包装等问题 | 建议修复；如不修复需说明原因 |
| `Suggestion` | 可选优化，不影响本次交付正确性 | 可记录为建议 |

## 通过判定

Review Gate 通过必须同时满足：

- 脚本硬校验为 `passed`。
- 没有未修复的 `Blocker` 或 `Major`。
- 命中的反例已记录 ID 和标题。
- 新类型偏移已给出反例回灌建议，或说明无需沉淀。
- 尚未自动化覆盖的语义检查项已列入 `Unverified Semantic Checks`。

如果基础命令或脚本硬校验阻塞，Review Gate 只能输出 `blocked`，不能输出通过。

## 审查清单

### 流程与生成

- 任务分流是否正确。
- 涉及 Proto/API 时是否执行 `make api` 和 `make protocode`。
- 涉及 GORM 时是否执行 `make gorm`。
- 依赖注入变化后是否执行 `make wire`。
- 是否存在手工编辑生成文件的迹象。

### 分层职责

- Service 层是否只透传到 Biz。
- Biz 是否承载业务编排、校验和 UseCase 方法。
- Data 是否优先复用生成 Repo。
- Data 是否只在生成 Repo 缺能力时补自定义查询、DTO、事务、缓存或外部资源组合。
- Server 是否只做注入和 HTTP Gateway 注册。

### 常量、错误和注释

- 业务常量是否放在 `internal/data/constant`。
- Biz 是否直接引用 `constant.*`，没有新增同义别名。
- 新增方法是否有中文注释。
- 错误码和错误包装是否符合当前模块风格。

### 第三方 HTTP 请求

- HTTP RPC 是否放在 `internal/data/rpc`。
- 是否复用统一注入的 `*resty.Client`。
- 请求是否包含 `SetContext(ctx)` 和 `EnableTrace()`。
- 响应状态是否通过当前模块 `goresty/restry` 封装的 `CheckStatus(resp)` 或等价方法检查。
- URL 来源、错误包装和日志脱敏是否符合当前模块风格。

### 反例匹配

- 必须检查 `references/examples.md` 的 `反例库`。
- 如果命中反例，审查结果必须写出反例 ID 和标题。
- 如果发现新类型偏移但没有命中已有反例，输出新反例回灌建议。

## 输出模板

```markdown
## Review Gate Result
- Reviewer: independent / self-review
- Diff scope:
- Script gate: passed / failed / blocked

### Findings
- Severity: Blocker / Major / Minor / Suggestion
- Rule:
- Matched anti-pattern: ID / title / N/A
- Evidence:
- Fix direction:
- Detect: script / review / future-ast / manual

### New Anti-pattern Suggestions
- ID:
- Title:
- Bad:
- Good:
- Why:
- Detect:

### Unverified Semantic Checks
- ...
```

如果没有发现问题，`Findings` 必须写 `none`，并仍需列出尚未被脚本自动覆盖的语义检查项。
