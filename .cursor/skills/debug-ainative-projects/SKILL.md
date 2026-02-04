# ainative 项目调试问题 Skill

## 技能用途

当在 ainative 项目(app/shadow/backend)中遇到问题需要调试时使用此技能。

**触发条件**:
- 代码运行出错
- 接口调用失败
- 编译/构建失败
- 功能异常

## 调试步骤

### 1. 确定问题所属项目

- [ ] ainative-app (Taro 小程序)
- [ ] ainative-shadow (Vue3 管理后台)
- [ ] ainative-backend (Go 后端)

### 2. 前端项目调试 (app/shadow)

#### 2.1 开发环境问题

**依赖安装失败**:
```bash
# 清除缓存
rm -rf node_modules pnpm-lock.yaml

# 重新安装
pnpm install
```

**端口被占用**:
```bash
# 查看端口占用 (以 5173 为例)
lsof -i :5173

# 杀掉进程
kill -9 <PID>
```

#### 2.2 运行时错误

**查看控制台错误**:
- 打开浏览器开发者工具 (F12)
- 查看 Console 标签的错误信息
- 查看 Network 标签的请求失败信息

**常见错误及解决**:

| 错误类型 | 可能原因 | 解决方案 |
|---------|---------|---------|
| 404 Not Found | 接口路径错误 | 检查 API 路径是否正确 |
| 401 Unauthorized | Token 过期/无效 | 清除 localStorage,重新登录 |
| 跨域错误 | CORS 配置问题 | 检查代理配置或后端 CORS 设置 |
| 组件未注册 | 组件导入错误 | 检查 import 语句和组件注册 |
| 类型错误 | TypeScript 类型不匹配 | 检查类型定义,修复类型错误 |

**小程序特殊问题 (ainative-app)**:

```bash
# 清除小程序缓存
# 在微信开发者工具: 工具 -> 清除缓存 -> 清除所有

# 查看小程序 Console
# 在微信开发者工具: Console 标签

# 真机调试
pnpm dev:weapp
# 然后在微信开发者工具中选择 "真机调试"
```

#### 2.3 接口调试

**检查请求参数**:
```typescript
// 在 API 调用前添加 console.log
console.log('请求参数:', params)
const result = await fetchData(params)
console.log('响应结果:', result)
```

**使用 Network 面板**:
1. 打开开发者工具 Network 标签
2. 找到失败的请求
3. 查看 Request Headers, Request Payload
4. 查看 Response

**检查拦截器**:
- ainative-app: `src/http/interceptor.ts`
- ainative-shadow: `src/service/axios.interceptor.ts`

#### 2.4 状态管理调试

**Pinia 状态调试**:
```typescript
import { storeToRefs } from 'pinia'

const store = useXxxStore()
const { data } = storeToRefs(store)

// 打印状态
console.log('Store state:', store.$state)

// 监听状态变化
watch(() => store.data, (newVal) => {
  console.log('数据变化:', newVal)
})
```

**使用 Vue Devtools**:
- 安装 Vue Devtools 浏览器插件
- 打开 Devtools -> Vue 标签
- 查看组件树和 Pinia stores

### 3. 后端项目调试 (backend)

#### 3.1 编译问题

**依赖问题**:
```bash
# 清除缓存并重新下载依赖
go clean -modcache
GOPROXY="https://goproxy.cn,direct" go mod tidy
```

**Wire 依赖注入错误**:
```bash
# 重新生成 wire 代码
make wire

# 检查 ProviderSet 是否正确注册
# 查看 internal/*/provider.go 或 ***.go 文件中的 ProviderSet
```

**Proto 生成错误**:
```bash
# 检查 Proto 语法
make buf

# 重新生成 API 代码
make api
```

#### 3.2 运行时错误

**启动失败**:
```bash
# 检查配置文件
cat configs/development.yaml

# 查看端口是否被占用
lsof -i :8000

# 查看数据库连接
# 确认 MySQL/Redis 是否正常运行
```

**数据库错误**:
```go
// 在 Data 层添加日志
l := log.NewHelper(log.With(logger, "module", "data"))
l.Infof("SQL: %+v", query)

// 检查 GORM 日志
// 在 internal/data/data.go 中设置 Logger 级别为 Debug
```

**接口调用错误**:
```bash
# 查看日志
tail -f logs/app.log

# 使用 curl 测试接口
curl -X POST http://localhost:8000/shadow/v1/moduleList \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"current": 1, "size": 10}'
```

