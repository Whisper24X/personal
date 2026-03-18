# 缓存 Key 定义参考

> 何时阅读: 新增缓存 Key 或调整缓存过期策略时。

## 文件位置

- `ainative-backend/internal/data/cache/cachekey.go`

## 现有结构

- 使用 `keymanage.New("backend")` 作为统一前缀
- `AddKey(name, ttl, desc)` 定义 Key 与默认过期时间

## 新增规范

- Key 名称清晰表达业务用途（建议 PascalCase）
- TTL 设置匹配业务一致性需求
- 描述保持简短中文说明

## 示例

```go
var cacheKey = keymanage.New("backend")

var (
    LOCK       = cacheKey.AddKey("LOCK", time.Minute*5, "锁")
    RouteCache = cacheKey.AddKey("RouteCache", time.Hour*24, "路由缓存")
)
```
