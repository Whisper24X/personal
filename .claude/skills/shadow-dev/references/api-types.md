# API 类型定义规范

详细的 API 类型定义指南和最佳实践。

## 类型组织结构

```typescript
// src/types/api/api.d.ts
declare namespace Api {
  // 通用类型（已定义，直接使用）
  namespace Common {
    interface PaginatedResponse<T> {
      list: T[];
      total: number;
    }

    interface BaseResponse<T> {
      code: number;
      data: T;
      message: string;
    }
  }

  // 按模块组织
  namespace User {
    // 请求参数
    interface ListParams {
      page?: number;
      pageSize?: number;
      keyword?: string;
      status?: number;
    }

    // 数据实体
    interface UserInfo {
      id: string;
      userName: string;
      email: string;
      status: number;
      createdAt: string;
    }

    // 响应类型
    type ListResponse = Common.PaginatedResponse<UserInfo>;
  }
}
```

## 命名规范

| 类型     | 命名              | 示例                             |
| -------- | ----------------- | -------------------------------- |
| 请求参数 | `XxxParams`       | `ListParams`, `CreateParams`     |
| 响应数据 | `XxxResponse`     | `ListResponse`, `DetailResponse` |
| 数据实体 | `XxxInfo/XxxData` | `UserInfo`, `OrderData`          |
| 枚举     | `XxxEnum`         | `StatusEnum`, `TypeEnum`         |

## 完整示例

### 用户模块

```typescript
declare namespace Api {
  namespace User {
    // 请求参数
    interface ListParams {
      /** 当前页 */
      page?: number;
      /** 每页数量 */
      pageSize?: number;
      /** 搜索关键词 */
      keyword?: string;
      /** 状态: 1-正常 2-禁用 */
      status?: 1 | 2;
    }

    interface CreateParams {
      userName: string;
      email: string;
      password: string;
      roleIds: string[];
    }

    interface UpdateParams extends Partial<CreateParams> {
      id: string;
    }

    // 数据实体
    interface UserInfo {
      id: string;
      userName: string;
      email: string;
      avatar?: string;
      status: 1 | 2;
      roles: RoleInfo[];
      createdAt: string;
      updatedAt: string;
    }

    interface RoleInfo {
      id: string;
      name: string;
    }

    // 响应类型
    type ListResponse = Api.Common.PaginatedResponse<UserInfo>;
    type DetailResponse = UserInfo;
    type CreateResponse = { id: string };
  }
}
```

### 订单模块

```typescript
declare namespace Api {
  namespace Order {
    interface ListParams {
      page?: number;
      pageSize?: number;
      orderNo?: string;
      status?: OrderStatus;
      startDate?: string;
      endDate?: string;
    }

    interface OrderInfo {
      id: string;
      orderNo: string;
      totalAmount: number;
      status: OrderStatus;
      items: OrderItem[];
      createdAt: string;
    }

    interface OrderItem {
      productId: string;
      productName: string;
      quantity: number;
      price: number;
    }

    enum OrderStatus {
      Pending = 1,
      Paid = 2,
      Shipped = 3,
      Completed = 4,
      Cancelled = 5,
    }

    type ListResponse = Api.Common.PaginatedResponse<OrderInfo>;
  }
}
```

## 类型复用

### 1. 使用 Partial/Pick/Omit

```typescript
// 创建参数（部分字段）
interface CreateParams {
  name: string;
  email: string;
  status: number;
}

// 更新参数（全部可选 + id）
interface UpdateParams extends Partial<CreateParams> {
  id: string;
}

// 仅选择部分字段
type UserBasicInfo = Pick<UserInfo, 'id' | 'name' | 'email'>;

// 排除某些字段
type UserWithoutPassword = Omit<UserInfo, 'password'>;
```

### 2. 继承通用类型

```typescript
// 扩展分页参数
interface ListParams extends Api.Common.PaginationParams {
  keyword?: string;
  status?: number;
}
```

## 枚举 vs 联合类型

### 使用枚举（推荐用于常量）

```typescript
enum UserStatus {
  Normal = 1,
  Disabled = 2,
  Deleted = 3,
}
```

### 使用联合类型（推荐用于类型约束）

```typescript
type UserStatus = 1 | 2 | 3;
type UserRole = 'admin' | 'user' | 'guest';
```

## 最佳实践

### ✅ 推荐

```typescript
// 1. 添加 JSDoc 注释
interface UserInfo {
  /** 用户ID */
  id: string;
  /** 用户名 */
  userName: string;
}

// 2. 使用联合类型约束
interface Params {
  status: 1 | 2 | 3; // 明确的值
  type: 'A' | 'B'; // 限定范围
}

// 3. 可选字段使用 ?
interface Params {
  required: string;
  optional?: number;
}

// 4. 使用 Record 定义对象
type UserMap = Record<string, UserInfo>;
```

### ❌ 避免

```typescript
// 1. 避免 any
interface Bad {
  data: any; // ❌
}

// 2. 避免过度嵌套
interface Bad {
  user: {
    profile: {
      detail: {
        info: string; // ❌ 太深
      };
    };
  };
}

// 3. 避免模糊命名
interface Bad {
  data: string; // ❌ 不明确
  info: number; // ❌ 不明确
}
```

## 与后端对接

### 字段映射

如果后端字段与前端不一致，在 API 调用层转换：

```typescript
// 后端返回 snake_case
interface BackendUser {
  user_name: string;
  created_at: string;
}

// 前端使用 camelCase
interface UserInfo {
  userName: string;
  createdAt: string;
}

// 在 API 层转换
export async function fetchUser(id: string): Promise<UserInfo> {
  const data = await request.get<BackendUser>({ url: `/user/${id}` });
  return {
    userName: data.user_name,
    createdAt: data.created_at,
  };
}
```

## 工具类型

### 项目通用工具类型

```typescript
// src/types/common/index.ts
declare namespace Common {
  /** 分页参数 */
  interface PaginationParams {
    page?: number;
    pageSize?: number;
  }

  /** 分页响应 */
  interface PaginatedResponse<T> {
    list: T[];
    total: number;
    page?: number;
    pageSize?: number;
  }

  /** ID 类型 */
  type ID = string | number;

  /** 时间戳 */
  type Timestamp = string;

  /** 键值对 */
  type KeyValue<T = any> = Record<string, T>;
}
```
