---
name: backend-codeing
description: 后端业务逻辑开发技能。触发场景：(1) 新增/修改 API 业务逻辑 (2) Biz 层 UseCase 与 Repo 接口 (3) Data 层实现与 DTO (4) Service 透传与注册 (5) HTTP/GRPC Server 注入与 Wire 同步 (6) 后端 CRUD 功能开发
allowed-tools: Read, Edit, Write, Glob, Grep, Bash
---

# Backend Coding (Step 6)

实现 **Biz → Data → Service → Server** 的完整链路，并完成 Wire 同步。

## 适用范围

- 新增/修改接口的业务逻辑
- 新增 Repo 接口与实现、DTO 转换
- 缓存/事务/分布式锁逻辑
- 新增或变更 HTTP/GRPC 服务注册

## 开发顺序

```
1. Biz 层 → 2. Data 层 → 3. Service 层 → 4. Server 层 → 5. Wire 同步
```

## 可编辑文件

| 层级        | 文件                                              | 说明                                   |
| ----------- | ------------------------------------------------- | -------------------------------------- |
| **Biz**     | `internal/biz/biz.go`                             | Repo 接口定义 + ProviderSet            |
| **Biz**     | `internal/biz/{position}_v1_{module}.go`          | UseCase 结构体与构造函数               |
| **Biz**     | `internal/biz/{position}_v1_{module}_{method}.go` | 具体业务逻辑方法                       |
| **Data**    | `internal/data/{table}.go`                        | Repo 实现 + DTO + 自定义查询           |
| **Data**    | `internal/data/data.go`                           | ProviderSet（生成 Repo + 自定义 Repo） |
| **Service** | `internal/service/{position}_v1_{module}.go`      | Service 透传调用 Biz                   |
| **Service** | `internal/service/service.go`                     | Service ProviderSet                    |
| **Server**  | `internal/server/http.go`                         | HTTP Server 注入/注册                  |
| **Server**  | `internal/server/grpc.go`                         | gRPC Server（如需）                    |
| **辅助**    | `internal/data/errorx/code.go`                    | 业务错误码                             |
| **辅助**    | `internal/data/constant/constant.go`              | 业务常量                               |
| **辅助**    | `internal/data/cache/cachekey.go`                 | 缓存 Key 定义                          |

## 禁止编辑

- `internal/data/gorm/**/*.gen.go` - 自动生成的 Model/DAO/Repo
- `api/**/*.pb.go` - Protobuf 生成代码
- `api/**/*.pb.validate.go` - 验证代码

---

## Step 1: Biz 层（核心业务逻辑）

### 1.1 定义 Repo 接口 (`biz.go`)

```go
// internal/biz/biz.go
type ProductRepo interface {
    ainative_backend_repo.IProductRepo  // 嵌入生成的接口
    // 自定义方法
    DTO(product *ainative_backend_model.Product) *pb.ProductInfo
    FindByNameLike(ctx context.Context, name string) ([]*ainative_backend_model.Product, error)
}
```

### 1.2 创建 UseCase 主文件

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

### 1.3 实现业务方法（每方法一文件）

详见 [references/biz-methods.md](references/biz-methods.md)

### 1.4 注册到 ProviderSet

```go
// internal/biz/biz.go
var ProviderSet = wire.NewSet(
    // ... 现有
    NewShadowV1ProductUseCase,  // 新增
)
```

---

## Step 2: Data 层（Repo 实现）

### 2.1 创建自定义 Repo

```go
// internal/data/product.go
package data

// 编译时接口检查
var _ biz.ProductRepo = (*ProductRepo)(nil)

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

type ProductRepo struct {
    log    *log.Helper
    config *conf.Bootstrap
    data   *Data
    *ainative_backend_repo.ProductRepo  // 嵌入生成的 Repo
}

// DTO 数据模型转 Protobuf
func (p *ProductRepo) DTO(product *ainative_backend_model.Product) *pb.ProductInfo {
    if product == nil {
        return nil
    }
    return &pb.ProductInfo{
        Id:        product.ID,
        Name:      product.Name,
        CreatedAt: timeutil.RFC3339(product.CreatedAt),
    }
}
```

### 2.2 注册到 ProviderSet

```go
// internal/data/data.go
var ProviderSet = wire.NewSet(
    // ... 基础设施
    ainative_backend_repo.NewProductRepo,  // 生成的 Repo
    NewProductRepo,                         // 自定义 Repo
)
```

---

## Step 3: Service 层（透传）

```go
// internal/service/shadow_v1_product.go
package service

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

func (s *ShadowV1ProductService) ProductList(ctx context.Context, req *pb.ProductListReq) (*pb.ProductListReply, error) {
    return s.productUseCase.ProductList(ctx, req)
}
```

注册到 `internal/service/service.go` 的 ProviderSet。

---

## Step 4: Server 注入

详见 [references/server-injection.md](references/server-injection.md)

```go
// internal/server/http.go
func NewHTTPServer(
    // ... 现有参数
    shadowV1ProductService *service.ShadowV1ProductService,  // 新增
) *http.Server {
    // ...
    shadowV1.RegisterProductHTTPServer(srv, shadowV1ProductService)
}
```

---

## Step 5: Wire 同步

```bash
cd ainative-backend && make wire
```

## 参考文档

| 文档                                                             | 说明                                  |
| ---------------------------------------------------------------- | ------------------------------------- |
| [references/biz-methods.md](references/biz-methods.md)           | Biz 层方法模板（List/Info/Store/Del） |
| [references/service-examples.md](references/service-examples.md) | Service 层代码示例                    |
| [references/server-injection.md](references/server-injection.md) | Server 注入步骤                       |
| [references/error-code.md](references/error-code.md)             | 错误码定义规范                        |
| [references/data-constant.md](references/data-constant.md)       | 常量定义规范                          |
| [references/cache-key.md](references/cache-key.md)               | 缓存 Key 定义                         |

## 检查清单

### Biz 层

- [ ] Repo 接口定义在 `biz.go`
- [ ] 接口嵌入 `ainative_backend_repo.IXxxRepo`
- [ ] UseCase 构造函数以 `New` 开头
- [ ] 依赖通过接口注入
- [ ] 方法单独文件，命名 `{position}_v1_{module}_{method}.go`
- [ ] 使用 `errorx` 错误码
- [ ] 已添加到 `biz.go` 的 ProviderSet

### Data 层

- [ ] 接口检查: `var _ biz.XxxRepo = (*XxxRepo)(nil)`
- [ ] 嵌入生成的 Repo: `*ainative_backend_repo.XxxRepo`
- [ ] 返回类型是接口: `func NewXxxRepo(...) biz.XxxRepo`
- [ ] DTO 方法处理 nil
- [ ] 更新操作传入 oldData
- [ ] 已注册生成 Repo 和自定义 Repo 到 ProviderSet

### Service 层

- [ ] 嵌入 `pb.UnimplementedXxxServer`
- [ ] 只调用 Biz 层，不直接调用 Data 层
- [ ] 已添加到 `service.go` 的 ProviderSet

### Server 层

- [ ] 已添加 Service 参数到 `NewHTTPServer`
- [ ] 已调用 `RegisterXxxHTTPServer`
- [ ] 已执行 `make wire`

## 输出

```
## Step 6: 业务逻辑
- Biz: ✅ UseCase/方法已实现
- Data: ✅ Repo/DTO/ProviderSet 已更新
- Service: ✅ 透传已完成/已注册
- Server: ✅ HTTP/GRPC 已注入
- Wire: ✅ 已同步
- Errorx: ✅ 已定义/⏭️ 沿用现有
```
