# 状态管理

Pinia 在 Taro 应用中的使用规范。

## 何时使用 Store

| 场景             | 使用 Store | 使用本地状态      |
| ---------------- | ---------- | ----------------- |
| 跨页面共享数据   | ✅         | ❌                |
| 需要持久化的数据 | ✅         | ❌                |
| 用户信息、Token  | ✅         | ❌                |
| 单页面状态       | ❌         | ✅ (ref/reactive) |
| 临时数据         | ❌         | ✅                |

## Store 定义

### 用户 Store

```typescript
// src/store/userStore.ts
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import Taro from '@tarojs/taro';

export const useUserStore = defineStore(
  'user',
  () => {
    // State
    const token = ref('');
    const userInfo = ref<UserInfo | null>(null);

    // Getters
    const isLoggedIn = computed(() => !!token.value);
    const nickname = computed(() => userInfo.value?.nickname ?? '');
    const avatar = computed(() => userInfo.value?.avatar ?? '');

    // Actions
    const setToken = (newToken: string) => {
      token.value = newToken;
    };

    const setUserInfo = (info: UserInfo) => {
      userInfo.value = info;
    };

    const login = async (params: LoginParams) => {
      const res = await loginApi(params);
      setToken(res.token);
      setUserInfo(res.userInfo);
    };

    const logout = () => {
      token.value = '';
      userInfo.value = null;
      Taro.reLaunch({ url: '/pages/index/index' });
    };

    return {
      // State
      token,
      userInfo,
      // Getters
      isLoggedIn,
      nickname,
      avatar,
      // Actions
      setToken,
      setUserInfo,
      login,
      logout,
    };
  },
  {
    // 持久化配置（必须使用 Taro 存储）
    persist: {
      storage: {
        getItem: (key) => Taro.getStorageSync(key),
        setItem: (key, value) => Taro.setStorageSync(key, value),
      },
    },
  }
);
```

**关键点**:

- ✅ 使用 Composition API 风格 (`() => {}`)
- ✅ 完整的类型定义
- ✅ **必须使用 Taro 存储适配器**（不能用浏览器 localStorage）

### 配置 Store

```typescript
// src/store/configStore.ts
import { defineStore } from 'pinia';
import { ref } from 'vue';
import Taro from '@tarojs/taro';

export const useConfigStore = defineStore(
  'config',
  () => {
    const theme = ref<'light' | 'dark'>('light');
    const language = ref<'zh' | 'en'>('zh');
    const systemInfo = ref<Taro.getSystemInfoSync.Result | null>(null);

    const setTheme = (newTheme: 'light' | 'dark') => {
      theme.value = newTheme;
    };

    const setLanguage = (lang: 'zh' | 'en') => {
      language.value = lang;
    };

    const initSystemInfo = () => {
      systemInfo.value = Taro.getSystemInfoSync();
    };

    return {
      theme,
      language,
      systemInfo,
      setTheme,
      setLanguage,
      initSystemInfo,
    };
  },
  {
    persist: {
      storage: {
        getItem: (key) => Taro.getStorageSync(key),
        setItem: (key, value) => Taro.setStorageSync(key, value),
      },
      paths: ['theme', 'language'], // 仅持久化部分字段
    },
  }
);
```

## 使用 Store

### 在页面中使用

```vue
<template>
  <view class="profile-page">
    <view class="user-info">
      <image :src="avatar" class="avatar" />
      <text class="nickname">{{ nickname }}</text>
    </view>

    <button v-if="isLoggedIn" @tap="handleLogout">退出登录</button>
    <button v-else @tap="handleLogin">去登录</button>
  </view>
</template>

<script setup lang="ts">
import Taro from '@tarojs/taro';
import { useUserStore } from '@/store/userStore';

const userStore = useUserStore();

// 直接访问
const { isLoggedIn, nickname, avatar } = userStore;

// 或使用 storeToRefs（响应式）
import { storeToRefs } from 'pinia';
const { isLoggedIn, nickname, avatar } = storeToRefs(userStore);

// 调用 action
const handleLogout = () => {
  userStore.logout();
};

const handleLogin = () => {
  Taro.navigateTo({ url: '/pages/user/login/index' });
};
</script>
```

### 在 API 层使用

```typescript
// src/api/request.ts
import { useUserStore } from '@/store/userStore';

const request = async (config: RequestConfig) => {
  const userStore = useUserStore();

  // 添加 Token
  if (userStore.token) {
    config.header = {
      ...config.header,
      Authorization: `Bearer ${userStore.token}`,
    };
  }

  return Taro.request(config);
};
```

### 在其他 Store 中使用

```typescript
// src/store/orderStore.ts
import { defineStore } from 'pinia';
import { useUserStore } from './userStore';

export const useOrderStore = defineStore('order', () => {
  const userStore = useUserStore();

  const getMyOrders = async () => {
    if (!userStore.isLoggedIn) {
      throw new Error('请先登录');
    }
    return await getOrders({ userId: userStore.userInfo?.id });
  };

  return { getMyOrders };
});
```

