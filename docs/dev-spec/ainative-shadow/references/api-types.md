# API 类型定义规范

## 概述

项目使用 TypeScript 全局命名空间 `Api` 定义所有接口类型，提供类型安全和智能提示。

**位置**: `src/types/api/api.d.ts`

---

## 类型组织结构

### 命名空间层级

```typescript
declare namespace Api {
  // 第一层：通用类型
  namespace Common {
    // 分页、响应等通用类型
  }
  
  // 第二层：业务模块
  namespace Auth {
    // 认证相关类型
  }
  
  namespace SystemManage {
    // 系统管理类型
  }
  
  namespace User {
    // 用户相关类型
  }
  
  // ... 其他业务模块
}
```

---

## 通用类型定义

### 分页参数

```typescript
declare namespace Api {
  namespace Common {
    /** 分页参数 */
    interface PaginationParams {
      /** 当前页码 */
      current: number
      /** 每页条数 */
      size: number
      /** 总条数 */
      total: number
    }

    /** 通用搜索参数（不含 total） */
    type CommonSearchParams = Pick<PaginationParams, 'current' | 'size'>

    /** 分页响应基础结构 */
    interface PaginatedResponse<T = any> {
      /** 数据列表 */
      records: T[]
      /** 当前页码 */
      current: number
      /** 每页条数 */
      size: number
      /** 总条数 */
      total: number
    }
  }
}
```

### 启用状态

```typescript
declare namespace Api {
  namespace Common {
    /** 启用状态 */
    type EnableStatus = '1' | '2'  // '1': 启用, '2': 禁用
    
    /** 通用状态 */
    type Status = 'active' | 'inactive' | 'pending' | 'deleted'
  }
}
```

### 基础响应结构

```typescript
// src/types/common/response.ts
export interface BaseResponse<T = unknown> {
  /** 状态码 */
  code: number
  /** 消息 */
  msg: string
  /** 数据 */
  data: T
}
```

---

## 业务模块类型

### 认证模块

```typescript
declare namespace Api {
  namespace Auth {
    /** 登录参数 */
    interface LoginParams {
      userName: string
      password: string
    }

    /** 登录响应 */
    interface LoginResponse {
      token: string
      refreshToken: string
    }

    /** 用户信息 */
    interface UserInfo {
      /** 按钮权限列表 */
      buttons: string[]
      /** 角色列表 */
      roles: string[]
      /** 用户ID */
      userId: number
      /** 用户名 */
      userName: string
      /** 邮箱 */
      email: string
      /** 头像 */
      avatar?: string
    }
  }
}
```

### 系统管理模块

```typescript
declare namespace Api {
  namespace SystemManage {
    /** 用户列表响应 */
    type UserList = Api.Common.PaginatedResponse<UserListItem>

    /** 用户列表项 */
    interface UserListItem {
      id: number
      avatar: string
      status: string
      userName: string
      userGender: string
      nickName: string
      userPhone: string
      userEmail: string
      userRoles: string[]
      createBy: string
      createTime: string
      updateBy: string
      updateTime: string
    }

    /** 用户搜索参数 */
    type UserSearchParams = Partial<
      Pick<
        UserListItem,
        'id' | 'userName' | 'userGender' | 'userPhone' | 'userEmail' | 'status'
      > &
      Api.Common.CommonSearchParams
    >

    /** 创建用户参数 */
    interface CreateUserParams {
      userName: string
      password: string
      nickName: string
      userPhone: string
      userEmail: string
      userRoles: string[]
    }

    /** 更新用户参数 */
    interface UpdateUserParams {
      id: number
      nickName?: string
      userPhone?: string
      userEmail?: string
      userRoles?: string[]
      status?: string
    }

    /** 角色列表响应 */
    type RoleList = Api.Common.PaginatedResponse<RoleListItem>

    /** 角色列表项 */
    interface RoleListItem {
      roleId: number
      roleName: string
      roleCode: string
      description: string
      enabled: boolean
      createTime: string
    }

    /** 角色搜索参数 */
    type RoleSearchParams = Partial<
      Pick<RoleListItem, 'roleId' | 'roleName' | 'roleCode' | 'description' | 'enabled'> &
      Api.Common.CommonSearchParams
    >
  }
}
```

---

## 类型定义最佳实践

### 1. 命名规范

```typescript
// ✅ 推荐命名

// 请求参数：以 Params 结尾
interface LoginParams { }
interface CreateUserParams { }
interface UserSearchParams { }

// 响应数据：以 Response 或 Data 结尾
interface LoginResponse { }
interface UserData { }

// 列表项：以 Item 结尾
interface UserListItem { }
interface RoleListItem { }

// 列表响应：以 List 结尾
type UserList = PaginatedResponse<UserListItem>

// ❌ 不推荐
interface UserReq { }        // 使用完整单词 Params
interface UserRes { }        // 使用完整单词 Response
interface User { }           // 不够具体
```

### 2. 使用工具类型

```typescript
// ✅ 推荐：使用 TypeScript 工具类型

// Partial：所有属性可选
type UserSearchParams = Partial<UserListItem>

// Pick：选择特定属性
type UserBasicInfo = Pick<UserListItem, 'id' | 'userName' | 'email'>

// Omit：排除特定属性
type CreateUserParams = Omit<UserListItem, 'id' | 'createTime' | 'updateTime'>

// Required：所有属性必填
type RequiredUserParams = Required<CreateUserParams>

// Record：键值对
type UserMap = Record<string, UserListItem>

// ❌ 不推荐：重复定义相似类型
interface UserSearchParams {
  id?: number
  userName?: string
  email?: string
}
```

