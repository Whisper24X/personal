# 分层架构与依赖流向

## 全栈架构总览

AINative Workspace 为 monorepo，包含三个子项目：

| 子项目 | 类型 | 技术栈 |
|--------|------|--------|
| **ainative-app** | 移动端应用 | Taro + Vue3 + Webpack5 |
| **ainative-shadow** | 管理后台 | Vue3 + Element Plus + Tailwind CSS |
| **ainative-backend** | Go 后端服务 | Kratos + GORM + Protobuf |

---

## 后端洋葱架构

依赖方向由外向内，内层不依赖外层。

```
┌─────────────────────────────────────────────────────────────┐
│                      Server 层                               │
│  (HTTP/gRPC 服务器, 中间件, 路由注册)                         │
├─────────────────────────────────────────────────────────────┤
│                      Service 层                              │
│  (协议转换, 调用 Biz 层)                                      │
├─────────────────────────────────────────────────────────────┤
│                      Biz 层 (核心)                           │
│  (业务逻辑, UseCase, 定义 Repository 接口)                    │
├─────────────────────────────────────────────────────────────┤
│                      Data 层                                 │
│  (实现 Repository 接口, 数据库/缓存/RPC 访问)                  │
└─────────────────────────────────────────────────────────────┘
```

### 各层职责

| 层级 | 目录 | 职责 |
|-----|------|------|
| API 层 | `api/` | 接口定义 (Proto) |
| Server 层 | `internal/server/` | 服务器配置、中间件、路由 |
| Service 层 | `internal/service/` | 协议转换，调用 Biz 层 |
| Biz 层 | `internal/biz/` | 业务逻辑，定义 Repository 接口 |
| Data 层 | `internal/data/` | 实现 Repository，数据库/缓存访问 |

### 依赖方向

```
API → Server → Service → Biz → Data
                          ↑
                    定义接口，不依赖实现
```

Biz 层定义 Repository 接口，Data 层实现接口，实现依赖倒置。

---

## 前端分层 (ainative-shadow)

```
┌─────────────────────────────────────────────────────────────┐
│                      视图层 (Views)                          │
├─────────────────────────────────────────────────────────────┤
│                      组件层 (Components)                     │
├─────────────────────────────────────────────────────────────┤
│                      逻辑层 (Hooks/Store)                    │
├─────────────────────────────────────────────────────────────┤
│                      数据层 (API/Utils)                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 依赖注入 (Wire)

项目使用 Google Wire 进行依赖注入。每层都有 `ProviderSet`，依赖关系：

```
App → Server → Service → Biz → Data → Infra (DB/Redis/MQ)
```

---

## 中间件链 (HTTP)

| 中间件 | 说明 |
|-------|------|
| tracing.Server() | 链路追踪 |
| metrics.KratosMiddleware() | 指标收集 |
| logger.HTTPLogger() | 请求日志 |
| recovery.Recovery() | Panic 恢复 |
| metadata.Server() | 元数据传递 |
| validate.Validator() | 参数校验 |
| ratelimit.Server() | 限流 |
| requestCancel.KratosMiddleware() | 请求超时控制 |

---

## 相关文档

- [后端架构详解](../docs/dev-spec/ainative-backend/references/architecture.md)
- [分层编码指南](../docs/dev-spec/ainative-backend/references/layer.md)
- [前端架构详解](../docs/dev-spec/ainative-shadow/references/architecture.md)
- [openspec/project.md](../openspec/project.md)
