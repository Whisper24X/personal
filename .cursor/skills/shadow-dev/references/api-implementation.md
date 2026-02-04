# API 实现规范

详细的 API 调用实现指南。

## 基础结构

### API 文件组织

```
src/api/
├── request.ts          # HTTP 封装（已有）
├── user.ts            # 用户模块
├── order.ts           # 订单模块
└── product.ts         # 商品模块
```

### 基础模板

```typescript
import request from '@/utils/http'

/**
 * 获取用户列表
 */
export function fetchUserList(params: Api.User.ListParams) {
  return request.get<Api.User.ListResponse>({
    url: '/api/user/list',
    params
  })
}

/**
 * 获取用户详情
 */
export function fetchUserDetail(id: string) {
  return request.get<Api.User.DetailResponse>({
    url: `/api/user/${id}`
  })
}

/**
 * 创建用户
 */
export function createUser(data: Api.User.CreateParams) {
  return request.post<Api.User.CreateResponse>({
    url: '/api/user/create',
    data
  })
}

/**
 * 更新用户
 */
export function updateUser(id: string, data: Api.User.UpdateParams) {
  return request.put<void>({
    url: `/api/user/${id}`,
    data
  })
}

/**
 * 删除用户
 */
export function deleteUser(id: string) {
  return request.delete<void>({
    url: `/api/user/${id}`
  })
}
```

## HTTP 方法选择

| 操作 | 方法 | 示例 |
|------|------|------|
| 获取列表/详情 | GET | `request.get()` |
| 创建 | POST | `request.post()` |
| 更新（全部） | PUT | `request.put()` |
| 更新（部分） | PATCH | `request.patch()` |
| 删除 | DELETE | `request.delete()` |

## 参数传递

### GET 请求（query 参数）

```typescript
export function fetchList(params: Api.User.ListParams) {
  return request.get<Api.User.ListResponse>({
    url: '/api/user/list',
    params  // 会转换为 ?page=1&pageSize=10
  })
}
```

### POST/PUT 请求（body 数据）

```typescript
export function createUser(data: Api.User.CreateParams) {
  return request.post<Api.User.CreateResponse>({
    url: '/api/user/create',
    data  // 会作为 request body
  })
}
```

### 路径参数

```typescript
// 方式1: 模板字符串
export function fetchDetail(id: string) {
  return request.get({
    url: `/api/user/${id}`
  })
}

// 方式2: params 参数（RESTful）
export function updateUser(id: string, data: any) {
  return request.put({
    url: `/api/user/:id`,
    params: { id },  // 会替换 :id
    data
  })
}
```

## 错误处理

### 统一错误处理（已在 request 中实现）

```typescript
// utils/http/index.ts 已处理
// - 401: 自动跳转登录
// - 403: 权限不足提示
// - 500: 服务器错误提示
```

### API 层特殊处理

```typescript
export async function deleteUser(id: string) {
  try {
    await request.delete({ url: `/api/user/${id}` })
    ElMessage.success('删除成功')
  } catch (error) {
    // 特殊处理
    if (error.code === 'USER_HAS_ORDERS') {
      ElMessage.error('用户有未完成订单，无法删除')
    }
    throw error
  }
}
```

## 文件上传

```typescript
/**
 * 上传头像
 */
export function uploadAvatar(file: File) {
  const formData = new FormData()
  formData.append('file', file)
  
  return request.post<{ url: string }>({
    url: '/api/upload/avatar',
    data: formData,
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
}
```

## 下载文件

```typescript
/**
 * 导出用户列表
 */
export function exportUsers(params: Api.User.ListParams) {
  return request.get({
    url: '/api/user/export',
    params,
    responseType: 'blob'  // 重要：指定响应类型
  }).then((blob) => {
    // 创建下载链接
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `users_${Date.now()}.xlsx`
    link.click()
    window.URL.revokeObjectURL(url)
  })
}
```

## 并发请求

```typescript
/**
 * 批量获取用户详情
 */
export async function batchFetchUsers(ids: string[]) {
  const promises = ids.map(id => fetchUserDetail(id))
  return Promise.all(promises)
}

/**
 * 同时获取多个数据
 */
export async function fetchDashboardData() {
  const [users, orders, stats] = await Promise.all([
    fetchUserList({ page: 1, pageSize: 10 }),
    fetchOrderList({ page: 1, pageSize: 10 }),
    fetchStatistics()
  ])
  
  return { users, orders, stats }
}
```

## 请求取消

```typescript
import { CancelToken } from 'axios'

let cancelFn: (() => void) | null = null

export function fetchUserList(params: Api.User.ListParams) {
  // 取消之前的请求
  cancelFn?.()
  
  return request.get<Api.User.ListResponse>({
    url: '/api/user/list',
    params,
    cancelToken: new CancelToken((cancel) => {
      cancelFn = cancel
    })
  })
}
```

## 请求拦截器（已配置）

```typescript
// utils/http/index.ts
// 已配置：
// - 自动添加 token
// - 请求超时处理
// - 响应数据解析
// - 错误统一处理
```

## 最佳实践

### ✅ 推荐

```typescript
// 1. 添加 JSDoc 注释
/**
 * 获取用户列表
 * @param params 查询参数
 * @returns 用户列表和总数
 */
export function fetchUserList(params: Api.User.ListParams) {
  // ...
}

// 2. 使用类型约束
export function createUser(data: Api.User.CreateParams) {
  return request.post<Api.User.CreateResponse>({
    url: '/api/user/create',
    data
  })
}

// 3. 导出函数（不是默认导出）
export function fetchUserList() {}
export function createUser() {}

// 4. 按模块组织
// user.ts - 用户相关
// order.ts - 订单相关
```

### ❌ 避免

```typescript
// 1. 避免在 API 层处理业务逻辑
export function fetchUserList(params: any) {
  const data = await request.get(...)
  // ❌ 不要在这里过滤、排序等
  return data.filter(...)
}

// 2. 避免使用 any
export function createUser(data: any) {  // ❌
  // ...
}

// 3. 避免默认导出
export default {  // ❌
  fetchList,
  createUser
}

// 4. 避免混合多个模块
// ❌ api.ts 包含所有 API（太大）
```

## Mock 数据（开发阶段）

### 使用 Mock Service Worker (可选)

```typescript
// src/mock/user.ts
import { rest } from 'msw'

export const userHandlers = [
  rest.get('/api/user/list', (req, res, ctx) => {
    return res(
      ctx.json({
        list: [
          { id: '1', userName: 'user1', email: 'user1@test.com' }
        ],
        total: 1
      })
    )
  })
]
```

### 本地开发代理

```typescript
// vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
})
```
