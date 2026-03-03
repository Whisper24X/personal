---
name: create-ainative-backend-api
description: 在 ainative-backend (Go + Kratos) 中创建新 API 接口。提供从需求分析到代码生成的完整流程。当用户要求创建新的后端接口、需要为前端提供新的 API、或需要实现新的业务逻辑时使用。
---

# ainative-backend 创建新 API Skill

## 技能用途

当需要在 ainative-backend (Go + Kratos 微服务框架) 中创建新的 API 接口时使用此技能。

**触发条件**:
- 用户要求创建新的后端接口
- 需要为前端提供新的 API
- 需要实现新的业务逻辑

## 技能步骤

### 1. 需求分析

确认以下信息:
- [ ] 接口功能和业务逻辑
- [ ] 接口所属端 (shadow 管理后台 / wechat 小程序端)
- [ ] 是否需要新建数据库表
- [ ] 数据库操作类型 (查询/创建/更新/删除)
- [ ] 权限要求

### 2. 数据库表设计 (如需要)

**使用 MCP 工具创建表**:

```sql
CREATE TABLE `表名` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `name` varchar(255) NOT NULL COMMENT '名称',
  `status` tinyint(4) DEFAULT '1' COMMENT '状态 1:启用 0:禁用',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at` datetime DEFAULT NULL COMMENT '删除时间',
  PRIMARY KEY (`id`),
  KEY `idx_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='表描述';
```

**导出 SQL 文件** (可选):

```bash
make sqldump TABLES=表名
```

### 3. 生成 GORM 代码

```bash
make gorm TABLES=表名
```

这会在 `internal/data/gorm/` 生成:
- `model/表名.go` - GORM Model
- `dao/表名.go` - 基础 DAO
- `repo/表名_repo.go` - 基础 Repository

### 4. 生成 Proto 文件

```bash
# 管理后台接口
make sqltopb shadow 表名

# 小程序端接口
make sqltopb wechat 表名
```

这会在 `api/{端}/v1/` 生成基础的 Proto 文件。

### 5. 编写/修改 Proto 文件

在 `api/shadow/v1/` 或 `api/wechat/v1/` 编辑 Proto 文件:

```protobuf
syntax = "proto3";

package shadow.v1;

import "google/api/annotations.proto";
import "validate/validate.proto";

option go_package = "gitlab.yc345.tv/ainative/ainative-backend/api/shadow/v1;v1";

// 模块服务
service ModuleService {
  // 获取列表
  rpc ModuleList(ModuleListReq) returns (ModuleListReply) {
    option (google.api.http) = {
      get: "/shadow/v1/moduleList"
    };
  }
  
  // 创建/更新
  rpc ModuleSave(ModuleSaveReq) returns (ModuleSaveReply) {
    option (google.api.http) = {
      post: "/shadow/v1/moduleSave"
      body: "*"
    };
  }
  
  // 删除
  rpc ModuleDelete(ModuleDeleteReq) returns (ModuleDeleteReply) {
    option (google.api.http) = {
      post: "/shadow/v1/moduleDelete"
      body: "*"
    };
  }
}

// 列表请求
message ModuleListReq {
  int64 current = 1 [(validate.rules).int64 = {gte: 1}]; // 当前页
  int64 size = 2 [(validate.rules).int64 = {gte: 1, lte: 100}]; // 每页大小
  string name = 3; // 名称搜索
}

// 列表响应
message ModuleListReply {
  int64 total = 1; // 总数
  repeated ModuleItem records = 2; // 数据列表
}

// 列表项
message ModuleItem {
  int64 id = 1; // ID
  string name = 2; // 名称
  int32 status = 3; // 状态
  string created_at = 4; // 创建时间
}

// 保存请求
message ModuleSaveReq {
  int64 id = 1; // ID (更新时传)
  string name = 2 [(validate.rules).string = {min_len: 1, max_len: 100}]; // 名称
  int32 status = 3 [(validate.rules).int32 = {in: [0, 1]}]; // 状态
}

// 保存响应
message ModuleSaveReply {
  int64 id = 1; // ID
}

// 删除请求
message ModuleDeleteReq {
  int64 id = 1 [(validate.rules).int64 = {gte: 1}]; // ID
}

// 删除响应
message ModuleDeleteReply {}
```

### 6. 格式化并生成 API 代码

```bash
# 格式化 Proto 文件
make buf

# 生成 API 代码
make api
```

这会生成:
- `*_grpc.pb.go` - gRPC 服务定义
- `*_http.pb.go` - HTTP 路由定义
- `*.pb.go` - 消息定义
- `*.pb.validate.go` - 参数校验代码
- `*.swagger.json` - Swagger 文档

### 7. 生成骨架代码

```bash
make protocode
```

这会在以下目录生成骨架代码:
- `internal/service/` - Service 层
- `internal/biz/` - Biz 层骨架

### 8. 实现 Data 层

在 `internal/data/表名.go` 实现 Repository:

