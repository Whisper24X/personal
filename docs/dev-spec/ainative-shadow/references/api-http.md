# API 调用规范

## 概述

项目使用 Axios 封装的 HTTP 客户端进行接口调用，提供统一的请求/响应处理、错误处理和消息提示。

**位置**: `src/utils/http/index.ts`

---

## HTTP 客户端配置

### 基础配置

```typescript
const axiosInstance = axios.create({
  timeout: 15000, // 请求超时时间
  baseURL: VITE_API_URL, // API 基础路径
  withCredentials: true, // 携带 Cookie
  validateStatus: (
    status // 只有 2xx 视为成功
  ) => status >= 200 && status < 300,
})
```

### 环境变量

在 `.env` 文件中配置：

```bash
# API 基础路径
VITE_API_URL=http://localhost:8080

# 代理目标地址 (开发环境)
VITE_API_PROXY_URL=http://localhost:8080

# 是否携带凭证
VITE_WITH_CREDENTIALS=true
```

---

## 请求拦截器

### 自动添加 Token

```typescript
axiosInstance.interceptors.request.use(
  (request: InternalAxiosRequestConfig) => {
    const { accessToken } = useUserStore()
    if (accessToken) {
      request.headers.set("Authorization", accessToken)
    }
    return request
  }
)
```

### 自动处理 Content-Type

```typescript
if (request.data && !(request.data instanceof FormData)) {
  request.headers.set("Content-Type", "application/json")
  request.data = JSON.stringify(request.data)
}
```

---

## 响应拦截器

### 统一响应处理

```typescript
axiosInstance.interceptors.response.use(
  (response: AxiosResponse<BaseResponse>) => {
    const { code, msg } = response.data

    // 成功响应
    if (code === ApiStatus.success) {
      return response
    }

    // 401 未授权
    if (code === ApiStatus.unauthorized) {
      handleUnauthorizedError(msg)
    }

    // 其他错误
    throw createHttpError(msg || "请求失败", code)
  }
)
```

### 401 自动登出（带防抖）

```typescript
function handleUnauthorizedError(message?: string): never {
  if (!isUnauthorizedErrorShown) {
    isUnauthorizedErrorShown = true

    // 500ms 后执行登出
    setTimeout(() => {
      useUserStore().logOut()
    }, 500)

    // 3秒内不重复提示
    setTimeout(() => {
      isUnauthorizedErrorShown = false
    }, 3000)

    showError(createHttpError(message || "登录已过期", 401), true)
  }
  throw error
}
```

---

## API 方法集合

### 导出的 API 方法

```typescript
const api = {
  // GET 请求
  get<T>(config: ExtendedAxiosRequestConfig) {
    return retryRequest<T>({ ...config, method: "GET" })
  },

  // POST 请求
  post<T>(config: ExtendedAxiosRequestConfig) {
    return retryRequest<T>({ ...config, method: "POST" })
  },

  // PUT 请求
  put<T>(config: ExtendedAxiosRequestConfig) {
    return retryRequest<T>({ ...config, method: "PUT" })
  },

  // DELETE 请求
  del<T>(config: ExtendedAxiosRequestConfig) {
    return retryRequest<T>({ ...config, method: "DELETE" })
  },

  // 通用请求
  request<T>(config: ExtendedAxiosRequestConfig) {
    return retryRequest<T>(config)
  },
}

export default api
```

---

## API 文件编写

### 文件组织

```
src/api/
├── auth.ts              # 认证相关接口
├── system-manage.ts     # 系统管理接口
├── user.ts              # 用户相关接口
└── ...                  # 其他业务模块
```

### API 函数模板

