# app-dev Skill

## 概述

ainative-app 移动端应用开发技能，提供 6 步开发流程和多端小程序开发最佳实践。

## 技术栈

- **跨端框架**: Taro 4.0.9
- **前端框架**: Vue 3 ^3.0.0
- **语言**: TypeScript ^5.4.5
- **样式**: Less ^4.2.0
- **状态**: Pinia ^3.0.1
- **持久化**: pinia-plugin-persistedstate ^4.2.0
- **构建**: Vite（通过 @tarojs/vite-runner）^4.5.10
- **代码规范**: ESLint 8.x + Prettier 3.x
- **Git Hooks**: Husky + lint-staged
- **Commit 规范**: commitlint（conventional）^19.x

## 支持平台

微信小程序（主力）、H5、支付宝、百度、抖音、QQ、京东、鸿蒙 hybrid

## 核心特性

### 1. 6 步标准流程

清晰的开发步骤，从需求分析到测试验证。

### 2. 小程序开发

- 统一 Taro API
- 单位自动转换（rpx）
- 小程序规范遵循

### 3. 企业级模式

- 请求封装（Token注入、401处理、白名单）
- 路由守卫（自动拦截未登录）
- 数据埋点（Vue指令）
- 文件上传（压缩、并发控制）

### 4. 渐进式披露

- **SKILL.md**: 快速流程、核心模式、常见场景（约 460 行）
- **references**: 详细文档、完整示例、最佳实践

## 文件结构

```
app-dev/
├── SKILL.md                        # 核心指南
├── README.md                       # 本文档
└── references/                     # 详细文档
    ├── api-patterns.md            # API 开发模式
    ├── page-patterns.md           # 页面开发模式
    ├── components.md              # 组件库文档
    ├── state-management.md        # Pinia 状态管理
    ├── style-system.md            # Less 样式系统
    ├── composables.md             # Composable 组合式函数规范
    ├── utils.md                   # 工具函数规范
    ├── code-standards.md          # 代码规范（ESLint/Prettier/Git/环境）
    └── cross-platform.md          # 多端适配规范
```

## 使用场景

AI Agent 会在以下情况自动使用：

- 开发 ainative-app 页面
- 创建移动端应用
- 小程序开发
- 微信小程序开发
- 用户提到"移动端"、"小程序"、"Taro"
- 用户明确提到 ainative-app

## 6 步流程

| 步骤        | 说明                   | 场景     |
| ----------- | ---------------------- | -------- |
| 1. 需求分析 | 确认平台、权限、TabBar | 所有场景 |
| 2. 定义 API | TypeScript 类型化接口  | 新增接口 |
| 3. 页面开发 | Vue 组件编写           | 所有场景 |
| 4. 组件调用 | 使用内置组件库         | UI 开发  |
| 5. 状态管理 | Pinia Store（跨页面）  | 共享状态 |
| 6. 测试验证 | 多端测试和 lint        | 所有场景 |

### 场景快速索引

| 场景             | 起始步骤 |
| ---------------- | -------- |
| 新增页面模块     | 步骤 2   |
| 已有页面新增功能 | 步骤 3   |
| 修改 UI 样式     | 步骤 3   |
| 跨组件状态共享   | 步骤 5   |

## 推荐模式

### 请求封装

```typescript
import { get, post } from '@/api/request';

// 自动 Token 注入
const data = await get<UserInfo>('/api/v1/user/info');

// 自动 401 处理（跳转登录）
```

### 页面组件

```vue
<script setup lang="ts">
import { ref } from 'vue';
import Taro, { useLoad } from '@tarojs/taro';
import CustomNavBar from '@/components/CustomNavBar/index.vue';

defineOptions({ name: 'ProfilePage' });

useLoad(() => {
  fetchData();
});
</script>

<template>
  <view class="page">
    <CustomNavBar title="标题" />
    <view class="content">
      <!-- 内容 -->
    </view>
  </view>
</template>

<style lang="less">
@import '@/styles/variables.less';

.page {
  .content {
    padding: @spacing-md;
  }
}
</style>
```

### Pinia Store（Taro 存储适配）

