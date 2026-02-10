# 跨端适配（已废弃）

> **⚠️ 重要提示**：本文档已废弃。ainative-app 项目当前仅支持微信小程序平台，不再支持跨端开发（H5、支付宝小程序等）。
>
> 如需微信小程序开发指南，请参考：
>
> - [SKILL.md](../SKILL.md) - 核心开发指南
> - [README.md](../README.md) - 完整文档索引
>
> 本文档保留仅供历史参考。

---

## 原文档内容（已过时）

Taro 多端开发的适配策略和最佳实践。

## 支持平台

- 微信小程序
- H5
- 支付宝小程序

## 单位转换

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

## API 差异

### 统一使用 Taro API

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

### 平台判断

```typescript
import Taro from '@tarojs/taro';

// 获取当前平台
const env = Taro.getEnv();

if (env === Taro.ENV_TYPE.WEAPP) {
  // 微信小程序特有逻辑
  console.log('微信小程序');
}

if (env === Taro.ENV_TYPE.WEB) {
  // H5 特有逻辑
  console.log('H5');
}

if (env === Taro.ENV_TYPE.ALIPAY) {
  // 支付宝小程序特有逻辑
  console.log('支付宝小程序');
}
```

### 条件编译（编译时）

```typescript
// 仅微信小程序
// #ifdef WEAPP
console.log('仅在微信小程序中运行');
wx.login();
// #endif

// 仅 H5
// #ifdef H5
console.log('仅在 H5 中运行');
window.history.back();
// #endif

// 仅支付宝小程序
// #ifdef ALIPAY
console.log('仅在支付宝小程序中运行');
// #endif

// 排除某平台
// #ifndef H5
console.log('非 H5 平台');
// #endif
```

## 组件差异

### 使用 Taro 组件

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
    <!-- 小程序不支持 -->
    <span>文本</span>
    <img src="..." />
  </div>
</template>
```

### 组件兼容性

| Taro 组件   | 微信小程序 | H5  | 支付宝小程序 |
| ----------- | ---------- | --- | ------------ |
| view        | ✅         | ✅  | ✅           |
| text        | ✅         | ✅  | ✅           |
| image       | ✅         | ✅  | ✅           |
| button      | ✅         | ✅  | ✅           |
| input       | ✅         | ✅  | ✅           |
| scroll-view | ✅         | ✅  | ✅           |

## 样式差异

### 安全区域适配

```less
@import '@/styles/mixins.less';

// 底部安全区域（刘海屏）
.footer {
  position: fixed;
  bottom: 0;
  .safe-area-bottom();
}

// 顶部安全区域
.navbar {
  position: fixed;
  top: 0;
  .safe-area-top();
}
```

### 平台特定样式

```less
// 微信小程序特有样式
/* #ifdef WEAPP */
.weapp-only {
  background: red;
}
/* #endif */

// H5 特有样式
/* #ifdef H5 */
.h5-only {
  background: blue;
  max-width: 750px;
  margin: 0 auto;
}
/* #endif */
```

## 路由差异

### 小程序路由

```typescript
// 小程序：navigateTo 有页面栈限制（10层）
Taro.navigateTo({ url: '/pages/detail/index' });

// 超过栈限制时使用 redirectTo
Taro.redirectTo({ url: '/pages/detail/index' });

// TabBar 页面
Taro.switchTab({ url: '/pages/index/index' });
```

### H5 路由

```typescript
// H5：使用浏览器路由，无页面栈限制
Taro.navigateTo({ url: '/pages/detail/index' });

// 支持浏览器返回按钮
window.history.back();
```

## 存储差异

### 统一使用 Taro 存储

```typescript
import Taro from '@tarojs/taro';

// ✅ 推荐：Taro 存储 API
Taro.setStorageSync('key', value);
const data = Taro.getStorageSync('key');
Taro.removeStorageSync('key');

// ❌ 避免：平台特定 API
localStorage.setItem('key', value); // 仅 H5
wx.setStorageSync('key', value); // 仅微信小程序
```

## 网络请求差异

### 统一请求封装

```typescript
import Taro from '@tarojs/taro';

// ✅ 推荐：统一使用 Taro.request
const request = async (config: RequestConfig) => {
  const response = await Taro.request({
    url: config.url,
    method: config.method,
    data: config.data,
    header: config.header,
  });

  return response.data;
};

