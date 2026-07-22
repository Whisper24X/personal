# Proto

## 适用场景

- 新增或修改 HTTP/gRPC 接口
- 新增业务 RPC
- 修改 API 入参/出参
- 调整 validate 规则
- 删除不需要的 RPC

## 强制门禁

只要涉及 API 契约变化，必须先完成 Proto，再进入 API Generation。

禁止直接进入 Biz/Service 编码后再补 proto。

## 表驱动接口

表驱动 CRUD 优先从 SQL/表结构生成 proto：

```bash
cd <backend-dir> && make sqltopb <position> {table}
```

如果当前 Makefile 没有 `sqltopb` 目标或工具不可用，必须先报告用户，不要自行手写替代。
执行后必须确认目标表对应的 `api/{position}/v1/*.proto` 已生成或更新，且没有覆盖已手工调整但本次不应变更的 proto 内容。

## 已有 Proto 新增业务 RPC

已有表或已有模块需要新增业务 RPC 时：

1. 选择已有 `api/{position}/v1/{module}.proto`。
2. 添加 rpc 定义、请求 message、响应 message。
3. 补充 `google.api.http` 映射。
4. 必要时补充 validate 规则。
5. 进入 API Generation。

Proto 编辑示例、CRUD RPC 删除模板见 [templates-proto.md](templates-proto.md)。

## 无表接口

测试接口、手动触发接口、聚合接口没有数据库表来源，不能通过 `sqltopb` 从表结构生成。按以下默认规则确定 Proto 归属：

1. 优先复用业务域匹配、服务职责匹配、路由前缀匹配的已有 proto。
2. 没有合适已有 proto 时，新建语义明确的 proto，例如 `{module}_test.proto`、`{module}_debug.proto`、`{module}_job.proto`、`{module}_sync.proto`、`{module}_aggregate.proto`。
3. 只有多个方案都合理、命名会影响模块边界、或无法判断业务域时，才询问用户。

新增或编辑 proto 时，注释必须标明“测试接口”“手动触发接口”或“聚合接口”等用途。

## 禁止行为

- 禁止手动创建表驱动 CRUD proto 绕过 `sqltopb`。
- 禁止修改 proto 后不执行 API Generation。
- 禁止手动编辑生成的 pb/http/grpc/validate 文件。

## 输出模板

```markdown
## Proto Result
- Mode: sqltopb / edit existing / no-table exception
- Proto file:
- HTTP route:
- Next: API Generation
```