#### 3.3 性能问题

**慢查询分析**:
```go
// 使用 GORM 的 Debug 模式
db.Debug().Where("...").Find(&items)

// 查看 MySQL 慢查询日志
// show variables like 'slow_query_log';
```

**内存泄漏**:
```bash
# 使用 pprof 分析
import _ "net/http/pprof"

# 访问 http://localhost:6060/debug/pprof/
```

#### 3.4 中间件问题

**权限验证失败**:
```go
// 检查 JWT Token
// 在 internal/pkg/jwt/jwt.go 添加日志

// 检查权限中间件
// 在 internal/pkg/middleware/ 添加日志
```

### 4. 全栈联调

#### 4.1 前后端联调流程

```mermaid
graph LR
    A[前端发起请求] --> B[检查请求参数]
    B --> C[检查 Network 请求]
    C --> D[后端接收请求]
    D --> E[检查后端日志]
    E --> F[检查业务逻辑]
    F --> G[检查数据库]
    G --> H[返回响应]
    H --> I[前端处理响应]
```

#### 4.2 常见联调问题

| 问题 | 排查步骤 |
|-----|---------|
| 请求参数格式错误 | 1. 查看前端发送的参数<br>2. 对比 Proto 定义<br>3. 检查参数校验规则 |
| 响应数据格式不匹配 | 1. 查看后端返回数据<br>2. 对比前端类型定义<br>3. 检查 DTO 转换 |
| Token 验证失败 | 1. 检查 Token 是否正确携带<br>2. 检查 Token 是否过期<br>3. 检查后端 JWT 配置 |
| 跨域问题 | 1. 检查前端代理配置<br>2. 检查后端 CORS 中间件<br>3. 使用 Nginx 配置 CORS |

### 5. 常用调试工具

#### 5.1 前端工具

- **Vue Devtools**: 调试 Vue 组件和状态
- **Network 面板**: 查看 HTTP 请求
- **Console**: 查看日志和错误
- **Sources**: 断点调试
- **微信开发者工具**: 小程序调试

#### 5.2 后端工具

- **Postman/Apifox**: API 接口测试
- **MySQL Workbench**: 数据库查询
- **Redis Desktop Manager**: Redis 调试
- **GoLand Debugger**: Go 代码断点调试
- **pprof**: 性能分析

#### 5.3 日志分析

**前端日志**:
```typescript
// 在关键位置添加日志
console.log('[调试] 请求参数:', params)
console.error('[错误] 接口调用失败:', error)
```

**后端日志**:
```go
// 使用结构化日志
l := log.NewHelper(log.With(logger, "module", "模块名"))
l.Infof("[调试] 请求参数: %+v", req)
l.Errorf("[错误] 数据库查询失败: %v", err)
```

### 6. 问题排查 Checklist

#### 前端问题
- [ ] 检查控制台是否有错误
- [ ] 检查 Network 请求是否成功
- [ ] 检查请求参数是否正确
- [ ] 检查组件是否正确导入
- [ ] 检查路由配置是否正确
- [ ] 检查环境变量是否正确
- [ ] 检查 Token 是否有效

#### 后端问题
- [ ] 检查服务是否正常启动
- [ ] 检查配置文件是否正确
- [ ] 检查数据库连接是否正常
- [ ] 检查 Proto 定义是否正确
- [ ] 检查 Wire 依赖注入是否成功
- [ ] 检查业务逻辑是否正确
- [ ] 检查错误日志

### 7. 应急处理

**紧急回滚**:
```bash
# Git 回滚到上一个版本
git log --oneline
git reset --hard <commit-id>
```

**清除所有缓存**:
```bash
# 前端
rm -rf node_modules pnpm-lock.yaml .turbo
pnpm install

# 后端
go clean -modcache
make wire
```

**重启所有服务**:
```bash
# 前端
pnpm dev

# 后端
./bin/backend -conf configs/development.yaml

# 数据库
# 重启 MySQL 和 Redis
```

## 相关文档

- [ainative-app 开发指南](/Users/moyan/myWorkPlace/yanxue-main/docs/dev-spec/ainative-app/README.md)
- [ainative-shadow 开发指南](/Users/moyan/myWorkPlace/yanxue-main/docs/dev-spec/ainative-shadow/README.md)
- [ainative-backend 开发指南](/Users/moyan/myWorkPlace/yanxue-main/docs/dev-spec/ainative-backend/README.md)
