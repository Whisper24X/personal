# Biz 层编写指南

## 概述

Biz 层是业务逻辑层,包含核心业务规则和用例实现。

**位置**: `internal/biz/`

**核心职责**:
- 实现业务逻辑
- 定义 Repository 接口 (依赖倒置)
- 编排多个 Repository 调用
- 业务规则校验

## 文件结构

```
internal/biz/
├── biz.go                                   # Wire Provider + 接口定义
├── app_v1_auth.go                          # UseCase 结构体
├── app_v1_auth_authlogin.go                # 具体方法
├── app_v1_auth_authchecktoken.go           # 具体方法
├── shadow_v1_sysadmin.go                   # UseCase 结构体
├── shadow_v1_sysadmin_sysadminlist.go      # 具体方法
└── ...
```

## 文件命名规范

| 类型 | 格式 | 示例 |
|-----|------|------|
| UseCase 主文件 | `{端}_v{版本}_{模块}.go` | `shadow_v1_product.go` |
| 方法文件 | `{端}_v{版本}_{模块}_{方法}.go` | `shadow_v1_product_productlist.go` |

## 接口定义 (biz.go)

在 `biz.go` 中定义 Repository 接口:

```go
// internal/biz/biz.go
package biz

import (
    "context"
    "github.com/google/wire"
    pb "gitlab.yc345.tv/ainative/ainative-backend/api/shadow/v1"
    "gitlab.yc345.tv/ainative/ainative-backend/internal/data/gorm/ainative_backend_model"
    "gitlab.yc345.tv/ainative/ainative-backend/internal/data/gorm/ainative_backend_repo"
)

var ProviderSet = wire.NewSet(
    NewAppV1AuthUseCase,
    NewShadowV1ProductUseCase,  // 新增
    // ...
)

// 通用 Repo 接口
type CommonRepo interface {
    AutoLock(ctx context.Context, key string, ttl time.Duration, fn func() error) error
    Transaction(ctx context.Context, fn func(tx *ainative_backend_dao.Query) error) error
    ClearCache(ctx context.Context) error
}

// ProductRepo 商品 Repository 接口
type ProductRepo interface {
    ainative_backend_repo.IProductRepo  // 嵌入自动生成的接口
    DTO(product *ainative_backend_model.Product) *pb.ProductInfo
    // 自定义方法
    FindByNameLike(ctx context.Context, name string) ([]*ainative_backend_model.Product, error)
}
```

### 接口设计原则

1. **嵌入生成的接口**: 复用自动生成的 CRUD 方法
2. **添加自定义方法**: 业务特定的数据访问方法
3. **DTO 方法**: 数据模型到 Protobuf 消息的转换

## UseCase 结构体

### 主文件

```go
// internal/biz/shadow_v1_product.go
package biz

import "github.com/go-kratos/kratos/v2/log"

func NewShadowV1ProductUseCase(
    logger log.Logger,
    commonRepo CommonRepo,
    productRepo ProductRepo,
) *ShadowV1ProductUseCase {
    l := log.NewHelper(log.With(logger, "module", "biz/shadowV1Product"), log.WithMessageKey("message"))
    return &ShadowV1ProductUseCase{
        log:         l,
        commonRepo:  commonRepo,
        productRepo: productRepo,
    }
}

type ShadowV1ProductUseCase struct {
    log         *log.Helper
    commonRepo  CommonRepo
    productRepo ProductRepo
}
```

### 依赖注入

通过接口注入,而不是具体实现:

```go
func NewShadowV1ProductUseCase(
    logger log.Logger,
    commonRepo CommonRepo,      // 接口,不是 *data.CommonRepo
    productRepo ProductRepo,    // 接口,不是 *data.ProductRepo
) *ShadowV1ProductUseCase
```

## 方法实现

### 列表查询

```go
// internal/biz/shadow_v1_product_productlist.go
package biz

import (
    "context"
    pb "gitlab.yc345.tv/ainative/ainative-backend/api/shadow/v1"
    "gitlab.yc345.tv/ainative/ainative-backend/internal/data/errorx"
    "gitlab.yc345.tv/backend/orm-gen/v2/condition"
)

func (p *ShadowV1ProductUseCase) ProductList(ctx context.Context, req *pb.ProductListReq) (*pb.ProductListReply, error) {
    // 1. 构建查询条件
    conditionReq := &condition.Req{
        Page:     req.Page,
        PageSize: req.PageSize,
        Orders: []condition.Order{
            {Field: "createdAt", Direction: "desc"},
        },
    }
    
    // 添加过滤条件
    if req.Name != "" {
        conditionReq.Filters = append(conditionReq.Filters, condition.Filter{
            Field:    "name",
            Operator: "like",
            Value:    "%" + req.Name + "%",
        })
    }
    if req.Status != 0 {
        conditionReq.Filters = append(conditionReq.Filters, condition.Filter{
            Field:    "status",
            Operator: "=",
            Value:    req.Status,
        })
    }
    
    // 2. 查询数据
    products, reply, err := p.productRepo.FindMultiCacheByCondition(ctx, conditionReq)
    if err != nil {
        return nil, errorx.DataSQLErr.WithError(err).Err()
    }
    
    // 3. 转换响应
    list := make([]*pb.ProductInfo, 0, len(products))
    for _, item := range products {
        list = append(list, p.productRepo.DTO(item))
    }
    
    return &pb.ProductListReply{
        Total: reply.Total,
        List:  list,
    }, nil
}
```

