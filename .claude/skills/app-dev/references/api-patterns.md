# API 开发模式

Taro + Vue3 应用的 API 调用模式和最佳实践。

## 核心封装（`src/api/request.ts`）

```typescript
// 响应数据格式约定
interface ResponseData<T = any> {
  code: number; // 0 或 200 为成功
  data: T;
  message: string;
}

// 请求选项扩展
interface RequestOptions {
  url: string;
  baseUrl?: string; // 默认 BASE_API，可覆盖
  skipTokenCheck?: boolean; // 跳过 token 校验
  skipErrorToast?: boolean; // 跳过自动错误提示
  customErrorCallback?: (error: any) => void; // 自定义错误处理
}
```

## HTTP 状态码处理

| 状态码   | 处理逻辑                                        |
| -------- | ----------------------------------------------- |
| 200-299  | 判断业务 code，非 0/200 则 showToast            |
| 401      | 清除登录信息，延迟 1.5s 跳转登录页（防抖）      |
| 409      | 业务冲突，触发 customErrorCallback 或 showToast |
| 404      | 提示「请求的资源不存在」                        |
| 5xx      | 提示「服务器错误，请稍后重试」                  |
| 网络错误 | 提示「网络异常，请稍后重试」                    |

## 请求方法

### 基础使用

```typescript
import { get, post, put, del } from '@/api/request';

// GET 请求
const data = await get<ResponseType>('/api/v1/endpoint', { params });

// POST 请求
const result = await post('/api/v1/endpoint', { body });

// PUT 请求
await put('/api/v1/endpoint/:id', { body });

// DELETE 请求
await del('/api/v1/endpoint/:id');
```

### 类型定义

```typescript
// src/api/user.ts
import { get, post } from '@/api/request';

// 1. 定义类型
interface UserInfo {
  id: string;
  nickname: string;
  avatar: string;
  phone?: string;
}

interface UpdateUserParams {
  nickname?: string;
  avatar?: string;
}

interface UserListParams {
  page: number;
  pageSize: number;
  keyword?: string;
}

interface UserListResponse {
  list: UserInfo[];
  total: number;
}

// 2. 导出 API 函数
/**
 * 获取用户信息
 */
export const getUserInfo = () => {
  return get<UserInfo>('/api/v1/user/info');
};

/**
 * 更新用户信息
 */
export const updateUserInfo = (params: UpdateUserParams) => {
  return post('/api/v1/user/update', params);
};

/**
 * 获取用户列表
 */
export const getUserList = (params: UserListParams) => {
  return get<UserListResponse>('/api/v1/user/list', params);
};

/**
 * 删除用户
 */
export const deleteUser = (id: string) => {
  return del(`/api/v1/user/${id}`);
};
```

## 白名单配置

### 无 Token 白名单（NO_TOKEN_WHITELIST）

不需要登录即可调用的接口：

```typescript
const NO_TOKEN_WHITELIST = [
  '/yanxue/wechat/v1/good/info',
  '/yanxue/wechat/v1/coupon/list',
  '/yanxue/wechat/v1/auth/login_xcx',
  // ...
];
```

### 忽略 401 白名单（UNAUTHORIZED_WHITELIST）

这些接口 401 时不触发登录跳转：

```typescript
const UNAUTHORIZED_WHITELIST = ['/wechat/v1/wx_xcx_qrcode/generate'];
```

### 自定义选项

```typescript
const res = await get(
  '/api/xxx',
  {},
  {
    skipErrorToast: true, // 静默错误
    skipTokenCheck: true, // 跳过 token 检查
    customErrorCallback: (err) => {
      /* 自定义处理 */
    },
  }
);
```

## 错误处理

### 统一错误处理

`request.ts` 已实现：

- 自动 Token 注入
- 401 自动跳转登录（防抖 1.5s）
- 网络错误提示
- 超时处理（默认 10 秒）

### API 层特殊处理

```typescript
export const deleteUser = async (id: string) => {
  try {
    await del(`/api/v1/user/${id}`);
    Taro.showToast({ title: '删除成功', icon: 'success' });
  } catch (error: any) {
    // 特殊错误处理
    if (error.code === 'USER_HAS_ORDERS') {
      Taro.showToast({ title: '用户有未完成订单', icon: 'none' });
    }
    throw error;
  }
};
```

## 文件上传

### 使用工具函数

