/**
 * 价格计算工具使用示例
 *
 * 本文件展示了如何使用 priceCalculator 工具类进行各种金额计算
 */

import {
  add,
  subtract,
  multiply,
  divide,
  calculateTotal,
  calculateDiscountedPrice,
  calculateFinalPrice,
  sum,
  formatAmount,
  formatAmountWithSymbol,
  createCalculator
} from "./priceCalculator"

// ========== 基础运算示例 ==========

// 加法 - 解决 0.1 + 0.2 = 0.30000000000000004 的问题
const addResult = add(0.1, 0.2) // 0.3
console.log("加法:", addResult)

// 减法 - 解决 0.3 - 0.1 = 0.19999999999999998 的问题
const subtractResult = subtract(0.3, 0.1) // 0.2
console.log("减法:", subtractResult)

// 乘法 - 解决浮点数乘法精度问题
const multiplyResult = multiply(0.07, 100) // 7
console.log("乘法:", multiplyResult)

// 除法
const divideResult = divide(0.3, 0.1) // 3
console.log("除法:", divideResult)

// ========== 商品价格计算示例 ==========

// 示例1: 计算商品总价（单价 × 数量）
const unitPrice = 99.99
const quantity = 3
const totalPrice = calculateTotal(unitPrice, quantity)
console.log(`单价: ¥${unitPrice}, 数量: ${quantity}, 总价: ¥${totalPrice}`) // 299.97

// 示例2: 计算优惠后价格
const originalPrice = 299.97
const couponDiscount = 50
const discountedPrice = calculateDiscountedPrice(originalPrice, couponDiscount)
console.log(`原价: ¥${originalPrice}, 优惠: ¥${couponDiscount}, 实付: ¥${discountedPrice}`) // 249.97

// 示例3: 计算订单最终价格（包含多种优惠）
const finalPrice = calculateFinalPrice({
  price: 99.99, // 单价
  quantity: 2, // 数量
  couponDiscount: 30, // 优惠券
  otherDiscount: 10 // 其他优惠
})
console.log(`最终价格: ¥${finalPrice}`) // 159.98

// 示例4: 多个金额求和
const amount1 = 100.5
const amount2 = 200.3
const amount3 = 50.2
const totalAmount = sum(amount1, amount2, amount3)
console.log(`总和: ¥${totalAmount}`) // 351

// ========== 实际业务场景示例 ==========

/**
 * 场景1: 订单确认页面 - 计算实付金额
 */
function calculateOrderPrice(goodPrice: number, selectedCoupon: { discountAmount: number } | null) {
  const discount = selectedCoupon?.discountAmount || 0
  const finalPrice = calculateDiscountedPrice(goodPrice, discount)

  return {
    originalPrice: goodPrice,
    discount: discount,
    finalPrice: finalPrice,
    // 格式化显示
    displayOriginal: formatAmountWithSymbol(goodPrice),
    displayDiscount: formatAmountWithSymbol(discount),
    displayFinal: formatAmountWithSymbol(finalPrice)
  }
}

// 使用示例
const orderResult = calculateOrderPrice(299, { discountAmount: 50 })
console.log("订单价格信息:", orderResult)
// {
//   originalPrice: 299,
//   discount: 50,
//   finalPrice: 249,
//   displayOriginal: '¥299',
//   displayDiscount: '¥50',
//   displayFinal: '¥249'
// }

/**
 * 场景2: 购物车 - 计算多个商品的总价
 */
interface CartItem {
  price: number
  quantity: number
}

function calculateCartTotal(items: CartItem[]) {
  const itemTotals = items.map(item => calculateTotal(item.price, item.quantity))
  const total = sum(...itemTotals)

  return {
    total: total,
    displayTotal: formatAmountWithSymbol(total)
  }
}

// 使用示例
const cartItems = [
  { price: 99.99, quantity: 2 },
  { price: 49.5, quantity: 1 },
  { price: 29.9, quantity: 3 }
]
const cartResult = calculateCartTotal(cartItems)
console.log("购物车总价:", cartResult)
// { total: 339.18, displayTotal: '¥339.18' }

/**
 * 场景3: 使用链式调用计算复杂价格
 */
function calculateComplexPrice() {
  const result = createCalculator(100) // 基础价格 100
    .multiply(2) // × 2 = 200
    .add(50) // + 50 = 250
    .applyCoupon(30) // - 优惠券30 = 220
    .applyPercentage(10) // - 10%折扣 = 198
    .min(0) // 确保不小于0
    .getValue()

  return result
}

console.log("复杂计算结果:", calculateComplexPrice()) // 198

/**
 * 场景4: 格式化金额显示
 */
function formatPriceDisplay(price: number) {
  return {
    // 去除末尾0: "100" 而不是 "100.00"
    simple: formatAmount(price),
    // 带货币符号: "¥100"
    withSymbol: formatAmountWithSymbol(price),
    // 自定义符号: "$100"
    withDollar: formatAmountWithSymbol(price, "$")
  }
}

console.log("格式化示例:", formatPriceDisplay(100))
// { simple: '100', withSymbol: '¥100', withDollar: '$100' }

console.log("格式化示例:", formatPriceDisplay(100.5))
// { simple: '100.5', withSymbol: '¥100.5', withDollar: '$100.5' }

// ========== Vue 组件中使用示例 ==========

/**
 * 在 Vue 组件的 computed 属性中使用
 */
/*
import { computed } from 'vue'
import { calculateDiscountedPrice, formatAmountWithSymbol } from '@/utils/priceCalculator'

// 组件中
const goodInfo = ref({ price: 299 })
const selectedCoupon = ref({ discountAmount: 50 })

// 计算最终价格
const finalPrice = computed(() => {
  const discount = selectedCoupon.value?.discountAmount || 0
  return calculateDiscountedPrice(goodInfo.value.price, discount)
})

// 格式化显示
const displayPrice = computed(() => {
  return formatAmountWithSymbol(finalPrice.value)
})
*/

// ========== 在订单页面中的实际应用 ==========

/**
 * 订单确认页面使用示例
 */
/*
// 在 confirm/index.vue 中
import { calculateDiscountedPrice } from '@/utils/priceCalculator'

// 计算最终价格
const finalPrice = computed(() => {
  const price = goodInfo.value?.price || 0
  const discount = selectedCoupon.value?.discountAmount || 0
  return calculateDiscountedPrice(price, discount)
})

// 在模板中显示
<InfoRow label="实付金额">
  <text class="final-price">¥{{ finalPrice }}</text>
</InfoRow>
*/

export {}
