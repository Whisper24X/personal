# PromoBanner 促销横幅组件

一个高度可定制的促销横幅组件，支持多种样式类型和交互功能。

## 功能特性

- 🎨 多种预设样式类型（default、success、warning、error、info）
- 🖼️ 支持图片图标和文字图标
- 📝 支持主标题和副标题
- 🎯 支持点击交互
- 🎛️ 高度可定制的样式属性
- 📱 响应式设计，适配小程序

## 基础用法

```vue
<template>
  <!-- 基础用法 -->
  <PromoBanner text="满500打九折,最多减300" />
  
  <!-- 带副标题 -->
  <PromoBanner 
    text="限时特惠" 
    sub-text="仅限今日有效" 
  />
  
  <!-- 不同类型 -->
  <PromoBanner 
    text="活动成功" 
    type="success" 
  />
  
  <!-- 可点击 -->
  <PromoBanner 
    text="点击查看详情" 
    clickable 
    show-arrow 
    @click="handleClick" 
  />
</template>
```

## Props

### 基础内容
| 参数 | 说明 | 类型 | 默认值 |
|------|------|------|--------|
| text | 主标题文字 | string | '满500打九折,最多减300' |
| subText | 副标题文字 | string | '' |

### 图标相关
| 参数 | 说明 | 类型 | 默认值 |
|------|------|------|--------|
| showIcon | 是否显示图标 | boolean | true |
| iconUrl | 图标图片URL | string | 默认礼物图标 |
| iconText | 图标文字（当iconUrl为空时显示） | string | '' |

### 样式相关
| 参数 | 说明 | 类型 | 默认值 |
|------|------|------|--------|
| type | 样式类型 | 'default' \| 'success' \| 'warning' \| 'error' \| 'info' | 'default' |
| backgroundColor | 背景色 | string | '' |
| textColor | 主标题颜色 | string | '' |
| subTextColor | 副标题颜色 | string | '' |
| borderRadius | 圆角 | string | '' |
| padding | 内边距 | string | '' |
| margin | 外边距 | string | '' |

### 布局相关
| 参数 | 说明 | 类型 | 默认值 |
|------|------|------|--------|
| showArrow | 是否显示右侧箭头 | boolean | false |
| clickable | 是否可点击 | boolean | false |

### 自定义样式
| 参数 | 说明 | 类型 | 默认值 |
|------|------|------|--------|
| customStyle | 自定义样式对象 | Record<string, any> | {} |

## Events

| 事件名 | 说明 | 参数 |
|--------|------|------|
| click | 点击事件（需要设置clickable为true） | event: Event |

## 样式类型

### default（默认）
- 背景色：浅红色 (#ffeaeb)
- 文字色：红色 (#fa5a65)

### success（成功）
- 背景色：浅绿色 (#e8f5e8)
- 文字色：绿色 (#52c41a)

### warning（警告）
- 背景色：浅橙色 (#fff7e6)
- 文字色：橙色 (#fa8c16)

### error（错误）
- 背景色：浅红色 (#ffebe6)
- 文字色：红色 (#ff4d4f)

### info（信息）
- 背景色：浅蓝色 (#e6f7ff)
- 文字色：蓝色 (#1890ff)

## 使用示例

### 1. 基础促销横幅
```vue
<PromoBanner text="满500打九折,最多减300" />
```

### 2. 成功提示横幅
```vue
<PromoBanner 
  text="订单提交成功" 
  sub-text="预计3-5个工作日送达" 
  type="success" 
/>
```

### 3. 警告横幅
```vue
<PromoBanner 
  text="库存不足" 
  sub-text="仅剩3件" 
  type="warning" 
/>
```

### 4. 可点击横幅
```vue
<PromoBanner 
  text="查看活动详情" 
  clickable 
  show-arrow 
  @click="navigateToActivity" 
/>
```

### 5. 自定义样式
```vue
<PromoBanner 
  text="自定义横幅" 
  :custom-style="{
    background: 'linear-gradient(45deg, #ff6b6b, #4ecdc4)',
    color: '#fff',
    borderRadius: '16rpx'
  }"
/>
```

### 6. 文字图标
```vue
<PromoBanner 
  text="新用户专享" 
  icon-text="NEW" 
  type="info" 
/>
```

## 注意事项

1. 当同时设置了 `iconUrl` 和 `iconText` 时，优先显示 `iconUrl`
2. 自定义样式会覆盖预设样式
3. 点击事件需要设置 `clickable` 为 `true` 才会生效
4. 组件使用 rpx 单位，自动适配不同屏幕尺寸
