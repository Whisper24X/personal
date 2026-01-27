# Data 层编写指南

## 概述

Data 层负责数据访问,实现 Biz 层定义的 Repository 接口。

**位置**: `internal/data/`

**核心职责**:
- 实现 Repository 接口
- 数据库 CRUD 操作
- 缓存读写
- 数据模型转换 (Model → Protobuf)

## 文件结构

```
internal/data/
├── data.go                  # Wire Provider + 基础设施初始化
├── common.go                # 通用 Repo (事务、锁、缓存)
├── sysadmin.go              # 自定义 SysAdminRepo
├── sysrole.go               # 自定义 SysRoleRepo
├── gorm/                    # GORM 自动生成
│   ├── ainative_backend_model/  # 数据模型
│   ├── ainative_backend_dao/    # DAO 查询对象
│   └── ainative_backend_repo/   # 基础 Repository
├── cache/                   # 缓存相关
├── dto/                     # 数据传输对象
├── errorx/                  # 错误码
├── constant/                # 常量
└── rpc/                     # RPC 客户端
```

## 自动生成的代码

### 生成命令

```bash
make gorm TABLES=product
```

### 生成的文件

| 目录 | 文件 | 说明 |
|-----|------|------|
| `ainative_backend_model/` | `product.gen.go` | 数据模型 |
| `ainative_backend_dao/` | `product.gen.go` | DAO 查询对象 |
| `ainative_backend_repo/` | `product.repo.go` | 基础 Repository |

### 数据模型示例

```go
// internal/data/gorm/ainative_backend_model/product.gen.go
package ainative_backend_model

type Product struct {
    ID        string    `gorm:"column:id;type:uuid;primaryKey"`
    Name      string    `gorm:"column:name;type:varchar(100)"`
    Price     int32     `gorm:"column:price;type:integer"`
    Status    int16     `gorm:"column:status;type:smallint"`
    CreatedAt time.Time `gorm:"column:createdAt;type:timestamp with time zone"`
    UpdatedAt time.Time `gorm:"column:updatedAt;type:timestamp with time zone"`
}
```

### 基础 Repository 接口

自动生成的接口包含常用方法:

```go
type IProductRepo interface {
    // 创建
    CreateOne(ctx context.Context, data *Product) error
    CreateOneCache(ctx context.Context, data *Product) error
    CreateBatch(ctx context.Context, data []*Product, batchSize int) error
    
    // 更新
    UpdateOne(ctx context.Context, newData *Product) error
    UpdateOneCache(ctx context.Context, newData *Product, oldData *Product) error
    
    // 查询
    FindOneByID(ctx context.Context, ID string) (*Product, error)
    FindOneCacheByID(ctx context.Context, ID string) (*Product, error)
    FindMultiByIDS(ctx context.Context, IDS []string) ([]*Product, error)
    FindMultiCacheByCondition(ctx context.Context, req *condition.Req) ([]*Product, *condition.Reply, error)
    
    // 删除
    DeleteOneByID(ctx context.Context, ID string) error
    DeleteOneCacheByID(ctx context.Context, ID string) error
    
    // 工具方法
    DeepCopy(data *Product) *Product
    DeleteIndexCache(ctx context.Context, data ...*Product) error
}
```

## 自定义 Repository

### 完整示例

