# WXML2Canvas 组件

一个功能强大的微信小程序 WXML 转 Canvas 组件，支持将复杂的 WXML 结构渲染为 Canvas 图像，适用于海报生成、图片分享等场景。

## ✨ 特性

- 🎨 **完整的 WXML 支持**：支持文本、图片、视频、背景、边框等多种元素
- 🔧 **高度可配置**：支持自定义容器类名、元素类名、缩放比例等
- 📱 **Taro 框架兼容**：专门适配 Taro Vue3 环境
- 🚀 **高性能渲染**：支持离屏渲染，提升性能
- 🎯 **精确布局**：支持复杂的 CSS 样式和布局
- 📦 **易于集成**：简单的 API 设计，易于集成到现有项目

## 📦 安装

### 1. 复制组件文件

将 `WXML2Canvas` 文件夹复制到你的项目 `components` 目录下。

```
src/
  components/
    WXML2Canvas/
      ├── index.vue      # 主组件
      ├── canvas.js      # Canvas 绘制逻辑
      ├── element.js     # 元素查询和处理
      ├── gradient.js    # 渐变处理
      └── constants.js   # 常量定义
```

### 2. 配置 Taro 插件 ⚠️ 重要

**必须配置** `@tarojs/plugin-inject` 插件，以确保 `dataText` 等属性能够正确传递给 Canvas 绘制逻辑，并且确保是驼峰。

在 `config/index.ts` 中添加以下配置：

```typescript
export default defineConfig<"vite">(async (merge, { command, mode }) => {
  const baseConfig: UserConfigExport<"vite"> = {
    // 其他配置...
    plugins: [
      // 其他插件...
      [
        "@tarojs/plugin-inject",
        {
          components: {
            Text: {
              "data-index": "'dataIndex'",
              "data-text": "'dataText'"
            },
            View: {
              "data-index": "'dataIndex'",
              "data-text": "'dataText'"
            },
            ScrollView: {
              "data-observe": "'dataObserve'"
            }
          }
        }
      ]
    ]
    // 其他配置...
  }
})
```

### 3. 插件配置说明

| 配置项 | 说明 | 必要性 |
|--------|------|--------|
| `Text` 组件的 `dataText` | 用于传递文本内容到 Canvas 绘制 | ✅ **必需** |
| `View` 组件的 `dataText` | 用于传递文本内容到 Canvas 绘制 | ✅ **必需** |
| `data-index` | 用于元素索引标识 | 🔶 **推荐** |
| `ScrollView` 的 `data-observe` | 用于滚动观察 | 🔶 **可选** |

**⚠️ 注意事项：**
- 如果没有配置此插件，`dataText` 属性将无法正确传递，导致文本无法渲染到 Canvas
- `dataText` 属性必须是驼峰，否则无法映射为dataset需要的格式
- 配置后需要重新启动开发服务器
- 此配置对所有使用了这些组件的页面都会生效

## 🚀 快速开始

### 基础用法

```vue
<template>
  <!-- 1. 定义要转换的 WXML 结构 -->
  <view class="wxml2canvas-container poster-template">
    <view class="poster-background">
      <!-- 图片元素 -->
      <image 
        class="wxml2canvas-item poster-image" 
        :src="imageUrl" 
        mode="aspectFill" 
      />
      
      <!-- 文本元素 -->
      <view 
        class="wxml2canvas-item poster-title" 
        :dataText="title"
      >
        {{ title }}
      </view>
    </view>
  </view>

  <!-- 2. WXML2Canvas 组件 -->
  <WXML2Canvas ref="wxml2canvasRef" />
</template>

<script setup>
import { ref, getCurrentInstance } from 'vue'
import WXML2Canvas from '@/components/WXML2Canvas/index.vue'

const wxml2canvasRef = ref(null)
const instance = getCurrentInstance()

// 生成图片
const generateImage = async () => {
  try {
    // 绘制 Canvas
    await wxml2canvasRef.value.draw(instance.ctx)
    
    // 导出图片
    const imagePath = await wxml2canvasRef.value.toTempFilePath()
    console.log('生成的图片路径:', imagePath)
    
    return imagePath
  } catch (error) {
    console.error('生成图片失败:', error)
  }
}
</script>

<style>
.poster-template {
  position: fixed;
  top: -9999px;
  left: -9999px;
  width: 750rpx;
  height: 1334rpx;
  background: #ffffff;
}
/* 其他样式... */
</style>
```

