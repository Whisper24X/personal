# Biz / Data / Service / Server

## 实现顺序

1. `internal/biz`: UseCase、Repo 接口、业务方法。
2. `internal/data`: 仅在生成 Repo 不够用时补充自定义方法。
3. `internal/service`: Service 只透传到 Biz。
4. `internal/service/service.go`: 注册 Service ProviderSet。
5. `internal/server/http.go`: 注入 Service 参数并注册 HTTP Gateway server。
6. `make wire`: 更新依赖注入。

## Biz 层

### Repo 接口

在 `internal/biz/biz.go` 中定义或扩展接口，优先嵌入生成 Repo 接口：

```go
type ProductRepo interface {
    {module}_repo.IProductRepo
    DTO(product *{module}_model.Product) *pb.ProductInfo
}
```

### UseCase

```go
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
```

### 业务方法

- 文件命名建议：`internal/biz/{position}_v1_{module}_{method}.go`。
- 查询条件字段必须以实际 model 为准，不从其他模块推断。
- 更新时优先读取 oldData，再 DeepCopy 后更新。
- 需要事务时使用 `commonRepo.Transaction`。
- 需要分布式锁时使用 `commonRepo.AutoLock` / `LockOnce`。

列表、详情、保存、删除、状态更新等方法按当前模块已有实现风格编写，字段名必须以实际 model 为准。完整 Biz 方法模板见 [templates-biz.md](templates-biz.md)。

## Data 层

优先使用当前模块 `internal/data/gorm/*_repo` 或实际生成 Repo 包中的已有方法。不要为了转发生成方法再封装一层。

只有以下情况才新增 `internal/data/{table}.go` 自定义方法：

- 生成 Repo 无法表达查询；
- 需要 DTO 转换；
- 需要跨表聚合；
- 需要缓存/事务/外部资源组合。

自定义 Repo 要做接口检查：

```go
var _ biz.ProductRepo = (*ProductRepo)(nil)
```

常量放 `internal/data/constant/constant.go`，缓存 Key 放 `internal/data/cache/cachekey.go`。常量、缓存 Key、错误码模板见 [templates-data.md](templates-data.md)。

## Service 层

Service 只做透传，不写业务逻辑：

```go
type ShadowV1ProductService struct {
    pb.UnimplementedProductServer
    log            *log.Helper
    productUseCase *biz.ShadowV1ProductUseCase
}

// ProductList 商品表-列表数据查询
func (s *ShadowV1ProductService) ProductList(ctx context.Context, req *pb.ProductListReq) (*pb.ProductListReply, error) {
    return s.productUseCase.ProductList(ctx, req)
}
```

必须注册到 `internal/service/service.go`：

```go
var ProviderSet = wire.NewSet(
    NewShadowV1ProductService,
)
```

完整 Service 结构体和透传方法模板见 [templates-service.md](templates-service.md)。

## Server 注入

在 `internal/server/http.go`：

1. `NewHTTPServer` 增加 Service 参数。
2. 在对应 Shadow/App 分组下调用 `Register{Service}HTTPServer`。
3. 执行 `make wire`。

当前门禁只强制检查 HTTP Gateway 注册；`*_grpc.pb.go` 属于 API 生成物检查，不代表已经完成 gRPC server 注册。

示例：

```go
shadowV1ProductService *service.ShadowV1ProductService,

shadowV1.RegisterProductHTTPServer(srv, shadowV1ProductService)
```

完成后必须搜索确认参数和注册调用都存在。

完整 Server 注入模板见 [templates-server.md](templates-server.md)。

## 错误码

- 通用业务错误优先使用 `internal/data/errorx/code.go`。
- API 错误码 proto 修改后必须执行 `make api` 和 `make protocode`。
- 常用：`errorx.ParamErr`、`errorx.DataNotFound`、`errorx.DataSQLErr`、`errorx.TokenExpired`、`errorx.TokenInvalid`。

## 输出模板

```markdown
## Code Result
- Biz:
- Data:
- Service:
- Server:
- ProviderSet:
- Wire required: yes/no
```
