# 状态管理规范

## 概述

项目使用 Pinia 进行状态管理,提供类型安全、模块化和持久化支持。

**位置**: `src/store/`

---

## Store 基本结构

### Store 模板

```typescript
/**
 * 模块名称 Store
 *
 * @description Store 功能描述
 * @author 作者名
 */
import { defineStore } from "pinia"
import { ref, computed } from "vue"

export const useModuleStore = defineStore(
  "moduleName", // Store ID（唯一）
  () => {
    // 状态定义（使用 ref）
    const count = ref(0)
    const list = ref<Item[]>([])

    // 计算属性（使用 computed）
    const doubleCount = computed(() => count.value * 2)
    const hasData = computed(() => list.value.length > 0)

    // 方法（Actions）
    const increment = () => {
      count.value++
    }

    const fetchList = async () => {
      const data = await api.getList()
      list.value = data
    }

    const reset = () => {
      count.value = 0
      list.value = []
    }

    // 返回
    return {
      // 状态
      count,
      list,
      // 计算属性
      doubleCount,
      hasData,
      // 方法
      increment,
      fetchList,
      reset,
    }
  },
  {
    // 持久化配置（可选）
    persist: {
      key: "module-store",
      storage: localStorage,
    },
  }
)
```

---

## 核心 Store 模块

### 1. User Store（用户状态）

```typescript
// src/store/modules/user.ts
export const useUserStore = defineStore(
  "userStore",
  () => {
    // 用户信息
    const info = ref<Partial<Api.Auth.UserInfo>>({})

    // 登录状态
    const isLogin = ref(false)

    // Token
    const accessToken = ref("")
    const refreshToken = ref("")

    // 语言
    const language = ref(LanguageEnum.ZH)

    // 计算属性
    const getUserInfo = computed(() => info.value)

    // 设置用户信息
    const setUserInfo = (newInfo: Api.Auth.UserInfo) => {
      info.value = newInfo
    }

    // 设置 Token
    const setToken = (newAccessToken: string, newRefreshToken?: string) => {
      accessToken.value = newAccessToken
      if (newRefreshToken) {
        refreshToken.value = newRefreshToken
      }
    }

    // 设置登录状态
    const setLoginStatus = (status: boolean) => {
      isLogin.value = status
    }

    // 登出
    const logOut = () => {
      info.value = {}
      isLogin.value = false
      accessToken.value = ""
      refreshToken.value = ""

      // 跳转登录页
      router.push("/login")
    }

    return {
      info,
      isLogin,
      accessToken,
      refreshToken,
      language,
      getUserInfo,
      setUserInfo,
      setToken,
      setLoginStatus,
      logOut,
    }
  },
  {
    persist: {
      key: "user",
      storage: localStorage,
    },
  }
)
```

### 2. Menu Store（菜单状态）

```typescript
// src/store/modules/menu.ts
export const useMenuStore = defineStore("menuStore", () => {
  // 菜单列表
  const menuList = ref<AppRouteRecord[]>([])

  // 首页路径
  const homePath = ref("")

  // 动态路由移除函数
  const removeRouteFns = ref<(() => void)[]>([])

  // 设置菜单列表
  const setMenuList = (list: AppRouteRecord[]) => {
    menuList.value = list
  }

  // 设置首页路径
  const setHomePath = (path: string) => {
    homePath.value = path
  }

  // 添加移除路由函数
  const addRemoveRouteFns = (fns: (() => void)[]) => {
    removeRouteFns.value = fns
  }

  // 移除所有动态路由
  const removeAllDynamicRoutes = () => {
    removeRouteFns.value.forEach((fn) => fn())
    removeRouteFns.value = []
  }

  return {
    menuList,
    homePath,
    setMenuList,
    setHomePath,
    addRemoveRouteFns,
    removeAllDynamicRoutes,
  }
})
```

### 3. Setting Store（设置状态）

```typescript
// src/store/modules/setting.ts
export const useSettingStore = defineStore(
  "settingStore",
  () => {
    // 主题
    const theme = ref("light")

    // 侧边栏折叠状态
    const isCollapse = ref(false)

    // 是否显示进度条
    const showNprogress = ref(true)

    // 是否显示面包屑
    const showBreadcrumb = ref(true)

    // 切换主题
    const toggleTheme = () => {
      theme.value = theme.value === "light" ? "dark" : "light"
    }

    // 切换侧边栏
    const toggleCollapse = () => {
      isCollapse.value = !isCollapse.value
    }

    return {
      theme,
      isCollapse,
      showNprogress,
      showBreadcrumb,
      toggleTheme,
      toggleCollapse,
    }
  },
  {
    persist: {
      key: "setting",
      storage: localStorage,
    },
  }
)
```

