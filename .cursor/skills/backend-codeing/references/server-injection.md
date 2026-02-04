# Server 注入参考

> 何时阅读: 新增 Service 需要注入到 HTTP/GRPC Server 时。

## 检查是否已注入

搜索 `NewHTTPServer` 函数参数和注册代码：
- 参数: `{position}V1{Table}Service *service.{Position}V1{Table}Service`
- 注册: `{position}v1.Register{Table}HTTPServer(srv, {position}V1{Table}Service)`

## 1. 添加函数参数

在 `NewHTTPServer` 函数参数中添加：

```go
// Shadow 示例
shadowV1ProductService *service.ShadowV1ProductService,

// App 示例
appV1UserService *service.AppV1UserService,
```

**位置**: 按模块分组，Shadow 在前，App 在后。

## 2. 添加服务注册

在函数体中添加注册代码：

```go
// Shadow v1 服务注册
shadowv1.RegisterProductHTTPServer(srv, shadowV1ProductService)

// App v1 服务注册
appv1.RegisterUserHTTPServer(srv, appV1UserService)
```

**位置**: 在对应的注释块下方添加。

## 3. 执行 Wire 同步

```bash
cd ainative-backend && make wire
```

## 4. 自定义路由（可选）

如需 SSE 流式返回或特殊处理：

```go
// 自定义路由
shadowRoute := srv.Route("/shadow")
shadowRoute.POST("/v1/xxx/completions", shadowV1XxxService.XxxHandler)
```

## 完整示例

```go
// internal/server/http.go
func NewHTTPServer(
    config *conf.Bootstrap,
    // Shadow 服务
    shadowV1SysAdminService *service.ShadowV1SysAdminService,
    shadowV1ProductService *service.ShadowV1ProductService,  // 新增
    // App 服务
    appV1AuthService *service.AppV1AuthService,
) *http.Server {
    // ... 中间件配置 ...

    srv := http.NewServer(opts...)

    // Shadow v1
    shadowv1.RegisterSysAdminHTTPServer(srv, shadowV1SysAdminService)
    shadowv1.RegisterProductHTTPServer(srv, shadowV1ProductService)  // 新增

    // App v1
    appv1.RegisterAuthHTTPServer(srv, appV1AuthService)

    return srv
}
```
