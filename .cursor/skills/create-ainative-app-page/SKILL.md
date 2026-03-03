---
name: create-ainative-app-page
description: 在 ainative-app (Taro + Vue3) 中创建新页面。提供从需求分析到页面实现的完整流程。当用户要求创建新页面、新功能模块、添加新路由页面或实现新的业务界面时使用。
---

# ainative-app 创建新页面 Skill

## 技能用途

当需要在 ainative-app (Taro + Vue3 跨平台应用) 中创建新页面时使用此技能。

**触发条件**:
- 用户要求创建新页面、新功能模块
- 需要添加新的路由页面
- 需要实现新的业务界面

## 技能步骤

### 1. 需求分析

首先确认以下信息:
- [ ] 页面功能和业务逻辑
- [ ] 页面路由路径
- [ ] 是否需要调用后端 API
- [ ] 是否需要状态管理
- [ ] 目标平台 (微信小程序)

### 2. 定义 API 类型 (如需要)

如果需要调用新的后端接口,先在 `src/api/` 目录创建或更新 API 文件:

```typescript
// src/api/模块名.ts
export interface 请求参数类型 {
  id: string
  // ...
}

export interface 响应数据类型 {
  id: string
  name: string
  // ...
}

// 使用项目的 HTTP 封装
export const getXxxData = (params: 请求参数类型) => 
  http.Get<响应数据类型>('/api/xxx', params)
```

### 3. 创建页面文件

在 `src/pages/` 目录下创建页面:

```
src/pages/
└── 模块名/
    ├── index.vue         # 页面主文件
    ├── index.config.ts   # 页面配置
    ├── service.ts        # 业务逻辑 (可选)
    └── components/       # 页面专属组件 (可选)
```

### 4. 编写页面配置

```typescript
// index.config.ts
export default definePageConfig({
  navigationBarTitleText: '页面标题',
  navigationStyle: 'default',
  enableShareAppMessage: false,
  enableShareTimeline: false,
})
```

### 5. 实现页面组件

```vue
<template>
  <view class="page-container">
    <!-- 使用 UnoCSS 原子类 -->
    <view class="p-4 bg-white rounded-2">
      {{ data }}
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Taro from '@tarojs/taro'
import { getXxxData } from '@/api/模块名'

// 响应式数据
const data = ref()

// 生命周期
onMounted(async () => {
  try {
    const result = await getXxxData({ id: '123' })
    data.value = result
  } catch (error) {
    Taro.showToast({
      title: '加载失败',
      icon: 'none'
    })
  }
})
</script>

<style lang="less" scoped>
.page-container {
  min-height: 100vh;
}
</style>
```

### 6. 添加路由配置

无需手动配置路由,Taro 会自动根据 `pages` 目录结构生成路由。

如需在 tabbar 中显示,修改 `src/app.config.ts`:

```typescript
export default defineAppConfig({
  pages: [
    'pages/模块名/index',
    // ...其他页面
  ],
  tabBar: {
    list: [
      {
        pagePath: 'pages/模块名/index',
        text: '标签文本',
        iconPath: 'assets/icon.png',
        selectedIconPath: 'assets/icon-active.png'
      }
    ]
  }
})
```

### 7. 使用 Pinia Store (如需要)

```typescript
// src/store/xxxStore.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useXxxStore = defineStore('xxx', () => {
  const data = ref([])
  
  const fetchData = async () => {
    // 获取数据逻辑
  }
  
  return {
    data,
    fetchData
  }
}, {
  persist: true // 持久化
})
```

在页面中使用:

```typescript
import { useXxxStore } from '@/store/xxxStore'

const store = useXxxStore()
```

### 8. 测试验证

```bash
# 微信小程序开发
pnpm dev:weapp

# 检查代码规范
pnpm lint

# 类型检查
pnpm type-check
```

## 关键规范

### 样式规范
- 优先使用 UnoCSS 原子类: `p-4`, `m-2`, `flex`, `items-center` 等
- 必要时使用 Less + scoped
- 使用项目预定义的变量 (在 `src/styles/` 中)

### 组件规范
- 全局组件放在 `src/components/`
- 页面专属组件放在页面目录的 `components/` 子目录
- 使用 TypeScript 定义 Props 和 Emits

### API 规范
- API 函数使用 `get/post/put/delete` 等语义化命名
- 使用 TypeScript 定义请求和响应类型
- 统一错误处理在拦截器中完成

### 开发注意事项
- 使用 Taro 提供的 API（不要直接使用 wx 等原生 API）
- 使用 rpx 单位适配不同屏幕
- 使用 Taro 组件（view、text、image），避免 HTML 标签（div、span、img）
```

## 常见问题

**Q: 如何导航到新页面?**

```typescript
// 普通跳转
Taro.navigateTo({
  url: '/pages/模块名/index?id=123'
})

// Tab 切换
Taro.switchTab({
  url: '/pages/模块名/index'
})

// 返回
Taro.navigateBack()
```

**Q: 如何获取路由参数?**

```typescript
import { useRouter } from '@tarojs/taro'

const router = useRouter()
const { id } = router.params
```

**Q: 如何处理页面分享?**

```typescript
// 在 setup 中
onShareAppMessage(() => {
  return {
    title: '分享标题',
    path: '/pages/模块名/index',
    imageUrl: '分享图片URL'
  }
})
```

## 相关文档

- [ainative-app 开发指南](/Users/moyan/myWorkPlace/yanxue-main/docs/dev-spec/ainative-app/README.md)
- [uni-app 约定](/Users/moyan/myWorkPlace/yanxue-main/docs/dev-spec/ainative-app/references/uni-app-patterns.md)
- [Vue3 + TypeScript 规范](/Users/moyan/myWorkPlace/yanxue-main/docs/dev-spec/ainative-app/references/vue-typescript-patterns.md)
- [API 与 HTTP 规范](/Users/moyan/myWorkPlace/yanxue-main/docs/dev-spec/ainative-app/references/api-http-patterns.md)