### 4. Worktab Store（工作标签页）

```typescript
// src/store/modules/worktab.ts
export const useWorktabStore = defineStore(
  "worktabStore",
  () => {
    // 打开的标签页
    const opened = ref<AppRouteRecord[]>([])

    // KeepAlive 排除列表
    const keepAliveExclude = ref<string[]>([])

    // 添加标签页
    const addWorktab = (route: AppRouteRecord) => {
      const exists = opened.value.find((item) => item.path === route.path)
      if (!exists) {
        opened.value.push(route)
      }
    }

    // 删除标签页
    const removeWorktab = (path: string) => {
      const index = opened.value.findIndex((item) => item.path === path)
      if (index > -1) {
        opened.value.splice(index, 1)
      }
    }

    // 关闭其他标签页
    const closeOthers = (path: string) => {
      opened.value = opened.value.filter((item) => item.path === path)
    }

    // 关闭所有标签页
    const closeAll = () => {
      opened.value = []
    }

    return {
      opened,
      keepAliveExclude,
      addWorktab,
      removeWorktab,
      closeOthers,
      closeAll,
    }
  },
  {
    persist: {
      key: "worktab",
      storage: sessionStorage, // 使用 sessionStorage
    },
  }
)
```

---

## Store 使用

### 1. 在组件中使用

```vue
<script setup lang="ts">
import { useUserStore } from "@/store/modules/user"
import { storeToRefs } from "pinia"

const userStore = useUserStore()

// ✅ 推荐：使用 storeToRefs 解构响应式数据
const { isLogin, info } = storeToRefs(userStore)

// ❌ 不推荐：直接解构会失去响应式
const { isLogin, info } = userStore

// ✅ 方法可以直接解构
const { setUserInfo, logOut } = userStore

// 使用
const handleLogin = async () => {
  await login()
  setUserInfo(userInfo)
}
</script>

<template>
  <div v-if="isLogin">
    <p>欢迎, {{ info.userName }}</p>
    <button @click="logOut">退出</button>
  </div>
</template>
```

### 2. 在 Setup 函数外使用

```typescript
// 在路由守卫中使用
router.beforeEach((to, from, next) => {
  const userStore = useUserStore()

  if (!userStore.isLogin && to.path !== "/login") {
    next("/login")
    return
  }

  next()
})
```

### 3. Store 之间互相调用

```typescript
export const useModuleStore = defineStore("module", () => {
  const userStore = useUserStore() // 使用其他 Store

  const doSomething = () => {
    if (userStore.isLogin) {
      // 业务逻辑
    }
  }

  return { doSomething }
})
```

---

## 持久化配置

### 1. 基础持久化

```typescript
export const useStore = defineStore(
  "store",
  () => {
    // ...
  },
  {
    persist: true, // 使用默认配置（localStorage）
  }
)
```

### 2. 自定义配置

```typescript
export const useStore = defineStore(
  "store",
  () => {
    // ...
  },
  {
    persist: {
      key: "custom-key", // 自定义 key
      storage: sessionStorage, // 使用 sessionStorage
      paths: ["count", "list"], // 只持久化指定字段
    },
  }
)
```

### 3. 多存储配置

```typescript
export const useStore = defineStore(
  "store",
  () => {
    // ...
  },
  {
    persist: [
      {
        key: "store-local",
        storage: localStorage,
        paths: ["token", "userInfo"],
      },
      {
        key: "store-session",
        storage: sessionStorage,
        paths: ["tempData"],
      },
    ],
  }
)
```

---

## 最佳实践

### 1. Store 命名规范

```typescript
// ✅ 推荐
export const useUserStore = defineStore("userStore", () => {})
export const useMenuStore = defineStore("menuStore", () => {})

// ❌ 不推荐
export const user = defineStore("user", () => {})
export const store = defineStore("store", () => {})
```

### 2. 状态设计原则

```typescript
// ✅ 推荐：扁平化状态
const user = ref<UserInfo>({})
const isLogin = ref(false)
const token = ref("")

// ❌ 不推荐：过度嵌套
const state = ref({
  user: {
    info: {},
    auth: {
      isLogin: false,
      token: "",
    },
  },
})
```

