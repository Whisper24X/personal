# Makefile 命令参考

## 命令速查表

| 命令 | 说明 | 使用频率 |
|-----|------|---------|
| `make help` | 显示所有可用命令 | - |
| `make init` | 安装开发依赖工具 | 首次 |
| `make api` | 生成 Proto 代码 | 高 |
| `make wire` | 生成依赖注入代码 | 高 |
| `make build` | 构建二进制文件 | 高 |
| `make gorm TABLES=xxx` | 生成 GORM 代码 | 中 |
| `make protocode` | 生成 data/biz/service 骨架代码 | 中 |
| `make all` | 执行完整构建流程 | 低 |

## 详细说明

### 初始化

#### `make init`

安装所有开发依赖工具:

```bash
make init
```

安装的工具包括:
- `kratos` - Kratos CLI
- `protoc-gen-go` - Protobuf Go 代码生成
- `protoc-gen-go-grpc` - gRPC 代码生成
- `protoc-gen-go-http` - HTTP 代码生成
- `protoc-gen-validate` - 参数校验代码生成
- `protoc-gen-openapiv2` - OpenAPI 文档生成
- `protoc-gen-go-errors` - 错误码生成
- `wire` - 依赖注入
- `go-enum` - 枚举生成
- `goimports` - 代码格式化

### 代码生成

#### `make api`

根据 Proto 文件生成所有 API 代码:

```bash
make api
```

生成的文件:
- `*.pb.go` - Protobuf 消息结构体
- `*_http.pb.go` - HTTP 路由和处理函数
- `*_grpc.pb.go` - gRPC 服务接口
- `*.pb.validate.go` - 参数校验函数
- `*.swagger.json` - OpenAPI 文档

#### `make wire`

生成 Wire 依赖注入代码:

```bash
make wire
```

生成文件: `cmd/server/wire_gen.go`

#### `make gorm`

根据数据库表结构生成 GORM 代码:

```bash
# 生成指定表
make gorm TABLES=sys_admin

# 生成多个表
make gorm TABLES=sys_admin,sys_role

# 生成所有表 (不指定 TABLES)
make gorm
```

生成的文件位置:
- `internal/data/gorm/ainative_backend_model/` - 数据模型
- `internal/data/gorm/ainative_backend_dao/` - DAO 查询对象
- `internal/data/gorm/ainative_backend_repo/` - Repository 接口和实现

#### `make protocode`

根据 Proto 文件生成 service/biz/data 层骨架代码:

```bash
make protocode
```

用于快速生成新接口的代码框架。

#### `make config`

生成配置文件的 Go 代码:

```bash
make config
```

根据 `internal/conf/conf.proto` 生成 `internal/conf/conf.pb.go`。

### 构建

#### `make build`

构建项目二进制文件:

```bash
make build
```

输出: `bin/backend`

构建参数:
- 静态链接
- 去除调试信息 (`-w -s`)
- 注入版本号

### 代码质量

#### `make lint`

运行 golangci-lint 代码检查:

```bash
make lint
```

#### `make gosec`

运行安全检查:

```bash
make gosec
```

#### `make gci`

格式化 Go import 语句:

```bash
make gci
```

#### `make buf`

格式化 Proto 文件:

```bash
make buf
```

### 文档和测试

#### `make apidoc`

同步接口文档到 Apifox 和 Yapi:

```bash
make apidoc
```

#### `make jmeter`

生成 JMeter 压测文件:

```bash
make jmeter USER=your_username
```

#### `make errcode`

导出错误码文档:

```bash
make errcode
```

输出: `doc/errcode/code.md`

### 数据库工具

#### `make sqldump`

导出数据库表结构为 SQL 文件:

```bash
make sqldump TABLES=sys_admin
```

#### `make sqltopb`

将数据库表结构转换为 Proto 定义:

```bash
make sqltopb shadow sys_admin,sys_role
```

参数说明:
- 第一个参数: 端名称 (`shadow` 或 `app`)
- 第二个参数: 表名列表 (逗号分隔)

### 版本管理

#### `make checkVersion`

检查依赖包是否有新版本:

```bash
make checkVersion
```

#### `make new-pre-branch`

创建新的预发布分支 (tag 版本号 +1):

```bash
make new-pre-branch
```

### 完整构建

#### `make all`

执行完整构建流程:

```bash
make all
```

包含: `api` → `config` → `checkVersion` → `wire` → `gosec`

## 常用命令组合

### 新增接口

```bash
# 1. 编写 Proto 后生成代码
make api

# 2. 生成骨架代码
make protocode

# 3. 更新依赖注入
make wire
```

### 新增数据表

```bash
# 1. 在数据库创建表后生成代码
make gorm TABLES=new_table

# 2. 如果需要生成 Proto
make sqltopb shadow new_table

# 3. 生成 API 代码
make api
```

### 提交代码前

```bash
# 格式化 + 检查
make gci && make lint && make gosec
```

## 环境变量

| 变量 | 说明 | 默认值 |
|-----|------|-------|
| `TABLES` | 指定要操作的表名 | 空 (所有表) |
| `USER` | JMeter 用户名 | 必填 |

## 依赖工具安装

如果 `make init` 失败,可手动安装:

```bash
# Protoc (protobuf 编译器)
make protoc-install

# Buf (proto 格式化工具)
# 参考: https://buf.build/docs/installation

# yc_turbo_kit (内部效率工具)
go install gitlab.yc345.tv/backend/yc_turbo_kit@latest
```
