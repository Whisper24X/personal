# 样式系统

Less 样式开发规范和设计变量使用指南。

## 设计变量

### 导入变量

```less
@import '@/styles/variables.less';

.my-component {
  color: @text-color;
  padding: @spacing-md;
}
```

### 颜色变量

```less
// 主题色
@primary-color: #1890ff;
@success-color: #52c41a;
@warning-color: #faad14;
@error-color: #f5222d;

// 业务特殊色（Button 等组件内定义）
// 品牌黄（主操作）: #ffd400 背景，#393548 文字
// 品牌蓝（次级）: #007aff
// 品牌红: #ff3b30
// Modal 紫色: #826eff / #604cea
// TabBar 激活: #393548，默认: #999

// 文字色
@text-color: #333333;
@text-color-secondary: #666666;
@text-color-placeholder: #999999;

// 背景色
@bg-color: #f5f5f5;
@bg-color-light: #fafafa;
@bg-color-dark: #f0f0f0;
@bg-color-white: #ffffff;
// 页面默认背景: #f7f7f9（common.less 定义）

// 边框色
@border-color: #eeeeee;
@border-color-dark: #dddddd;
```

### 间距变量

```less
@spacing-xs: 10rpx;
@spacing-sm: 20rpx;
@spacing-md: 30rpx;
@spacing-lg: 40rpx;
@spacing-xl: 50rpx;
```

### 字体变量

```less
// 字号（rpx，适配小程序）
@font-size-xs: 20rpx; // 极小（辅助信息）
@font-size-sm: 24rpx; // 小（副标题、标签）
@font-size-md: 28rpx; // 中（正文基础，page 默认）
@font-size-lg: 32rpx; // 大（标题、主要内容）
@font-size-xl: 36rpx; // 超大（大标题）

// 字体族（优先级从高到低）
// 正文: PingFangSC, PingFangSC-Regular, AlibabaPuHuiTi_2_55_Regular, SourceHanSansCN-Regular, "HarmonyOS Sans SC Regular", "Helvetica Neue", Helvetica, Arial, "Microsoft Yahei", sans-serif
// 标题/按钮粗体: AlibabaPuHuiTi_2_105_Heavy
// 导航栏标题: "苹方-简"（font-weight: 600）
```

### 圆角变量

```less
@border-radius-sm: 4rpx; // 小圆角（标签、小按钮）
@border-radius-md: 8rpx; // 中圆角（卡片、按钮）
@border-radius-lg: 16rpx; // 大圆角（弹窗、大卡片）

// 特殊值
// 24rpx - InfoCard 卡片圆角
// 50rpx - round 按钮圆角
// 50% - circle 圆形按钮
```

### 阴影变量

```less
@box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.1); // 轻阴影（卡片）
@box-shadow-dark: 0 4rpx 16rpx rgba(0, 0, 0, 0.2); // 深阴影（浮层）

// TabBar: box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.05);
// Button: box-shadow: inset 0px 2px 2px 0px rgba(255, 255, 255, 0.302);
```

### 动画变量

```less
@animation-duration: 0.3s;
@animation-timing-function: ease-in-out;
```

## Mixins

文件：`src/styles/mixins.less`

### 导入 Mixins

```less
@import '@/styles/mixins.less';

.my-component {
  .ellipsis();
}
```

### 1. 1px 边框（解决高清屏 1px 问题）

```less
// 使用方式：.hairline(top/bottom/left/right/border, @color)
.hairline(@position, @color);

// 预定义工具类（common.less 已暴露）
.hairline-top {
  .hairline(top, #eee);
}
.hairline-bottom {
  .hairline(bottom, #eee);
}
.hairline-left {
  .hairline(left, #eee);
}
.hairline-right {
  .hairline(right, #eee);
}
.hairline-all {
  .hairline(border, #eee);
}
```

### 2. 文本省略

```less
// 单行省略
.ellipsis();

// 多行省略
.multi-ellipsis(@line: 2);

// 工具类（common.less 已暴露）
.ellipsis      // 单行
.ellipsis-2    // 两行
.ellipsis-3    // 三行;
```

### 3. 安全区适配

```less
.safe-area-inset-bottom {
  padding-bottom: constant(safe-area-inset-bottom);
  padding-bottom: env(safe-area-inset-bottom);
}

// 工具类
.safe-bottom {
  .safe-area-inset-bottom();
}
```

### 4. Flex 布局

```less
// 全兼容居中（带 -webkit- 前缀）
.flex-center();

// 工具类（common.less 已暴露）
.flex           // display: flex
.flex-column    // flex-direction: column
.flex-center    // flex + 居中
.flex-between   // flex + space-between
.flex-around    // flex + space-around
.flex-1         // flex: 1
```

### 5. 清除浮动

```less
.clearfix();
```

---

## 通用工具类（common.less）

`src/styles/common.less` 提供轻量原子工具类，可直接在模板中组合使用。

| 类名                                  | 说明                   |
| ------------------------------------- | ---------------------- |
| `.flex`                               | `display: flex`        |
| `.flex-column`                        | 纵向 flex              |
| `.flex-center`                        | flex + 居中            |
| `.flex-between`                       | flex + 两端对齐        |
| `.flex-around`                        | flex + 均匀分布        |
| `.flex-1`                             | `flex: 1`              |
| `.ellipsis`                           | 单行文本省略           |
| `.ellipsis-2`                         | 两行省略               |
| `.ellipsis-3`                         | 三行省略               |
| `.hairline-top/bottom/left/right/all` | 1px 边框（物理 0.5px） |
| `.safe-bottom`                        | 底部安全区 padding     |
| `.m-{10/20/30}`                       | 全方向 margin          |
| `.mt/mb/ml/mr-{10/20/30}`             | 单方向 margin          |
| `.p-{10/20/30}`                       | 全方向 padding         |
| `.pt/pb/pl/pr-{10/20/30}`             | 单方向 padding         |

## 单位使用

### rpx（推荐）

基于 750 设计稿自动转换：

```less
.box {
  width: 750rpx; // 全屏宽度
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
  border: 1px solid @border-color; // 固定 1px 边框
}

.icon {
  width: 24px; // 固定图标大小
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
  box-shadow: @box-shadow;
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
      .ellipsis();
    }

    .item-desc {
      margin-top: 8rpx;
      font-size: @font-size-sm;
      color: @text-color-secondary;
      .multi-ellipsis(2);
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
@import './variables.less';

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
  padding-top: constant(safe-area-inset-top);
  padding-top: env(safe-area-inset-top);
}

.footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  .safe-area-inset-bottom();
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
@import '@/styles/variables.less';
@import '@/styles/mixins.less';

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
  .ellipsis();
}

// 5. BEM 命名
.user-card {
  &__avatar {
  }
  &__name {
  }
  &__desc {
  }

  &--active {
  }
  &--disabled {
  }
}
```

### ❌ 避免

```less
// 1. 避免硬编码
.box {
  color: #333333; // ❌
  padding: 24rpx; // ❌
}

// 2. 避免使用 ID 选择器
#header {
  // ❌
  color: red;
}

// 3. 避免过度嵌套
.a .b .c .d .e {
  // ❌
  color: red;
}
```
