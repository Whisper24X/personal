# 跨端适配规范

Taro 多端开发的适配策略和最佳实践。

## 支持平台

| 平台         | 说明     |
| ------------ | -------- |
| 微信小程序   | 主力平台 |
| H5           | Web 端   |
| 支付宝小程序 |          |
| 百度小程序   |          |
| 抖音小程序   |          |
| QQ 小程序    |          |
| 京东小程序   |          |
| 鸿蒙 hybrid  |          |

## 单位选择

| 场景       | 单位            | 说明                              |
| ---------- | --------------- | --------------------------------- |
| 小程序样式 | `rpx`           | 物理像素自适应，750rpx = 屏幕宽度 |
| H5 样式    | `px` / `vw`     | postcss-pxtorem 自动转换          |
| 导航栏高度 | `px`（JS 计算） | 通过 `getWindowInfo()` 动态获取   |

### rpx 转换规则

基于 750 设计稿：

| 平台         | 转换规则                |
| ------------ | ----------------------- |
| 微信小程序   | 1rpx = 0.5px (iPhone 6) |
| H5           | 自动转换为 rem          |
| 支付宝小程序 | 同微信小程序            |

```less
.box {
  width: 750rpx; // 全屏宽度
  height: 200rpx; // 200/750 * 屏幕宽度
}
```

### px 不转换

```less
.border {
  border: 1px solid #eee; // 固定 1px，不转换
}
```

## 平台判断

### 编译时（条件编译）

```less
/* src/styles/platform.less */
/* #ifdef WEAPP */
.wx-only {
  display: block;
}
/* #endif */

/* #ifdef H5 */
.h5-only {
  display: block;
}
/* #endif */
```

```typescript
// JS 中的平台判断
if (process.env.TARO_ENV === 'h5') {
  // H5 专属逻辑
}
if (process.env.TARO_ENV === 'weapp') {
  // 小程序专属逻辑
}
```

### 运行时（Taro API）

```typescript
import Taro from '@tarojs/taro';

const env = Taro.getEnv();

if (env === Taro.ENV_TYPE.WEAPP) {
  // 微信小程序特有逻辑
}
if (env === Taro.ENV_TYPE.WEB) {
  // H5 特有逻辑
}
if (env === Taro.ENV_TYPE.ALIPAY) {
  // 支付宝小程序特有逻辑
}
```

## 滚动条隐藏

小程序标准做法（`common.less` 已全局设置）：

```less
view,
scroll-view {
  &::-webkit-scrollbar {
    display: none;
  }
}
```

## 安全区适配

```less
@import '@/styles/mixins.less';

// 底部安全区域（刘海屏）
.footer {
  position: fixed;
  bottom: 0;
  .safe-area-inset-bottom();
}

// 或 CSS 直接写（TabBar）
height: calc(100px + env(safe-area-inset-bottom));
```

## 统一使用 Taro API

```typescript
import Taro from '@tarojs/taro';

// ✅ 推荐：统一使用 Taro API
Taro.showToast({ title: '成功' });
Taro.navigateTo({ url: '/pages/index/index' });
Taro.request({ url: '...' });

// ❌ 避免：直接使用平台 API
wx.showToast(); // 仅微信小程序
window.alert(); // 仅 H5
```

## 使用 Taro 组件

```vue
<template>
  <!-- ✅ 推荐：Taro 组件 -->
  <view class="container">
    <text>文本</text>
    <image src="..." />
    <button>按钮</button>
  </view>

  <!-- ❌ 避免：HTML 标签 -->
  <div class="container">
    <span>文本</span>
    <img src="..." />
  </div>
</template>
```

## 存储与请求

### 统一使用 Taro 存储

```typescript
Taro.setStorageSync('key', value);
const data = Taro.getStorageSync('key');
Taro.removeStorageSync('key');
```

### 统一请求封装

使用 `src/api/request.ts` 封装的 `get`/`post` 等方法，勿直接使用 `Taro.request`。

## 最佳实践

### ✅ 推荐

```typescript
// 1. 统一使用 Taro API
import Taro from '@tarojs/taro';

// 2. 平台判断（运行时）
if (Taro.getEnv() === Taro.ENV_TYPE.WEAPP) {
  // 微信小程序逻辑
}

// 3. 条件编译（编译时）
// #ifdef WEAPP
console.log('微信小程序');
// #endif

// 4. 使用 Taro 组件
// <view>, <text>, <image>
```

### ❌ 避免

```typescript
// 1. 避免使用平台特定 API
wx.showToast(); // ❌
window.alert(); // ❌

// 2. 避免使用 HTML 标签
// <div>, <span>, <img>  // ❌

// 3. 避免硬编码平台逻辑
if (process.env.TARO_ENV === 'weapp') {
  // ⚠️ 编译时判断，打包后不可变
}
```
