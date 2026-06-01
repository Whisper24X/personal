# 路由配置

路由配置和菜单管理指南。

## 路由类型

### 1. 静态路由

固定的路由配置，在 `src/router/routes/staticRoutes.ts` 定义。

```typescript
export const staticRoutes: RouteRecordRaw[] = [
  {
    path: '/user',
    name: 'User',
    component: () => import('@/views/user/index.vue'),
    meta: {
      title: '用户管理',
      icon: 'user',
      requiresAuth: true, // 需要登录
    },
  },
];
```

### 2. 动态路由

后端返回的菜单数据，自动注册路由。

**工作流程**:

1. 登录后获取用户菜单数据
2. 前端根据菜单数据自动注册路由
3. 前端路由文件需要存在对应的 component

## 路由配置

### 基础配置

```typescript
{
  path: '/user',           // 路由路径
  name: 'User',            // 路由名称（唯一）
  component: () => import('@/views/user/index.vue'),  // 组件
  meta: {
    title: '用户管理',     // 页面标题
    icon: 'user',          // 菜单图标
    requiresAuth: true,    // 需要登录
    permissions: ['user:view']  // 权限标识
  }
}
```

### 嵌套路由

```typescript
{
  path: '/system',
  name: 'System',
  component: Layout,  // 布局组件
  meta: { title: '系统管理', icon: 'setting' },
  children: [
    {
      path: 'user',
      name: 'SystemUser',
      component: () => import('@/views/system/user/index.vue'),
      meta: { title: '用户管理', icon: 'user' }
    },
    {
      path: 'role',
      name: 'SystemRole',
      component: () => import('@/views/system/role/index.vue'),
      meta: { title: '角色管理', icon: 'role' }
    }
  ]
}
```

## Meta 字段

| 字段         | 类型       | 说明                          |
| ------------ | ---------- | ----------------------------- |
| title        | `string`   | 页面标题（显示在 tab/面包屑） |
| icon         | `string`   | 菜单图标                      |
| requiresAuth | `boolean`  | 是否需要登录（默认 true）     |
| permissions  | `string[]` | 权限标识数组                  |
| hidden       | `boolean`  | 是否隐藏菜单                  |
| keepAlive    | `boolean`  | 是否缓存页面                  |

## 路由跳转

### 编程式导航

```typescript
import { useRouter } from 'vue-router';

const router = useRouter();

// 跳转到指定路由
router.push('/user');
router.push({ name: 'User' });
router.push({ path: '/user', query: { id: '1' } });

// 替换当前路由（不产生历史记录）
router.replace('/user');

// 后退
router.back();
router.go(-1);

// 前进
router.go(1);
```

### 声明式导航

```vue
<template>
  <!-- 基础 -->
  <router-link to="/user">用户管理</router-link>

  <!-- 命名路由 -->
  <router-link :to="{ name: 'User' }">用户管理</router-link>

  <!-- 带参数 -->
  <router-link :to="{ path: '/user', query: { id: '1' } }"> 用户详情 </router-link>
</template>
```

## 路由守卫

### 全局前置守卫（已配置）

```typescript
// src/router/guards/beforeEach.ts
// 已实现：
// - 登录验证
// - 权限检查
// - 页面标题设置
// - 加载进度条
```

### 路由独享守卫

```typescript
{
  path: '/admin',
  name: 'Admin',
  component: () => import('@/views/admin/index.vue'),
  beforeEnter: (to, from) => {
    // 自定义验证逻辑
    if (!hasPermission('admin')) {
      return '/403'
    }
  }
}
```

### 组件内守卫

```vue
<script setup lang="ts">
import { onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router';

// 离开前确认
onBeforeRouteLeave((to, from) => {
  if (hasUnsavedChanges.value) {
    const answer = window.confirm('有未保存的更改，确定离开吗？');
    if (!answer) return false;
  }
});

// 路由更新
onBeforeRouteUpdate((to, from) => {
  // 参数变化时重新加载
  fetchData(to.params.id);
});
</script>
```

## 获取路由参数

### Query 参数

```typescript
import { useRoute } from 'vue-router';

const route = useRoute();

// 获取 query 参数（?id=1）
const id = route.query.id;
```

### Params 参数

```typescript
// 路由配置
{
  path: '/user/:id',
  name: 'UserDetail',
  component: () => import('@/views/user/detail.vue')
}

// 获取 params 参数（/user/123）
const id = route.params.id
```

## 面包屑

```vue
<script setup lang="ts">
import { useRoute } from 'vue-router';

const route = useRoute();

const breadcrumbs = computed(() => {
  return route.matched.map((item) => ({
    title: item.meta.title,
    path: item.path,
  }));
});
</script>

<template>
  <el-breadcrumb>
    <el-breadcrumb-item v-for="item in breadcrumbs" :key="item.path" :to="item.path">
      {{ item.title }}
    </el-breadcrumb-item>
  </el-breadcrumb>
</template>
```

## 权限控制

### 按钮级权限

```vue
<script setup lang="ts">
import { hasPermission } from '@/utils/permission';

const canEdit = computed(() => hasPermission('user:edit'));
const canDelete = computed(() => hasPermission('user:delete'));
</script>

<template>
  <ElButton v-if="canEdit" type="primary">编辑</ElButton>
  <ElButton v-if="canDelete" type="danger">删除</ElButton>
</template>
```

### 指令方式

```vue
<template>
  <!-- v-auth 指令（已定义） -->
  <ElButton v-auth="'user:edit'" type="primary">编辑</ElButton>
  <ElButton v-auth="'user:delete'" type="danger">删除</ElButton>

  <!-- v-roles 指令（已定义） -->
  <ElButton v-roles="['admin', 'manager']">管理操作</ElButton>
</template>
```

## 多标签页

```typescript
// 打开新标签页
import { useWorktab } from '@/hooks/core/useWorktab';

const { openTab, closeTab, closeOtherTabs } = useWorktab();

// 打开
openTab({ name: 'User', path: '/user' });

// 关闭
closeTab('/user');

// 关闭其他
closeOtherTabs('/user');
```
