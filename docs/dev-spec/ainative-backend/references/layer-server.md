# Server 层编写指南

## 概述

Server 层负责创建和配置 HTTP/gRPC 服务器,注册路由和中间件。

**位置**: `internal/server/`

## 文件结构

```
internal/server/
├── server.go        # Wire ProviderSet
├── http.go          # HTTP 服务器
├── grpc.go          # gRPC 服务器
├── cron.go          # 定时任务
└── rabbitmq.go      # MQ 消费者
```

## HTTP 服务器

### 完整示例

```go
// internal/server/http.go
package server

import (
    "github.com/go-kratos/kratos/v2/middleware/metadata"
    "github.com/go-kratos/kratos/v2/middleware/ratelimit"
    "github.com/go-kratos/kratos/v2/middleware/tracing"
    "github.com/go-kratos/kratos/v2/transport/http"
    appV1 "gitlab.yc345.tv/ainative/ainative-backend/api/app/v1"
    shadowV1 "gitlab.yc345.tv/ainative/ainative-backend/api/shadow/v1"
    "gitlab.yc345.tv/ainative/ainative-backend/internal/conf"
    "gitlab.yc345.tv/ainative/ainative-backend/internal/service"
    // ... 其他 import
)

func NewHTTPServer(
    config *conf.Bootstrap,
    // 注入 Service
    shadowV1SysAdminService *service.ShadowV1SysAdminService,
    shadowV1SysAuthService *service.ShadowV1SysAuthService,
    appV1AuthService *service.AppV1AuthService,
    // ... 其他 Service
) *http.Server {
    // 1. 配置中间件
    var opts = []http.ServerOption{
        http.Middleware(
            tracing.Server(),           // 链路追踪
            logger.HTTPLogger(config),  // 请求日志
            recovery.Recovery(),        // Panic 恢复
            metadata.Server(),          // 元数据传递
            validate.Validator(),       // 参数校验
            ratelimit.Server(),         // 限流
        ),
    }
    
    // 2. 配置服务器参数
    if config.Server.Http.Addr != "" {
        opts = append(opts, http.Address(config.Server.Http.Addr))
    }
    if config.Server.Http.Timeout != nil {
        opts = append(opts, http.Timeout(config.Server.Http.Timeout.AsDuration()))
    }
    
    // 3. 配置错误编码器
    opts = append(opts, 
        http.ErrorEncoder(errx.HTTPErrorEncoder(errorx.Manager)),
        http.ResponseEncoder(ResponseEncoder),
    )
    
    // 4. 创建服务器
    srv := http.NewServer(opts...)
    
    // 5. 注册服务
    shadowV1.RegisterSysAdminHTTPServer(srv, shadowV1SysAdminService)
    shadowV1.RegisterSysAuthHTTPServer(srv, shadowV1SysAuthService)
    appV1.RegisterAuthHTTPServer(srv, appV1AuthService)
    // ... 注册其他服务
    
    return srv
}
```

### 新增服务注册

当新增接口模块时,需要:

1. **添加 Service 参数**:
```go
func NewHTTPServer(
    // ... 现有参数
    shadowV1ProductService *service.ShadowV1ProductService,  // 新增
) *http.Server {
```

2. **注册服务**:
```go
shadowV1.RegisterProductHTTPServer(srv, shadowV1ProductService)
```

## 中间件配置

### 中间件顺序

中间件按顺序执行,建议顺序:

```go
http.Middleware(
    tracing.Server(),                    // 1. 链路追踪 (最外层)
    metrics.KratosMiddleware(),          // 2. 指标收集
    logger.HTTPLogger(config),           // 3. 请求日志
    recovery.Recovery(),                 // 4. Panic 恢复
    metadata.Server(),                   // 5. 元数据传递
    validate.Validator(),                // 6. 参数校验
    ratelimit.Server(),                  // 7. 限流
    requestCancel.KratosMiddleware(...), // 8. 请求超时
)
```

### 自定义中间件

中间件位置: `internal/pkg/middleware/`

```go
// internal/pkg/middleware/custom/custom.go
package custom

import (
    "context"
    "github.com/go-kratos/kratos/v2/middleware"
)

func CustomMiddleware() middleware.Middleware {
    return func(handler middleware.Handler) middleware.Handler {
        return func(ctx context.Context, req interface{}) (interface{}, error) {
            // 前置处理
            
            reply, err := handler(ctx, req)
            
            // 后置处理
            
            return reply, err
        }
    }
}
```

## 响应编码器

自定义响应格式:

```go
func ResponseEncoder(w http.ResponseWriter, r *http.Request, v interface{}) error {
    if v == nil {
        return nil
    }
    
    // 处理重定向
    if rd, ok := v.(http.Redirector); ok {
        url, code := rd.Redirect()
        netHttp.Redirect(w, r, url, code)
        return nil
    }
    
    codec, _ := http.CodecForRequest(r, "Accept")
    data, err := codec.Marshal(v)
    if err != nil {
        return err
    }
    
    w.Header().Set("Content-Type", "application/"+codec.Name())
    w.Header().Set("X-Trace-Id", r.Header.Get("TraceID"))
    _, err = w.Write(data)
    return err
}
```

## gRPC 服务器

```go
// internal/server/grpc.go
func NewGRPCServer(
    config *conf.Bootstrap,
    shadowV1SysAdminService *service.ShadowV1SysAdminService,
) *grpc.Server {
    var opts = []grpc.ServerOption{
        grpc.Middleware(
            recovery.Recovery(),
            tracing.Server(),
            validate.Validator(),
        ),
    }
    
    if config.Server.Grpc.Addr != "" {
        opts = append(opts, grpc.Address(config.Server.Grpc.Addr))
    }
    if config.Server.Grpc.Timeout != nil {
        opts = append(opts, grpc.Timeout(config.Server.Grpc.Timeout.AsDuration()))
    }
    
    srv := grpc.NewServer(opts...)
    shadowV1.RegisterSysAdminServer(srv, shadowV1SysAdminService)
    
    return srv
}
```

## 定时任务

```go
// internal/server/cron.go
package server

import (
    "github.com/robfig/cron/v3"
    "gitlab.yc345.tv/ainative/ainative-backend/internal/service"
)

func NewCronServer(
    asyncService *service.AsyncService,
) *cron.Cron {
    c := cron.New(cron.WithSeconds())
    
    // 每天凌晨2点执行
    c.AddFunc("0 0 2 * * *", func() {
        asyncService.DailyTask()
    })
    
    // 每5分钟执行
    c.AddFunc("0 */5 * * * *", func() {
        asyncService.PeriodicTask()
    })
    
    return c
}
```

## MQ 消费者

```go
// internal/server/rabbitmq.go
package server

func NewRabbitMQServer(
    config *conf.Bootstrap,
    asyncService *service.AsyncService,
) error {
    // 注册消费者
    // ...
}
```

## Wire Provider

```go
// internal/server/server.go
package server

import "github.com/google/wire"

var ProviderSet = wire.NewSet(
    NewHTTPServer,
    NewGRPCServer,
    NewCronServer,
)
```

## 注意事项

1. **Service 注入**: 所有要注册的 Service 必须作为 `NewHTTPServer` 的参数
2. **中间件顺序**: tracing 应该在最外层,recovery 应该在日志之后
3. **服务注册**: 每个 Proto Service 对应一个 `RegisterXxxHTTPServer` 调用
4. **Wire 同步**: 修改参数后需要运行 `make wire`