```typescript
export const useUserStore = defineStore(
  'user',
  () => {
    const token = ref('');
    return { token };
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

## 代码规范

- **TypeScript**: 严格模式，避免 `any`
- **命名**: 页面/组件 PascalCase，函数 camelCase
- **组件**: 使用 `<script setup>`，添加 `defineOptions`
- **样式**: 使用 `rpx` 单位，导入设计变量
- **API**: 统一使用 Taro API

## 示例覆盖

### API 开发

- ✅ 类型定义和请求方法
- ✅ 白名单配置（无 Token、忽略 401）
- ✅ 错误处理
- ✅ 文件上传
- ✅ 并发请求

### 页面开发

- ✅ 基础页面模板
- ✅ 列表页面（下拉刷新、滚动加载）
- ✅ 表单页面（验证、提交）
- ✅ TabBar 页面
- ✅ 生命周期 Hooks

### 组件库

- ✅ 布局组件（CustomNavBar、TabBar、TabBarLayout、StatusBar）
- ✅ 反馈组件（Loading、OiModal、Toast、EmptyState）
- ✅ UI 基础组件（OiButton、OiModal、OiSheet、OiTabs）
- ✅ 业务组件（InfoCard、InfoRow、ImageUploader、FilterDropdown 等）
- ✅ 自定义组件模板

### 状态管理

- ✅ Store 定义（Composition API）
- ✅ Taro 存储适配（必须）
- ✅ 状态持久化
- ✅ Store 使用和重置

### 样式系统

- ✅ 设计变量（颜色、间距、字体、圆角）
- ✅ Mixins（文本省略、1px边框、安全区域、Flex）
- ✅ 常用样式模式（卡片、列表、按钮、表单）
- ✅ 平台特定样式

### 小程序开发

- ✅ 单位转换（rpx/px）
- ✅ Taro API 使用
- ✅ 小程序组件
- ✅ 样式规范
- ✅ 路由/存储/网络封装

## 常用命令

```bash
pnpm dev:weapp              # 微信小程序开发（development）
pnpm dev:weapp:local        # 本地联调
pnpm dev:h5                 # H5 开发
pnpm build:weapp:test       # 测试包
pnpm build:weapp:stage      # 预发布包
pnpm build:weapp:production # 正式包
pnpm lint                   # 代码检查
pnpm lint:fix               # 自动修复
pnpm format                 # Prettier 格式化
```

## 相关文档

- [项目概览](../../../docs/dev-spec/ainative-app/README.md)
- [完整规范](../../../docs/dev-spec/ainative-app/references/)
- [Taro 官方文档](https://taro-docs.jd.com/)

## 与其他技能的关系

- **prototype**: 先用 prototype 验证想法，再用 app-dev 完整实现
- **test**: app-dev 开发完成后，用 test 生成测试用例

## 最佳实践总结

### DO ✅

- ✅ 使用 TypeScript 严格类型
- ✅ 统一使用 Taro API
- ✅ 使用 `rpx` 单位
- ✅ 导入设计变量 `variables.less`
- ✅ Pinia 使用 Taro 存储适配
- ✅ 添加 `defineOptions` 声明组件名
- ✅ 完整的错误处理

### DON'T ❌

- ❌ 使用 `any` 类型
- ❌ 使用平台特定 API（`wx.xxx`, `window.xxx`）
- ❌ 使用 HTML 标签（`<div>`, `<span>`, `<img>`）
- ❌ Pinia 使用浏览器 localStorage
- ❌ 硬编码颜色/间距
- ❌ 过度嵌套样式

## 关键差异

### 与 shadow-dev 的区别

| 特性     | app-dev (Taro + Vue3) | shadow-dev (Vue3 + Element Plus) |
| -------- | --------------------- | -------------------------------- |
| 平台     | 微信/H5/支付宝等多端  | 管理后台（Web）                  |
| UI库     | 自定义组件            | Element Plus                     |
| 单位     | rpx（自动转换）       | px/rem                           |
| 路由     | Taro 路由             | Vue Router                       |
| 存储     | Taro.setStorageSync   | localStorage                     |
| 请求     | Taro.request 封装     | axios 封装                       |
| 核心Hook | useLoad, useDidShow   | useTable                         |

---

**版本**: 1.0.0  
**最后更新**: 2026-02-03  
**维护者**: AI Agent
