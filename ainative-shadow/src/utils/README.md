# 工具函数说明

## 二维码生成工具 (qrcode.ts)

### 功能概述
提供多种二维码生成方式，支持生成DataURL、Canvas、SVG等格式的二维码。

### 主要函数

#### 1. generateQRCodeDataURL
生成二维码并返回DataURL格式
```typescript
const dataURL = await generateQRCodeDataURL('https://example.com', {
  width: 200,
  height: 200,
  color: {
    dark: '#000000',
    light: '#FFFFFF'
  }
})
```

#### 2. generateQRCodeCanvas
生成二维码并返回Canvas元素
```typescript
const canvas = await generateQRCodeCanvas('https://example.com')
```

#### 3. generateQRCodeSVG
生成二维码并返回SVG字符串
```typescript
const svg = await generateQRCodeSVG('https://example.com')
```

#### 4. generateMiniProgramQRCode
生成小程序跳转二维码
```typescript
const dataURL = await generateMiniProgramQRCode('coupon123', '/pages/coupon/detail')
```

#### 5. generateCouponShareQRCode
生成优惠券分享二维码
```typescript
const dataURL = await generateCouponShareQRCode('coupon123', '会员优惠券')
```

#### 6. downloadQRCode
下载二维码图片
```typescript
downloadQRCode(dataURL, 'qrcode.png')
```

### 配置选项
```typescript
interface QRCodeOptions {
  width?: number        // 二维码宽度
  height?: number       // 二维码高度
  margin?: number       // 边距
  color?: {
    dark?: string       // 前景色
    light?: string      // 背景色
  }
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H' // 纠错级别
}
```

## 优惠券分享图生成工具 (couponShareImage.ts)

### 功能概述
基于 html2canvas 的优惠券分享图生成工具,配合 CouponShareImage 组件使用。

### 实现方案
**v2.0 (当前)**: DOM + html2canvas  
- ✅ 使用Vue组件渲染DOM结构
- ✅ CSS样式,易于维护和调整
- ✅ html2canvas转换为图片
- ✅ 开发效率高,调试方便

**v1.0 (已废弃)**: 纯Canvas绘制  
- ❌ 手动计算每个元素位置
- ❌ 修改样式需要重写代码
- ❌ 调试困难

### 主要函数

#### 1. generateCouponShareImage
使用html2canvas生成分享图
```typescript
import { generateCouponShareImage } from '@/utils/couponShareImage'

// 获取分享图DOM元素
const element = shareImageRef.value?.shareImageRef

// 生成base64图片
const dataURL = await generateCouponShareImage(element)
```

#### 2. downloadCouponShareImage
下载分享图到本地
```typescript
import { downloadCouponShareImage } from '@/utils/couponShareImage'

// 下载分享图
const element = shareImageRef.value?.shareImageRef
await downloadCouponShareImage(element, '优惠券分享图.png')
```

### 组件Props
```typescript
interface CouponShareImageProps {
  couponId: string | number    // 优惠券ID (必填)
  couponName: string          // 优惠券名称 (必填)
  amount: string              // 优惠金额 (必填)
  threshold: string           // 门槛 (必填)
  validTime: string           // 有效期 (必填)
  miniProgramName?: string    // 小程序名称 (默认: 洋葱星球研学家长服务)
  miniProgramIcon?: string    // 小程序图标URL (默认: 洋葱Logo)
  width?: number              // 画布宽度 (默认: 750)
  height?: number             // 画布高度 (默认: 1250)
}
```

### 分享图样式
**最新设计 (2025版)**:
- **顶部标题**: "有一张优惠券等你领取，数量有限，先到先得"
- **小程序区域**: 
  - 圆形小程序图标 (默认160px,洋葱星球Logo)
  - 小程序名称 "洋葱星球研学家长服务"
- **优惠券卡片区域** (白色圆角卡片):
  - 右上角红色标签: "限领1张/人"
  - 优惠金额: 大号红色数字 (¥1000)
  - 使用门槛: "满10000可用"
  - 虚线分隔符
  - 使用周期: 优惠券有效期
  - 二维码: 200x200px 居中显示
  - 底部提示: "长按扫码快速领取优惠"
- **整体风格**: 专属背景图片 (洋葱星球主题背景)
- **尺寸**: 750x1250px

## 使用示例

### 完整示例
```vue
<template>
  <div>
    <!-- 显示预览 -->
    <img v-if="shareImageUrl" :src="shareImageUrl" alt="分享图预览" />
    
    <!-- 操作按钮 -->
    <el-button @click="handleGenerateImage">生成分享图</el-button>
    <el-button @click="handleDownloadImage">下载分享图</el-button>

    <!-- 分享图组件(隐藏) -->
    <CouponShareImage
      ref="shareImageRef"
      couponId="123"
      couponName="会员优惠券"
      amount="1000"
      threshold="满10000可用"
      validTime="2025.10.10 10:00-2025.11.15 24:00"
      miniProgramName="洋葱星球研学家长服务"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'
import CouponShareImage from '@/components/CouponShareImage/index.vue'
import { generateCouponShareImage, downloadCouponShareImage } from '@/utils/couponShareImage'

const shareImageRef = ref()
const shareImageUrl = ref('')

// 生成分享图预览
const handleGenerateImage = async () => {
  await nextTick()
  const element = shareImageRef.value?.shareImageRef
  if (element) {
    shareImageUrl.value = await generateCouponShareImage(element)
  }
}

// 下载分享图
const handleDownloadImage = async () => {
  await nextTick()
  const element = shareImageRef.value?.shareImageRef
  if (element) {
    await downloadCouponShareImage(element, '会员优惠券-分享图.png')
  }
}
</script>
```

### 生成简单二维码
```typescript
import { generateQRCodeDataURL } from '@/utils/qrcode'

// 生成普通二维码
const qrCode = await generateQRCodeDataURL('https://example.com')

// 生成小程序跳转二维码
const miniProgramQR = await generateMiniProgramQRCode('coupon123')
```

## 注意事项

1. **依赖库**: 需要安装 `html2canvas`, `qrcode` 和 `@types/qrcode`
2. **浏览器兼容性**: 需要支持 Canvas API 的现代浏览器
3. **图片跨域**: 背景图和图标需要支持CORS,默认CDN资源已配置
4. **DOM渲染**: 生成前需等待DOM渲染和图片加载完成(建议500ms延迟)
5. **组件位置**: 分享图组件通过CSS隐藏,但保留在DOM中用于转换
6. **图片格式**: 生成PNG格式,质量1.0,文件约100-200KB