```typescript
import { handleTaroFileUpload } from '@/utils/upload';
import Taro from '@tarojs/taro';

/**
 * 上传头像
 */
export const uploadAvatar = async () => {
  // 1. 选择图片
  const result = await Taro.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
  });

  // 2. 上传
  const uploadResult = await handleTaroFileUpload({
    tempFilePath: result.tempFilePaths[0],
    shouldCompress: true,
    maxSize: 1024 * 1024, // 1MB
    getToken: async () => {
      // 获取上传 Token
      const res = await get<{ token: string }>('/api/v1/upload/token');
      return res.token;
    },
  });

  return uploadResult.url;
};
```

### 上传配置

```typescript
interface UploadConfig {
  tempFilePath: string; // 临时文件路径
  shouldCompress?: boolean; // 是否压缩（默认 true）
  maxSize?: number; // 最大大小（字节）
  getToken: () => Promise<string>; // 获取上传 Token
}
```

## 并发请求

```typescript
/**
 * 获取首页数据
 */
export const getHomeData = async () => {
  const [banners, products, categories] = await Promise.all([
    get<Banner[]>('/api/v1/banner/list'),
    get<Product[]>('/api/v1/product/list', { page: 1, pageSize: 10 }),
    get<Category[]>('/api/v1/category/list'),
  ]);

  return { banners, products, categories };
};
```

## 请求取消

```typescript
let requestTask: Taro.RequestTask | null = null;

export const searchProducts = (keyword: string) => {
  // 取消之前的请求
  requestTask?.abort();

  requestTask = Taro.request({
    url: `${BASE_URL}/api/v1/product/search`,
    data: { keyword },
    success: (res) => {
      console.log(res.data);
    },
  });

  return requestTask;
};
```

## API 文件组织

```
src/api/
├── request.ts          # 底层封装（勿直接使用 Taro.request）
├── auth.ts             # 登录/注册/短信
├── user.ts             # 用户信息
├── order.ts            # 订单相关
├── good.ts             # 商品相关
├── course.ts           # 课程相关
├── deposit.ts          # 储值
├── coupon.ts           # 优惠券
├── child.ts            # 营员信息
├── parent.ts           # 监护人信息
├── upload.ts           # 上传
└── tripConfig.ts       # 远程配置
```

### 模块示例

```typescript
// src/api/product.ts
import { get, post } from '@/api/request';

interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
}

interface ProductListParams {
  page: number;
  pageSize: number;
  categoryId?: string;
}

/**
 * 获取商品列表
 */
export const getProductList = (params: ProductListParams) => {
  return get<{ list: Product[]; total: number }>('/api/v1/product/list', params);
};

/**
 * 获取商品详情
 */
export const getProductDetail = (id: string) => {
  return get<Product>(`/api/v1/product/${id}`);
};

/**
 * 搜索商品
 */
export const searchProducts = (keyword: string) => {
  return get<Product[]>('/api/v1/product/search', { keyword });
};
```

## 环境配置

### 多环境 API 地址

```typescript
// src/config/env.ts
const ENV_CONFIG = {
  development: {
    apiBaseUrl: 'http://localhost:8000',
  },
  staging: {
    apiBaseUrl: 'https://api-staging.example.com',
  },
  production: {
    apiBaseUrl: 'https://api.example.com',
  },
};

export const getApiBaseUrl = () => {
  const env = process.env.TARO_APP_ENV || 'development';
  return ENV_CONFIG[env].apiBaseUrl;
};
```

## 最佳实践

### ✅ 推荐

```typescript
// 1. 完整的类型定义
export const getUserInfo = () => {
  return get<UserInfo>("/api/v1/user/info")
}

// 2. 添加 JSDoc 注释
/**
 * 获取用户列表
 * @param params 查询参数
 */
export const getUserList = (params: UserListParams) => {
  // ...
}

// 3. 导出函数（不是默认导出）
export const getUser = () => {}
export const updateUser = () => {}

// 4. 错误提示友好
catch (error: any) {
  Taro.showToast({
    title: error.message || "操作失败",
    icon: "none"
  })
}
```

### ❌ 避免

```typescript
// 1. 避免使用 any
export const getUserInfo = () => {
  return get<any>("/api/v1/user/info")  // ❌
}

// 2. 避免在 API 层处理业务逻辑
export const getUserList = async (params: any) => {
  const data = await get(...)
  // ❌ 不要在这里过滤、排序
  return data.filter(...)
}

// 3. 避免默认导出
export default {  // ❌
  getUserInfo,
  updateUser
}
```

## 调试技巧

### 请求日志

```typescript
// src/api/request.ts
const request = async (config: RequestConfig) => {
  console.log('[Request]', config.url, config.data);

  const response = await Taro.request(config);

  console.log('[Response]', config.url, response.data);

  return response.data;
};
```

### 微信开发者工具

1. 打开调试器 -> Network 面板
2. 查看请求详情
3. 检查请求头、响应体