```go
package data

import (
    "context"
    "gitlab.yc345.tv/ainative/ainative-backend/internal/biz"
    "gitlab.yc345.tv/ainative/ainative-backend/internal/data/gorm/model"
    "gitlab.yc345.tv/ainative/ainative-backend/internal/data/gorm/repo"
)

type moduleRepo struct {
    data *Data
    repo *repo.ModuleRepo
}

// NewModuleRepo 创建 Repository
func NewModuleRepo(data *Data) biz.ModuleRepo {
    return &moduleRepo{
        data: data,
        repo: repo.NewModuleRepo(data.Gorm),
    }
}

// List 获取列表
func (r *moduleRepo) List(ctx context.Context, params *biz.ModuleListParams) ([]*biz.ModuleItem, int64, error) {
    // 构建查询条件
    query := r.repo.DB.WithContext(ctx)
    
    if params.Name != "" {
        query = query.Where("name LIKE ?", "%"+params.Name+"%")
    }
    
    // 分页查询
    var items []*model.Module
    var total int64
    
    err := query.Count(&total).Error
    if err != nil {
        return nil, 0, err
    }
    
    err = query.
        Offset(int((params.Current - 1) * params.Size)).
        Limit(int(params.Size)).
        Order("id DESC").
        Find(&items).Error
    if err != nil {
        return nil, 0, err
    }
    
    // DTO 转换
    result := make([]*biz.ModuleItem, 0, len(items))
    for _, item := range items {
        result = append(result, &biz.ModuleItem{
            ID:        item.ID,
            Name:      item.Name,
            Status:    item.Status,
            CreatedAt: item.CreatedAt.Format("2006-01-02 15:04:05"),
        })
    }
    
    return result, total, nil
}

// Save 创建或更新
func (r *moduleRepo) Save(ctx context.Context, data *biz.ModuleSaveData) (int64, error) {
    item := &model.Module{
        Name:   data.Name,
        Status: data.Status,
    }
    
    if data.ID > 0 {
        // 更新
        item.ID = data.ID
        err := r.repo.Update(ctx, item)
        return item.ID, err
    }
    
    // 创建
    err := r.repo.Insert(ctx, item)
    return item.ID, err
}

// Delete 删除
func (r *moduleRepo) Delete(ctx context.Context, id int64) error {
    return r.repo.Delete(ctx, id)
}
```

**在 `internal/data/data.go` 中注册 Provider**:

```go
var ProviderSet = wire.NewSet(
    // ...
    NewModuleRepo,
)
```

### 9. 实现 Biz 层

**定义接口** - 在 `internal/biz/biz.go`:

```go
// ModuleRepo 模块 Repository 接口
type ModuleRepo interface {
    List(ctx context.Context, params *ModuleListParams) ([]*ModuleItem, int64, error)
    Save(ctx context.Context, data *ModuleSaveData) (int64, error)
    Delete(ctx context.Context, id int64) error
}

// ModuleListParams 列表查询参数
type ModuleListParams struct {
    Current int64
    Size    int64
    Name    string
}

// ModuleItem 列表项
type ModuleItem struct {
    ID        int64
    Name      string
    Status    int32
    CreatedAt string
}

// ModuleSaveData 保存数据
type ModuleSaveData struct {
    ID     int64
    Name   string
    Status int32
}
```

**实现 UseCase** - 在 `internal/biz/shadow_v1_module.go`:

```go
package biz

import (
    "context"
    v1 "gitlab.yc345.tv/ainative/ainative-backend/api/shadow/v1"
)

type ModuleUseCase struct {
    repo ModuleRepo
}

// NewModuleUseCase 创建 UseCase
func NewModuleUseCase(repo ModuleRepo) *ModuleUseCase {
    return &ModuleUseCase{
        repo: repo,
    }
}

// List 获取列表
func (uc *ModuleUseCase) List(ctx context.Context, req *v1.ModuleListReq) (*v1.ModuleListReply, error) {
    params := &ModuleListParams{
        Current: req.Current,
        Size:    req.Size,
        Name:    req.Name,
    }
    
    items, total, err := uc.repo.List(ctx, params)
    if err != nil {
        return nil, err
    }
    
    // 转换为 Proto Message
    records := make([]*v1.ModuleItem, 0, len(items))
    for _, item := range items {
        records = append(records, &v1.ModuleItem{
            Id:        item.ID,
            Name:      item.Name,
            Status:    item.Status,
            CreatedAt: item.CreatedAt,
        })
    }
    
    return &v1.ModuleListReply{
        Total:   total,
        Records: records,
    }, nil
}

// Save 保存
func (uc *ModuleUseCase) Save(ctx context.Context, req *v1.ModuleSaveReq) (*v1.ModuleSaveReply, error) {
    data := &ModuleSaveData{
        ID:     req.Id,
        Name:   req.Name,
        Status: req.Status,
    }
    
    id, err := uc.repo.Save(ctx, data)
    if err != nil {
        return nil, err
    }
    
    return &v1.ModuleSaveReply{Id: id}, nil
}

// Delete 删除
func (uc *ModuleUseCase) Delete(ctx context.Context, req *v1.ModuleDeleteReq) (*v1.ModuleDeleteReply, error) {
    err := uc.repo.Delete(ctx, req.Id)
    if err != nil {
        return nil, err
    }
    
    return &v1.ModuleDeleteReply{}, nil
}
```

