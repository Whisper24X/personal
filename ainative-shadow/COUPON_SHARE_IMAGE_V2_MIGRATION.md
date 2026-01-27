# 优惠券分享图 V2 迁移指南

## 更新日期
2025-11-05

## 重大变更

### 从纯Canvas绘制 → DOM + html2canvas

**原因**: 提升开发效率和可维护性

| 方面 | V1 (Canvas绘制) | V2 (DOM + html2canvas) |
|------|----------------|----------------------|
| 实现方式 | 手动Canvas API绘制 | Vue组件 + CSS样式 |
| 代码量 | ~300行复杂计算 | ~200行清晰结构 |
| 调试体验 | 靠日志和试错 | 浏览器开发工具 |
| 样式调整 | 修改代码重新计算 | 修改CSS立即生效 |
| 维护成本 | 高 | 低 |
| 灵活性 | 低 | 高 |

## 新架构

### 文件结构

```
src/
├── components/
│   └── CouponShareImage/
│       ├── index.vue          # 分享图Vue组件
│       └── README.md          # 组件文档
├── utils/
│   ├── couponShareImage.ts    # html2canvas工具函数
│   └── qrcode.ts              # 二维码生成(保持不变)
└── pages/
    └── miniProgramManagement/
        └── coupon/
            └── components/
                └── CouponDetailDialog.vue  # 使用示例
```

### 核心变更

#### 1. 新增组件: CouponShareImage

```vue
<!-- /src/components/CouponShareImage/index.vue -->
<template>
  <div class="coupon-share-image-wrapper">
    <div class="coupon-share-image">
      <!-- DOM结构 + CSS样式 -->
      <!-- 背景图、标题、图标、卡片、二维码 -->
    </div>
  </div>
</template>
```

**特点**:
- 完整的DOM结构
- 使用Flexbox布局
- 响应式设计
- 自动生成二维码

#### 2. 工具函数重写

```typescript
// V1: 复杂的Canvas绘制
export const generateCouponShareImage = async (
  config: CouponShareImageConfig
): Promise<string> => {
  // 300+ 行Canvas绘制代码
  // 手动计算位置、字体、颜色...
}

// V2: 简洁的html2canvas转换
export const generateCouponShareImage = async (
  element: HTMLElement
): Promise<string> => {
  const canvas = await html2canvas(element, {
    useCORS: true,
    scale: 1,
  })
  return canvas.toDataURL('image/png', 1.0)
}
```

## 迁移步骤

### 步骤 1: 更新依赖

确认 `package.json` 已包含:
```json
{
  "dependencies": {
    "html2canvas": "^1.4.1",
    "qrcode": "^1.5.4"
  }
}
```

### 步骤 2: 使用新组件

#### Before (V1)
```vue
<script setup>
import { generateCouponShareImage } from '@/utils/couponShareImage'

const generateImage = async () => {
  const dataURL = await generateCouponShareImage({
    couponId: '123',
    couponName: '优惠券',
    amount: '100',
    threshold: '无门槛',
    validTime: '2025-12-31',
    // ... 更多配置
  })
}
</script>
```

#### After (V2)
```vue
<template>
  <!-- 添加组件 -->
  <CouponShareImage
    ref="shareImageRef"
    :couponId="123"
    couponName="优惠券"
    amount="100"
    threshold="无门槛"
    validTime="2025-12-31"
  />
</template>

<script setup>
import { ref, nextTick } from 'vue'
import CouponShareImage from '@/components/CouponShareImage/index.vue'
import { generateCouponShareImage } from '@/utils/couponShareImage'

const shareImageRef = ref()

const generateImage = async () => {
  await nextTick()
  const element = shareImageRef.value?.shareImageRef
  const dataURL = await generateCouponShareImage(element)
}
</script>
```

### 步骤 3: 更新下载逻辑

#### Before (V1)
```typescript
import { downloadCouponShareImage } from '@/utils/couponShareImage'

await downloadCouponShareImage({
  couponId: '123',
  // ... 完整配置
}, 'filename.png')
```

#### After (V2)
```typescript
import { downloadCouponShareImage } from '@/utils/couponShareImage'

const element = shareImageRef.value?.shareImageRef
await downloadCouponShareImage(element, 'filename.png')
```

## API 变更

### generateCouponShareImage

#### V1 签名
```typescript
generateCouponShareImage(
  config: CouponShareImageConfig
): Promise<string>
```

#### V2 签名
```typescript
generateCouponShareImage(
  element: HTMLElement
): Promise<string>
```

**变更原因**: 配置移到组件Props,工具函数只负责转换

### downloadCouponShareImage

#### V1 签名
```typescript
downloadCouponShareImage(
  config: CouponShareImageConfig,
  filename?: string
): Promise<void>
```

