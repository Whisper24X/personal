# 数据采集规范

本文档介绍 ainative-app 的数据采集（埋点）工具使用方法。

## 概述

数据采集工具基于微信小程序的 `wx.reportEvent` 封装，支持：

- Vue 指令式埋点
- 手动调用埋点
- 自动采集用户信息
- 开发环境调试

## 初始化

在 `app.ts` 中初始化（已内置配置）：

```typescript
import { initAnalytics, vTrack, vTrackView } from "@/utils/analytics"
import { useUserStore } from "@/store/userStore"
import { IS_DEV } from "./config/env"

// 注册全局埋点指令
App.directive("track", vTrack)
App.directive("trackView", vTrackView)

// 初始化数据采集分析
initAnalytics({
  enabled: true,
  enableInDev: true,
  debug: IS_DEV,
  getUserInfo: () => {
    try {
      const userStore = useUserStore()
      if (userStore.isLoggedIn && userStore.userInfo) {
        return {
          userId: userStore.userInfo.openid,
          nickname: userStore.userInfo.nickname
        }
      }
    } catch (error) {
      console.warn("获取用户信息失败:", error)
    }
    return null
  }
})
```

> **注意**：全局埋点指令 `v-track` 和 `v-track-view` 已在应用启动时注册，可以直接在组件中使用，无需额外导入。

### 配置项

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| enabled | boolean | true | 是否启用采集 |
| enableInDev | boolean | false | 开发环境是否启用 |
| debug | boolean | false | 是否打印调试日志 |
| getUserInfo | function | - | 获取用户信息的函数 |

## 指令式埋点

### 点击埋点 v-track

```vue
<template>
  <!-- 基础用法 -->
  <button v-track="{ event: 'click_button' }">按钮</button>
  
  <!-- 带参数 -->
  <button v-track="{ event: 'click_item', params: { id: item.id, name: item.name } }">
    {{ item.name }}
  </button>
  
  <!-- 动态事件名 -->
  <button v-track="{ event: `click_${item.type}`, params: item }">
    操作
  </button>
</template>

<script setup lang="ts">
// v-track 已在应用启动时全局注册，无需导入
</script>
```

### 曝光埋点 v-track-view

```vue
<template>
  <!-- 基础用法 -->
  <view v-track-view="{ event: 'view_card' }">
    卡片内容
  </view>
  
  <!-- 带参数 -->
  <view v-track-view="{ event: 'view_product', params: { id: product.id } }">
    商品卡片
  </view>
</template>

<script setup lang="ts">
// v-track-view 已在应用启动时全局注册，无需导入
</script>
```

## 手动调用

### 通用埋点

```typescript
import { track } from "@/utils/analytics"

// 基础用法
track("custom_event")

// 带参数
track("purchase_complete", {
  orderId: "order_123",
  amount: 99.00,
  items: 3
})
```

### 页面浏览

```typescript
import { trackPageView } from "@/utils/analytics"

// 在页面 onShow 中调用
trackPageView("product_detail", {
  productId: "123",
  source: "home_recommend"
})
```

### 点击事件

```typescript
import { trackClick } from "@/utils/analytics"

const handleButtonClick = () => {
  trackClick("submit_form", {
    formType: "feedback"
  })
}
```

### 分享事件

```typescript
import { trackShare } from "@/utils/analytics"

const handleShare = (result) => {
  trackShare("share_product", {
    productId: "123",
    channel: result.channel
  })
}
```

## 事件命名规范

### 命名规则

- 使用小写字母和下划线
- 格式：`动作_对象` 或 `动作_对象_详情`
- 避免使用缩写

### 推荐命名

```typescript
// 页面浏览
"view_home_page"
"view_product_detail"
"view_order_list"

// 点击事件
"click_login_button"
"click_product_card"
"click_share_button"

// 业务事件
"submit_order"
"add_to_cart"
"complete_payment"
```

## 参数规范

### 通用参数

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string | 资源 ID |
| name | string | 资源名称 |
| source | string | 来源页面 |
| position | number | 位置索引 |

### 示例

```typescript
track("click_product", {
  id: "product_123",           // 商品 ID
  name: "商品名称",             // 商品名称
  source: "home_recommend",    // 来源
  position: 2,                 // 位置（从 0 开始）
  price: 99.00,                // 价格
  category: "electronics"      // 分类
})
```

## 平台适配

### 微信小程序

使用 `wx.reportEvent` 上报事件：

```typescript
wx.reportEvent("event_name", {
  key1: "value1",
  key2: "value2"
})
```

### H5

H5 环境下，事件会输出到控制台（需自行对接第三方统计平台）。

## 调试

开启 debug 模式后，所有埋点事件会打印到控制台：

```typescript
initAnalytics({
  debug: true
})
```

控制台输出示例：

```
[Analytics] Track: click_button
{
  event: "click_button",
  params: { id: "123" },
  user: { userId: "user_id" },
  timestamp: 1234567890
}
```

## 最佳实践

1. **统一管理**：在一个地方定义所有事件名常量
2. **参数标准化**：确保相同类型的事件使用相同的参数结构
3. **适度采集**：只采集对业务有价值的数据
4. **隐私保护**：不要采集敏感个人信息
5. **性能考虑**：避免在高频场景过度埋点

## 事件名常量示例

```typescript
// src/constants/analytics.ts
export const AnalyticsEvents = {
  // 页面浏览
  VIEW_HOME: "view_home",
  VIEW_PRODUCT: "view_product",
  VIEW_ORDER: "view_order",
  
  // 点击事件
  CLICK_LOGIN: "click_login",
  CLICK_PRODUCT: "click_product",
  CLICK_SHARE: "click_share",
  
  // 业务事件
  SUBMIT_ORDER: "submit_order",
  PAYMENT_SUCCESS: "payment_success",
  PAYMENT_FAIL: "payment_fail"
} as const
```
