# 样式系统

Less 样式开发规范和设计变量使用指南。

## 设计变量

### 导入变量

```less
@import "@/styles/variables.less";

.my-component {
  color: @text-color;
  padding: @spacing-md;
}
```

### 颜色变量

```less
// 主色
@primary-color: #1890ff;
@success-color: #52c41a;
@warning-color: #faad14;
@error-color: #f5222d;

// 文字色
@text-color: #333333;
@text-color-secondary: #666666;
@text-color-tertiary: #999999;
@text-color-disabled: #cccccc;

// 背景色
@bg-color: #f5f5f5;
@bg-color-light: #fafafa;
@bg-color-white: #ffffff;

// 边框色
@border-color: #e8e8e8;
@border-color-light: #f0f0f0;
```

### 间距变量

```less
@spacing-xs: 8rpx;
@spacing-sm: 16rpx;
@spacing-md: 24rpx;
@spacing-lg: 32rpx;
@spacing-xl: 48rpx;
```

### 字体变量

```less
// 字号
@font-size-xs: 20rpx;
@font-size-sm: 24rpx;
@font-size-md: 28rpx;
@font-size-lg: 32rpx;
@font-size-xl: 36rpx;

// 行高
@line-height-base: 1.5;
@line-height-tight: 1.2;
@line-height-loose: 1.8;

// 字重
@font-weight-normal: 400;
@font-weight-medium: 500;
@font-weight-bold: 700;
```

### 圆角变量

```less
@border-radius-sm: 4rpx;
@border-radius-md: 8rpx;
@border-radius-lg: 16rpx;
@border-radius-xl: 24rpx;
@border-radius-round: 999rpx;
```

### 阴影变量

```less
@box-shadow-sm: 0 2rpx 8rpx rgba(0, 0, 0, 0.08);
@box-shadow-md: 0 4rpx 16rpx rgba(0, 0, 0, 0.12);
@box-shadow-lg: 0 8rpx 24rpx rgba(0, 0, 0, 0.16);
```

## Mixins

### 导入 Mixins

```less
@import "@/styles/mixins.less";

.my-component {
  .text-ellipsis();
}
```

### 文本省略

```less
// 单行省略
.text-ellipsis();

// 使用示例
.title {
  .text-ellipsis();
  font-size: @font-size-lg;
}
```

```less
// 多行省略
.multi-line-ellipsis(@lines);

// 使用示例
.description {
  .multi-line-ellipsis(2);  // 2行省略
}
```

### 1px 边框

```less
.border-1px(@color, @direction);

// 使用示例
.item {
  .border-1px(@border-color, bottom);  // 底部 1px 边框
}

// 方向选项: top, right, bottom, left, all
```

### 安全区域

```less
// 底部安全区域
.safe-area-bottom();

// 使用示例
.footer {
  position: fixed;
  bottom: 0;
  .safe-area-bottom();
}
```

```less
// 顶部安全区域
.safe-area-top();

// 使用示例
.header {
  position: fixed;
  top: 0;
  .safe-area-top();
}
```

### Flex 布局

```less
// 水平居中
.flex-center();

// 使用示例
.container {
  .flex-center();
  height: 200rpx;
}
```

```less
// 垂直居中
.flex-align-center();

// 水平居中
.flex-justify-center();

// 两端对齐
.flex-between();

// 垂直方向
.flex-column();
```

## 单位使用

### rpx（推荐）

基于 750 设计稿自动转换：

```less
.box {
  width: 750rpx;   // 全屏宽度
  height: 200rpx;
  padding: 24rpx;
}
```

- **小程序**: 直接使用 rpx
- **H5**: 自动转换为 rem

### px（特殊情况）

不需要缩放的固定尺寸：

```less
.border {
  border: 1px solid @border-color;  // 固定 1px 边框
}

.icon {
  width: 24px;   // 固定图标大小
  height: 24px;
}
```

## 常用样式模式

### 卡片样式

```less
.card {
  background: @bg-color-white;
  border-radius: @border-radius-lg;
  padding: @spacing-lg;
  box-shadow: @box-shadow-sm;
}
```

### 列表项样式

