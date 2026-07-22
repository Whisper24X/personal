---
name: backend-dev
description: studyspace-service 唯一后端开发入口。用于后端 CRUD、业务 RPC、测试接口、聚合接口、数据库/GORM/Proto/API/Biz/Data/Service/Server/Wire/质量检查全流程。任何 studyspace-service 代码变更都必须先使用本技能，按任务分流执行流水线并完成质量门禁。
---

# Backend Dev

`backend-dev` 是 `studyspace-service` 唯一可触发的后端开发技能。
本技能负责决策、门禁、步骤顺序和最终验收；详细模板放在 `references/`。

## 0. Entry Contract

收到任何涉及 `studyspace-service` 的任务时，先执行本技能。
不要根据关键词绕过本技能的任务分流。
不要先写业务代码再补 Proto/API 生成。
不要把生成步骤、注册步骤或 Wire 留到最后凭记忆补。
开始前必须给出任务类型、原因、流水线路径和是否需要用户确认。

## 1. Golden Rules

- 开始编码前必须先做任务分流，并说明将执行的流水线步骤。
- 命中多个任务类型时，选择更完整的流程。
- 涉及 `.proto` 时，必须先完成 Proto 和 API Generation。
- 涉及 HTTP/gRPC API 契约时，必须先完成 Proto 和 API Generation。
- 涉及 API 入参/出参时，必须先完成 Proto 和 API Generation。
- 涉及业务 RPC 时，必须先完成 Proto 和 API Generation。
- 无表接口先按默认规则选择 Proto 归属：优先已有 proto，不合适再新建，归属不明确才询问用户。
- 表驱动 CRUD 优先通过表结构生成 proto。
- 生成 Repo 能满足调用时，优先使用 `internal/data/gorm/studyspace_service_repo`。
- 不要为了转发生成 Repo 方法而在 Data 层再封装一层。
- 只有生成 Repo 缺能力时才在 `internal/data` 补自定义方法。
- 常量放到 `internal/data/constant`，写法见 [references/constants.md](references/constants.md)。
- 缓存 Key 放到 `internal/data/cache/cachekey.go`。
- 新增方法必须有中文注释。
- Service 层只透传到 Biz，不写业务逻辑。
- Server 层新增服务后必须注册 HTTP Gateway server。
- 依赖注入变化后必须执行 `make wire`。
- 完成前必须执行 Quality Gate。
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
- 禁止提交 `studyspace-service/server` 构建产物。

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
当前学习空间相关 SQL 优先放在 `studyspace-service/doc/sql/studyspace_crm/`。
需要立即生效的 SQL 必须执行导入。

```bash
cd studyspace-service && make sqlimport ./doc/sql/studyspace_crm/{file}.sql
```

导入失败必须修复后重试。
详细规范见 [references/database.md](references/database.md)。

### Step 3: GORM

表结构新增或变更后执行。

```bash
cd studyspace-service && make gorm
```

生成后只验证，不手动编辑生成文件。
详细规范见 [references/gorm.md](references/gorm.md)。

### Step 4: Proto

表驱动接口优先通过表结构生成：

```bash
cd studyspace-service && make sqltopb shadow {table}
cd studyspace-service && make sqltopb app {table}
```

已有 proto 的业务 RPC 在现有 proto 上编辑。
无表接口先按默认规则确定 Proto 归属；只有多个方案都合理或模块边界不明确时才询问用户。
任何 proto 修改后必须进入 API Generation。
详细规则见 [references/proto.md](references/proto.md)。

### Step 5: API Generation

当前标准生成顺序：

```bash
cd studyspace-service && make api
cd studyspace-service && make protocode
```

`make api` 生成接口代码，`make protocode` 生成 data/biz/service 基线代码。涉及 Proto/API 变更时，两步都必须执行。
详细规则见 [references/api-generation.md](references/api-generation.md)。

### Step 6: Code

实现顺序固定为 Biz -> Data -> Service -> Server -> Wire。
Biz 写 UseCase、Repo 接口和业务方法。
Data 优先调用生成 Repo；仅在缺失能力时补充自定义方法。
Service 只透传到 Biz。
Server 注入 service 参数并注册 HTTP Gateway server。
Wire 在注入关系变更后必须执行。
详细模板见 [references/biz-service-server.md](references/biz-service-server.md)。

### Step 7: Quality

最低验证：

```bash
cd studyspace-service && make wire
cd studyspace-service && gofmt -w <changed-go-files>
cd studyspace-service && go test ./internal/biz ./internal/service ./internal/server ./internal/data
cd studyspace-service && go build ./cmd/server
```

执行 `go build ./cmd/server` 后如果生成 `studyspace-service/server`，必须删除。
详细门禁见 [references/quality-gate.md](references/quality-gate.md)。

## 5. Step Gates

### Audit Gate

- 已识别 position：`shadow`、`app` 或 `N/A`。
- 已识别 table_name：具体表名或 `N/A`。
- 已识别 goal：CRUD、业务 RPC、测试接口、聚合接口、只改逻辑等。
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
- 目标包测试已执行或说明原因。
- `go build ./cmd/server` 已执行或说明原因。
- 构建产物已清理。
- 可选脚本已按需执行。

## 6. Command Canon

标准 API 生成顺序：

```bash
cd studyspace-service && make api
cd studyspace-service && make protocode
```

标准 Wire 命令：

```bash
cd studyspace-service && make wire
```

标准 GORM 命令：

```bash
cd studyspace-service && make gorm
```

标准 SQL 导入命令：

```bash
cd studyspace-service && make sqlimport ./doc/sql/studyspace_crm/{file}.sql
```

如用户口径与 Makefile 不一致，先核对 Makefile，再说明差异。
不要猜测不存在的命令目标。

## 7. Optional Verification Scripts

可以运行：

```bash
cd .agents/skills/backend-dev && ./scripts/verify-backend-flow.sh
cd .agents/skills/backend-dev && ./scripts/check-generated-artifacts.sh
cd .agents/skills/backend-dev && ./scripts/verify-skill-docs.sh
```

`verify-backend-flow.sh` 用于检查后端基础工件和可选 HTTP 注册。
`check-generated-artifacts.sh` 用于检查构建产物和未定义命令残留。
`verify-skill-docs.sh` 用于检查技能文档路径、Makefile target 和 Markdown 链接。
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
- Quality: [references/quality-gate.md](references/quality-gate.md)
- Examples: [references/examples.md](references/examples.md)
