# API 请求规范

本文档介绍 ainative-app 的网络请求封装和使用规范。

## 请求封装

基于 Taro.request 封装，位于 `src/api/request.ts`。

### 核心特性

| 特性 | 说明 |
|------|------|
| Token 注入 | 自动添加 Bearer Token |
| 401 处理 | 自动跳转登录（防抖 3 秒） |
| 白名单 | 支持无 Token 和忽略 401 的接口 |
| 超时控制 | 默认 10 秒超时 |
| 错误处理 | 统一错误提示 |

## 基本使用

### GET 请求

```typescript
import { get } from "@/api/request"

interface UserInfo {
  id: string
  nickname: string
  avatar: string
}

const getUserInfo = async () => {
  const data = await get<UserInfo>("/api/v1/user/info")
  return data
}
```

### POST 请求

```typescript
import { post } from "@/api/request"

interface UpdateParams {
  nickname: string
  avatar?: string
}

const updateUserInfo = async (params: UpdateParams) => {
  await post("/api/v1/user/update", params)
}
```

### PUT 请求

```typescript
import { put } from "@/api/request"

const updateStatus = async (id: string, status: number) => {
  await put(`/api/v1/item/${id}/status`, { status })
}
```

### DELETE 请求

```typescript
import { del } from "@/api/request"

const deleteItem = async (id: string) => {
  await del(`/api/v1/item/${id}`)
}
```

## 白名单配置

### 无 Token 白名单

不需要携带 Token 的接口：

```typescript
const NO_TOKEN_WHITELIST: string[] = [
  "/api/v1/auth/login",
  "/api/v1/public/config"
]
```

### 忽略 401 白名单

接收到 401 不跳转登录的接口：

```typescript
const UNAUTHORIZED_WHITELIST: string[] = [
  "/api/v1/user/check-login"
]
```

## API 模块组织

建议按功能模块组织 API：

```
src/api/
├── request.ts          # 请求封装
├── user/
│   └── index.ts        # 用户相关 API
├── order/
│   └── index.ts        # 订单相关 API
└── example/
    └── user.ts         # 示例 API
```

### 模块示例

```typescript
// src/api/user/index.ts
import { get, post } from "../request"

export interface UserInfo {
  id: string
  nickname: string
  avatar: string
  phone: string
}

export interface LoginParams {
  phone: string
  code: string
}

export interface LoginResult {
  token: string
  userInfo: UserInfo
}

/**
 * 获取用户信息
 */
export const getUserInfo = () => {
  return get<UserInfo>("/api/v1/user/info")
}

/**
 * 登录
 */
export const login = (params: LoginParams) => {
  return post<LoginResult>("/api/v1/auth/login", params)
}

/**
 * 退出登录
 */
export const logout = () => {
  return post("/api/v1/auth/logout")
}
```

## 错误处理

请求封装内置了错误处理，特殊场景可手动处理：

```typescript
import { get } from "@/api/request"
import Taro from "@tarojs/taro"

const fetchData = async () => {
  try {
    const data = await get("/api/v1/data")
    return data
  } catch (error) {
    // 自定义错误处理
    console.error("请求失败:", error)
    Taro.showToast({
      title: "数据加载失败",
      icon: "none"
    })
    return null
  }
}
```

## 类型规范

建议为每个 API 定义请求和响应类型：

```typescript
// 请求参数类型
export interface ListParams {
  page: number
  pageSize: number
  keyword?: string
}

// 分页响应类型
export interface PaginatedResponse<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

// 使用
export const getList = (params: ListParams) => {
  return get<PaginatedResponse<ItemData>>("/api/v1/items", params)
}
```

## 最佳实践

1. **类型安全**：所有 API 都应定义 TypeScript 类型
2. **模块化**：按功能模块组织 API 文件
3. **错误处理**：统一使用封装的错误处理，特殊场景再自定义
4. **注释文档**：为每个 API 函数添加 JSDoc 注释
5. **参数校验**：在调用 API 前进行必要的参数校验
