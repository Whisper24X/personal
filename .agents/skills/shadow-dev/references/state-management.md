# 状态管理

Pinia 状态管理使用指南。

## 何时使用

| 场景             | 使用 Pinia | 使用本地状态      |
| ---------------- | ---------- | ----------------- |
| 跨组件共享数据   | ✅         | ❌                |
| 复杂的状态逻辑   | ✅         | ❌                |
| 需要持久化的数据 | ✅         | ❌                |
| 单个组件的状态   | ❌         | ✅                |
| 简单的表单数据   | ❌         | ✅（或 useTable） |

## Store 定义

### 基础 Store

```typescript
// src/store/modules/user.ts
import { defineStore } from 'pinia';

export const useUserStore = defineStore('user', () => {
  // State
  const userInfo = ref<Api.User.UserInfo | null>(null);
  const token = ref('');

  // Getters
  const isLoggedIn = computed(() => !!token.value);
  const userName = computed(() => userInfo.value?.userName ?? '');

  // Actions
  const setToken = (newToken: string) => {
    token.value = newToken;
  };

  const setUserInfo = (info: Api.User.UserInfo) => {
    userInfo.value = info;
  };

  const login = async (params: Api.Auth.LoginParams) => {
    const res = await loginApi(params);
    setToken(res.token);
    setUserInfo(res.userInfo);
  };

  const logout = () => {
    token.value = '';
    userInfo.value = null;
  };

  return {
    // State
    userInfo,
    token,
    // Getters
    isLoggedIn,
    userName,
    // Actions
    setToken,
    setUserInfo,
    login,
    logout,
  };
});
```

### 持久化 Store

```typescript
import { defineStore } from 'pinia';
import { createPersistedState } from 'pinia-plugin-persistedstate';

export const useUserStore = defineStore(
  'user',
  () => {
    const token = ref('');
    const userInfo = ref(null);

    return { token, userInfo };
  },
  {
    persist: {
      key: 'user-store',
      storage: localStorage,
      paths: ['token', 'userInfo'], // 指定持久化的字段
    },
  }
);
```

## 使用 Store

### 在组件中使用

```vue
<script setup lang="ts">
import { useUserStore } from '@/store/modules/user';

const userStore = useUserStore();

// 直接访问
console.log(userStore.userName);
console.log(userStore.isLoggedIn);

// 调用 action
const handleLogout = () => {
  userStore.logout();
};

// 解构（需要 storeToRefs）
import { storeToRefs } from 'pinia';
const { userName, isLoggedIn } = storeToRefs(userStore);
const { logout } = userStore; // actions 不需要 storeToRefs
</script>

<template>
  <div>
    <p>欢迎，{{ userName }}</p>
    <ElButton @click="handleLogout">退出登录</ElButton>
  </div>
</template>
```

### 在其他 Store 中使用

```typescript
import { defineStore } from 'pinia';
import { useUserStore } from './user';

export const useOrderStore = defineStore('order', () => {
  const userStore = useUserStore();

  const fetchMyOrders = async () => {
    if (!userStore.isLoggedIn) {
      throw new Error('请先登录');
    }
    // 使用 userStore.userInfo.id
    return fetchOrders({ userId: userStore.userInfo.id });
  };

  return { fetchMyOrders };
});
```

## 常见 Store 模式

### 用户 Store

```typescript
export const useUserStore = defineStore('user', () => {
  const token = ref('');
  const userInfo = ref<Api.User.UserInfo | null>(null);
  const permissions = ref<string[]>([]);

  const isLoggedIn = computed(() => !!token.value);
  const hasPermission = (permission: string) => {
    return permissions.value.includes(permission);
  };

  const login = async (params: Api.Auth.LoginParams) => {
    const res = await loginApi(params);
    token.value = res.token;
    userInfo.value = res.userInfo;
    permissions.value = res.permissions;
  };

  const logout = () => {
    token.value = '';
    userInfo.value = null;
    permissions.value = [];
  };

  return {
    token,
    userInfo,
    permissions,
    isLoggedIn,
    hasPermission,
    login,
    logout,
  };
});
```

### 配置 Store

```typescript
export const useSettingStore = defineStore(
  'setting',
  () => {
    const theme = ref<'light' | 'dark'>('light');
    const language = ref<'zh' | 'en'>('zh');
    const pageSize = ref(20);

    const setTheme = (newTheme: 'light' | 'dark') => {
      theme.value = newTheme;
    };

    const setLanguage = (lang: 'zh' | 'en') => {
      language.value = lang;
    };

    return {
      theme,
      language,
      pageSize,
      setTheme,
      setLanguage,
    };
  },
  {
    persist: true, // 持久化所有状态
  }
);
```

### 菜单 Store

```typescript
export const useMenuStore = defineStore('menu', () => {
  const menus = ref<Menu[]>([]);
  const activeMenu = ref('');

  const fetchMenus = async () => {
    menus.value = await fetchMenusApi();
  };

  const setActiveMenu = (path: string) => {
    activeMenu.value = path;
  };

  return {
    menus,
    activeMenu,
    fetchMenus,
    setActiveMenu,
  };
});
```

## 最佳实践

### ✅ 推荐

```typescript
// 1. 使用 Composition API 风格
export const useStore = defineStore('store', () => {
  // setup 函数
  return {};
});

// 2. 明确的类型定义
const userInfo = ref<Api.User.UserInfo | null>(null);

// 3. 异步操作使用 async/await
const fetchData = async () => {
  const data = await api();
  state.value = data;
};

// 4. 返回的对象有序组织
return {
  // State
  data,
  loading,
  // Getters
  computed1,
  computed2,
  // Actions
  fetchData,
  updateData,
};
```

### ❌ 避免

```typescript
// 1. 避免直接修改 state（应该通过 action）
// 组件中
userStore.token = 'xxx'; // ❌

// 应该
userStore.setToken('xxx'); // ✅

// 2. 避免在 Store 中直接操作 DOM
export const useStore = defineStore('store', () => {
  const fetchData = async () => {
    document.body.style.background = 'red'; // ❌
  };
});

// 3. 避免过度使用 Store
// 简单的本地状态不需要 Store
const localData = ref([]); // ✅ 组件内部使用即可
```

## Store 重置

```typescript
export const useDataStore = defineStore('data', () => {
  const data = ref([]);
  const loading = ref(false);

  const $reset = () => {
    data.value = [];
    loading.value = false;
  };

  return {
    data,
    loading,
    $reset,
  };
});

// 使用
const dataStore = useDataStore();
dataStore.$reset(); // 重置 store
```

## 调试

### Vue DevTools

Pinia 集成 Vue DevTools，可以：

- 查看所有 Store 状态
- 时间旅行调试
- 修改状态查看效果

### 手动日志

```typescript
export const useStore = defineStore('store', () => {
  const data = ref([]);

  const fetchData = async () => {
    console.log('[Store] fetchData start');
    const result = await api();
    data.value = result;
    console.log('[Store] fetchData success', result);
  };

  return { data, fetchData };
});
```
