# 分层代码编写指南

## 概览

本项目采用洋葱架构,代码分为以下几层:

| 层级 | 目录 | 职责 |
|-----|------|------|
| API 层 | `api/` | 接口定义 (Proto) |
| Server 层 | `internal/server/` | 服务器配置,中间件 |
| Service 层 | `internal/service/` | 协议转换 |
| Biz 层 | `internal/biz/` | 业务逻辑 |
| Data 层 | `internal/data/` | 数据访问 |

## 依赖方向

```
API → Server → Service → Biz → Data
                          ↑
                    定义接口,不依赖实现
```

Biz 层定义 Repository 接口,Data 层实现接口,实现依赖倒置。

## 文档索引

| 文档 | 内容 |
|-----|------|
| [layer-api.md](layer-api.md) | Proto 文件编写规范 |
| [layer-server.md](layer-server.md) | Server 层代码编写 |
| [layer-service.md](layer-service.md) | Service 层代码编写 |
| [layer-biz.md](layer-biz.md) | Biz 层代码编写 |
| [layer-data.md](layer-data.md) | Data 层代码编写 |

## 代码流转示例

以 "管理员列表" 接口为例:

```
请求: GET /shadow/v1/sysAdminList

1. [Proto] api/shadow/v1/sys_admin.proto
   - 定义 SysAdminListReq, SysAdminListReply

2. [Server] internal/server/http.go
   - RegisterSysAdminHTTPServer(srv, service)

3. [Service] internal/service/shadow_v1_sysadmin.go
   - SysAdminList() → 调用 biz.SysAdminList()

4. [Biz] internal/biz/shadow_v1_sysadmin_sysadminlist.go
   - 业务逻辑,调用 Repository

5. [Data] internal/data/sysadmin.go
   - 数据库查询,缓存处理
```

## 通用规范

### 文件命名

| 层级 | 命名格式 | 示例 |
|-----|---------|------|
| Service | `{端}_v{版本}_{模块}.go` | `shadow_v1_sysadmin.go` |
| Biz | `{端}_v{版本}_{模块}.go` | `shadow_v1_sysadmin.go` |
| Biz 方法 | `{端}_v{版本}_{模块}_{方法}.go` | `shadow_v1_sysadmin_sysadminlist.go` |
| Data | `{表名}.go` | `sysadmin.go` |

### Wire Provider

每层都有 `ProviderSet`,用于依赖注入:

```go
// 每个层的主文件中
var ProviderSet = wire.NewSet(
    NewXxxService,
    NewYyyService,
)
```

### 日志规范

使用 Kratos 的 log.Helper:

```go
l := log.NewHelper(log.With(logger, "module", "模块名"), log.WithMessageKey("message"))
l.Info("message")
l.Errorf("error: %v", err)
```

### 错误处理

使用项目定义的错误码:

```go
import "gitlab.yc345.tv/backend/ainative-backend/internal/data/errorx"

// 返回错误
return nil, errorx.TokenExpired.Err()

// 包装原始错误
return nil, errorx.DataSQLErr.WithError(err).Err()
```
