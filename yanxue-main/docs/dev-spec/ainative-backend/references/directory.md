# 项目目录结构

## 顶层目录

```
backend/
├── api/                 # Proto 定义和生成的代码
├── cmd/                 # 程序入口
├── configs/             # 配置文件
├── doc/                 # 项目文档
├── internal/            # 业务代码 (核心)
├── third_party/         # 第三方 Proto 依赖
├── Dockerfile           # Docker 构建文件
├── Makefile             # 构建命令
├── go.mod               # Go 模块定义
└── go.sum               # 依赖版本锁定
```

## API 目录

Proto 接口定义和自动生成的代码。

```
api/
├── app/                 # App 端接口
│   └── v1/
│       ├── auth.proto           # 认证接口定义
│       ├── auth.pb.go           # 生成: Protobuf 消息
│       ├── auth_http.pb.go      # 生成: HTTP 路由
│       ├── auth_grpc.pb.go      # 生成: gRPC 服务
│       ├── auth.pb.validate.go  # 生成: 参数校验
│       ├── auth.swagger.json    # 生成: OpenAPI 文档
│       ├── user.proto
│       └── ...
└── shadow/              # 管理后台接口
    └── v1/
        ├── sys_admin.proto
        ├── sys_auth.proto
        ├── sys_role.proto
        ├── sys_dept.proto
        ├── sys_permission.proto
        └── ...
```

**端命名规范**:
- `app/` - App 端 (用户侧)
- `shadow/` - 管理后台 (管理员侧)

## CMD 目录

程序入口和依赖注入。

```
cmd/
└── server/
    ├── main.go          # 程序入口
    ├── wire.go          # Wire 依赖注入定义
    └── wire_gen.go      # 生成: Wire 依赖注入代码
```

## Configs 目录

环境配置文件。

```
configs/
├── default.yaml         # 默认配置
├── development.yaml     # 开发环境
├── test.yaml            # 测试环境
├── stage.yaml           # 预发布环境
└── production.yaml      # 生产环境
```

## Internal 目录 (核心)

业务代码,按洋葱架构分层。

```
internal/
├── biz/                 # Biz 层: 业务逻辑 (UseCase)
│   ├── biz.go                              # Wire Provider 和接口定义
│   ├── app_v1_auth.go                      # UseCase 结构体定义
│   ├── app_v1_auth_authlogin.go            # 具体方法实现
│   ├── shadow_v1_sysadmin.go
│   └── shadow_v1_sysadmin_sysadminlist.go
│
├── conf/                # 配置结构定义
│   ├── conf.proto       # 配置 Proto 定义
│   ├── conf.pb.go       # 生成: 配置结构体
│   └── conf.go          # 配置加载逻辑
│
├── data/                # Data 层: 数据访问 (Repository)
│   ├── data.go                  # Wire Provider 和基础设施初始化
│   ├── common.go                # 通用 Repo (锁、事务、缓存)
│   ├── sysadmin.go              # 自定义 SysAdmin Repo
│   ├── sysrole.go               # 自定义 SysRole Repo
│   ├── gorm/                    # GORM 自动生成代码
│   │   ├── ainative_backend_dao/    # 生成: DAO 查询对象
│   │   ├── ainative_backend_model/  # 生成: 数据模型
│   │   └── ainative_backend_repo/   # 生成: 基础 Repository
│   ├── cache/                   # 缓存相关
│   ├── dto/                     # 数据传输对象
│   ├── errorx/                  # 错误码定义
│   ├── constant/                # 常量定义
│   └── rpc/                     # RPC 客户端
│
├── pkg/                 # 内部工具包
│   ├── cache/           # 缓存工具
│   │   ├── keymanage/   # 缓存 Key 管理
│   │   ├── redislock/   # Redis 分布式锁
│   │   └── rockscache/  # RocksCache 封装
│   ├── errx/            # 错误处理
│   ├── jwt/             # JWT 认证
│   ├── meta/            # 上下文元数据
│   ├── middleware/      # 中间件
│   │   ├── auth/        # 认证中间件
│   │   ├── logger/      # 日志中间件
│   │   ├── recovery/    # 恢复中间件
│   │   └── validate/    # 参数校验中间件
│   ├── goresty/         # HTTP 客户端
│   └── util/            # 通用工具
│       ├── cryptutil/   # 加解密
│       ├── fileutil/    # 文件操作
│       ├── iputil/      # IP 处理
│       ├── jsonutil/    # JSON 处理
│       ├── timeutil/    # 时间处理
│       └── ...
│
├── server/              # Server 层: 服务器配置
│   ├── server.go        # Wire Provider
│   ├── http.go          # HTTP 服务器
│   ├── grpc.go          # gRPC 服务器
│   ├── cron.go          # 定时任务
│   └── rabbitmq.go      # RabbitMQ 消费者
│
└── service/             # Service 层: 协议转换
    ├── service.go                   # Wire Provider
    ├── app_v1_auth.go               # App 认证服务
    ├── app_v1_user.go               # App 用户服务
    ├── shadow_v1_sysadmin.go        # 管理员服务
    ├── shadow_v1_sysauth.go         # 后台认证服务
    └── ...
```

## 文件命名规范

### Service/Biz 层

格式: `{端}_v{版本}_{模块}.go` 或 `{端}_v{版本}_{模块}_{方法}.go`

| 示例 | 说明 |
|-----|------|
| `app_v1_auth.go` | App v1 认证模块主文件 |
| `app_v1_auth_authlogin.go` | App v1 认证模块 AuthLogin 方法 |
| `shadow_v1_sysadmin.go` | 后台 v1 系统管理员模块 |
| `shadow_v1_sysadmin_sysadminlist.go` | 后台 v1 管理员列表方法 |

### Data 层

| 类型 | 位置 | 说明 |
|-----|------|------|
| 自动生成 Model | `data/gorm/ainative_backend_model/` | 数据库模型 |
| 自动生成 Repo | `data/gorm/ainative_backend_repo/` | 基础 CRUD |
| 自定义 Repo | `data/{表名}.go` | 扩展业务方法 |

### Proto 文件

格式: `{模块}.proto`,使用下划线分隔单词。

| 示例 | 说明 |
|-----|------|
| `auth.proto` | 认证模块 |
| `sys_admin.proto` | 系统管理员模块 |
| `sys_role.proto` | 系统角色模块 |

## 代码定位速查

| 需要找什么 | 位置 |
|-----------|------|
| 接口定义 | `api/{端}/v1/{模块}.proto` |
| HTTP 路由 | `api/{端}/v1/{模块}_http.pb.go` |
| Service 入口 | `internal/service/{端}_v1_{模块}.go` |
| 业务逻辑 | `internal/biz/{端}_v1_{模块}.go` |
| 数据访问 | `internal/data/{表名}.go` |
| 数据模型 | `internal/data/gorm/ainative_backend_model/{表名}.gen.go` |
| 基础 CRUD | `internal/data/gorm/ainative_backend_repo/{表名}.repo.go` |
| 错误码 | `internal/data/errorx/code.go` |
| 配置定义 | `internal/conf/conf.proto` |
| 依赖注入 | `cmd/server/wire.go` |