```go
// internal/data/product.go
package data

import (
    "context"

    "github.com/go-kratos/kratos/v2/log"
    pb "gitlab.yc345.tv/ainative/ainative-backend/api/shadow/v1"
    "gitlab.yc345.tv/ainative/ainative-backend/internal/biz"
    "gitlab.yc345.tv/ainative/ainative-backend/internal/conf"
    "gitlab.yc345.tv/ainative/ainative-backend/internal/data/errorx"
    "gitlab.yc345.tv/ainative/ainative-backend/internal/data/gorm/ainative_backend_dao"
    "gitlab.yc345.tv/ainative/ainative-backend/internal/data/gorm/ainative_backend_model"
    "gitlab.yc345.tv/ainative/ainative-backend/internal/data/gorm/ainative_backend_repo"
    "gitlab.yc345.tv/ainative/ainative-backend/internal/pkg/util/timeutil"
)

// 编译时接口检查
var _ biz.ProductRepo = (*ProductRepo)(nil)

// NewProductRepo 创建 ProductRepo
func NewProductRepo(
    logger log.Logger,
    config *conf.Bootstrap,
    data *Data,
    productRepo *ainative_backend_repo.ProductRepo,
) biz.ProductRepo {
    l := log.NewHelper(log.With(logger, "module", "data/product"), log.WithMessageKey("message"))
    return &ProductRepo{
        log:         l,
        config:      config,
        data:        data,
        ProductRepo: productRepo,
    }
}

// ProductRepo 商品 Repository
type ProductRepo struct {
    log    *log.Helper
    config *conf.Bootstrap
    data   *Data
    *ainative_backend_repo.ProductRepo  // 嵌入自动生成的 Repo
}

// DTO 数据模型转 Protobuf
func (p *ProductRepo) DTO(product *ainative_backend_model.Product) *pb.ProductInfo {
    if product == nil {
        return nil
    }
    return &pb.ProductInfo{
        Id:        product.ID,
        Name:      product.Name,
        Price:     product.Price,
        Status:    int32(product.Status),
        CreatedAt: timeutil.RFC3339(product.CreatedAt),
        UpdatedAt: timeutil.RFC3339(product.UpdatedAt),
    }
}

// FindByNameLike 根据名称模糊查询
func (p *ProductRepo) FindByNameLike(ctx context.Context, name string) ([]*ainative_backend_model.Product, error) {
    dao := ainative_backend_dao.Use(p.data.db).Product
    return dao.WithContext(ctx).Where(dao.Name.Like("%" + name + "%")).Find()
}

// FindActiveProducts 查询启用的商品
func (p *ProductRepo) FindActiveProducts(ctx context.Context) ([]*ainative_backend_model.Product, error) {
    dao := ainative_backend_dao.Use(p.data.db).Product
    return dao.WithContext(ctx).Where(dao.Status.Eq(1)).Find()
}
```

### 关键点

1. **接口检查**: `var _ biz.ProductRepo = (*ProductRepo)(nil)`
2. **嵌入生成的 Repo**: `*ainative_backend_repo.ProductRepo`
3. **返回接口类型**: `func NewProductRepo(...) biz.ProductRepo`

## Wire 注册

在 `data.go` 中注册:

```go
// internal/data/data.go
var ProviderSet = wire.NewSet(
    // 基础设施
    NewDB,
    NewRedis,
    NewData,
    
    // 自动生成的 Repo
    ainative_backend_repo.NewProductRepo,
    
    // 自定义 Repo
    NewProductRepo,
    
    // ...
)
```

## DAO 使用

### 基本查询

```go
dao := ainative_backend_dao.Use(p.data.db).Product

// 单条查询
product, err := dao.WithContext(ctx).Where(dao.ID.Eq(id)).First()

// 多条查询
products, err := dao.WithContext(ctx).Where(dao.Status.Eq(1)).Find()

// 条件组合
products, err := dao.WithContext(ctx).
    Where(dao.Status.Eq(1)).
    Where(dao.Name.Like("%keyword%")).
    Order(dao.CreatedAt.Desc()).
    Limit(10).
    Find()
```

### 创建

```go
dao := ainative_backend_dao.Use(p.data.db).Product

// 创建单条
err := dao.WithContext(ctx).Create(product)

// 批量创建
err := dao.WithContext(ctx).CreateInBatches(products, 100)
```

### 更新

```go
dao := ainative_backend_dao.Use(p.data.db).Product

// 更新对象 (非零值)
_, err := dao.WithContext(ctx).Updates(product)

// 更新指定字段
_, err := dao.WithContext(ctx).
    Where(dao.ID.Eq(id)).
    Update(dao.Status, 1)

// 更新多个字段
_, err := dao.WithContext(ctx).
    Where(dao.ID.Eq(id)).
    Updates(map[string]interface{}{
        "name":   "new name",
        "status": 1,
    })
```

