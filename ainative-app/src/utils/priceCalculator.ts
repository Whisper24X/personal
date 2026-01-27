/**
 * 金额计算工具类
 * 解决 JavaScript 浮点数精度问题
 * 所有金额计算统一使用此工具进行处理
 */

/**
 * 浮点数精度处理 - 将数字转换为整数进行计算
 * @param num 数字
 * @returns 放大后的整数和放大倍数
 */
const toInteger = (num: number): { value: number; times: number } => {
  const numStr = num.toString()
  const dotPos = numStr.indexOf(".")
  const len = dotPos > -1 ? numStr.length - dotPos - 1 : 0
  const times = Math.pow(10, len)
  return {
    value: Math.round(num * times),
    times
  }
}

/**
 * 加法运算
 * @param a 加数
 * @param b 加数
 * @returns 和
 * @example add(0.1, 0.2) // 0.3
 */
export const add = (a: number, b: number): number => {
  const aInfo = toInteger(a)
  const bInfo = toInteger(b)
  const maxTimes = Math.max(aInfo.times, bInfo.times)

  const aValue = aInfo.value * (maxTimes / aInfo.times)
  const bValue = bInfo.value * (maxTimes / bInfo.times)

  return (aValue + bValue) / maxTimes
}

/**
 * 减法运算
 * @param a 被减数
 * @param b 减数
 * @returns 差
 * @example subtract(0.3, 0.1) // 0.2
 */
export const subtract = (a: number, b: number): number => {
  const aInfo = toInteger(a)
  const bInfo = toInteger(b)
  const maxTimes = Math.max(aInfo.times, bInfo.times)

  const aValue = aInfo.value * (maxTimes / aInfo.times)
  const bValue = bInfo.value * (maxTimes / bInfo.times)

  return (aValue - bValue) / maxTimes
}

/**
 * 乘法运算
 * @param a 乘数
 * @param b 乘数
 * @returns 积
 * @example multiply(0.1, 0.2) // 0.02
 */
export const multiply = (a: number, b: number): number => {
  const aInfo = toInteger(a)
  const bInfo = toInteger(b)

  return (aInfo.value * bInfo.value) / (aInfo.times * bInfo.times)
}

/**
 * 除法运算
 * @param a 被除数
 * @param b 除数
 * @returns 商
 * @example divide(0.3, 0.1) // 3
 */
export const divide = (a: number, b: number): number => {
  if (b === 0) {
    throw new Error("除数不能为0")
  }

  const aInfo = toInteger(a)
  const bInfo = toInteger(b)

  return (aInfo.value / bInfo.value) * (bInfo.times / aInfo.times)
}

/**
 * 保留指定小数位数（四舍五入）
 * @param num 数字
 * @param decimals 小数位数，默认2位
 * @returns 处理后的数字
 * @example toFixed(1.235, 2) // 1.24
 */
export const toFixed = (num: number, decimals: number = 2): number => {
  const times = Math.pow(10, decimals)
  return Math.round(multiply(num, times)) / times
}

/**
 * 计算总价（单价 × 数量）
 * @param price 单价
 * @param quantity 数量
 * @returns 总价
 */
export const calculateTotal = (price: number, quantity: number): number => {
  return toFixed(multiply(price, quantity))
}

/**
 * 计算优惠后价格
 * @param originalPrice 原价
 * @param discount 优惠金额
 * @returns 优惠后价格（最小为0）
 */
export const calculateDiscountedPrice = (originalPrice: number, discount: number): number => {
  const result = subtract(originalPrice, discount)
  return toFixed(Math.max(0, result))
}

/**
 * 计算多个金额的总和
 * @param amounts 金额数组
 * @returns 总和
 */
export const sum = (...amounts: number[]): number => {
  return toFixed(amounts.reduce((total, amount) => add(total, amount), 0))
}

/**
 * 计算订单最终价格
 * @param params 计算参数
 * @param params.price 商品单价
 * @param params.quantity 数量（默认1）
 * @param params.couponDiscount 优惠券折扣金额（默认0）
 * @param params.otherDiscount 其他折扣金额（默认0）
 * @returns 最终价格（最小为0）
 */
export const calculateFinalPrice = (params: {
  price: number
  quantity?: number
  couponDiscount?: number
  otherDiscount?: number
}): number => {
  const { price, quantity = 1, couponDiscount = 0, otherDiscount = 0 } = params

  // 计算总价
  const total = calculateTotal(price, quantity)

  // 计算总折扣
  const totalDiscount = sum(couponDiscount, otherDiscount)

  // 计算最终价格
  return calculateDiscountedPrice(total, totalDiscount)
}