### 3. 类型复用

```typescript
// ✅ 推荐：复用通用类型

// 所有列表都使用 PaginatedResponse
type UserList = Api.Common.PaginatedResponse<UserListItem>
type RoleList = Api.Common.PaginatedResponse<RoleListItem>

// 所有搜索参数都继承 CommonSearchParams
type UserSearchParams = Partial<UserListItem> & Api.Common.CommonSearchParams

// ❌ 不推荐：每个模块都定义自己的分页类型
interface UserList {
  records: UserListItem[]
  current: number
  size: number
  total: number
}
```

### 4. 枚举类型

```typescript
// ✅ 推荐：使用字面量类型联合

type UserStatus = 'active' | 'inactive' | 'deleted'
type UserGender = 'male' | 'female' | 'unknown'
type UserRole = 'admin' | 'user' | 'guest'

// 或使用 enum
enum UserStatusEnum {
  Active = 'active',
  Inactive = 'inactive',
  Deleted = 'deleted'
}

// ❌ 不推荐：使用数字或不明确的字符串
type UserStatus = 1 | 2 | 3
type UserGender = 'M' | 'F'
```

### 5. 可选属性

```typescript
// ✅ 推荐：明确标记可选属性

interface UserInfo {
  id: number            // 必填
  userName: string      // 必填
  avatar?: string       // 可选
  email?: string        // 可选
}

// ❌ 不推荐：所有属性都可选
interface UserInfo {
  id?: number
  userName?: string
  avatar?: string
  email?: string
}
```

---

## 类型导入和使用

### 全局类型使用

```typescript
// 在组件中直接使用，无需导入
<script setup lang="ts">
const loginParams: Api.Auth.LoginParams = {
  userName: 'admin',
  password: '123456'
}

const userInfo: Api.Auth.UserInfo = {
  userId: 1,
  userName: 'admin',
  email: 'admin@example.com',
  buttons: [],
  roles: []
}
</script>
```

### ESLint 配置

在 `eslint.config.mjs` 中配置全局变量：

```javascript
export default [
  {
    languageOptions: {
      globals: {
        Api: 'readonly'  // 声明 Api 为只读全局变量
      }
    }
  }
]
```

---

## 与后端对齐

### 后端 Proto 到前端类型

后端 Proto 定义：

```protobuf
message UserInfo {
  int64 user_id = 1;
  string user_name = 2;
  string email = 3;
  repeated string roles = 4;
}
```

对应的前端类型：

```typescript
declare namespace Api {
  namespace User {
    interface UserInfo {
      userId: number      // int64 → number
      userName: string    // string → string
      email: string
      roles: string[]     // repeated string → string[]
    }
  }
}
```

### 字段命名转换

| Proto (snake_case) | TypeScript (camelCase) |
|-------------------|------------------------|
| user_id | userId |
| user_name | userName |
| create_time | createTime |
| is_enabled | isEnabled |

---

## 类型模板

### 基础 CRUD 类型模板

```typescript
declare namespace Api {
  namespace ModuleName {
    /** 列表项 */
    interface ListItem {
      id: number
      name: string
      status: string
      createTime: string
      updateTime: string
    }

    /** 列表响应 */
    type ListResponse = Api.Common.PaginatedResponse<ListItem>

    /** 搜索参数 */
    type SearchParams = Partial<
      Pick<ListItem, 'id' | 'name' | 'status'> &
      Api.Common.CommonSearchParams
    >

    /** 创建参数 */
    interface CreateParams {
      name: string
      status: string
    }

    /** 更新参数 */
    interface UpdateParams {
      id: number
      name?: string
      status?: string
    }

    /** 详情响应 */
    type DetailResponse = ListItem

    /** 删除参数 */
    interface DeleteParams {
      id: number
    }
  }
}
```

---

## 类型检查

### 使用类型守卫

```typescript
// 类型守卫函数
function isUserInfo(data: unknown): data is Api.Auth.UserInfo {
  return (
    typeof data === 'object' &&
    data !== null &&
    'userId' in data &&
    'userName' in data
  )
}

// 使用
const data: unknown = await fetchUserInfo()
if (isUserInfo(data)) {
  console.log(data.userId)  // 类型安全
}
```

### 使用断言

```typescript
// 类型断言（确定类型时使用）
const userInfo = data as Api.Auth.UserInfo

// 非空断言（确定不为 null 时使用）
const userName = userInfo.userName!
```

---

## 常见问题

### Q1: 为什么使用全局命名空间而不是导入导出？

**A**: 全局命名空间的优点：
- 无需在每个文件中导入
- 类型定义集中管理
- 更符合类型定义的使用习惯

### Q2: 如何避免类型定义冲突？

**A**: 使用嵌套的命名空间：
```typescript
Api.Auth.UserInfo      // 认证模块的用户信息
Api.User.UserInfo      // 用户模块的用户信息
```

### Q3: 什么时候使用 interface，什么时候使用 type？

**A**: 
- `interface`: 用于对象类型定义，可扩展
- `type`: 用于联合类型、工具类型、类型别名

```typescript
// interface：对象类型
interface UserInfo {
  id: number
  name: string
}

// type：联合类型、类型别名
type UserStatus = 'active' | 'inactive'
type UserList = PaginatedResponse<UserInfo>
```

---

## 相关文档

- [API 调用规范](api-http.md)
- [组件开发规范](component-development.md)
- [TypeScript 最佳实践](typescript-best-practices.md)
