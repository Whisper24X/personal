# CustomNavBar 自定义导航栏组件

## 功能特性

- 支持自定义标题
- 支持返回按钮显示/隐藏
- 支持右侧按钮（文字或图标）
- 自动适配状态栏高度
- 支持自定义背景图片
- 支持自定义字体颜色
- 支持自定义背景颜色
- 支持自定义左侧按钮图片
- 提供事件回调

## 使用方法

### 基础用法

```vue
<template>
  <view class="page">
    <custom-nav-bar title="页面标题" />
    <!-- 页面内容 -->
  </view>
</template>

<script setup>
import CustomNavBar from "@/components/CustomNavBar/index.vue"
</script>
```

### 带右侧按钮

```vue
<template>
  <view class="page">
    <custom-nav-bar title="页面标题" right-text="保存" @right-click="handleSave" />
    <!-- 页面内容 -->
  </view>
</template>

<script setup>
import CustomNavBar from "@/components/CustomNavBar/index.vue"

const handleSave = () => {
  console.log("保存按钮被点击")
}
</script>
```

### 带右侧图标

```vue
<template>
  <view class="page">
    <custom-nav-bar
      title="页面标题"
      right-icon="/assets/icons/more.png"
      @right-click="handleMore"
    />
    <!-- 页面内容 -->
  </view>
</template>
```

### 隐藏返回按钮

```vue
<template>
  <view class="page">
    <custom-nav-bar title="首页" :show-back="false" />
    <!-- 页面内容 -->
  </view>
</template>
```

### 自定义样式

```vue
<template>
  <view class="page">
    <custom-nav-bar
      title="自定义导航栏"
      text-color="#333333"
      background-color="#f8f8f8"
      left-icon="/assets/icons/back-black.png"
    />
    <!-- 页面内容 -->
  </view>
</template>
```

## Props

| 属性名          | 类型    | 默认值                        | 说明                   |
| --------------- | ------- | ----------------------------- | ---------------------- |
| title           | string  | "洋葱星球研学"                | 导航栏标题             |
| showBack        | boolean | true                          | 是否显示返回按钮       |
| rightText       | string  | ""                            | 右侧按钮文字           |
| rightIcon       | string  | ""                            | 右侧按钮图标路径       |
| backgroundImage | string  | ""                            | 自定义背景图片（可选） |
| textColor       | string  | "#ffffff"                     | 字体颜色               |
| backgroundColor | string  | ""                            | 背景颜色               |
| leftIcon        | string  | "../../assets/icons/back.png" | 左侧按钮图标路径       |

## Events

| 事件名     | 说明             | 回调参数 |
| ---------- | ---------------- | -------- |
| back       | 返回按钮点击事件 | -        |
| rightClick | 右侧按钮点击事件 | -        |

## 样式说明

- 导航栏高度：状态栏高度 + 88rpx
- 背景图片：使用默认的 navBar-bg.png
- 默认标题颜色：白色 (#ffffff)
- 字体：苹方-简，32px，600字重
- 支持通过 props 自定义字体颜色、背景颜色和左侧按钮图片
