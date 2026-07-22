# Quality Gate

## 前置检查

执行命令前先确认本次新增/修改的 HTTP Service 已注册：

```bash
rg "Register{Service}HTTPServer" <backend-dir>/internal/server/http.go
```

找不到注册时，立即回到 Code 步骤补充 server 注入，不要继续执行生成或构建。

## 必须执行

按影响范围执行最低验证：

```bash
cd <backend-dir> && make wire
cd <backend-dir> && gofmt -w <changed-go-files>
cd <backend-dir> && rg "const \(" internal/biz -g "*.go"
cd <backend-dir> && go test ./internal/biz ./internal/service ./internal/server ./internal/data
cd <backend-dir> && go build ./cmd/server
cd <workspace-root> && .agents/skills/backend-dev/scripts/compliance-verify.sh --backend-dir <backend-dir> --task-type <type>
```

`rg "const \(" internal/biz -g "*.go"` 用于确认 Biz 层没有新增业务常量；若发现本次新增的场景、状态、类型、规则版本等常量，迁移到 `internal/data/constant` 后再继续。

如果 `go build ./cmd/server` 生成 `<backend-dir>/server`，必须删除。

`compliance-verify.sh` 是合规校验总入口，加载 `scripts/` 下的 `compliance-*.sh` 专项脚本检查技能硬规则。涉及 Proto/API 或 GORM 生成时，脚本会重新执行标准生成命令，并用 `git diff` 判断生成物是否缺失、过期或被手工修改。

脚本硬校验通过后，必须执行 Review Gate。Review Gate 规则见 [review-gate.md](review-gate.md)。

## 有条件执行

```bash
cd <backend-dir> && make gci
cd <backend-dir> && make lint
```

`make lint` 如果因历史问题失败，要区分本次引入问题和既有问题，并在结果中说明。

## 阻塞处理

如果数据库连接、`yc_turbo_kit`/`buf`/`wire` 安装、权限、网络或本地环境导致命令无法继续，不要无限重试，也不要把未验证项标记为通过。按以下模板输出阻塞结果：

```markdown
## Blocked Result
- Blocked command:
- Error summary:
- Completed artifacts:
- Unverified items:
- Next action needed:
```

阻塞前已产生的代码或生成物仍需检查 diff，并说明哪些变更属于本次任务。

基础命令或 `compliance-verify.sh` 阻塞时，不得把 Review Gate 标记为通过；最终结果必须说明 Review Gate 未执行或仅能进行 `self-review` 的原因。

## 生成物检查

- Proto 修改后，确认已先执行 `make api` 生成 pb/http/grpc/validate/swagger。
- Proto 修改后，确认 pb/http/grpc/validate/swagger 文件存在。
- Proto 修改后，确认已执行 `make protocode` 并基于生成后的 data/biz/service 文件继续实现。
- Proto/API 生成后，重新执行 `make api && make protocode`，确认工作区 diff 不再产生新的生成物差异。
- GORM 生成后，重新执行 `make gorm`，确认工作区 diff 不再产生新的 model/dao/repo 差异。
- Wire 修改后，确认 `cmd/server/wire_gen.go` 更新。
- 不保留本地二进制、临时探针、调试脚本，除非用户明确要求。

## 第三方 HTTP 请求检查

新增或修改 `internal/data/rpc` 中的 HTTP 请求时，必须检查：

- 使用统一注入的 `*resty.Client`，不得在业务 RPC 方法内直接 `resty.New()`。
- 请求链路包含 `SetContext(ctx)` 和 `EnableTrace()`。
- 响应状态通过当前模块 `goresty/restry` 封装的 `CheckStatus(resp)` 或等价公共方法检查。
- 新增 `New*HttpRpc` 已注册到 `internal/data/data.go` ProviderSet。
- 依赖注入变化后已执行 `make wire`，并确认 `cmd/*/wire_gen.go` 更新或无新增 diff。

## 规则分类

脚本硬校验覆盖：

- 生成一致性；
- HTTP Gateway 注册；
- ProviderSet 和 Wire 工件；
- Biz 业务常量位置；
- 第三方 HTTP RPC 基础写法；
- 生成文件和构建产物残留。

人工或 AI 复核覆盖：

- 任务分流是否正确；
- Service 层是否只透传；
- Data 层是否优先复用生成 Repo；
- 第三方 HTTP 请求的 URL 来源、错误包装和日志脱敏是否符合当前模块风格；
- 查询字段、更新字段是否来自实际 model；
- 阻塞项说明是否完整。

## Review Gate

Review Gate 在脚本硬校验之后执行，负责脚本难以覆盖的语义、分层和人类标准问题。

执行要求：

- 审查者只审查 diff，不修改代码。
- 优先使用独立审查上下文；无法独立执行时，最终报告标注为 `self-review`。
- 必须读取 `examples.md` 中的正向示例和反例库。
- 命中反例时，审查结果必须标注反例 ID 和标题。
- 发现新类型偏移但未命中现有反例时，最终报告必须给出新反例回灌建议。
- `Blocker` 和 `Major` 问题必须回到对应 Code/API/Data/Service 步骤修复后重新验证。

## 输出模板

```markdown
## Quality Result
| Check | Status | Notes |
| --- | --- | --- |
| HTTP registration | ✅/❌ | ... |
| make protocode | ✅/❌ | ... |
| make wire | ✅/❌ | ... |
| gofmt | ✅/❌ | ... |
| constants scan | ✅/❌ | ... |
| compliance script | ✅/❌ | ... |
| Review Gate | ✅/❌ | independent / self-review / blocked |
| go test | ✅/❌ | ... |
| go build | ✅/❌ | ... |
| artifact cleanup | ✅/❌ | ... |
```
