---
name: backend-dev
description: Go 后端开发入口。用于后端 CRUD、业务 RPC、测试接口、聚合接口、数据库/GORM/Proto/API/Biz/Data/Service/Server/Wire/质量检查全流程。任何 Go 后端代码变更都必须先使用本技能，按任务分流执行流水线并完成质量门禁。
---

# Backend Dev

`backend-dev` 是 Go 后端开发任务的统一入口技能。
本技能负责决策、门禁、步骤顺序和最终验收；详细模板放在 `references/`。

## 0. Entry Contract

收到任何涉及 Go 后端服务的任务时，先执行本技能。
不要根据关键词绕过本技能的任务分流。
不要先写业务代码再补 Proto/API 生成。
不要把生成步骤、注册步骤或 Wire 留到最后凭记忆补。
开始前必须给出目标后端模块、任务类型、原因、流水线路径和是否需要用户确认。

### Module Discovery

开始执行流水线前，必须先识别当前后端模块：

- `BACKEND_DIR`：后端模块目录，优先使用用户指定目录；未指定时从当前任务涉及文件、`go.mod` 和 `Makefile` 推断。
- `GO_MODULE`：读取 `BACKEND_DIR/go.mod` 的 module 值。
- `API_DIR`：按当前模块实际 `api/**/v*` 目录识别；不存在时在 Proto 步骤规划新目录。
- `SQL_DIR`：按当前模块已有 `doc/sql/**` 或任务指定目录识别；不存在时按项目现有规范新建。
- `GORM_PACKAGES`：按当前模块 `internal/data/gorm/*_{model,dao,repo}` 或实际生成目录识别。

如果多个后端模块都合理，或模块边界不明确，先询问用户确认。

## 1. Golden Rules

- 开始编码前必须先做任务分流，并说明将执行的流水线步骤。
- 命中多个任务类型时，选择更完整的流程。
- 涉及 `.proto` 时，必须先完成 Proto 和 API Generation。
- 涉及 HTTP/gRPC API 契约时，必须先完成 Proto 和 API Generation。
- 涉及 API 入参/出参时，必须先完成 Proto 和 API Generation。
- 涉及业务 RPC 时，必须先完成 Proto 和 API Generation。
- 无表接口先按默认规则选择 Proto 归属：优先已有 proto，不合适再新建，归属不明确才询问用户。
- 表驱动 CRUD 优先通过表结构生成 proto。
- 生成 Repo 能满足调用时，优先使用当前模块 `internal/data/gorm/*_repo` 或实际生成 Repo 包。
- 不要为了转发生成 Repo 方法而在 Data 层再封装一层。
- 只有生成 Repo 缺能力时才在 `internal/data` 补自定义方法。
- 常量放到 `internal/data/constant`，写法见 [references/constants.md](references/constants.md)。
- 缓存 Key 放到 `internal/data/cache/cachekey.go`。
- 第三方 HTTP 请求放到 `internal/data/rpc`，必须复用统一注入的 `*resty.Client`，写法见 [references/http-rpc.md](references/http-rpc.md)。
- 新增方法必须有中文注释。
- Service 层只透传到 Biz，不写业务逻辑。
- Server 层新增服务后必须注册 HTTP Gateway server。
- 依赖注入变化后必须执行 `make wire`。
- 完成前必须执行 Quality Gate。
- Quality Gate 脚本通过后必须执行 Review Gate，按 [references/review-gate.md](references/review-gate.md) 做语义审查。
- 外部依赖或环境阻塞时必须输出阻塞命令、错误摘要、已完成工件、未验证项和下一步。
- `go build ./cmd/server` 生成的本地二进制必须清理。

## 2. Forbidden Actions

- 禁止创建额外后端子技能分散流程入口。
- 禁止手动编辑 `api/**/*.pb.go`。
- 禁止手动编辑 `api/**/*_http.pb.go`。
- 禁止手动编辑 `api/**/*_grpc.pb.go`。
- 禁止手动编辑 `api/**/*.pb.validate.go`。
- 禁止手动编辑 `doc/swagger/**/*.json`。
- 禁止手动编辑 `internal/data/gorm/**/*.gen.go`。
- 禁止手动编辑生成 DAO。
- 禁止跳过 HTTP 注册检查。
- 禁止跳过 ProviderSet 检查。
- 禁止跳过 Wire 生成。
- 禁止使用未在 Makefile 定义的生成命令。
- 禁止把 SQL 导入失败留给用户。
- 禁止提交 `go build ./cmd/server` 生成的本地二进制构建产物。

