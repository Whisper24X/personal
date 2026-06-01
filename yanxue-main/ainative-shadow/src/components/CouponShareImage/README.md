# 优惠券分享图组件

## 概述

基于 DOM + html2canvas 的优惠券分享图生成组件,相比纯 Canvas 绘制方案更加灵活、易维护。

## 设计优势

### 对比传统 Canvas 绘制方案

| 特性 | DOM + html2canvas | 纯 Canvas 绘制 |
|------|-------------------|----------------|
| **开发效率** | ✅ 使用熟悉的 HTML/CSS | ❌ 需要手动计算每个元素位置 |
| **样式维护** | ✅ CSS 样式,易于调整 | ❌ 修改样式需要重写代码 |
| **响应式** | ✅ 自动适应容器 | ❌ 需要手动计算缩放 |
| **复杂布局** | ✅ Flexbox/Grid 轻松实现 | ❌ 复杂布局计算困难 |
| **调试体验** | ✅ 浏览器开发工具直接调试 | ❌ 只能靠日志和试错 |
| **字体渲染** | ✅ 浏览器原生渲染 | ⚠️ 需要加载字体文件 |
| **图片处理** | ✅ 支持各种图片格式 | ⚠️ 需要处理跨域问题 |

## 组件使用

### 基础用法

```vue
<template>
  <div>
    <!-- 分享图组件 -->
    <CouponShareImage
      ref="shareImageRef"
      :couponId="123"
      couponName="会员优惠券"
      amount="1000"
      threshold="满10000可用"
      validTime="2025.10.10 10:00-2025.11.15 24:00"
      miniProgramName="洋葱星球研学家长服务"
    />

    <!-- 操作按钮 -->
    <el-button @click="handleDownload">下载分享图</el-button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import CouponShareImage from '@/components/CouponShareImage/index.vue'
import { downloadCouponShareImage } from '@/utils/couponShareImage'

const shareImageRef = ref()

const handleDownload = async () => {
  const element = shareImageRef.value?.shareImageRef
  if (element) {
    await downloadCouponShareImage(element, '优惠券分享图.png')
  }
}
</script>
```

### Props 配置

```typescript
interface CouponShareImageProps {
  couponId: string | number       // 优惠券ID
  couponName: string              // 优惠券名称
  amount: string                  // 优惠金额
  threshold: string               // 使用门槛
  validTime: string               // 有效期
  miniProgramName?: string        // 小程序名称(默认: 洋葱星球研学家长服务)
  miniProgramIcon?: string        // 小程序图标URL(默认: 洋葱Logo)
  width?: number                  // 画布宽度(默认: 750px)
  height?: number                 // 画布高度(默认: 1250px)
}
```

## 工具函数

### generateCouponShareImage

生成分享图的 base64 DataURL

```typescript
import { generateCouponShareImage } from '@/utils/couponShareImage'

const element = document.querySelector('.coupon-share-image')
const dataURL = await generateCouponShareImage(element)

// 使用 dataURL
// 1. 显示预览
imgElement.src = dataURL

// 2. 上传到服务器
const blob = await fetch(dataURL).then(r => r.blob())
```

### downloadCouponShareImage

直接下载分享图

```typescript
import { downloadCouponShareImage } from '@/utils/couponShareImage'

const element = document.querySelector('.coupon-share-image')
await downloadCouponShareImage(element, '优惠券分享图.png')
```

## 设计规范

### 尺寸规范
- **画布**: 750x1250px
- **背景图**: 750x1250px (洋葱星球主题)
- **小程序图标**: 160x160px 圆形
- **二维码**: 200x200px
- **卡片圆角**: 30px
- **标签圆角**: 35px

### 颜色规范
- **卡片背景**: #FFFFFF
- **主题色**: #FF6B4D
- **文字色**: 
  - 白色 #FFFFFF (背景区域)
  - 黑色 #333333 (卡片区域)
  - 灰色 #666666 (次要文字)

### 字体规范
- **标题**: 48px / font-weight: 900
- **小程序名称**: 32px
- **优惠金额**: 120px / font-weight: bold
- **门槛**: 28px
- **使用周期**: 24px
- **提示文字**: 28px / font-weight: bold

## 技术实现

### 核心流程

```
1. Vue组件渲染DOM结构
   ↓
2. 应用CSS样式(背景、布局、字体等)
   ↓
3. QRCode库生成二维码Canvas
   ↓
4. 等待图片资源加载完成
   ↓
5. html2canvas转换DOM为Canvas
   ↓
6. Canvas.toDataURL()生成图片
```

### html2canvas 配置

```typescript
{
  useCORS: true,        // 支持跨域图片
  allowTaint: false,    // 不允许污染画布
  backgroundColor: null, // 透明背景
  scale: 1,             // 1倍缩放(DOM已是目标尺寸)
  logging: false        // 关闭日志
}
```

## 注意事项

### 1. 图片跨域

组件中的背景图和图标需要支持CORS:
- 已配置默认CDN资源支持跨域
- 自定义图片需确保服务器配置 `Access-Control-Allow-Origin`

### 2. DOM渲染时机

生成分享图前需确保:
```typescript
// 等待Vue渲染完成
await nextTick()

// 等待图片加载(建议500ms)
setTimeout(() => {
  generateShareImage()
}, 500)
```

### 3. 隐藏组件

组件通过CSS隐藏但保留在DOM中:
```scss
.coupon-share-image-wrapper {
  position: fixed;
  left: -9999px;
  top: -9999px;
  z-index: -1;
}
```

### 4. 字体显示

使用系统字体栈确保跨平台一致性:
```css
font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
```

## 性能优化

### 1. 按需生成
```typescript
// ❌ 不好: 每次渲染都生成
watch(() => data, () => generateImage())

// ✅ 好: 仅在需要时生成
const handleDownload = () => generateImage()
```

### 2. 缓存结果
```typescript
const imageCache = new Map()

async function getCachedImage(id) {
  if (imageCache.has(id)) {
    return imageCache.get(id)
  }
  
  const dataURL = await generateImage()
  imageCache.set(id, dataURL)
  return dataURL
}
```

### 3. 懒加载组件
```vue
<CouponShareImage
  v-if="showShareImage"  // 仅在需要时加载
  ref="shareImageRef"
  v-bind="config"
/>
```

## 调试技巧

### 1. 显示预览
临时修改CSS查看实际渲染效果:
```scss
.coupon-share-image-wrapper {
  position: fixed;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%) scale(0.5);
  z-index: 9999;
  border: 2px solid red;
}
```

### 2. 检查图片加载
```typescript
const img = new Image()
img.onload = () => console.log('图片加载成功')
img.onerror = () => console.error('图片加载失败')
img.src = imageUrl
```

### 3. html2canvas 日志
```typescript
await html2canvas(element, {
  logging: true  // 开启日志查看详细信息
})
```

## 常见问题

### Q1: 生成的图片模糊?
A: 确保 scale 设置正确,DOM尺寸已是目标尺寸时使用 scale: 1

### Q2: 图片不显示?
A: 检查CORS配置,确保 `useCORS: true` 且图片支持跨域

### Q3: 字体显示异常?
A: 使用系统字体或确保自定义字体已加载完成

### Q4: 生成速度慢?
A: 优化图片尺寸,减少DOM复杂度,使用缓存

## 未来优化

- [ ] 支持主题切换
- [ ] 支持自定义模板
- [ ] WebWorker后台生成
- [ ] WebP格式导出
- [ ] 批量生成优化

