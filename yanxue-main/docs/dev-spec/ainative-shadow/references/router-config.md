# 路由配置规范

## 概述

项目使用 Vue Router 4 进行路由管理,支持静态路由和动态路由,提供完善的权限控制和路由守卫机制。

**位置**: `src/router/`

---

## 目录结构

```
src/router/
├── core/                      # 路由核心逻辑
│   ├── ComponentLoader.ts     # 组件加载器
│   ├── IframeRouteManager.ts  # iframe 路由管理
│   ├── MenuProcessor.ts       # 菜单处理器
│   ├── RoutePermissionValidator.ts  # 权限验证
│   ├── RouteRegistry.ts       # 路由注册器
│   ├── RouteTransformer.ts    # 路由转换器
│   └── RouteValidator.ts      # 路由验证器
│
├── guards/                    # 路由守卫
│   ├── beforeEach.ts          # 前置守卫
│   └── afterEach.ts           # 后置守卫
│
├── modules/                   # 路由模块
│   ├── dashboard.ts           # 仪表盘路由
│   ├── system.ts              # 系统管理路由
│   ├── exception.ts           # 异常页面路由
│   └── result.ts              # 结果页面路由
│
├── routes/                    # 路由定义
│   ├── staticRoutes.ts        # 静态路由
│   └── asyncRoutes.ts         # 动态路由
│
├── routesAlias.ts             # 路由别名
└── index.ts                   # 路由入口
```

---

## 路由定义

### 1. 静态路由

静态路由在应用启动时注册,不需要权限验证。

```typescript
// src/router/routes/staticRoutes.ts
import type { RouteRecordRaw } from "vue-router"

export const staticRoutes: RouteRecordRaw[] = [
  {
    path: "/login",
    name: "Login",
    component: () => import("@/views/login/index.vue"),
    meta: {
      title: "登录",
      hideInMenu: true,
    },
  },
  {
    path: "/404",
    name: "Exception404",
    component: () => import("@/views/exception/404.vue"),
    meta: {
      title: "404",
      hideInMenu: true,
    },
  },
  {
    path: "/403",
    name: "Exception403",
    component: () => import("@/views/exception/403.vue"),
    meta: {
      title: "403",
      hideInMenu: true,
    },
  },
  {
    path: "/500",
    name: "Exception500",
    component: () => import("@/views/exception/500.vue"),
    meta: {
      title: "500",
      hideInMenu: true,
    },
  },
]
```

### 2. 动态路由

动态路由根据用户权限从后端获取,前端自动注册。

```typescript
// 后端返回的菜单数据格式
interface MenuData {
  id: string
  name: string
  path: string
  component: string
  icon?: string
  order?: number
  children?: MenuData[]
  meta?: {
    title: string
    hideInMenu?: boolean
    keepAlive?: boolean
    permissions?: string[]
  }
}

// 前端转换为路由
const transformToRoute = (menu: MenuData): RouteRecordRaw => {
  return {
    path: menu.path,
    name: menu.name,
    component: () => import(`@/views/${menu.component}.vue`),
    meta: {
      title: menu.meta?.title || menu.name,
      icon: menu.icon,
      ...menu.meta,
    },
    children: menu.children?.map(transformToRoute),
  }
}
```

---

## 路由 Meta 字段

```typescript
interface RouteMeta {
  /** 页面标题 */
  title: string

  /** 图标名称 */
  icon?: string

  /** 是否隐藏在菜单中 */
  hideInMenu?: boolean

  /** 是否缓存页面 */
  keepAlive?: boolean

  /** 所需权限 */
  permissions?: string[]

  /** 是否固定在标签页（不可关闭） */
  affix?: boolean

  /** 外链地址 */
  externalLink?: string

  /** iframe 地址 */
  iframeSrc?: string

  /** 面包屑路径（自定义） */
  breadcrumbPath?: string[]
}
```

### 使用示例

```typescript
{
  path: '/user',
  name: 'User',
  component: () => import('@/views/user/index.vue'),
  meta: {
    title: '用户管理',
    icon: 'user',
    keepAlive: true,           // 缓存页面
    permissions: ['user:view']  // 需要权限
  }
}
```

---

## 路由守卫

### 1. 全局前置守卫