## 3. Task Router

| 任务类型 | 识别条件 | 必须步骤 |
| --- | --- | --- |
| 表驱动 CRUD | 新表、改表、标准增删改查 | Audit -> Database -> GORM -> Proto -> API Generation -> Code -> Quality |
| 已有表业务 RPC | 已有表/已有 proto，新增业务接口、过滤、状态变更 | Audit -> Proto -> API Generation -> Code -> Quality |
| 无表接口 | 测试接口、手动触发、聚合接口、同步任务触发 | Audit -> Resolve Proto Plan -> Proto -> API Generation -> Code -> Quality |
| 只改业务逻辑 | 不改表、不改 proto、不改 API 入参出参 | Audit -> Code -> Quality |
| 只改数据库/GORM | 只涉及表结构或模型生成 | Audit -> Database -> GORM -> Quality |
| 只重新生成代码 | 用户明确要求重新生成 API/GORM/Wire | Audit -> Requested Generation -> Quality |

任务分流细节见 [references/task-router.md](references/task-router.md)。

## 4. Pipeline Overview

流水线按以下步骤执行。
每一步只在命中条件时执行，但 Audit 和 Quality 必须执行。
任何步骤发现前置工件缺失时，回到缺失工件所在步骤补齐。

### Step 1: Audit

目标：确定任务类型、工件现状、起始步骤和必须执行的后续步骤。
必须检查 SQL、GORM、Proto、API generated files、Biz、Service、ProviderSet、HTTP registration、Wire。
必须输出任务类型、起点、后续步骤和风险。
详细清单见 [references/audit-checklist.md](references/audit-checklist.md)。

### Step 2: Database

仅在新表、改表或菜单 SQL 注入时执行。
SQL 目录以当前模块实际目录为准。
已有 SQL 目录优先复用；不存在时按当前项目规范选择 `doc/sql/{module}/` 或任务指定目录。
需要立即生效的 SQL 必须执行导入。

```bash
cd <backend-dir> && make sqlimport <sql-file>
```

导入失败必须修复后重试。
详细规范见 [references/database.md](references/database.md)。

### Step 3: GORM

表结构新增或变更后执行。

```bash
cd <backend-dir> && make gorm
```

生成后只验证，不手动编辑生成文件。
详细规范见 [references/gorm.md](references/gorm.md)。

### Step 4: Proto

表驱动接口优先通过表结构生成：

```bash
cd <backend-dir> && make sqltopb <position> {table}
```

已有 proto 的业务 RPC 在现有 proto 上编辑。
无表接口先按默认规则确定 Proto 归属；只有多个方案都合理或模块边界不明确时才询问用户。
任何 proto 修改后必须进入 API Generation。
详细规则见 [references/proto.md](references/proto.md)。

### Step 5: API Generation

当前标准生成顺序：

```bash
cd <backend-dir> && make api
cd <backend-dir> && make protocode
```

`make api` 生成接口代码，`make protocode` 生成 data/biz/service 基线代码。涉及 Proto/API 变更时，两步都必须执行。
详细规则见 [references/api-generation.md](references/api-generation.md)。

### Step 6: Code

实现顺序固定为 Biz -> Data -> Service -> Server -> Wire。
Biz 写 UseCase、Repo 接口和业务方法。
Data 优先调用生成 Repo；仅在缺失能力时补充自定义方法。
第三方 HTTP 请求按 `internal/data/rpc` 形态封装，复用统一 Resty 客户端。
Service 只透传到 Biz。
Server 注入 service 参数并注册 HTTP Gateway server。
Wire 在注入关系变更后必须执行。
详细模板见 [references/biz-service-server.md](references/biz-service-server.md) 和 [references/http-rpc.md](references/http-rpc.md)。

### Step 7: Quality

最低验证：