## Store 持久化

### Taro 存储适配（必须）

```typescript
{
  persist: {
    storage: {
      getItem: (key) => Taro.getStorageSync(key),
      setItem: (key, value) => Taro.setStorageSync(key, value)
    }
  }
}
```

**为什么必须使用 Taro 存储**:

- ✅ 微信小程序兼容
- ✅ 同步读写性能更好
- ❌ 浏览器 localStorage 在小程序不可用

### 选择性持久化

```typescript
{
  persist: {
    storage: {
      getItem: (key) => Taro.getStorageSync(key),
      setItem: (key, value) => Taro.setStorageSync(key, value)
    },
    paths: ["token", "userInfo"]  // 仅持久化指定字段
  }
}
```

## Store 重置

```typescript
export const useUserStore = defineStore('user', () => {
  const token = ref('');
  const userInfo = ref(null);

  const $reset = () => {
    token.value = '';
    userInfo.value = null;
  };

  return {
    token,
    userInfo,
    $reset,
  };
});

// 使用
const userStore = useUserStore();
userStore.$reset();
```

## 常见模式

### TabBar Store

```typescript
// src/store/tabBarStore.ts
import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useTabBarStore = defineStore('tabBar', () => {
  const activeTab = ref('home');
  const showTabBar = ref(true);

  const setActiveTab = (tab: string) => {
    activeTab.value = tab;
  };

  const setShowTabBar = (show: boolean) => {
    showTabBar.value = show;
  };

  return {
    activeTab,
    showTabBar,
    setActiveTab,
    setShowTabBar,
  };
});
```

### 购物车 Store

```typescript
// src/store/cartStore.ts
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import Taro from '@tarojs/taro';

interface CartItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
}

export const useCartStore = defineStore(
  'cart',
  () => {
    const items = ref<CartItem[]>([]);

    // 商品总数
    const totalCount = computed(() => {
      return items.value.reduce((sum, item) => sum + item.quantity, 0);
    });

    // 总价
    const totalPrice = computed(() => {
      return items.value.reduce((sum, item) => sum + item.price * item.quantity, 0);
    });

    // 添加商品
    const addItem = (product: CartItem) => {
      const exist = items.value.find((item) => item.productId === product.productId);
      if (exist) {
        exist.quantity += product.quantity;
      } else {
        items.value.push(product);
      }
    };

    // 更新数量
    const updateQuantity = (productId: string, quantity: number) => {
      const item = items.value.find((item) => item.productId === productId);
      if (item) {
        item.quantity = quantity;
        if (item.quantity <= 0) {
          removeItem(productId);
        }
      }
    };

    // 移除商品
    const removeItem = (productId: string) => {
      const index = items.value.findIndex((item) => item.productId === productId);
      if (index > -1) {
        items.value.splice(index, 1);
      }
    };

    // 清空购物车
    const clear = () => {
      items.value = [];
    };

    return {
      items,
      totalCount,
      totalPrice,
      addItem,
      updateQuantity,
      removeItem,
      clear,
    };
  },
  {
    persist: {
      storage: {
        getItem: (key) => Taro.getStorageSync(key),
        setItem: (key, value) => Taro.setStorageSync(key, value),
      },
    },
  }
);
```

## 最佳实践

### ✅ 推荐

```typescript
// 1. 使用 Composition API 风格
export const useStore = defineStore("store", () => {
  // ...
  return {}
})

// 2. 完整的类型定义
const userInfo = ref<UserInfo | null>(null)

// 3. 必须使用 Taro 存储适配
{
  persist: {
    storage: {
      getItem: (key) => Taro.getStorageSync(key),
      setItem: (key, value) => Taro.setStorageSync(key, value)
    }
  }
}

// 4. 返回对象有序组织
return {
  // State
  token,
  userInfo,
  // Getters
  isLoggedIn,
  // Actions
  login,
  logout
}
```

### ❌ 避免

```typescript
// 1. 避免使用浏览器 localStorage
{
  persist: true; // ❌ 默认使用 localStorage，小程序不支持
}

// 2. 避免直接修改 state（应该通过 action）
// 组件中
userStore.token = 'xxx'; // ❌

// 应该
userStore.setToken('xxx'); // ✅

// 3. 避免在 Store 中使用 Taro 页面跳转（除非是全局行为）
export const useStore = defineStore('store', () => {
  const fetchData = () => {
    Taro.navigateTo({ url: '...' }); // ⚠️ 慎用
  };
});
```

## 调试

### 打印 Store 状态

```typescript
const userStore = useUserStore();
console.log('User Store:', userStore.$state);
```

### 监听 Store 变化

```typescript
const userStore = useUserStore();

userStore.$subscribe((mutation, state) => {
  console.log('Store changed:', mutation, state);
});
```