### 高级用法 - 海报生成器

参考 `PosterGenerator.vue` 组件的完整实现：

```vue
<template>
  <!-- 复杂的海报模板 -->
  <view class="wxml2canvas-container poster-template">
    <view class="poster-background">
      <!-- 商品图片 -->
      <image
        class="wxml2canvas-item poster-main-image"
        :src="goodInfo?.mainImage?.[0] || ''"
        mode="aspectFill"
      />
      
      <!-- 商品信息 -->
      <view class="poster-info-section">
        <view 
          class="wxml2canvas-item poster-title" 
          :dataText="goodInfo?.name || '商品详情'"
        >
          {{ goodInfo?.name || "商品详情" }}
        </view>
        
        <view 
          class="wxml2canvas-item poster-price" 
          :dataText="`¥${goodInfo?.price}`"
        >
          ¥{{ goodInfo?.price }}
        </view>
      </view>
      
      <!-- 二维码 -->
      <image
        class="wxml2canvas-item poster-qr"
        :src="qrCodeUrl"
        mode="aspectFit"
      />
    </view>
  </view>

  <WXML2Canvas v-if="isVisible" ref="wxml2canvasRef" />
</template>

<script setup>
const generatePoster = async () => {
  try {
    // 1. 检查元素是否存在
    const checkElements = () => {
      return new Promise(resolve => {
        const query = Taro.createSelectorQuery()
        query.selectAll('.wxml2canvas-container').boundingClientRect()
        query.selectAll('.wxml2canvas-item').boundingClientRect()
        
        const timeoutId = setTimeout(() => {
          resolve({ containers: [], items: [] })
        }, 3000)
        
        query.exec(res => {
          clearTimeout(timeoutId)
          resolve({
            containers: res[0] || [],
            items: res[1] || []
          })
        })
      })
    }

    const elementCheck = await checkElements()
    if (elementCheck.containers.length === 0) {
      throw new Error('未找到海报模板容器')
    }

    // 2. 绘制 Canvas（带超时保护）
    const drawPromise = wxml2canvasRef.value.draw(instance.ctx)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('海报生成超时（30秒）')), 30000)
    })

    await Promise.race([drawPromise, timeoutPromise])

    // 3. 导出图片
    const posterPath = await wxml2canvasRef.value.toTempFilePath()
    return posterPath
    
  } catch (error) {
    console.error('生成海报失败:', error)
    throw error
  }
}
</script>
```

## 📋 API 参考

### Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `containerClass` | String | `'wxml2canvas-container'` | 容器元素的 CSS 类名 |
| `itemClass` | String | `'wxml2canvas-item'` | 可绘制元素的 CSS 类名 |
| `scale` | Number | `1` | 画布缩放比例 |
| `offscreen` | Boolean | `false` | 是否使用离屏渲染 |

### Methods

#### `draw(page, component)`
绘制 WXML 结构到 Canvas

- **参数**：
  - `page`: 页面实例（Taro 环境下可传 `instance.ctx`）
  - `component`: 组件实例（可选）
- **返回值**：`Promise<void>`

#### `toTempFilePath(original = true)`
将 Canvas 导出为临时图片文件

- **参数**：
  - `original`: 是否保持原始尺寸
- **返回值**：`Promise<string>` - 图片临时路径

#### `toDataURL()`
将 Canvas 转换为 base64 数据

- **返回值**：`string` - base64 数据

#### `getImageData()`
获取 Canvas 图像数据

- **返回值**：`ImageData` - 图像数据对象

## 🎨 样式规范

### 容器元素
使用 `wxml2canvas-container` 类标识容器：

```html
<view class="wxml2canvas-container">
  <!-- 内容 -->
</view>
```

### 可绘制元素
使用 `wxml2canvas-item` 类标识可绘制元素：

```html
<!-- 文本元素 -->
<view class="wxml2canvas-item" dataText="文本内容">
  文本内容
</view>

<!-- 图片元素 -->
<image class="wxml2canvas-item" src="图片路径" />

<!-- 图标文本 -->
<view class="wxml2canvas-item" dataIcon="图标内容">
  图标内容
</view>
```

### 文本绑定
支持多种文本绑定方式：

