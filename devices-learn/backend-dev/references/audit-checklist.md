# Audit Checklist

## 目的

审计现有工件，确认从哪一步开始，避免重复生成或跳过必要步骤。

## 输入

| 字段 | 说明 |
| --- | --- |
| `position` | API 位置：`shadow` 或 `app` |
| `table_name` | 表名；无表接口填 `N/A` |
| `goal` | CRUD / 业务 RPC / 测试接口 / 聚合接口 / 只改逻辑 |

## 工件检查

| 工件 | 路径 | 检查方式 |
| --- | --- | --- |
| SQL 文件 | `studyspace-service/doc/sql/**` | Glob |
| 数据库表 | `public.{table}` | DB schema search 或现有 SQL |
| GORM Model/DAO/Repo | `studyspace-service/internal/data/gorm/studyspace_service_*` | Glob |
| Proto | `studyspace-service/api/{shadow|app}/v1/*.proto` | Glob / 内容搜索 |
| API 生成文件 | `*.pb.go`、`*_http.pb.go`、`*_grpc.pb.go`、`*.pb.validate.go` | Glob |
| Protocode 基线 | `internal/data/*.go`、`internal/biz/*.go`、`internal/service/*.go` | 涉及 Proto/API 时检查 |
| Biz | `studyspace-service/internal/biz/*.go` | 内容搜索 |
| 常量归属 | `studyspace-service/internal/data/constant/constant.go` | 涉及场景/状态/类型/规则版本时检查 |
| Service | `studyspace-service/internal/service/*.go` | Glob / 内容搜索 |
| ProviderSet | `internal/biz/biz.go`、`internal/service/service.go` | 内容搜索 |
| HTTP 注册 | `studyspace-service/internal/server/http.go` | 搜索 `Register{Service}HTTPServer` |
| Wire | `studyspace-service/cmd/server/wire_gen.go` | 确认注入已生成 |

## 起点判断

```text
没有 SQL/表结构       -> 从 Database 开始
表结构存在但 GORM 缺失 -> 从 GORM 开始
需要新 API 契约       -> 从 Proto 开始
Proto 改过但 pb 缺失  -> 从 API Generation 开始
Service/Biz 缺失      -> 从 Code 开始
HTTP 注册缺失         -> 回到 Code 的 Server 注入
只改逻辑              -> Code -> Quality
```

## 输出模板

```markdown
## Audit Result

### Input
- position:
- table_name:
- goal:

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

### Decision
- Task type:
- Start step:
- Required pipeline:
- Generation: make api -> make protocode / not involved
```
