# Service 层编写指南

## 概述

Service 层是协议转换层,接收 Protobuf 请求,调用 Biz 层处理业务。

**位置**: `internal/service/`

**核心原则**: Service 层不包含业务逻辑,只做协议转换和调用转发。

## 文件结构

```
internal/service/
├── service.go                   # Wire ProviderSet
├── app_v1_auth.go              # App 认证服务
├── app_v1_user.go              # App 用户服务
├── shadow_v1_sysadmin.go       # 管理员服务
├── shadow_v1_sysauth.go        # 后台认证服务
└── async.go                     # 异步任务服务
```

## 文件命名规范

格式: `{端}_v{版本}_{模块}.go`

| 端 | 示例 |
|---|------|
| app | `app_v1_auth.go`, `app_v1_user.go` |
| shadow | `shadow_v1_sysadmin.go`, `shadow_v1_sysrole.go` |

## 代码模板

### 完整示例

```go
// internal/service/shadow_v1_product.go
package service

import (
    "context"

    "github.com/go-kratos/kratos/v2/log"
    pb "gitlab.yc345.tv/backend/ainative-backend/api/shadow/v1"
    "gitlab.yc345.tv/backend/ainative-backend/internal/biz"
)

// NewShadowV1ProductService 创建 Service
func NewShadowV1ProductService(
    logger log.Logger,
    productUseCase *biz.ShadowV1ProductUseCase,
) *ShadowV1ProductService {
    l := log.NewHelper(log.With(logger, "module", "service/shadowV1Product"), log.WithMessageKey("message"))
    return &ShadowV1ProductService{
        log:            l,
        productUseCase: productUseCase,
    }
}

// ShadowV1ProductService 商品服务
type ShadowV1ProductService struct {
    pb.UnimplementedProductServer  // 嵌入未实现的服务接口
    log            *log.Helper
    productUseCase *biz.ShadowV1ProductUseCase
}

// ProductList 商品列表
func (s *ShadowV1ProductService) ProductList(ctx context.Context, req *pb.ProductListReq) (*pb.ProductListReply, error) {
    return s.productUseCase.ProductList(ctx, req)
}

// ProductInfo 商品详情
func (s *ShadowV1ProductService) ProductInfo(ctx context.Context, req *pb.ProductInfoReq) (*pb.ProductInfoReply, error) {
    return s.productUseCase.ProductInfo(ctx, req)
}

// ProductStore 保存商品
func (s *ShadowV1ProductService) ProductStore(ctx context.Context, req *pb.ProductStoreReq) (*pb.ProductStoreReply, error) {
    return s.productUseCase.ProductStore(ctx, req)
}

// ProductDel 删除商品
func (s *ShadowV1ProductService) ProductDel(ctx context.Context, req *pb.ProductDelReq) (*pb.ProductDelReply, error) {
    return s.productUseCase.ProductDel(ctx, req)
}
```

### 简化模式

当方法很多时,可以直接透传:

```go
func (s *ShadowV1ProductService) ProductList(ctx context.Context, req *pb.ProductListReq) (*pb.ProductListReply, error) {
    return s.productUseCase.ProductList(ctx, req)
}
```

## 结构体定义

### 必须嵌入 Unimplemented

```go
type ShadowV1ProductService struct {
    pb.UnimplementedProductServer  // 必须嵌入
    log            *log.Helper
    productUseCase *biz.ShadowV1ProductUseCase
}
```

嵌入 `UnimplementedXxxServer` 的作用:
- 确保实现 gRPC 服务接口
- 未实现的方法返回 `Unimplemented` 错误

### 依赖注入

通过构造函数注入依赖:

```go
func NewShadowV1ProductService(
    logger log.Logger,                          // 日志
    productUseCase *biz.ShadowV1ProductUseCase, // UseCase
) *ShadowV1ProductService {
    // ...
}
```

## Wire 注册

在 `service.go` 中注册 Provider:

```go
// internal/service/service.go
package service

import "github.com/google/wire"

var ProviderSet = wire.NewSet(
    NewAppV1AuthService,
    NewAppV1UserService,
    NewShadowV1SysAdminService,
    NewShadowV1ProductService,  // 新增
    // ...
)
```

## 日志使用

### 初始化

```go
l := log.NewHelper(log.With(logger, "module", "service/模块名"), log.WithMessageKey("message"))
```

### 使用

```go
s.log.Info("处理请求")
s.log.Infof("用户登录: %s", req.Username)
s.log.Errorf("处理失败: %v", err)
```

## 特殊场景

### 需要上下文信息

从 context 获取元数据:

```go
import "gitlab.yc345.tv/backend/ainative-backend/internal/pkg/meta"

func (s *ShadowV1ProductService) ProductStore(ctx context.Context, req *pb.ProductStoreReq) (*pb.ProductStoreReply, error) {
    // 获取当前登录用户
    adminId := meta.GetAdminId(ctx)
    
    return s.productUseCase.ProductStore(ctx, req, adminId)
}
```

### 需要前置处理

简单的前置处理可以在 Service 层:

```go
func (s *ShadowV1ProductService) ProductStore(ctx context.Context, req *pb.ProductStoreReq) (*pb.ProductStoreReply, error) {
    // 字符串处理
    req.Name = strings.TrimSpace(req.Name)
    
    return s.productUseCase.ProductStore(ctx, req)
}
```

### 异步任务服务

```go
// internal/service/async.go
package service

type AsyncService struct {
    log         *log.Helper
    productRepo biz.ProductRepo
}

func NewAsyncService(
    logger log.Logger,
    productRepo biz.ProductRepo,
) *AsyncService {
    l := log.NewHelper(log.With(logger, "module", "service/async"), log.WithMessageKey("message"))
    return &AsyncService{
        log:         l,
        productRepo: productRepo,
    }
}

func (s *AsyncService) DailyTask() {
    // 定时任务逻辑
}
```

## 常见错误

### 错误1: 在 Service 层写业务逻辑

```go
// 错误示例
func (s *ShadowV1ProductService) ProductStore(ctx context.Context, req *pb.ProductStoreReq) (*pb.ProductStoreReply, error) {
    // 不应该在这里写业务逻辑
    if req.Price < 0 {
        return nil, errors.New("价格不能为负")
    }
    // 这些应该在 Biz 层
}
```

### 错误2: 直接调用 Data 层

```go
// 错误示例
type ShadowV1ProductService struct {
    productRepo biz.ProductRepo  // 错误: 不应该直接依赖 Data 层
}
```

### 错误3: 忘记嵌入 Unimplemented

```go
// 错误示例
type ShadowV1ProductService struct {
    // 缺少 pb.UnimplementedProductServer
    log *log.Helper
}
```

## 检查清单

- [ ] 文件命名符合 `{端}_v{版本}_{模块}.go` 格式
- [ ] 结构体嵌入 `pb.UnimplementedXxxServer`
- [ ] 构造函数以 `New` 开头
- [ ] 日志 module 名称正确
- [ ] 只调用 Biz 层,不直接调用 Data 层
- [ ] 已添加到 `service.go` 的 ProviderSet
- [ ] 已在 Server 层注册服务