```bash
cd <backend-dir> && make wire
cd <backend-dir> && gofmt -w <changed-go-files>
cd <backend-dir> && go test ./internal/biz ./internal/service ./internal/server ./internal/data
cd <backend-dir> && go build ./cmd/server
cd <workspace-root> && .agents/skills/backend-dev/scripts/compliance-verify.sh --backend-dir <backend-dir> --task-type <type>
```

执行 `go build ./cmd/server` 后如果生成 `<backend-dir>/server`，必须删除。
涉及 Proto/API 或 GORM 生成时，合规脚本必须重新执行标准生成命令并用 `git diff` 验证生成结果一致。
脚本硬校验通过后，必须按 Review Gate 复核语义问题、命中反例和新反例回灌建议。
详细门禁见 [references/quality-gate.md](references/quality-gate.md)。

## 5. Step Gates

### Audit Gate

- 已识别 position：`shadow`、`app` 或 `N/A`。
- 已识别 table_name：具体表名或 `N/A`。
- 已识别 goal：CRUD、业务 RPC、测试接口、聚合接口、只改逻辑等。
- 已识别 BACKEND_DIR、GO_MODULE、API_DIR、SQL_DIR 和 GORM_PACKAGES。
- 已检查 SQL 是否存在。
- 已检查 GORM model/dao/repo 是否存在。
- 已检查 proto 是否存在。
- 已检查 API 生成文件是否存在。
- 已检查 Biz/Service 是否存在。
- 已检查本次新增/修改的业务常量是否归属 `internal/data/constant`。
- 已检查 ProviderSet 是否注册。
- 已检查 HTTP server 是否注册。
- 已检查 Wire 是否需要更新。
- 已输出建议起点。

### Database Gate

- SQL 文件保存到当前模块实际目录。
- SQL 包含必要注释。
- 数据库变更脚本具备幂等性。
- 菜单 SQL 不硬编码 UUID。
- 需要立即生效时已执行 `make sqlimport`。
- 导入失败已修复并重试。
- 表结构结果已验证。

### GORM Gate

- 已执行 `make gorm`。
- 对应 model 文件存在。
- 对应 dao 文件存在。
- 对应 repo 文件存在。
- 生成字段与 SQL 字段一致。
- 未手动修改生成文件。

### Proto Gate

- 表驱动 CRUD 已优先走 `sqltopb`。
- 已有表业务 RPC 已编辑对应 proto。
- 无表接口已按默认规则确定 Proto 归属，或已在归属不明确时获得用户确认。
- RPC 注释说明用途。
- HTTP route 已定义。
- 请求 message 已定义。
- 响应 message 已定义。
- validate 规则按需补充。
- Proto 修改后已进入 API Generation。

### API Generation Gate

- 已执行 `make api`。
- pb 文件已生成或更新。
- http pb 文件已生成或更新。
- grpc pb 文件已生成或更新。
- validate 文件已生成或更新。
- swagger 已生成或更新。
- 未手动编辑生成文件。
- 已执行 `make protocode` 生成 data/biz/service 基线代码。

### Code Gate

- Biz UseCase 已实现。
- Repo 接口已定义或扩展。
- Data 层优先复用生成 Repo。
- 自定义 Data 方法有明确必要性。
- DTO 转换放在合适位置。
- 常量已放入 `internal/data/constant`，Biz 层直接引用 `constant.*`，不得新增同义别名。
- 第三方 HTTP RPC 已复用统一 `*resty.Client`，没有在业务代码中直接 `resty.New()`。
- 第三方 HTTP 请求已设置 `SetContext(ctx)`、`EnableTrace()`，并使用项目封装的 `CheckStatus(resp)` 或等价方法检查响应状态。
- 新增 HTTP RPC 已注册到 `internal/data/data.go` ProviderSet，依赖注入变化后已执行 Wire。
- 新增方法有中文注释。
- Service 只透传。
- Service ProviderSet 已注册。
- HTTP Gateway server 参数已注入。
- HTTP Gateway server 注册函数已调用。
- Wire 需要更新时已执行。

### Quality Gate