```typescript
import request from "@/utils/http"

/**
 * 获取用户列表
 * @param params 搜索参数
 * @returns 用户列表响应
 */
export function fetchGetUserList(params: Api.SystemManage.UserSearchParams) {
  return request.get<Api.SystemManage.UserList>({
    url: "/api/user/list",
    params,
  })
}

/**
 * 创建用户
 * @param data 用户数据
 * @returns 用户ID
 */
export function fetchCreateUser(data: Api.SystemManage.CreateUserParams) {
  return request.post<{ id: string }>({
    url: "/api/user/create",
    data,
    showSuccessMessage: true, // 显示成功提示
  })
}

/**
 * 更新用户
 * @param id 用户ID
 * @param data 更新数据
 */
export function fetchUpdateUser(
  id: string,
  data: Api.SystemManage.UpdateUserParams
) {
  return request.put<void>({
    url: `/api/user/${id}`,
    data,
    showSuccessMessage: true,
  })
}

/**
 * 删除用户
 * @param id 用户ID
 */
export function fetchDeleteUser(id: string) {
  return request.del<void>({
    url: `/api/user/${id}`,
    showSuccessMessage: true,
  })
}
```

---

## 扩展配置选项

### 自定义配置接口

```typescript
interface ExtendedAxiosRequestConfig extends AxiosRequestConfig {
  /** 是否显示错误提示（默认 true） */
  showErrorMessage?: boolean

  /** 是否显示成功提示（默认 false） */
  showSuccessMessage?: boolean
}
```

### 使用示例

```typescript
// 1. 不显示错误提示
export function fetchData() {
  return request.get<DataType>({
    url: "/api/data",
    showErrorMessage: false, // 静默失败
  })
}

// 2. 显示成功提示
export function saveData(data: DataType) {
  return request.post<void>({
    url: "/api/data",
    data,
    showSuccessMessage: true, // 保存成功时提示
  })
}

// 3. 自定义请求头
export function uploadFile(file: File) {
  const formData = new FormData()
  formData.append("file", file)

  return request.post<{ url: string }>({
    url: "/api/upload",
    data: formData,
    headers: {
      "Content-Type": "multipart/form-data",
    },
  })
}
```

---

## 请求重试机制

### 重试配置

```typescript
const MAX_RETRIES = 0 // 最大重试次数（默认不重试）
const RETRY_DELAY = 1000 // 重试延迟（毫秒）

// 可重试的状态码
const RETRY_STATUS_CODES = [
  408, // Request Timeout
  500, // Internal Server Error
  502, // Bad Gateway
  503, // Service Unavailable
  504, // Gateway Timeout
]
```

### 重试逻辑

```typescript
async function retryRequest<T>(
  config: ExtendedAxiosRequestConfig,
  retries: number = MAX_RETRIES
): Promise<T> {
  try {
    return await request<T>(config)
  } catch (error) {
    // 判断是否需要重试
    if (retries > 0 && shouldRetry(error)) {
      await delay(RETRY_DELAY)
      return retryRequest<T>(config, retries - 1)
    }
    throw error
  }
}
```

---

## 错误处理

### 错误类型

```typescript
export class HttpError extends Error {
  code: number

  constructor(message: string, code: number) {
    super(message)
    this.name = "HttpError"
    this.code = code
  }
}
```

### 错误码定义

```typescript
// src/utils/http/status.ts
export enum ApiStatus {
  success = 200, // 成功
  unauthorized = 401, // 未授权
  forbidden = 403, // 禁止访问
  notFound = 404, // 未找到
  requestTimeout = 408, // 请求超时
  internalServerError = 500, // 服务器错误
  badGateway = 502, // 网关错误
  serviceUnavailable = 503, // 服务不可用
  gatewayTimeout = 504, // 网关超时
}
```

### 错误消息提示

```typescript
// 显示错误消息
export function showError(error: HttpError, show = true): void {
  if (!show) return

  ElMessage.error({
    message: error.message,
    duration: 3000,
    showClose: true,
  })
}

// 显示成功消息
export function showSuccess(message: string): void {
  ElMessage.success({
    message,
    duration: 2000,
  })
}
```

---

## 常见场景

### 场景 1: 列表查询（带分页）

