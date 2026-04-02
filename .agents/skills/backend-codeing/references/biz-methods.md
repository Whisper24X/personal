# Biz 层方法模板

> 何时阅读: 实现 Biz 层业务方法时参考此文件。

## 文件命名

`internal/biz/{position}_v1_{module}_{method}.go`

示例: `shadow_v1_product_productlist.go`

---

## 列表查询 (List)

```go
// internal/biz/shadow_v1_product_productlist.go
package biz

import (
    "context"
    pb "gitlab.yc345.tv/backend/ainative-backend/api/shadow/v1"
    "gitlab.yc345.tv/backend/ainative-backend/internal/data/errorx"
    "gitlab.yc345.tv/backend/orm-gen/v2/condition"
)

func (p *ShadowV1ProductUseCase) ProductList(ctx context.Context, req *pb.ProductListReq) (*pb.ProductListReply, error) {
    // 1. 构建查询条件
    // ⚠️ Field 值必须与目标 model 实际定义一致，不可从其他文件的写法推断
    // 查阅 internal/data/gorm/*_model/{table}.gen.go 确认实际值
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

---

## 详情查询 (Info)

```go
// internal/biz/shadow_v1_product_productinfo.go
package biz

func (p *ShadowV1ProductUseCase) ProductInfo(ctx context.Context, req *pb.ProductInfoReq) (*pb.ProductInfoReply, error) {
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

---

## 新增/更新 (Store)

```go
// internal/biz/shadow_v1_product_productstore.go
package biz

func (p *ShadowV1ProductUseCase) ProductStore(ctx context.Context, req *pb.ProductStoreReq) (*pb.ProductStoreReply, error) {
    var productId string

    if req.Id == "" {
        // 新增
        product := &ainative_backend_model.Product{
            Name:   req.Name,
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

---

## 删除 (Del)

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

---

## 状态更新 (Status)

```go
// internal/biz/shadow_v1_product_productstatus.go
package biz

func (p *ShadowV1ProductUseCase) ProductStatus(ctx context.Context, req *pb.ProductStatusReq) (*pb.ProductStatusReply, error) {
    oldProduct, err := p.productRepo.FindOneCacheByID(ctx, req.Id)
    if err != nil {
        return nil, errorx.DataSQLErr.WithError(err).Err()
    }
    if oldProduct.ID == "" {
        return nil, errorx.DataNotFound.Err()
    }

    newProduct := p.productRepo.DeepCopy(oldProduct)
    newProduct.Status = int16(req.Status)

    err = p.productRepo.UpdateOneCacheWithZero(ctx, newProduct, oldProduct)
    if err != nil {
        return nil, errorx.DataSQLErr.WithError(err).Err()
    }

    return &pb.ProductStatusReply{}, nil
}
```

---

## 事务处理

```go
func (p *ShadowV1ProductUseCase) BatchCreate(ctx context.Context, req *pb.BatchCreateReq) error {
    return p.commonRepo.Transaction(ctx, func(tx *ainative_backend_dao.Query) error {
        for _, item := range req.Items {
            product := &ainative_backend_model.Product{Name: item.Name}
            err := p.productRepo.CreateOneCacheByTx(ctx, tx, product)
            if err != nil {
                return err  // 自动回滚
            }
        }
        return nil  // 自动提交
    })
}
```

---

## 分布式锁

```go
func (p *ShadowV1ProductUseCase) UpdateStock(ctx context.Context, productId string, delta int) error {
    lockKey := fmt.Sprintf("product:stock:%s", productId)

    return p.commonRepo.AutoLock(ctx, lockKey, 5*time.Second, func() error {
        product, err := p.productRepo.FindOneCacheByID(ctx, productId)
        if err != nil {
            return err
        }
        product.Stock += delta
        return p.productRepo.UpdateOneCache(ctx, product, product)
    })
}
```