```typescript
// src/router/guards/beforeEach.ts
export function setupBeforeEachGuard(router: Router): void {
  router.beforeEach(async (to, from, next) => {
    // 1. 开启进度条
    NProgress.start()

    // 2. 检查登录状态
    const userStore = useUserStore()
    if (!userStore.isLogin && to.path !== "/login") {
      next("/login")
      return
    }

    // 3. 动态路由注册
    if (!routeRegistry.isRegistered() && userStore.isLogin) {
      await registerDynamicRoutes()
      next({ ...to, replace: true })
      return
    }

    // 4. 权限验证
    if (to.meta.permissions) {
      const hasPermission = checkPermission(to.meta.permissions)
      if (!hasPermission) {
        next("/403")
        return
      }
    }

    // 5. 设置页面标题
    setPageTitle(to)

    // 6. 添加到工作标签页
    setWorktab(to)

    next()
  })
}
```

### 2. 全局后置守卫

```typescript
// src/router/guards/afterEach.ts
export function setupAfterEachGuard(router: Router): void {
  router.afterEach((to) => {
    // 关闭进度条
    NProgress.done()

    // 关闭 loading
    if (pendingLoading) {
      loadingService.hideLoading()
      resetPendingLoading()
    }
  })
}
```

### 3. 路由级守卫

```typescript
// 在路由配置中定义
{
  path: '/admin',
  component: Admin,
  beforeEnter: (to, from, next) => {
    // 仅对这个路由生效
    if (hasAdminPermission()) {
      next()
    } else {
      next('/403')
    }
  }
}
```

---

## 权限控制

### 1. 路由权限

```typescript
// 路由配置
{
  path: '/user/edit',
  name: 'UserEdit',
  component: () => import('@/views/user/edit.vue'),
  meta: {
    title: '编辑用户',
    permissions: ['user:edit']  // 需要 user:edit 权限
  }
}

// 权限验证
const checkPermission = (requiredPermissions: string[]): boolean => {
  const userStore = useUserStore()
  const userPermissions = userStore.info.buttons || []

  return requiredPermissions.some(permission =>
    userPermissions.includes(permission)
  )
}
```

### 2. 按钮权限指令

```typescript
// src/directives/business/auth.ts
export const auth = {
  mounted(el: HTMLElement, binding: DirectiveBinding) {
    const { value } = binding
    const userStore = useUserStore()
    const permissions = userStore.info.buttons || []

    if (value && !permissions.includes(value)) {
      el.parentNode?.removeChild(el)
    }
  }
}

// 使用
<el-button v-auth="'user:edit'">编辑</el-button>
<el-button v-auth="'user:delete'">删除</el-button>
```

---

## 路由跳转

### 1. 声明式导航

```vue
<template>
  <!-- 字符串路径 -->
  <router-link to="/user">用户管理</router-link>

  <!-- 命名路由 -->
  <router-link :to="{ name: 'User' }">用户管理</router-link>

  <!-- 带参数 -->
  <router-link :to="{ name: 'UserDetail', params: { id: 123 } }">
    用户详情
  </router-link>

  <!-- 带查询参数 -->
  <router-link :to="{ path: '/user', query: { page: 1 } }">
    用户列表
  </router-link>
</template>
```

### 2. 编程式导航

```typescript
import { useRouter } from "vue-router"

const router = useRouter()

// 字符串路径
router.push("/user")

// 对象
router.push({ path: "/user" })

// 命名路由
router.push({ name: "User" })

// 带参数
router.push({ name: "UserDetail", params: { id: 123 } })

// 带查询参数
router.push({ path: "/user", query: { page: 1 } })

// 替换当前历史记录
router.replace({ path: "/user" })

// 前进/后退
router.go(-1) // 后退一页
router.go(1) // 前进一页
router.back() // 后退
router.forward() // 前进
```

---

## 路由传参

### 1. Params 传参（动态路由）

```typescript
// 路由配置
{
  path: '/user/:id',
  name: 'UserDetail',
  component: () => import('@/views/user/detail.vue')
}

// 跳转
router.push({ name: 'UserDetail', params: { id: 123 } })

// 接收
<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()
const userId = route.params.id
</script>
```

### 2. Query 传参

```typescript
// 跳转
router.push({
  path: '/user',
  query: { page: 1, size: 10, name: '张三' }
})

// 接收
<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()
const page = route.query.page
const size = route.query.size
const name = route.query.name
</script>
```

### 3. State 传参（不在 URL 中显示）

```typescript
// 跳转
router.push({
  path: "/user",
  state: { from: "dashboard" },
})

// 接收
const state = history.state
console.log(state.from) // 'dashboard'
```

---

## 页面缓存

### 1. 配置 KeepAlive

```typescript
// 路由配置
{
  path: '/user',
  name: 'User',
  component: () => import('@/views/user/index.vue'),
  meta: {
    keepAlive: true  // 开启缓存
  }
}
```