```less
.list-item {
  display: flex;
  align-items: center;
  padding: @spacing-md @spacing-lg;
  background: @bg-color-white;
  border-bottom: 1px solid @border-color;
  
  &:active {
    background: @bg-color-light;
  }
  
  .item-icon {
    width: 80rpx;
    height: 80rpx;
    margin-right: @spacing-md;
    border-radius: @border-radius-md;
  }
  
  .item-content {
    flex: 1;
    
    .item-title {
      font-size: @font-size-lg;
      color: @text-color;
      .text-ellipsis();
    }
    
    .item-desc {
      margin-top: 8rpx;
      font-size: @font-size-sm;
      color: @text-color-secondary;
      .multi-line-ellipsis(2);
    }
  }
  
  .item-arrow {
    width: 32rpx;
    height: 32rpx;
    margin-left: @spacing-sm;
  }
}
```

### 按钮样式

```less
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 88rpx;
  padding: 0 @spacing-lg;
  font-size: @font-size-md;
  border-radius: @border-radius-lg;
  transition: all 0.3s;
  
  &.btn-primary {
    background: @primary-color;
    color: #fff;
    
    &:active {
      opacity: 0.8;
    }
  }
  
  &.btn-default {
    background: @bg-color-white;
    color: @text-color;
    border: 1px solid @border-color;
    
    &:active {
      background: @bg-color-light;
    }
  }
  
  &.btn-disabled {
    opacity: 0.5;
    pointer-events: none;
  }
}
```

### 表单样式

```less
.form {
  .form-item {
    display: flex;
    align-items: center;
    padding: @spacing-md @spacing-lg;
    background: @bg-color-white;
    border-bottom: 1px solid @border-color;
    
    .form-label {
      width: 160rpx;
      font-size: @font-size-md;
      color: @text-color;
    }
    
    .form-input {
      flex: 1;
      font-size: @font-size-md;
      color: @text-color;
    }
  }
}
```

## 平台特定样式

### 条件编译

```less
// 仅微信小程序
/* #ifdef WEAPP */
.weapp-only {
  background: red;
}
/* #endif */

// 仅 H5
/* #ifdef H5 */
.h5-only {
  background: blue;
}
/* #endif */

// 排除某平台
/* #ifndef H5 */
.not-h5 {
  background: green;
}
/* #endif */
```

### 平台样式文件

```less
// src/styles/platform.less
@import "./variables.less";

// 微信小程序特定样式
/* #ifdef WEAPP */
.page {
  min-height: 100vh;
}
/* #endif */

// H5 特定样式
/* #ifdef H5 */
.page {
  max-width: 750px;
  margin: 0 auto;
}
/* #endif */
```

## 响应式设计

### 屏幕尺寸适配

```less
.container {
  width: 750rpx;
  max-width: 100%;
  margin: 0 auto;
}

.content {
  padding: @spacing-md;
  
  // 小屏幕
  @media (max-width: 375px) {
    padding: @spacing-sm;
  }
  
  // 大屏幕
  @media (min-width: 768px) {
    padding: @spacing-lg;
  }
}
```

### 刘海屏适配

```less
.navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  .safe-area-top();
}

.footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  .safe-area-bottom();
}
```

## 性能优化

### 避免深层嵌套

```less
// ❌ 避免
.page {
  .container {
    .content {
      .item {
        .title {
          color: red;
        }
      }
    }
  }
}

// ✅ 推荐
.page-title {
  color: red;
}
```

### 使用变量

```less
// ❌ 避免硬编码
.box {
  padding: 24rpx;
  color: #333333;
}

// ✅ 使用变量
.box {
  padding: @spacing-md;
  color: @text-color;
}
```

## 最佳实践

### ✅ 推荐

```less
// 1. 导入设计变量
@import "@/styles/variables.less";
@import "@/styles/mixins.less";

// 2. 使用 rpx 单位
.box {
  width: 750rpx;
  height: 200rpx;
}

// 3. 使用设计变量
.text {
  color: @text-color;
  font-size: @font-size-md;
}

// 4. 使用 Mixins
.title {
  .text-ellipsis();
}

// 5. BEM 命名
.user-card {
  &__avatar { }
  &__name { }
  &__desc { }
  
  &--active { }
  &--disabled { }
}
```

### ❌ 避免

```less
// 1. 避免硬编码
.box {
  color: #333333;  // ❌
  padding: 24rpx;  // ❌
}

// 2. 避免使用 ID 选择器
#header {  // ❌
  color: red;
}

// 3. 避免过度嵌套
.a .b .c .d .e {  // ❌
  color: red;
}
```
