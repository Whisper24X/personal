# 工具函数规范

常用工具函数位于 `src/utils/`，按功能拆分单文件。

## 价格处理（`formatPrice.ts`）

```ts
import { centsToYuan, formatPrice, formatPriceFromCents } from "@/utils/formatPrice"

// 分 → 元（number）
centsToYuan(cents: number | string): number

// 格式化价格（去末尾零，最多两位小数）
formatPrice(price: number | string): string

// 组合方法：分 → 元 → 格式化字符串
formatPriceFromCents(cents: number | string): string

// 示例
formatPriceFromCents(9900)   // → "99"
formatPriceFromCents(9950)   // → "99.5"
```

## 样式适配（`style.ts`）

```ts
import {
  isIOS,
  isAndroid,
  isIPhoneX,
  statusBarHeight,
  navBarHeight,
  topAreaHeight,
  safeAreaBottom,
  pxToRpx,
  rpxToPx,
  getAdaptiveStyle,
} from "@/utils/style"

// 设备检测
isIOS         // 是否 iOS
isAndroid     // 是否 Android
isIPhoneX     // 是否刘海屏

// 尺寸（px）
statusBarHeight    // 状态栏高度
navBarHeight       // 导航栏高度（44px 固定）
topAreaHeight      // 顶部安全区 = statusBarHeight + navBarHeight
safeAreaBottom     // 底部安全区高度

// 单位转换
pxToRpx(px: number): number
rpxToPx(rpx: number): number

// 批量样式转换（数字自动加 rpx 后缀）
getAdaptiveStyle({ width: 100, height: 200, top: 10 })
// → { width: "100rpx", height: "200rpx", top: "10rpx" }
```

## 状态栏（`statusBar.ts`）

```ts
import { getStatusBarHeight } from "@/utils/statusBar"

getStatusBarHeight(): number  // 获取状态栏高度（px）
```

## 价格计算（`priceCalculator.ts`）

```ts
import { calculateDiscountedPrice } from "@/utils/priceCalculator"

// 折扣价格计算（参见 priceCalculator.README.md 详细说明）
calculateDiscountedPrice(price: number, discount: number): number
```

## 日期处理

- `formatDate.ts`：格式化、解析等
- 统一使用项目内封装，不引入第三方日期库