- HTTP 注册已确认。
- ProviderSet 已确认。
- `make wire` 已执行。
- Go 文件已 gofmt。
- 已扫描 `internal/biz` 中是否新增业务常量，并确认无违规常量定义。
- 已运行 `compliance-verify.sh`，并处理生成一致性、HTTP RPC、注册、Wire 和构建产物检查结果。
- 已执行 Review Gate；如果无法独立审查，最终结果标注为 `self-review`。
- Review Gate 的 `Blocker` 和 `Major` 问题已修复后重新验证。
- 目标包测试已执行或说明原因。
- `go build ./cmd/server` 已执行或说明原因。
- 构建产物已清理。
- 可选脚本已按需执行。

## 6. Command Canon

标准 API 生成顺序：

```bash
cd <backend-dir> && make api
cd <backend-dir> && make protocode
```

标准 Wire 命令：

```bash
cd <backend-dir> && make wire
```

标准 GORM 命令：

```bash
cd <backend-dir> && make gorm
```

标准 SQL 导入命令：

```bash
cd <backend-dir> && make sqlimport <sql-file>
```

如用户口径与 Makefile 不一致，先核对 Makefile，再说明差异。
不要猜测不存在的命令目标。

## 7. Optional Verification Scripts

可以运行：

```bash
cd .agents/skills/backend-dev && ./scripts/flow-verify.sh
cd .agents/skills/backend-dev && ./scripts/compliance-verify.sh --backend-dir <backend-dir> --task-type <type>
cd .agents/skills/backend-dev && ./scripts/artifacts-verify.sh
cd .agents/skills/backend-dev && ./scripts/docs-verify.sh
```

`flow-verify.sh` 用于检查后端基础工件和可选 HTTP 注册。
`compliance-verify.sh` 是合规校验总入口，加载 `scripts/` 下的 `compliance-*.sh` 专项脚本检查生成一致性、HTTP RPC、ProviderSet、Wire、业务常量和构建产物。
`artifacts-verify.sh` 用于检查构建产物和未定义命令残留。
`docs-verify.sh` 用于检查技能文档路径、Makefile target 和 Markdown 链接。
脚本只做辅助检查，不能替代编译、测试和人工判断。

## 8. Final Output Template

完成后按此格式汇报：

```markdown
## Backend Dev Result

- Task type: 表驱动 CRUD / 已有表业务 RPC / 无表接口 / 只改业务逻辑 / 其他
- Pipeline: Audit -> ...
- Proto/API: 已执行 / 未涉及 / 已说明例外
- Commands: make api, make protocode, make wire, go test ...
- Verification: 通过 / 未执行原因
- Compliance: 通过 / 未执行原因 / 阻塞项
- Review Gate: independent / self-review / blocked，Findings: none / ...
- Matched anti-patterns: 无 / AP-...
- New anti-pattern suggestions: 无 / 标题、Bad、Good、Why、Detect 草案
- Unverified semantic checks: 无 / ...
- Artifacts: 无构建产物残留 / 已清理
- Blockers: 无 / 阻塞命令、错误摘要、未验证项和下一步
- Risks: 无 / ...
```

## 9. Reference Index

- Task routing: [references/task-router.md](references/task-router.md)
- Project context: [references/project-context.md](references/project-context.md)
- Audit: [references/audit-checklist.md](references/audit-checklist.md)
- Database: [references/database.md](references/database.md)
- Schema/Menu templates: [references/schema-guide.md](references/schema-guide.md)
- GORM: [references/gorm.md](references/gorm.md)
- Constants: [references/constants.md](references/constants.md)
- Proto: [references/proto.md](references/proto.md)
- Proto templates: [references/templates-proto.md](references/templates-proto.md)
- API generation: [references/api-generation.md](references/api-generation.md)
- Code: [references/biz-service-server.md](references/biz-service-server.md)
- Biz templates: [references/templates-biz.md](references/templates-biz.md)
- Service templates: [references/templates-service.md](references/templates-service.md)
- Server templates: [references/templates-server.md](references/templates-server.md)
- Data/Error templates: [references/templates-data.md](references/templates-data.md)
- Third-party HTTP RPC: [references/http-rpc.md](references/http-rpc.md)
- Quality: [references/quality-gate.md](references/quality-gate.md)
- Review Gate: [references/review-gate.md](references/review-gate.md)
- Examples: [references/examples.md](references/examples.md)