// ❌ 避免：直接使用 fetch（仅 H5）
fetch('https://api.example.com'); // 小程序不支持
```

### 域名配置

**微信小程序**：

- 需在微信公众平台配置服务器域名
- 仅支持 https
- 域名需备案

**H5**：

- 开发环境：配置代理（`config/dev.ts`）
- 生产环境：配置 CORS 或 nginx 反向代理

## 文件上传差异

### 统一上传方法

```typescript
import Taro from '@tarojs/taro';

// 选择图片（跨端兼容）
const chooseImage = async () => {
  const result = await Taro.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
  });

  return result.tempFilePaths[0];
};

// 上传文件
const uploadFile = async (filePath: string) => {
  const result = await Taro.uploadFile({
    url: 'https://api.example.com/upload',
    filePath: filePath,
    name: 'file',
  });

  return JSON.parse(result.data);
};
```

## 授权差异

### 微信小程序授权

```typescript
// 获取用户信息授权
const getUserProfile = async () => {
  const res = await Taro.getUserProfile({
    desc: '用于完善用户资料',
  });
  return res.userInfo;
};

// 获取位置授权
const getLocation = async () => {
  const res = await Taro.getLocation({
    type: 'wgs84',
  });
  return { latitude: res.latitude, longitude: res.longitude };
};
```

### H5 授权

```typescript
// H5 使用浏览器 API
// #ifdef H5
const getLocation = async () => {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition((position) => {
      resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
    }, reject);
  });
};
// #endif
```

## 性能优化

### 小程序性能

```typescript
// 1. 使用分包加载
// app.config.ts
export default {
  pages: ['pages/index/index'],
  subPackages: [
    {
      root: 'pages/user',
      pages: ['profile/index', 'settings/index'],
    },
  ],
};

// 2. 图片优化
// - 使用 webp 格式
// - 压缩图片
// - 使用 CDN

// 3. 按需加载
const loadMore = async () => {
  // 懒加载更多数据
};
```

### H5 性能

```typescript
// 1. 路由懒加载
const routes = [
  {
    path: '/detail',
    component: () => import('@/pages/detail/index.vue'),
  },
];

// 2. 图片懒加载
// 使用 IntersectionObserver

// 3. 缓存优化
// 使用 Service Worker
```

## 调试技巧

### 微信开发者工具

```typescript
// 1. 真机调试
// 工具 -> 真机调试

// 2. 清除缓存
// 工具 -> 清除缓存

// 3. 查看网络请求
// 调试器 -> Network
```

### H5 调试

```typescript
// 1. Chrome DevTools
// F12 打开开发者工具

// 2. 移动端调试
// Chrome -> More tools -> Remote devices

// 3. vconsole（移动端调试）
import VConsole from 'vconsole';
// #ifdef H5
new VConsole();
// #endif
```

## 最佳实践

### ✅ 推荐

```typescript
// 1. 统一使用 Taro API
import Taro from "@tarojs/taro"

// 2. 平台判断（运行时）
if (Taro.getEnv() === Taro.ENV_TYPE.WEAPP) {
  // 微信小程序逻辑
}

// 3. 条件编译（编译时）
// #ifdef WEAPP
console.log("微信小程序")
// #endif

// 4. 使用 Taro 组件
<view>, <text>, <image>
```

### ❌ 避免

```typescript
// 1. 避免使用平台特定 API
wx.showToast()  // ❌
window.alert()  // ❌

// 2. 避免使用 HTML 标签
<div>, <span>, <img>  // ❌

// 3. 避免硬编码平台逻辑
if (process.env.TARO_ENV === "weapp") {  // ⚠️ 不如 getEnv
  // ...
}
```

## 兼容性表

| 功能        | 微信小程序 | H5   | 支付宝小程序 |
| ----------- | ---------- | ---- | ------------ |
| request     | ✅         | ✅   | ✅           |
| navigateTo  | ✅         | ✅   | ✅           |
| showToast   | ✅         | ✅   | ✅           |
| setStorage  | ✅         | ✅   | ✅           |
| chooseImage | ✅         | ✅   | ✅           |
| getLocation | ✅         | ✅   | ✅           |
| 支付        | ✅         | 部分 | ✅           |
| 分享        | ✅         | 部分 | ✅           |
