# Service 层代码示例

> 何时阅读: 实现 Service 层透传方法时参考此文件。

## 核心原则

Service 层**只做透传**，不包含业务逻辑。

---

## Service 结构体模板

```go
// internal/service/shadow_v1_product.go
package service

import (
    "context"
    "github.com/go-kratos/kratos/v2/log"
    pb "gitlab.yc345.tv/backend/ainative-backend/api/shadow/v1"
    "gitlab.yc345.tv/backend/ainative-backend/internal/biz"
)

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

type ShadowV1ProductService struct {
    pb.UnimplementedProductServer  // 必须嵌入
    log            *log.Helper
    productUseCase *biz.ShadowV1ProductUseCase
}
```

---

## 透传方法示例

### 列表查询

```go
func (s *ShadowV1ProductService) ProductList(ctx context.Context, req *pb.ProductListReq) (*pb.ProductListReply, error) {
    return s.productUseCase.ProductList(ctx, req)
}
```

### 详情查询

```go
func (s *ShadowV1ProductService) ProductInfo(ctx context.Context, req *pb.ProductInfoReq) (*pb.ProductInfoReply, error) {
    return s.productUseCase.ProductInfo(ctx, req)
}
```

### 新增/更新

```go
func (s *ShadowV1ProductService) ProductStore(ctx context.Context, req *pb.ProductStoreReq) (*pb.ProductStoreReply, error) {
    return s.productUseCase.ProductStore(ctx, req)
}
```

### 删除

```go
func (s *ShadowV1ProductService) ProductDel(ctx context.Context, req *pb.ProductDelReq) (*pb.ProductDelReply, error) {
    return s.productUseCase.ProductDel(ctx, req)
}
```

---

## 注册到 ProviderSet

```go
// internal/service/service.go
var ProviderSet = wire.NewSet(
    // ... 现有
    NewShadowV1ProductService,  // 新增
)
```

---

## 常见错误

### 错误1: 在 Service 层写业务逻辑

```go
// 错误示例
func (s *ShadowV1ProductService) ProductStore(...) {
    if req.Price < 0 {  // 不应该在这里
        return nil, errors.New("价格不能为负")
    }
}
```

### 错误2: 忘记嵌入 Unimplemented

```go
// 错误示例
type ShadowV1ProductService struct {
    // 缺少 pb.UnimplementedProductServer
}
```