### 详情查询

```go
// internal/biz/shadow_v1_product_productinfo.go
package biz

func (p *ShadowV1ProductUseCase) ProductInfo(ctx context.Context, req *pb.ProductInfoReq) (*pb.ProductInfoReply, error) {
    // 查询
    product, err := p.productRepo.FindOneCacheByID(ctx, req.Id)
    if err != nil {
        return nil, errorx.DataSQLErr.WithError(err).Err()
    }
    if product.ID == "" {
        return nil, errorx.DataNotFound.Err()
    }
    
    return &pb.ProductInfoReply{
        Info: p.productRepo.DTO(product),
    }, nil
}
```

### 新增/更新 (Store 模式)

```go
// internal/biz/shadow_v1_product_productstore.go
package biz

func (p *ShadowV1ProductUseCase) ProductStore(ctx context.Context, req *pb.ProductStoreReq) (*pb.ProductStoreReply, error) {
    var productId string
    
    if req.Id == "" {
        // 新增
        product := &ainative_backend_model.Product{
            Name:   req.Name,
            Price:  req.Price,
            Status: int16(req.Status),
        }
        err := p.productRepo.CreateOneCache(ctx, product)
        if err != nil {
            return nil, errorx.DataSQLErr.WithError(err).Err()
        }
        productId = product.ID
    } else {
        // 更新
        oldProduct, err := p.productRepo.FindOneCacheByID(ctx, req.Id)
        if err != nil {
            return nil, errorx.DataSQLErr.WithError(err).Err()
        }
        if oldProduct.ID == "" {
            return nil, errorx.DataNotFound.Err()
        }
        
        newProduct := p.productRepo.DeepCopy(oldProduct)
        newProduct.Name = req.Name
        newProduct.Price = req.Price
        newProduct.Status = int16(req.Status)
        
        err = p.productRepo.UpdateOneCache(ctx, newProduct, oldProduct)
        if err != nil {
            return nil, errorx.DataSQLErr.WithError(err).Err()
        }
        productId = newProduct.ID
    }
    
    return &pb.ProductStoreReply{Id: productId}, nil
}
```

### 删除

```go
// internal/biz/shadow_v1_product_productdel.go
package biz

func (p *ShadowV1ProductUseCase) ProductDel(ctx context.Context, req *pb.ProductDelReq) (*pb.ProductDelReply, error) {
    err := p.productRepo.DeleteOneCacheByID(ctx, req.Id)
    if err != nil {
        return nil, errorx.DataSQLErr.WithError(err).Err()
    }
    return &pb.ProductDelReply{}, nil
}
```

## 事务处理

使用 CommonRepo 的事务方法:

```go
func (p *ShadowV1ProductUseCase) BatchCreate(ctx context.Context, req *pb.BatchCreateReq) error {
    return p.commonRepo.Transaction(ctx, func(tx *ainative_backend_dao.Query) error {
        for _, item := range req.Items {
            product := &ainative_backend_model.Product{
                Name:  item.Name,
                Price: item.Price,
            }
            err := p.productRepo.CreateOneCacheByTx(ctx, tx, product)
            if err != nil {
                return err  // 自动回滚
            }
        }
        return nil  // 自动提交
    })
}
```

## 分布式锁

防止并发问题:

```go
func (p *ShadowV1ProductUseCase) UpdateStock(ctx context.Context, productId string, delta int) error {
    lockKey := fmt.Sprintf("product:stock:%s", productId)
    
    return p.commonRepo.AutoLock(ctx, lockKey, 5*time.Second, func() error {
        // 获取锁后的操作
        product, err := p.productRepo.FindOneCacheByID(ctx, productId)
        if err != nil {
            return err
        }
        product.Stock += delta
        return p.productRepo.UpdateOneCache(ctx, product, product)
    })
}
```

## 错误处理

使用项目定义的错误码:

```go
import "gitlab.yc345.tv/ainative/ainative-backend/internal/data/errorx"

// 返回错误
return nil, errorx.DataNotFound.Err()

// 包装原始错误
return nil, errorx.DataSQLErr.WithError(err).Err()

// 自定义错误信息
return nil, errorx.ParamErr.WithMessage("价格不能为负").Err()
```

## 检查清单

- [ ] 接口定义在 `biz.go` 中
- [ ] UseCase 构造函数以 `New` 开头
- [ ] 依赖通过接口注入,不是具体实现
- [ ] 方法单独文件,命名符合规范
- [ ] 使用项目错误码
- [ ] 需要缓存的查询使用 `*Cache*` 方法
- [ ] 更新操作传入 oldData 以正确删除缓存
- [ ] 已添加到 `biz.go` 的 ProviderSet
