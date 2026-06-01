# 金额计算工具 (priceCalculator)

## 📖 简介

这是一个专门用于处理金额计算的工具库，解决 JavaScript 浮点数精度问题（如 `0.1 + 0.2 = 0.30000000000000004`）。

所有涉及金额计算的场景都应该使用此工具，确保计算结果准确无误。

## 🎯 核心功能

### 1. 基础数学运算

```typescript
import { add, subtract, multiply, divide } from "@/utils/priceCalculator"

// 加法
add(0.1, 0.2) // 0.3 (而不是 0.30000000000000004)

// 减法
subtract(0.3, 0.1) // 0.2 (而不是 0.19999999999999998)

// 乘法
multiply(0.07, 100) // 7

// 除法
divide(0.3, 0.1) // 3
```

### 2. 业务场景计算

```typescript
import {
  calculateTotal, // 计算总价
  calculateDiscountedPrice, // 计算优惠后价格
  calculateFinalPrice, // 计算订单最终价格
  sum // 求和
} from "@/utils/priceCalculator"

// 计算商品总价（单价 × 数量）
calculateTotal(99.99, 2) // 199.98

// 计算优惠后价格（原价 - 优惠）
calculateDiscountedPrice(299, 50) // 249

// 计算订单最终价格（支持多种优惠）
calculateFinalPrice({
  price: 99.99,
  quantity: 2,
  couponDiscount: 30,
  otherDiscount: 10
}) // 159.98

// 多个金额求和
sum(100.1, 200.2, 50.3) // 350.6
```

### 3. 格式化显示

```typescript
import { formatAmount, formatAmountWithSymbol } from "@/utils/priceCalculator"

// 格式化金额（去除末尾的0）
formatAmount(100) // "100"
formatAmount(100.5) // "100.5"
formatAmount(100.0) // "100"

// 带货币符号
formatAmountWithSymbol(100) // "¥100"
formatAmountWithSymbol(100, "$") // "$100"
```

### 4. 链式调用（高级用法）

```typescript
import { createCalculator } from "@/utils/priceCalculator"

const finalPrice = createCalculator(100) // 基础价格
  .multiply(2) // × 2
  .add(50) // + 50
  .applyCoupon(30) // 应用优惠券
  .applyPercentage(10) // 打9折（优惠10%）
  .min(0) // 确保不小于0
  .getValue() // 获取结果

console.log(finalPrice) // 198
```

## 📝 实际应用场景

### 场景1: 订单确认页面

```vue
<script setup lang="ts">
import { computed } from "vue"
import { calculateDiscountedPrice } from "@/utils/priceCalculator"

const goodInfo = ref({ price: 299 })
const selectedCoupon = ref({ discountAmount: 50 })

// 计算最终价格
const finalPrice = computed(() => {
  const price = goodInfo.value?.price || 0
  const discount = selectedCoupon.value?.discountAmount || 0
  return calculateDiscountedPrice(price, discount)
})
</script>

<template>
  <view>实付金额: ¥{{ finalPrice }}</view>
</template>
```

### 场景2: 购物车总价计算

```typescript
import { calculateTotal, sum } from "@/utils/priceCalculator"

interface CartItem {
  price: number
  quantity: number
}

const cartItems: CartItem[] = [
  { price: 99.99, quantity: 2 },
  { price: 49.5, quantity: 1 }
]

// 计算每个商品的小计
const itemTotals = cartItems.map(item => calculateTotal(item.price, item.quantity))

// 计算总价
const totalPrice = sum(...itemTotals)
console.log(totalPrice) // 249.48
```

### 场景3: 多种优惠叠加

```typescript
import { calculateFinalPrice } from "@/utils/priceCalculator"

const result = calculateFinalPrice({
  price: 100, // 单价
  quantity: 3, // 数量
  couponDiscount: 50, // 优惠券
  otherDiscount: 20 // 满减/活动优惠
})

console.log(result) // 230
// 计算过程: 100 × 3 - 50 - 20 = 230
```

### 场景4: 价格比较

```typescript
import { isGreaterThan, isLessThan, isEqual } from "@/utils/priceCalculator"

const price1 = 99.99
const price2 = 100.0

isGreaterThan(price2, price1) // true
isLessThan(price1, price2) // true
isEqual(99.99, 99.99) // true
```

## 🔧 API 文档

### 基础运算

| 函数             | 参数     | 返回值 | 说明 |
| ---------------- | -------- | ------ | ---- |
| `add(a, b)`      | 两个数字 | number | 加法 |
| `subtract(a, b)` | 两个数字 | number | 减法 |
| `multiply(a, b)` | 两个数字 | number | 乘法 |
| `divide(a, b)`   | 两个数字 | number | 除法 |

### 业务计算

| 函数                                        | 参数           | 返回值 | 说明           |
| ------------------------------------------- | -------------- | ------ | -------------- |
| `calculateTotal(price, quantity)`           | 单价, 数量     | number | 计算总价       |
| `calculateDiscountedPrice(price, discount)` | 原价, 优惠金额 | number | 计算优惠后价格 |
| `calculateFinalPrice(params)`               | 配置对象       | number | 计算最终价格   |
| `sum(...amounts)`                           | 多个金额       | number | 求和           |

### 格式化

| 函数                                      | 参数       | 返回值 | 说明         |
| ----------------------------------------- | ---------- | ------ | ------------ |
| `formatAmount(amount)`                    | 金额       | string | 格式化金额   |
| `formatAmountWithSymbol(amount, symbol?)` | 金额, 符号 | string | 带符号格式化 |

### 比较

| 函数                        | 参数     | 返回值  | 说明     |
| --------------------------- | -------- | ------- | -------- |
| `isEqual(a, b, precision?)` | 两个金额 | boolean | 是否相等 |
| `isGreaterThan(a, b)`       | 两个金额 | boolean | 是否大于 |
| `isLessThan(a, b)`          | 两个金额 | boolean | 是否小于 |

### 链式调用

```typescript
createCalculator(initialValue)
  .add(num) // 加
  .subtract(num) // 减
  .multiply(num) // 乘
  .divide(num) // 除
  .applyCoupon(discount) // 应用优惠券
  .applyPercentage(pct) // 应用百分比折扣
  .min(minValue) // 最小值
  .max(maxValue) // 最大值
  .getValue() // 获取数字结果
  .toString() // 获取字符串
  .toStringWithSymbol() // 获取带符号字符串
```

## ⚠️ 注意事项

1. **所有金额计算都使用此工具**
   - ❌ 不要: `price * quantity`
   - ✅ 应该: `calculateTotal(price, quantity)`

2. **金额显示时格式化**
   - ❌ 不要: `¥${price}`
   - ✅ 应该: `formatAmountWithSymbol(price)`

3. **比较金额时使用专用函数**
   - ❌ 不要: `price1 === price2`
   - ✅ 应该: `isEqual(price1, price2)`

4. **保持一致性**
   - 项目中所有金额计算都应使用此工具
   - 确保计算精度统一

## 🧪 测试示例

```typescript
// 测试精度问题
console.log(0.1 + 0.2) // 0.30000000000000004
console.log(add(0.1, 0.2)) // 0.3

// 测试业务场景
const order = {
  price: 99.99,
  quantity: 3,
  coupon: 50
}

const total = calculateTotal(order.price, order.quantity) // 299.97
const final = calculateDiscountedPrice(total, order.coupon) // 249.97
```

## 📚 更多示例

详细使用示例请查看 `priceCalculator.example.ts` 文件。

## 🤝 贡献

如果发现计算问题或需要新功能，请及时反馈。