#### V2 签名
```typescript
downloadCouponShareImage(
  element: HTMLElement,
  filename?: string
): Promise<void>
```

### 配置项映射

| V1 配置 | V2 位置 | 说明 |
|---------|---------|------|
| `couponId` | 组件Props | 优惠券ID |
| `couponName` | 组件Props | 优惠券名称 |
| `amount` | 组件Props | 优惠金额 |
| `threshold` | 组件Props | 使用门槛 |
| `validTime` | 组件Props | 有效期 |
| `miniProgramName` | 组件Props | 小程序名称 |
| `miniProgramIcon` | 组件Props | 小程序图标 |
| `qrCodeSize` | 组件内部 | 固定200px |
| `canvasWidth` | 组件Props `width` | 默认750 |
| `canvasHeight` | 组件Props `height` | 默认1250 |
| `backgroundColor` | CSS样式 | 背景图片 |
| `textColor` | CSS样式 | 文字颜色 |
| `accentColor` | CSS样式 | 主题色 |

## 完整迁移示例

### 优惠券详情对话框

```vue
<template>
  <el-dialog>
    <!-- 预览区域 -->
    <div class="share-preview">
      <img :src="shareImageUrl" alt="分享图预览" />
    </div>
    
    <!-- 下载按钮 -->
    <el-button @click="handleDownload">下载分享图</el-button>

    <!-- 分享图组件(隐藏) -->
    <CouponShareImage
      v-if="shareConfig"
      ref="shareImageRef"
      v-bind="shareConfig"
    />
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import CouponShareImage from '@/components/CouponShareImage/index.vue'
import { 
  generateCouponShareImage, 
  downloadCouponShareImage 
} from '@/utils/couponShareImage'

// 分享图配置
const shareConfig = computed(() => ({
  couponId: couponData.value.id,
  couponName: couponData.value.name,
  amount: couponData.value.discountAmount.toString(),
  threshold: couponData.value.minAmount === 0 
    ? '无门槛' 
    : `满${couponData.value.minAmount}可用`,
  validTime: formatValidTime(couponData.value),
  miniProgramName: '洋葱星球研学家长服务',
}))

const shareImageRef = ref()
const shareImageUrl = ref('')

// 生成预览
watch(() => shareConfig.value, async () => {
  if (shareConfig.value) {
    await nextTick()
    setTimeout(async () => {
      const element = shareImageRef.value?.shareImageRef
      if (element) {
        shareImageUrl.value = await generateCouponShareImage(element)
      }
    }, 500) // 等待图片加载
  }
}, { immediate: true })

// 下载
const handleDownload = async () => {
  const element = shareImageRef.value?.shareImageRef
  if (element) {
    await downloadCouponShareImage(element, `${couponData.value.name}-分享图.png`)
  }
}
</script>
```

## 常见问题

### Q1: 为什么要等待500ms?
**A**: 等待背景图和图标加载完成,否则html2canvas可能转换空白图片

### Q2: 组件为什么要隐藏?
**A**: 通过CSS移到屏幕外,保留在DOM中供html2canvas使用

### Q3: 能否直接显示组件?
**A**: 可以,移除隐藏CSS即可作为预览组件使用

### Q4: 性能如何?
**A**: 首次生成约500ms,后续可缓存结果

### Q5: 如何调试样式?
**A**: 临时修改CSS显示组件,使用浏览器开发工具调试

## 优势总结

### 开发效率
- ✅ Vue组件开发,符合现有技术栈
- ✅ CSS样式调整,所见即所得
- ✅ 组件复用,多处使用一致

### 维护性
- ✅ 代码结构清晰,易于理解
- ✅ 样式分离,修改方便
- ✅ 调试友好,工具支持好

### 扩展性
- ✅ 新增元素,添加DOM即可
- ✅ 样式变更,修改CSS
- ✅ 支持主题切换
- ✅ 支持动态内容

### 用户体验
- ✅ 生成速度快
- ✅ 图片质量高
- ✅ 样式还原度100%

## 回滚方案

如需回滚到V1,代码已备份在Git历史中:
```bash
# 查看V1最后一次提交
git log --grep="Canvas绘制"

# 恢复特定文件
git checkout <commit-hash> src/utils/couponShareImage.ts
```

## 相关文档

- [组件文档](/src/components/CouponShareImage/README.md)
- [工具函数文档](/src/utils/README.md#优惠券分享图生成工具)
- [html2canvas官方文档](https://html2canvas.hertzen.com/)

## 技术支持

如遇问题,请查看:
1. 组件README.md的常见问题章节
2. 浏览器控制台错误信息
3. html2canvas配置选项

