# Audit Checklist

## 目的

审计现有工件，确认从哪一步开始，避免重复生成或跳过必要步骤。

## 输入

| 字段 | 说明 |
| --- | --- |
| `position` | API 位置：`shadow` 或 `app` |
| `table_name` | 表名；无表接口填 `N/A` |
| `goal` | CRUD / 业务 RPC / 测试接口 / 聚合接口 / 只改逻辑 |
| `backend_dir` | 后端模块目录；未明确时先通过任务涉及文件、`go.mod`、`Makefile` 推断 |
| `task_type` | 合规脚本使用：`crud` / `rpc` / `logic` / `gorm` / `generation` / `other` |
| `service_name` | 合规脚本使用：新增或修改 HTTP Gateway Service 时填写 `{Service}` |
| `proto_path` | 合规脚本使用：涉及 Proto/API 生成时填写目标 `.proto` 路径 |
| `http_rpc_files` | 合规脚本使用：新增或修改第三方 HTTP 请求时填写 `internal/data/rpc/*.go` |

## 工件检查

| 工件 | 路径 | 检查方式 |
| --- | --- | --- |
| SQL 文件 | `<backend-dir>/doc/sql/**` 或任务指定目录 | Glob |
| 数据库表 | `public.{table}` | DB schema search 或现有 SQL |
| GORM Model/DAO/Repo | `<backend-dir>/internal/data/gorm/*_{model,dao,repo}` 或实际生成目录 | Glob |
| Proto | `<backend-dir>/api/{position}/v{version}/*.proto` | Glob / 内容搜索 |
| API 生成文件 | `*.pb.go`、`*_http.pb.go`、`*_grpc.pb.go`、`*.pb.validate.go` | Glob |
| Protocode 基线 | `internal/data/*.go`、`internal/biz/*.go`、`internal/service/*.go` | 涉及 Proto/API 时检查 |
| Biz | `<backend-dir>/internal/biz/*.go` | 内容搜索 |
| 常量归属 | `<backend-dir>/internal/data/constant/constant.go` | 涉及场景/状态/类型/规则版本时检查 |
| Service | `<backend-dir>/internal/service/*.go` | Glob / 内容搜索 |
| ProviderSet | `internal/biz/biz.go`、`internal/service/service.go` | 内容搜索 |
| HTTP 注册 | `<backend-dir>/internal/server/http.go` | 搜索 `Register{Service}HTTPServer` |
| Wire | `<backend-dir>/cmd/server/wire_gen.go` | 确认注入已生成 |
| 第三方 HTTP RPC | `<backend-dir>/internal/data/rpc/*.go` | 检查统一 `*resty.Client`、`SetContext(ctx)`、`EnableTrace()`、`CheckStatus(resp)`、ProviderSet |

## 起点判断

```text
没有 SQL/表结构       -> 从 Database 开始
表结构存在但 GORM 缺失 -> 从 GORM 开始
需要新 API 契约       -> 从 Proto 开始
Proto 改过但 pb 缺失  -> 从 API Generation 开始
Service/Biz 缺失      -> 从 Code 开始
HTTP 注册缺失         -> 回到 Code 的 Server 注入
新增 HTTP RPC 未注入    -> 回到 Code 的 Data ProviderSet / Wire
只改逻辑              -> Code -> Quality
```

## 输出模板

```markdown
## Audit Result

### Input
- backend_dir:
- position:
- table_name:
- goal:
- task_type:
- service_name:
- proto_path:
- http_rpc_files:

### Artifacts
| Artifact | Status | Notes |
| --- | --- | --- |
| SQL | yes/no | ... |
| GORM | yes/no | ... |
| Proto | yes/no | ... |
| API generated | yes/no | ... |
| Protocode baseline | yes/no/not involved | ... |
| Biz/Service | yes/no | ... |
| Constants | yes/no/not involved | ... |
| HTTP registration | yes/no | ... |
| HTTP RPC | yes/no/not involved | ... |

### Decision
- Task type:
- Start step:
- Required pipeline:
- Generation: make api -> make protocode / not involved
- Compliance script args:
```
