# Task Router

## 目的

后端任务开始前必须先分流，避免直接进入编码导致跳过 Proto、API 生成或质量门禁。

## 分流规则

| 任务类型 | 典型需求 | 必须路径 |
| --- | --- | --- |
| 表驱动 CRUD | 新建表、标准增删改查、管理端列表/详情/保存/删除 | Audit -> Database -> GORM -> Proto -> API Generation -> Code -> Quality |
| 已有表业务 RPC | 添加同步、审核、状态切换、批量操作、筛选条件 | Audit -> Proto -> API Generation -> Code -> Quality |
| 无表接口 | 测试接口、手动触发接口、聚合接口、任务触发接口 | Audit -> Resolve Proto Plan -> Proto -> API Generation -> Code -> Quality |
| 只改业务逻辑 | 只改 Biz/Data 逻辑，不改 API 契约 | Audit -> Code -> Quality |
| 只改数据库/GORM | 表结构调整、重新生成 GORM | Audit -> Database -> GORM -> Quality |
| 只重新生成代码 | 用户明确要求重新生成 API/GORM/Wire | Audit -> Requested Generation -> Quality |

## Proto/API 门禁

命中以下任意条件时，不允许直接进入 Code：

- 新增或修改 `.proto`
- 新增 HTTP/gRPC API 契约
- 修改 API 入参/出参
- 添加业务 RPC
- 需要生成 `pb.go`、`grpc.pb.go`、`http.pb.go`、`pb.validate.go`、swagger

命中后固定执行：`make api` -> `make protocode` -> 基于生成文件继续编码。

## 无表接口处理

无表接口不能默认手写 proto。先按默认规则确定 Proto 归属：

1. 当前接口没有数据库表来源，无法通过 `sqltopb` 生成。
2. 优先复用业务域、服务职责、路由前缀匹配的已有 proto。
3. 没有合适已有 proto 时，新建语义明确的测试、调试、任务、同步或聚合 proto。
4. 只有多个方案都合理、命名会影响模块边界、或无法判断业务域时，才询问用户。

## 输出

开始编码前输出：

```markdown
## Backend Task Route
- Task type: ...
- Reason: ...
- Pipeline: Audit -> ...
- Proto/API involved: yes/no
- Generation required: make api -> make protocode / no
- Proto plan: existing proto / new proto / not involved
- User confirmation needed: yes/no, only when ownership is ambiguous
```
