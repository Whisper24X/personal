# 小程序开发适配

Taro 微信小程序开发的适配策略和最佳实践。

## 目标平台

- 微信小程序

## 单位转换

### rpx 转换规则

基于 750 设计稿：1rpx = 0.5px (iPhone 6)

```less
.box {
  width: 750rpx;   // 全屏宽度
  height: 200rpx;  // 200/750 * 屏幕宽度
}
```

### px 不转换

```less
.border {
  border: 1px solid #eee;  // 固定 1px，不转换
}
```

## API 使用

### 统一使用 Taro API

```typescript
import Taro from "@tarojs/taro"

// ✅ 推荐：统一使用 Taro API
Taro.showToast({ title: "成功" })
Taro.navigateTo({ url: "/pages/index/index" })
Taro.request({ url: "..." })

// ❌ 避免：直接使用微信原生 API
wx.showToast()  // 不推荐
```

## 组件使用

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
  <div class="container">  <!-- 小程序不支持 -->
    <span>文本</span>
    <img src="..." />
  </div>
</template>
```

## 样式适配

### 安全区域适配

```less
@import "@/styles/mixins.less";

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

## 路由

```typescript
// navigateTo 有页面栈限制（10层）
Taro.navigateTo({ url: "/pages/detail/index" })

// 超过栈限制时使用 redirectTo
Taro.redirectTo({ url: "/pages/detail/index" })

// TabBar 页面
Taro.switchTab({ url: "/pages/index/index" })
```

## 存储

```typescript
import Taro from "@tarojs/taro"

// ✅ 推荐：Taro 存储 API
Taro.setStorageSync("key", value)
const data = Taro.getStorageSync("key")
Taro.removeStorageSync("key")

// ❌ 避免：微信原生 API
wx.setStorageSync("key", value)
```

## 网络请求

### 统一请求封装

```typescript
import Taro from "@tarojs/taro"

// ✅ 推荐：统一使用 Taro.request
const request = async (config: RequestConfig) => {
  const response = await Taro.request({
    url: config.url,
    method: config.method,
    data: config.data,
    header: config.header
  })
  
  return response.data
}
```

### 域名配置

- 需在微信公众平台配置服务器域名
- 仅支持 https
- 域名需备案

## 文件上传

```typescript
import Taro from "@tarojs/taro"

// 选择图片
const chooseImage = async () => {
  const result = await Taro.chooseImage({
    count: 1,
    sizeType: ["compressed"],
    sourceType: ["album", "camera"]
  })
  
  return result.tempFilePaths[0]
}

// 上传文件
const uploadFile = async (filePath: string) => {
  const result = await Taro.uploadFile({
    url: "https://api.example.com/upload",
    filePath: filePath,
    name: "file"
  })
  
  return JSON.parse(result.data)
}
```

## 授权

```typescript
// 获取用户信息授权
const getUserProfile = async () => {
  const res = await Taro.getUserProfile({
    desc: "用于完善用户资料"
  })
  return res.userInfo
}

// 获取位置授权
const getLocation = async () => {
  const res = await Taro.getLocation({
    type: "wgs84"
  })
  return { latitude: res.latitude, longitude: res.longitude }
}
```

## 性能优化

```typescript
// 1. 使用分包加载
// app.config.ts
export default {
  pages: ["pages/index/index"],
  subPackages: [
    {
      root: "pages/user",
      pages: ["profile/index", "settings/index"]
    }
  ]
}

// 2. 图片优化
// - 使用 webp 格式
// - 压缩图片
// - 使用 CDN

// 3. 按需加载
const loadMore = async () => {
  // 懒加载更多数据
}
```

## 调试技巧

```typescript
// 1. 真机调试
// 微信开发者工具 -> 工具 -> 真机调试

// 2. 清除缓存
// 工具 -> 清除缓存

// 3. 查看网络请求
// 调试器 -> Network
```

## 最佳实践

### ✅ 推荐

```typescript
// 1. 统一使用 Taro API
import Taro from "@tarojs/taro"

// 2. 使用 Taro 组件
<view>, <text>, <image>

// 3. 使用 rpx 单位
width: 750rpx;
```

### ❌ 避免

```typescript
// 1. 避免使用微信原生 API
wx.showToast()  // ❌ 使用 Taro.showToast()

// 2. 避免使用 HTML 标签
<div>, <span>, <img>  // ❌ 使用 <view>, <text>, <image>

// 3. 避免硬编码平台逻辑
if (process.env.TARO_ENV === "weapp") {  // ⚠️ 不如 Taro.getEnv()
  // ...
}
```
