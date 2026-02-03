---
name: app-dev
description: Guides development for ainative-app mobile application (Taro + Vue3 + Pinia). Supports multi-platform (WeChat, H5, Alipay). Provides 6-step workflow, cross-platform patterns, request encapsulation. Use when developing mobile app, mini-program, cross-platform pages, or user mentions ainative-app, Taro, WeChat mini-program.
---

# ainative-app 移动端开发指南

指导 Taro + Vue3 跨端移动应用开发，遵循项目规范和最佳实践。

## 技术栈

- **框架**: Taro 3.6.23 + Vue 3.3.4
- **构建**: Webpack 5
- **状态**: Pinia 2.1.7
- **样式**: Less 4.2.0
- **类型**: TypeScript 5.4.5

## 支持平台

- 微信小程序
- H5
- 支付宝小程序

## 6 步开发流程

```
需求分析 → 定义 API → 页面开发 → 组件调用 → 状态管理 → 测试验证
```

根据场景选择起始步骤：

| 场景             | 起始步骤          |
| ---------------- | ----------------- |
| 新增页面模块     | 步骤 2 - 定义 API |
| 已有页面新增功能 | 步骤 3 - 页面开发 |
| 修改 UI 样式     | 步骤 3 - 页面开发 |
| 跨组件状态共享   | 步骤 5 - 状态管理 |

---

### 步骤 1: 需求分析

确认：

- 支持的平台（微信/H5/支付宝）
- 是否需要登录权限
- 是否需要 TabBar
- 数据埋点需求

### 步骤 2: 定义 API

在 `src/api/` 创建模块文件：

```typescript
import { get, post } from '@/api/request';

// 定义类型
interface UserInfo {
  id: string;
  nickname: string;
  avatar: string;
}

interface UpdateParams {
  nickname: string;
  avatar?: string;
}

// 获取用户信息
export const getUserInfo = () => {
  return get<UserInfo>('/api/v1/user/info');
};

// 更新用户信息
export const updateUserInfo = (params: UpdateParams) => {
  return post('/api/v1/user/update', params);
};
```

**规范**:

- 使用 `get/post/put/del` 方法
- TypeScript 类型完整
- 添加函数注释

→ 详见 [references/api-patterns.md](references/api-patterns.md)

### 步骤 3: 页面开发

创建页面：`src/pages/user/profile/index.vue` + `index.config.ts`

```vue
<template>
  <view class="page">
    <NavBar title="个人资料" />
    <view class="content">
      <!-- 内容 -->
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import Taro, { useLoad } from '@tarojs/taro';
import NavBar from '@/components/NavBar/index.vue';

defineOptions({ name: 'ProfilePage' });

const data = ref(null);

useLoad(() => {
  fetchData();
});
</script>

<style lang="less">
@import '@/styles/variables.less';

.page {
  .content {
    padding: @spacing-md;
  }
}
</style>
```

**关键点**: 使用 `<script setup>`、`defineOptions`、`rpx` 单位、设计变量

→ 详见 [references/page-patterns.md](references/page-patterns.md)

### 步骤 4: 组件调用

#### 内置组件库

```vue
<template>
  <!-- 导航栏 -->
  <NavBar title="页面标题" :show-back="true" @back="handleBack" />

  <!-- TabBar 布局 -->
  <TabBarLayout tab-key="home" :show-tab-bar="true">
    <view>页面内容</view>
  </TabBarLayout>

  <!-- 空状态 -->
  <EmptyState message="暂无数据" />

  <!-- 加载中 -->
  <Loading :visible="loading" />

  <!-- 模态框 -->
  <Modal :visible="modalVisible" title="提示" content="确定删除吗？" @confirm="handleConfirm" @cancel="modalVisible = false" />
</template>
```

→ 详见 [references/components.md](references/components.md)

### 步骤 5: 状态管理

#### 何时使用 Store

| 场景           | 使用 Store | 使用本地状态 |
| -------------- | ---------- | ------------ |
| 跨页面共享数据 | ✅         | ❌           |
| 需要持久化     | ✅         | ❌           |
| 单页面状态     | ❌         | ✅           |

#### 创建 Store

```typescript
// src/store/userStore.ts
import { defineStore } from 'pinia';
import Taro from '@tarojs/taro';

export const useUserStore = defineStore(
  'user',
  () => {
    const token = ref('');
    const userInfo = ref(null);

    return { token, userInfo };
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

**Taro 存储适配**: 必须使用 `Taro.getStorageSync/setStorageSync`，确保跨端兼容。

→ 详见 [references/state-management.md](references/state-management.md)

### 步骤 6: 测试验证

```bash
# 微信小程序
pnpm dev:weapp

# H5
pnpm dev:h5

# 构建
pnpm build:weapp
pnpm build:h5

# Lint
pnpm lint
```

**检查清单**:

- [ ] TypeScript 无错误
- [ ] 多端测试通过
- [ ] 样式适配正常
- [ ] API 错误处理完善
- [ ] 埋点数据正确

---

## 核心模式

### 1. 请求封装

**自动 Token 注入、401 处理、白名单机制**：

```typescript
import { get, post } from '@/api/request';

