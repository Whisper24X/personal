# 可靠性要求

## 错误处理

### 错误码定义

位置：`internal/data/errorx/code.go`

```go
var TokenExpired = errx.New(4001, "token已过期", "Token expired")
var TokenInvalid = errx.New(4002, "无效token", "Invalid token")
```

### 错误返回

```go
// 直接返回
return nil, errorx.TokenExpired.Err()

// 包装原始错误
return nil, errorx.DataSQLErr.WithError(err).Err()
```

---

## 缓存策略

使用 RocksCache 实现弱一致性缓存：

```go
// 带缓存的查询
admin, err := s.FindOneCacheByID(ctx, adminId)

// 更新后删除缓存
err = s.UpdateOneCache(ctx, newData, oldData)
```

缓存 Key 前缀在各 Repo 中定义：

```go
var CacheSysAdminByIDPrefix = "DBCache:devices_demo:SysAdminByID"
```

---

## 限流与超时

HTTP 中间件链中包含：

- `ratelimit.Server()`：限流
- `requestCancel.KratosMiddleware()`：请求超时控制

---

## 降级与恢复

- `recovery.Recovery()`：Panic 恢复，避免进程退出

---

## 可观测性

- **tracing**：`tracing.Server()` 链路追踪
- **metrics**：`metrics.KratosMiddleware()` 指标收集
- **logger**：`logger.HTTPLogger()` 请求日志

---

## 相关文档

- [后端架构 - 错误处理与缓存](../docs/dev-spec/ainative-backend/references/architecture.md)
