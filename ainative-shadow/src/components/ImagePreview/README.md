# ImagePreview 图片预览组件

一个基于 Element Plus 的图片预览组件，支持单张和多张图片预览。

## 特性

- 支持单张和多张图片预览
- 支持自定义图片尺寸和填充模式
- 支持多图模式下的网格布局配置
- 内置错误状态和占位图
- 基于 Element Plus 的 el-image 组件

## 使用方法

### 单张图片预览

```vue
<template>
  <ImagePreview v-model="imageUrl" :width="200" :height="150" />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import ImagePreview from '@/components/ImagePreview/index.vue'

const imageUrl = ref('https://example.com/image.jpg')
</script>
```

### 多张图片预览

```vue
<template>
  <ImagePreview
    v-model="imageUrls"
    :is-multiple="true"
    :columns="4"
    :gap="12"
    :width="150"
    :height="150"
    @preview="handlePreview"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import ImagePreview from '@/components/ImagePreview/index.vue'

const imageUrls = ref([
  'https://example.com/image1.jpg',
  'https://example.com/image2.jpg',
  'https://example.com/image3.jpg',
])

const handlePreview = (url: string) => {
  console.log('预览图片:', url)
}
</script>
```

## Props

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| modelValue | string \| string[] | - | 图片地址，支持单个字符串或字符串数组 |
| isMultiple | boolean | false | 是否多图模式 |
| width | number \| string | 100 | 图片宽度，支持数字（px）或字符串 |
| height | number \| string | 100 | 图片高度，支持数字（px）或字符串 |
| fit | 'fill' \| 'contain' \| 'cover' \| 'none' \| 'scale-down' | 'cover' | 图片填充模式 |
| columns | number | 3 | 多图模式下每行显示的图片数量 |
| gap | number | 8 | 多图模式下图片间距（px） |

## Events

| 事件名 | 参数 | 说明 |
|--------|------|------|
| preview | (url: string) | 点击图片时触发，返回当前点击的图片地址 |

## 示例

### 不同尺寸

```vue
<ImagePreview v-model="url" width="200" height="150" />
<ImagePreview v-model="url" width="300" height="200" />
```

### 不同填充模式

```vue
<ImagePreview v-model="url" fit="contain" />
<ImagePreview v-model="url" fit="cover" />
<ImagePreview v-model="url" fit="fill" />
```

### 多图布局

```vue
<ImagePreview
  v-model="urls"
  :is-multiple="true"
  :columns="3"
  :gap="8"
  width="120"
  height="120"
/>
``` 