// 自动添加 Token
const data = await get<UserInfo>('/api/v1/user/info');

// 自动处理 401 跳转登录（防抖 3 秒）
```

### 2. 路由守卫

**自动拦截需要登录的页面**：

```typescript
// src/utils/routerGuard.ts
const authPages = ['/pages/user/profile/index'];
```

已在 `app.ts` 自动初始化，无需手动调用。

### 3. 数据埋点

**Vue 指令埋点（全局注册）**：

```vue
<!-- 点击埋点 -->
<button v-track="{ event: 'click_button', params: { id: 1 } }">
  按钮
</button>

<!-- 曝光埋点 -->
<view v-track-view="{ event: 'view_card', params: { id: 1 } }">
  卡片
</view>
```

### 4. 样式系统

```less
@import '@/styles/variables.less';

.container {
  padding: @spacing-md; // 使用设计变量
  color: @text-color;
  font-size: @font-size-md;
  .text-ellipsis(); // 使用 mixin
}
```

---

## 跨端适配

### 1. 单位使用

- **小程序**: 使用 `rpx`（基于 750 设计稿）
- **H5**: 自动转换为 `rem`

```less
.box {
  width: 750rpx; // 全屏宽度
  height: 100rpx; // 自动转换
}
```

### 2. API 差异

```typescript
import Taro from '@tarojs/taro';

// 统一使用 Taro API
Taro.showToast({ title: '成功' });
Taro.navigateTo({ url: '/pages/index/index' });
Taro.request({ url: '...' });
```

### 3. 平台判断

```typescript
import Taro from '@tarojs/taro';

if (Taro.getEnv() === Taro.ENV_TYPE.WEAPP) {
  // 微信小程序特有逻辑
}

if (Taro.getEnv() === Taro.ENV_TYPE.WEB) {
  // H5 特有逻辑
}
```

### 4. 条件编译（编译时）

```typescript
// #ifdef WEAPP
console.log('仅微信小程序');
// #endif

// #ifdef H5
console.log('仅 H5');
// #endif
```

---

## 常见场景

- **列表+下拉刷新**: 使用 `useLoad` + `usePullDownRefresh`
- **TabBar 页面**: 使用 `<TabBarLayout tab-key="home">`
- **文件上传**: 使用 `Taro.chooseImage` + `handleTaroFileUpload`

→ 完整示例见 [references/page-patterns.md](references/page-patterns.md)

---

## 代码规范

### TypeScript

- ✅ 严格模式
- ✅ 避免 `any`
- ✅ API 响应类型化
- ✅ Props 完整定义

### 命名

- 页面：PascalCase (`ProfilePage`)
- 组件：PascalCase (`NavBar`)
- 函数：camelCase (`getUserInfo`)
- Store：camelCase (`useUserStore`)

### 组件

- 使用 `<script setup>`
- 添加 `defineOptions({ name: "ComponentName" })`
- 导入设计变量 `@/styles/variables.less`
- 使用 `rpx` 单位

### 样式

- 使用设计变量（`@primary-color`, `@spacing-md`）
- 使用 Mixins（`.text-ellipsis()`, `.safe-area-bottom()`）
- 避免固定像素值

---

## 快速参考

### 项目目录

```
ainative-app/src/
├── api/              # API 接口
├── components/       # 通用组件
├── pages/           # 页面组件
├── store/           # Pinia Store
├── styles/          # 样式系统
├── types/           # 类型定义
├── utils/           # 工具函数
└── app.ts           # 应用入口
```

### 常用导入

```typescript
import Taro from '@tarojs/taro';
import { get, post } from '@/api/request';
import { useUserStore } from '@/store/userStore';
import NavBar from '@/components/NavBar/index.vue';
```

### 常用命令

```bash
pnpm dev:weapp          # 微信小程序开发
pnpm dev:h5             # H5 开发
pnpm build:weapp        # 微信小程序构建
pnpm build:h5           # H5 构建
pnpm lint               # 代码检查
```

### Taro API 速查

```typescript
// 导航
Taro.navigateTo({ url: '/pages/user/index' });
Taro.redirectTo({ url: '/pages/login/index' });
Taro.navigateBack({ delta: 1 });

// 提示
Taro.showToast({ title: '成功', icon: 'success' });
Taro.showLoading({ title: '加载中...' });
Taro.hideLoading();

// 存储
Taro.setStorageSync('key', value);
Taro.getStorageSync('key');
Taro.removeStorageSync('key');
```

---

## 详细文档

完整规范请查看：

- **API 模式**: [references/api-patterns.md](references/api-patterns.md)
- **页面开发**: [references/page-patterns.md](references/page-patterns.md)
- **组件库**: [references/components.md](references/components.md)
- **状态管理**: [references/state-management.md](references/state-management.md)
- **样式系统**: [references/style-system.md](references/style-system.md)
- **跨端适配**: [references/cross-platform.md](references/cross-platform.md)

完整文档：[docs/dev-spec/ainative-app/README.md](../../../docs/dev-spec/ainative-app/README.md)