### 3. 异步操作

```typescript
// ✅ 推荐：在 Action 中处理异步
const fetchUserInfo = async () => {
  try {
    loading.value = true
    const data = await api.getUserInfo()
    userInfo.value = data
  } catch (error) {
    console.error('获取用户信息失败', error)
  } finally {
    loading.value = false
  }
}

// ❌ 不推荐：在组件中直接处理
<script setup lang="ts">
const userStore = useUserStore()

const fetchData = async () => {
  const data = await api.getUserInfo()
  userStore.userInfo = data  // 直接修改
}
</script>
```

### 4. 重置状态

```typescript
export const useStore = defineStore("store", () => {
  // 初始状态
  const initialState = {
    count: 0,
    list: [],
  }

  const count = ref(initialState.count)
  const list = ref<Item[]>(initialState.list)

  // 重置方法
  const reset = () => {
    count.value = initialState.count
    list.value = []
  }

  // 或使用 Pinia 的 $reset (Options API 写法才支持)
  // const $reset = () => {
  //   count.value = 0
  //   list.value = []
  // }

  return { count, list, reset }
})
```

### 5. 类型安全

```typescript
// ✅ 推荐：定义类型
interface UserInfo {
  id: number
  name: string
  email: string
}

export const useUserStore = defineStore("user", () => {
  const info = ref<UserInfo | null>(null)
  const list = ref<UserInfo[]>([])

  return { info, list }
})

// ❌ 不推荐：不定义类型
export const useUserStore = defineStore("user", () => {
  const info = ref(null) // 类型不明确
  const list = ref([]) // 类型不明确

  return { info, list }
})
```

---

## 调试工具

### 1. Vue DevTools

在浏览器中安装 Vue DevTools 扩展，可以查看和调试 Store 状态。

### 2. 日志输出

```typescript
export const useStore = defineStore("store", () => {
  const count = ref(0)

  // 监听状态变化
  watch(count, (newVal, oldVal) => {
    console.log(`count 从 ${oldVal} 变为 ${newVal}`)
  })

  return { count }
})
```

### 3. Pinia 插件

```typescript
// src/store/index.ts
import { createPinia } from "pinia"
import piniaPluginPersistedstate from "pinia-plugin-persistedstate"

const pinia = createPinia()

// 使用持久化插件
pinia.use(piniaPluginPersistedstate)

// 自定义插件（日志）
pinia.use(({ store }) => {
  store.$subscribe((mutation, state) => {
    console.log("Store 变化:", mutation.storeId, state)
  })
})

export default pinia
```

---

## 迁移指南

### 从 Vuex 迁移到 Pinia

```typescript
// Vuex (Options API)
export default {
  state: {
    count: 0,
  },
  getters: {
    doubleCount: (state) => state.count * 2,
  },
  mutations: {
    increment(state) {
      state.count++
    },
  },
  actions: {
    async fetchData({ commit }) {
      const data = await api.getData()
      commit("setData", data)
    },
  },
}

// Pinia (Composition API)
export const useStore = defineStore("store", () => {
  // state
  const count = ref(0)

  // getters
  const doubleCount = computed(() => count.value * 2)

  // mutations + actions
  const increment = () => {
    count.value++
  }

  const fetchData = async () => {
    const data = await api.getData()
    list.value = data
  }

  return {
    count,
    doubleCount,
    increment,
    fetchData,
  }
})
```

---

## 常见问题

### Q1: 何时使用 Store，何时使用组件状态?

**A**:

- **使用 Store**: 跨组件共享、需要持久化、全局状态
- **使用组件状态**: 仅在当前组件使用、临时状态

### Q2: 如何在 Store 中使用路由?

**A**: 导入路由实例

```typescript
import { router } from "@/router"

export const useStore = defineStore("store", () => {
  const navigate = (path: string) => {
    router.push(path)
  }

  return { navigate }
})
```

### Q3: Store 的数据什么时候清理?

**A**:

- 页面刷新时，未持久化的数据会清空
- 持久化的数据会从 localStorage/sessionStorage 恢复
- 需要手动清理时，调用 reset 方法

---

## 相关文档

- [组件开发规范](component-development.md)
- [核心 Hooks](core-hooks.md)
- [路由配置规范](router-config.md)