**在 `internal/biz/biz.go` 中注册 Provider**:

```go
var ProviderSet = wire.NewSet(
    // ...
    NewModuleUseCase,
)
```

### 10. 实现 Service 层

在 `internal/service/shadow_v1_module.go`:

```go
package service

import (
    "context"
    v1 "gitlab.yc345.tv/ainative/ainative-backend/api/shadow/v1"
    "gitlab.yc345.tv/ainative/ainative-backend/internal/biz"
)

type ModuleService struct {
    v1.UnimplementedModuleServiceServer
    uc *biz.ModuleUseCase
}

// NewModuleService 创建 Service
func NewModuleService(uc *biz.ModuleUseCase) *ModuleService {
    return &ModuleService{
        uc: uc,
    }
}

// ModuleList 获取列表
func (s *ModuleService) ModuleList(ctx context.Context, req *v1.ModuleListReq) (*v1.ModuleListReply, error) {
    return s.uc.List(ctx, req)
}

// ModuleSave 保存
func (s *ModuleService) ModuleSave(ctx context.Context, req *v1.ModuleSaveReq) (*v1.ModuleSaveReply, error) {
    return s.uc.Save(ctx, req)
}

// ModuleDelete 删除
func (s *ModuleService) ModuleDelete(ctx context.Context, req *v1.ModuleDeleteReq) (*v1.ModuleDeleteReply, error) {
    return s.uc.Delete(ctx, req)
}
```

**在 `internal/service/service.go` 中注册 Provider**:

```go
var ProviderSet = wire.NewSet(
    // ...
    NewModuleService,
)
```

### 11. 注册 HTTP 服务

在 `internal/server/http.go` 的 `NewHTTPServer` 函数中注册:

```go
func NewHTTPServer(
    // ... 其他服务
    moduleService *service.ModuleService,
) *http.Server {
    // ...
    
    // 注册 Module 服务
    v1.RegisterModuleServiceHTTPServer(srv, moduleService)
    
    return srv
}
```

### 12. 生成依赖注入代码

```bash
make wire
```

### 13. 测试验证

```bash
# 构建
make build

# 运行
./bin/backend -conf configs/development.yaml

# 代码检查
make lint
```

## 关键规范

### 命名规范
- Proto Service: `ModuleService`
- Proto RPC: `ModuleList`, `ModuleSave`, `ModuleDelete`
- Biz UseCase: `ModuleUseCase`
- Biz Repository: `ModuleRepo`
- Service: `ModuleService`

### 错误处理
```go
import "gitlab.yc345.tv/ainative/ainative-backend/internal/data/errorx"

// 返回错误
return nil, errorx.ParamErr.Err()

// 包装错误
return nil, errorx.DataSQLErr.WithError(err).Err()
```

### 日志记录
```go
import "github.com/go-kratos/kratos/v2/log"

l := log.NewHelper(log.With(logger, "module", "模块名"))
l.Info("操作成功")
l.Errorf("操作失败: %v", err)
```

### 参数校验
使用 Proto validate 规则:
```protobuf
string name = 1 [(validate.rules).string = {min_len: 1, max_len: 100}];
int64 id = 2 [(validate.rules).int64 = {gte: 1}];
```

## 开发流程图

```
1. 数据库表设计 (如需要)
   ↓
2. make gorm TABLES=表名
   ↓
3. make sqltopb shadow/wechat 表名
   ↓
4. 编辑 Proto 文件,添加业务接口
   ↓
5. make buf && make api
   ↓
6. make protocode
   ↓
7. 实现 Data 层 (internal/data/)
   ↓
8. 实现 Biz 层 (internal/biz/)
   ↓
9. 实现 Service 层 (internal/service/)
   ↓
10. 注册 HTTP 服务 (internal/server/http.go)
   ↓
11. make wire
   ↓
12. 测试验证
```

## 常见问题

**Q: 如何处理事务?**

```go
func (r *moduleRepo) SaveWithTransaction(ctx context.Context, data *biz.ModuleSaveData) error {
    return r.data.Gorm.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
        // 操作 1
        if err := tx.Create(&model1).Error; err != nil {
            return err
        }
        
        // 操作 2
        if err := tx.Update(&model2).Error; err != nil {
            return err
        }
        
        return nil
    })
}
```

**Q: 如何添加中间件?**

在 `internal/server/http.go`:

```go
srv := http.NewServer(
    http.Middleware(
        middleware.AuthMiddleware(), // 自定义中间件
    ),
)
```

## 相关文档

- [ainative-backend 开发指南](/Users/moyan/myWorkPlace/yanxue-main/docs/dev-spec/ainative-backend/README.md)
- [分层编码指南](/Users/moyan/myWorkPlace/yanxue-main/docs/dev-spec/ainative-backend/references/layer.md)
- [Makefile 命令](/Users/moyan/myWorkPlace/yanxue-main/docs/dev-spec/ainative-backend/references/makefile.md)