/**
 * 格式化金额显示（保留2位小数，去除末尾的0）
 * @param amount 金额
 * @returns 格式化后的金额字符串
 * @example formatAmount(100) // "100"
 * @example formatAmount(100.50) // "100.5"
 * @example formatAmount(100.00) // "100"
 */
export const formatAmount = (amount: number): string => {
  const fixed = toFixed(amount, 2)

  // 如果是整数，直接返回
  if (Number.isInteger(fixed)) {
    return fixed.toString()
  }
  // 去除末尾的0
  return parseFloat(fixed.toFixed(2)).toString()
}

/**
 * 格式化金额显示（带货币符号）
 * @param amount 金额
 * @param symbol 货币符号，默认为"¥"
 * @returns 格式化后的金额字符串
 * @example formatAmountWithSymbol(100) // "¥100"
 */
export const formatAmountWithSymbol = (amount: number, symbol: string = "¥"): string => {
  return `${symbol}${formatAmount(amount)}`
}

/**
 * 比较两个金额是否相等（考虑精度问题）
 * @param a 金额a
 * @param b 金额b
 * @param precision 精度，默认0.01（分）
 * @returns 是否相等
 */
export const isEqual = (a: number, b: number, precision: number = 0.01): boolean => {
  return Math.abs(subtract(a, b)) < precision
}

/**
 * 判断金额a是否大于金额b
 * @param a 金额a
 * @param b 金额b
 * @returns 是否大于
 */
export const isGreaterThan = (a: number, b: number): boolean => {
  return subtract(a, b) > 0
}

/**
 * 判断金额a是否小于金额b
 * @param a 金额a
 * @param b 金额b
 * @returns 是否小于
 */
export const isLessThan = (a: number, b: number): boolean => {
  return subtract(a, b) < 0
}

/**
 * 计算百分比折扣后的价格
 * @param price 原价
 * @param percentage 折扣百分比（0-100），如：10表示打9折（优惠10%）
 * @returns 折扣后价格
 * @example calculatePercentageDiscount(100, 10) // 90
 */
export const calculatePercentageDiscount = (price: number, percentage: number): number => {
  const discountAmount = multiply(price, divide(percentage, 100))
  return calculateDiscountedPrice(price, discountAmount)
}

/**
 * 金额计算器类（链式调用）
 */
export class PriceCalculator {
  private value: number

  constructor(initialValue: number = 0) {
    this.value = initialValue
  }

  /**
   * 加法
   */
  add(num: number): PriceCalculator {
    this.value = add(this.value, num)
    return this
  }

  /**
   * 减法
   */
  subtract(num: number): PriceCalculator {
    this.value = subtract(this.value, num)
    return this
  }

  /**
   * 乘法
   */
  multiply(num: number): PriceCalculator {
    this.value = multiply(this.value, num)
    return this
  }

  /**
   * 除法
   */
  divide(num: number): PriceCalculator {
    this.value = divide(this.value, num)
    return this
  }

  /**
   * 应用优惠券
   */
  applyCoupon(discount: number): PriceCalculator {
    this.value = calculateDiscountedPrice(this.value, discount)
    return this
  }

  /**
   * 应用百分比折扣
   */
  applyPercentage(percentage: number): PriceCalculator {
    this.value = calculatePercentageDiscount(this.value, percentage)
    return this
  }

  /**
   * 确保最小值
   */
  min(minValue: number): PriceCalculator {
    this.value = Math.max(this.value, minValue)
    return this
  }

  /**
   * 确保最大值
   */
  max(maxValue: number): PriceCalculator {
    this.value = Math.min(this.value, maxValue)
    return this
  }

  /**
   * 获取结果（保留2位小数）
   */
  getValue(): number {
    return toFixed(this.value, 2)
  }

  /**
   * 获取格式化后的字符串
   */
  toString(): string {
    return formatAmount(this.value)
  }

  /**
   * 获取带货币符号的字符串
   */
  toStringWithSymbol(symbol: string = "¥"): string {
    return formatAmountWithSymbol(this.value, symbol)
  }
}

/**
 * 创建价格计算器实例
 * @param initialValue 初始值
 * @returns 计算器实例
 * @example
 * const finalPrice = createCalculator(100)
 *   .multiply(2)
 *   .applyCoupon(50)
 *   .min(0)
 *   .getValue() // 150
 */
export const createCalculator = (initialValue: number = 0): PriceCalculator => {
  return new PriceCalculator(initialValue)
}
