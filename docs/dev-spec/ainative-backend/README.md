# ainative-backend 开发指南

本文档提供 backend 开发流程概览和规范索引。详细规范请参阅
[`docs/dev-spec/ainative-backend/references/`](docs/dev-spec/ainative-backend/references/) 目录下的对应文档。为保证跨目录引用一致，本文所有链接均采用该路径前缀。

---

## 快速开始

### 开发流程

```mermaid
graph LR
    A[1. 审计需求] --> B[2. 数据库表设计]
    B --> C[3. make gorm]
    C --> D[4. make sqltopb]
    D --> E[5. 修改 Proto + make api]
    E --> F[6. make protocode]
    F --> G[7. 实现各层逻辑]
    G --> H[8. 测试验证]
```

### 从哪一步开始？

| 场景 | 起始步骤 |
|-----|---------|
| 新增模块 | 第 2 步 - 数据库表设计 |
| 已有表新增接口 | 第 4 步 - `make sqltopb` |
| 已有接口修改 | 第 5 步 - 修改 Proto |
| 仅修改业务逻辑 | 第 7 步 - 实现逻辑 |

---

## 开发流程详解

### 1. 审计需求

分析需求，评估当前项目情况，确定从哪一步开始执行。

### 2. 数据库表设计

使用 dbhub MCP 工具创建或更新数据库表。

→ 详见 [数据库设计规范](docs/dev-spec/ainative-backend/references/database.md)

### 3. 生成 GORM 代码

```bash
make gorm TABLES=表名
```

生成 Model、DAO、基础 Repository 到 `internal/data/gorm/` 目录。

### 4. 生成 Proto 文件

```bash
make sqltopb shadow 表名   # 管理后台接口
make sqltopb app 表名      # App 端接口
```

根据数据库表结构自动生成 Proto 文件到 `api/{端}/v1/` 目录。

### 5. 修改 Proto 并生成 API 代码

根据业务需求修改 Proto 文件，添加校验规则、调整字段，然后生成代码：

```bash
make api
```

→ 详见 [API 层规范](docs/dev-spec/ainative-backend/references/layer-api.md)

### 6. 生成骨架代码

```bash
make protocode
```

自动生成 Service、Biz 层的骨架代码。

### 7. 实现各层逻辑

按 Service → Biz → Data 顺序实现业务逻辑，完成后更新依赖注入：

```bash
make wire
```

→ 详见 [分层编码指南](docs/dev-spec/ainative-backend/references/layer.md)

### 8. 测试验证

```bash
make build
./bin/backend -conf configs/development.yaml
```

---

## 常见开发场景

### 场景 1: 添加字段到现有表

1. 修改数据库表结构
2. `make gorm TABLES=表名`
3. 更新 Proto 文件（如需暴露给前端）
4. `make api`
5. 更新 DTO 转换方法

### 场景 2: 添加方法到现有接口

1. 在 Proto 文件中添加 rpc 定义
2. `make api && make protocode`
3. 实现业务逻辑
4. `make wire`

### 场景 3: 添加自定义查询

1. 在自定义 Repo 中添加方法（`internal/data/{表名}.go`）
2. 在 Biz 接口中声明（`internal/biz/biz.go`）

→ 详见 [Data 层规范](docs/dev-spec/ainative-backend/references/layer-data.md)

---

## 规范文档索引

### 入门必读

| 文档 | 说明 |
|-----|------|
| [架构概览](docs/dev-spec/ainative-backend/references/architecture.md) | 洋葱架构、各层职责、依赖注入 |
| [目录结构](docs/dev-spec/ainative-backend/references/directory.md) | 项目目录组织、文件命名规范 |

### 开发规范

| 文档 | 说明 |
|-----|------|
| [数据库设计](docs/dev-spec/ainative-backend/references/database.md) | 表命名、字段规范、敏感数据处理 |
| [分层编码](docs/dev-spec/ainative-backend/references/layer.md) | 分层概述、依赖方向、通用规范 |
| [错误码规范](docs/dev-spec/ainative-backend/references/error-codes.md) | 错误码定义、使用方式、国际化 |

### 各层详解

| 文档 | 说明 |
|-----|------|
| [API 层](docs/dev-spec/ainative-backend/references/layer-api.md) | Proto 文件编写、校验规则 |
| [Server 层](docs/dev-spec/ainative-backend/references/layer-server.md) | 服务器配置、中间件、路由注册 |
| [Service 层](docs/dev-spec/ainative-backend/references/layer-service.md) | 协议转换、调用 Biz 层 |
| [Biz 层](docs/dev-spec/ainative-backend/references/layer-biz.md) | 业务逻辑、UseCase、接口定义 |
| [Data 层](docs/dev-spec/ainative-backend/references/layer-data.md) | Repository 实现、数据访问、DTO 转换 |

### 工具参考

| 文档 | 说明 |
|-----|------|
| [Makefile 命令](docs/dev-spec/ainative-backend/references/makefile.md) | 所有 make 命令详解 |

---

## 开发检查清单

开发完成后，确认以下事项：

- [ ] Proto 文件参数校验规则完整
- [ ] 所有层的 Provider 已注册到 ProviderSet
- [ ] Server 层已注册新服务
- [ ] `make wire` 执行成功
- [ ] `make lint` 无错误
- [ ] 接口测试通过

### 生成代码注意事项

- 带有 `Code generated` 或 `DO NOT EDIT` 头部的文件会被覆盖，禁止直接修改。
- `make gorm` 生成内容在 `internal/data/gorm/`，自定义查询与业务逻辑写在 `internal/data/{表名}.go`。
- `make sqltopb` 会覆盖 `api/{端}/v1/*.proto` 的自动生成内容；第 5 步手动调整 Proto 后，避免重复执行该命令，除非需要重新同步数据库字段。
- `make api` 会覆盖 `api/{端}/v1/*_grpc.pb.go`、`*_http.pb.go`、`*.pb.go`、`*.pb.validate.go`，仅修改 `.proto`。
- `make protocode`/`make wire` 会更新骨架与依赖注入代码，业务实现保持在非生成文件中。