```html
<!-- 方式1: dataText 属性（推荐） -->
<view class="wxml2canvas-item" :dataText="dynamicText">
  {{ dynamicText }}
</view>

<!-- 方式2: dataIcon 属性（用于图标字体） -->
<view class="wxml2canvas-item" :dataIcon="iconText">
  {{ iconText }}
</view>

<!-- 方式3: 元素内容 -->
<view class="wxml2canvas-item">
  直接的文本内容
</view>
```

**⚠️ 重要说明：**
- `dataText` 和 `dataIcon` 属性需要配合 `@tarojs/plugin-inject` 插件才能正常工作
- 推荐优先使用 `dataText` 方式，因为它能确保文本内容正确传递到 Canvas 绘制逻辑
- 如果使用动态内容，必须使用 `:data-text="variable"` 的绑定语法

**文本优先级：**
Canvas 绘制时会按以下优先级查找文本内容：
1. `element.dataset.icon` (最高优先级)
2. `element.dataset.text`
3. `element.textContent` (最低优先级)

## 🔧 高级配置

### 自定义类名

```vue
<WXML2Canvas 
  container-class="my-container"
  item-class="my-item"
  :scale="2"
  :offscreen="true"
/>
```

### 离屏渲染

启用离屏渲染可以提升性能，特别适合复杂的海报生成：

```vue
<WXML2Canvas :offscreen="true" />
```

### 高清输出

通过设置 `scale` 属性可以生成高清图片：

```vue
<WXML2Canvas :scale="2" />
```

## 🛠️ 最佳实践

### 1. 元素检查
在绘制前检查元素是否存在：

```javascript
const checkElements = async () => {
  const query = Taro.createSelectorQuery()
  query.selectAll('.wxml2canvas-container').boundingClientRect()
  query.selectAll('.wxml2canvas-item').boundingClientRect()
  
  return new Promise(resolve => {
    query.exec(res => {
      resolve({
        containers: res[0] || [],
        items: res[1] || []
      })
    })
  })
}
```

### 2. 超时保护
为长时间的绘制操作添加超时保护：

```javascript
const drawWithTimeout = async () => {
  const drawPromise = wxml2canvasRef.value.draw(instance.ctx)
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('绘制超时')), 30000)
  })
  
  return Promise.race([drawPromise, timeoutPromise])
}
```

### 3. 错误处理
完善的错误处理机制：

```javascript
try {
  await wxml2canvasRef.value.draw(instance.ctx)
  const imagePath = await wxml2canvasRef.value.toTempFilePath()
  return imagePath
} catch (error) {
  console.error('生成失败:', error)
  Taro.showToast({
    title: '生成失败',
    icon: 'none'
  })
}
```

### 4. 样式隔离
将海报模板样式与页面样式隔离：

```css
.poster-template {
  position: fixed;
  top: -9999px;
  left: -9999px;
  /* 确保不影响页面布局 */
}
```

## 🐛 常见问题

### Q: 生成的图片为空白？
A: 检查以下几点：
1. 确保容器和元素都添加了正确的类名
2. 确保图片资源已加载完成
3. 检查元素是否正确渲染到页面
4. **检查是否正确配置了 `@tarojs/plugin-inject` 插件**

### Q: 文本没有显示？
A: 检查以下几点：
1. 确保文本元素设置了 `dataText` 属性或包含文本内容
2. **确保已配置 `@tarojs/plugin-inject` 插件**，否则 `dataText` 属性无法正确传递
3. 检查 `dataText` 的绑定语法是否正确：`:dataText="textContent"`

### Q: `dataText` 属性不生效？
A: 这通常是因为没有配置 `@tarojs/plugin-inject` 插件导致的：
1. 在 `config/index.ts` 中添加插件配置
2. 重新启动开发服务器
3. 确保插件配置中包含了 `Text` 和 `View` 组件的 `dataText` 映射

### Q: 图片显示不正确？
A: 检查图片的 `mode` 属性设置是否正确

### Q: 在 Taro 环境下报错？
A: 确保传递正确的页面实例：`wxml2canvasRef.value.draw(instance.ctx)`

### Q: 控制台出现 "dataset 中没有找到 text 属性" 的警告？
A: 这表明 `@tarojs/plugin-inject` 插件配置不正确或未生效：
1. 检查插件配置是否正确
2. 确认是否重新启动了开发服务器
3. 检查元素是否正确使用了 `:dataText` 绑定

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

> 💡 **来源**： 项目基础版本来自 [wxml2canvas2d](https://github.com/ChrisChan13/wxml2canvas-2d)