### 删除

```go
dao := ainative_backend_dao.Use(p.data.db).Product

// 删除
_, err := dao.WithContext(ctx).Where(dao.ID.Eq(id)).Delete()

// 批量删除
_, err := dao.WithContext(ctx).Where(dao.ID.In(ids...)).Delete()
```

## 缓存使用

### 带缓存的查询

自动生成的 Repo 提供 `*Cache*` 后缀的方法:

```go
// 查询时自动使用缓存
product, err := p.FindOneCacheByID(ctx, id)

// 创建后清除相关缓存
err := p.CreateOneCache(ctx, product)

// 更新后清除相关缓存 (需要传入旧数据)
err := p.UpdateOneCache(ctx, newProduct, oldProduct)

// 删除后清除缓存
err := p.DeleteOneCacheByID(ctx, id)
```

### 缓存 Key 定义

```go
var (
    CacheProductByIDPrefix        = "DBCache:devices_demo:ProductByID"
    CacheProductByConditionPrefix = "DBCache:devices_demo:ProductByCondition"
)
```

## 事务使用

### 使用事务的方法

```go
// 使用带 Tx 后缀的方法
err := p.commonRepo.Transaction(ctx, func(tx *ainative_backend_dao.Query) error {
    err := p.productRepo.CreateOneCacheByTx(ctx, tx, product1)
    if err != nil {
        return err
    }
    err = p.productRepo.CreateOneCacheByTx(ctx, tx, product2)
    if err != nil {
        return err
    }
    return nil
})
```

## CommonRepo

### 接口

```go
type CommonRepo interface {
    // 分布式锁 (自动续期)
    AutoLock(ctx context.Context, key string, ttl time.Duration, fn func() error) error
    
    // 分布式锁 (带重试)
    AutoLockRetry(ctx context.Context, key string, ttl time.Duration, fn func() error) error
    
    // 分布式锁 (仅执行一次)
    LockOnce(ctx context.Context, key string, ttl time.Duration, fn func() error) error
    
    // 事务
    Transaction(ctx context.Context, fn func(tx *ainative_backend_dao.Query) error) error
    
    // 清除缓存
    ClearCache(ctx context.Context) error
}
```

### 实现

```go
// internal/data/common.go
func NewCommonRepo(
    logger log.Logger,
    data *Data,
) biz.CommonRepo {
    // ...
}

func (c *CommonRepo) Transaction(ctx context.Context, fn func(tx *ainative_backend_dao.Query) error) error {
    return c.data.db.Transaction(func(tx *gorm.DB) error {
        return fn(ainative_backend_dao.Use(tx))
    })
}
```

## 错误码定义

位置: `internal/data/errorx/code.go`

```go
package errorx

import "gitlab.yc345.tv/ainative/ainative-backend/internal/pkg/errx"

var Manager = errx.NewManager()

var (
    // 通用错误
    ParamErr     = Manager.Add(errx.New(4000, "参数错误", "Parameter error"))
    DataNotFound = Manager.Add(errx.New(4004, "数据不存在", "Data not found"))
    DataSQLErr   = Manager.Add(errx.New(5001, "数据库错误", "Database error"))
    
    // Token 错误
    TokenExpired    = Manager.Add(errx.New(4001, "token已过期", "Token expired"))
    TokenInvalid    = Manager.Add(errx.New(4002, "无效token", "Invalid token"))
    
    // 业务错误
    ProductNotFound = Manager.Add(errx.New(4101, "商品不存在", "Product not found"))
)
```

## 检查清单

- [ ] 接口检查: `var _ biz.XxxRepo = (*XxxRepo)(nil)`
- [ ] 嵌入自动生成的 Repo
- [ ] 返回类型是接口 `biz.XxxRepo`
- [ ] DTO 方法处理 nil
- [ ] 更新操作传入 oldData
- [ ] 已注册自动生成的 Repo 和自定义 Repo 到 ProviderSet
- [ ] 错误码已定义在 errorx
