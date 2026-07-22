# Examples

## 表驱动 CRUD

用户需求：开发课程包管理 CRUD。

路径：

```text
Audit -> Database -> GORM -> Proto -> API Generation -> Code -> Quality
```

关键点：

- 先设计 SQL 并 `make sqlimport`。
- 再 `make gorm`。
- 表驱动 proto 优先 `make sqltopb shadow {table}`。
- proto 修改后依次执行 `make api` 和 `make protocode`。
- 基于生成后的 Biz/Data/Service 文件继续实现业务逻辑。
- 实现 Biz/Data/Service/Server 后执行 `make wire` 和质量检查。

## 已有表业务 RPC

用户需求：给已有课程资源增加“手动同步”接口。

路径：

```text
Audit -> Proto -> API Generation -> Code -> Quality
```

关键点：

- 选择已有 proto 或确认新 proto 归属。
- 新增 RPC 和 message 后依次执行 `make api` 和 `make protocode`。
- 基于生成后的 Biz/Data/Service 文件继续实现业务逻辑。
- Service 只透传，业务逻辑写在 Biz。
- HTTP 注册和 ProviderSet 必须补齐。

## 无表测试接口

用户需求：写一个后端测试接口触发同步。

路径：

```text
Audit -> Resolve Proto Plan -> Proto -> API Generation -> Code -> Quality
```

关键点：

- 先说明该接口无表结构来源，不能通过 `sqltopb` 生成。
- 优先挂到已有业务域、服务职责、路由前缀匹配的 proto。
- 没有合适已有 proto 时，新建语义明确的测试/调试/任务/同步 proto。
- 只有多个方案都合理或模块边界不明确时才询问用户。
- 新增或编辑 proto 后依次执行 `make api` 和 `make protocode`。
- 接口注释必须标明测试或手动触发用途。

## 只改业务逻辑

用户需求：调整同步逻辑，不改接口。

路径：

```text
Audit -> Code -> Quality
```

关键点：

- 不需要 proto/API 生成。
- 优先复用生成 Repo 方法。
- 常量放 `internal/data/constant`。
- 每个新增方法写中文注释。

## 只重新生成 API

用户需求：proto 已改，重新生成接口代码。

路径：

```text
Audit -> API Generation -> Quality
```

关键点：

- 执行 `make api`。
- 执行 `make protocode`。
- 不使用历史错误脚手架命令。