### 2. 根组件配置

```vue
<!-- App.vue -->
<template>
  <router-view v-slot="{ Component, route }">
    <keep-alive :include="keepAliveList">
      <component :is="Component" :key="route.path" />
    </keep-alive>
  </router-view>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { useRoute } from "vue-router"

const route = useRoute()

// 从路由 meta 中获取需要缓存的页面
const keepAliveList = computed(() => {
  const routes = router.getRoutes()
  return routes.filter((r) => r.meta?.keepAlive).map((r) => r.name as string)
})
</script>
```

### 3. 组件内控制

```vue
<script setup lang="ts">
import { onActivated, onDeactivated } from "vue"

// 组件被激活时
onActivated(() => {
  console.log("页面被激活（从缓存中恢复）")
  // 刷新数据
  fetchData()
})

// 组件被停用时
onDeactivated(() => {
  console.log("页面被停用（进入缓存）")
})
</script>
```

---

## 工作标签页

### 1. 添加标签页

```typescript
import { setWorktab } from "@/utils/navigation"

// 在路由守卫中自动添加
router.beforeEach((to) => {
  if (to.meta?.title && !to.meta?.hideInMenu) {
    setWorktab(to)
  }
})
```

### 2. 标签页操作

```typescript
import { useWorktabStore } from "@/store/modules/worktab"

const worktabStore = useWorktabStore()

// 关闭当前标签页
worktabStore.removeWorktab(route.path)

// 关闭其他标签页
worktabStore.closeOthers(route.path)

// 关闭所有标签页
worktabStore.closeAll()

// 刷新当前标签页
worktabStore.refreshWorktab(route.path)
```

---

## 面包屑导航

### 1. 自动生成

```vue
<template>
  <el-breadcrumb>
    <el-breadcrumb-item
      v-for="(item, index) in breadcrumbs"
      :key="index"
      :to="item.path"
    >
      {{ item.title }}
    </el-breadcrumb-item>
  </el-breadcrumb>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { useRoute } from "vue-router"

const route = useRoute()

const breadcrumbs = computed(() => {
  return route.matched
    .filter((r) => r.meta?.title)
    .map((r) => ({
      path: r.path,
      title: r.meta.title,
    }))
})
</script>
```

---

## 路由别名

```typescript
// src/router/routesAlias.ts
export const RoutesAlias = {
  Login: "/login",
  Dashboard: "/dashboard",
  User: "/user",
  UserList: "/user/list",
  UserDetail: "/user/detail/:id",
  Exception404: "/404",
  Exception403: "/403",
  Exception500: "/500",
} as const

// 使用
router.push(RoutesAlias.UserList)
```

---

## 最佳实践

### 1. 路由懒加载

```typescript
// ✅ 推荐：使用动态导入
{
  path: '/user',
  component: () => import('@/views/user/index.vue')
}

// ❌ 不推荐：直接导入
import UserView from '@/views/user/index.vue'
{
  path: '/user',
  component: UserView
}
```

### 2. 路由命名

```typescript
// ✅ 推荐：使用有意义的名称
{
  path: '/user/detail/:id',
  name: 'UserDetail',
  component: () => import('@/views/user/detail.vue')
}

// ❌ 不推荐：不命名或使用无意义的名称
{
  path: '/user/detail/:id',
  name: 'Route1',
  component: () => import('@/views/user/detail.vue')
}
```

### 3. Meta 信息完整

```typescript
// ✅ 推荐：提供完整的 meta 信息
{
  path: '/user',
  name: 'User',
  component: () => import('@/views/user/index.vue'),
  meta: {
    title: '用户管理',
    icon: 'user',
    keepAlive: true,
    permissions: ['user:view']
  }
}
```

---

## 常见问题

### Q1: 动态路由刷新后丢失?

**A**: 在路由守卫中重新注册动态路由

```typescript
router.beforeEach(async (to, from, next) => {
  if (!routeRegistry.isRegistered()) {
    await registerDynamicRoutes()
    next({ ...to, replace: true })
    return
  }
  next()
})
```

### Q2: 如何实现路由过渡动画?

**A**: 使用 Transition 组件

```vue
<template>
  <router-view v-slot="{ Component }">
    <transition name="fade" mode="out-in">
      <component :is="Component" />
    </transition>
  </router-view>
</template>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
```

---

## 相关文档

- [架构概览](architecture.md)
- [状态管理规范](state-management.md)
- [组件开发规范](component-development.md)