```typescript
/**
 * 获取用户列表
 */
export function fetchUserList(params: {
  current: number
  size: number
  name?: string
  status?: string
}) {
  return request.get<Api.Common.PaginatedResponse<UserItem>>({
    url: "/api/user/list",
    params,
  })
}

// 使用
const response = await fetchUserList({
  current: 1,
  size: 10,
  name: "张三",
})
```

### 场景 2: 创建/更新（保存）

```typescript
/**
 * 保存用户（新增或更新）
 */
export function fetchSaveUser(data: {
  id?: string // 有 ID 为更新，无 ID 为新增
  name: string
  email: string
}) {
  return request.post<{ id: string }>({
    url: "/api/user/save",
    data,
    showSuccessMessage: true,
  })
}
```

### 场景 3: 删除

```typescript
/**
 * 删除用户
 */
export function fetchDeleteUser(id: string) {
  return request.del<void>({
    url: `/api/user/${id}`,
    showSuccessMessage: true,
  })
}
```

### 场景 4: 文件上传

```typescript
/**
 * 上传文件
 */
export function fetchUploadFile(file: File) {
  const formData = new FormData()
  formData.append("file", file)

  return request.post<{ url: string }>({
    url: "/api/upload",
    data: formData,
    headers: {
      "Content-Type": "multipart/form-data",
    },
  })
}
```

### 场景 5: 文件下载

```typescript
/**
 * 下载文件
 */
export function fetchDownloadFile(fileId: string) {
  return request.get<Blob>({
    url: `/api/file/${fileId}`,
    responseType: "blob",
  })
}

// 使用
const blob = await fetchDownloadFile("xxx")
const url = URL.createObjectURL(blob)
const a = document.createElement("a")
a.href = url
a.download = "filename.xlsx"
a.click()
URL.revokeObjectURL(url)
```

---

## 最佳实践

### 1. 函数命名规范

```typescript
// ✅ 推荐：使用 fetch 前缀
export function fetchGetUserList() {}
export function fetchCreateUser() {}
export function fetchUpdateUser() {}
export function fetchDeleteUser() {}

// ❌ 不推荐
export function getUserList() {}
export function createUser() {}
```

### 2. 类型定义

```typescript
// ✅ 推荐：使用全局类型命名空间
export function fetchGetUserList(
  params: Api.User.SearchParams
): Promise<Api.User.ListResponse> {}

// ❌ 不推荐：内联类型
export function fetchGetUserList(params: {
  name: string
}): Promise<{ list: any[] }> {}
```

### 3. 错误处理

```typescript
// ✅ 推荐：在组件中捕获错误
try {
  const data = await fetchGetUserList(params)
  // 处理成功逻辑
} catch (error) {
  // HTTP 拦截器已处理错误提示
  // 这里只需处理业务逻辑
  console.error('获取用户列表失败', error)
}

// ❌ 不推荐：在 API 函数中处理错误
export async function fetchGetUserList() {
  try {
    return await request.get(...)
  } catch (error) {
    console.error(error)  // 不要在这里处理
    throw error
  }
}
```

### 4. 请求参数处理

```typescript
// ✅ 推荐：过滤空值
export function fetchGetUserList(params: UserSearchParams) {
  // 过滤掉 undefined 和空字符串
  const filteredParams = Object.entries(params)
    .filter(([_, value]) => value !== undefined && value !== "")
    .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {})

  return request.get<UserListResponse>({
    url: "/api/user/list",
    params: filteredParams,
  })
}
```

### 5. 取消重复请求

```typescript
// 使用 AbortController
const controller = new AbortController()

export function fetchGetUserList(params: UserSearchParams) {
  return request.get<UserListResponse>({
    url: "/api/user/list",
    params,
    signal: controller.signal,
  })
}

// 取消请求
controller.abort()
```

---

## 相关文档

- [API 类型定义](api-types.md)
- [错误处理规范](error-handling.md)
- [核心 Hooks - useTable](core-hooks.md)
