/**
 * 金额处理工具函数
 * 说明：后端统一使用"分"作为金额单位，前端需要转换为"元"进行显示
 */

/**
 * 分转元 - 用于显示
 * @param cents 金额（分）
 * @returns 格式化后的金额字符串（元，保留2位小数）
 * @example
 * centsToYuan(10000) // "100.00"
 * centsToYuan(0) // "0.00"
 * centsToYuan(null) // "--"
 */
export function centsToYuan(cents: number | undefined | null): string {
  if (cents === undefined || cents === null) {
    return '--'
  }
  return (cents / 100).toFixed(2)
}

/**
 * 分转元（带货币符号）- 用于显示
 * @param cents 金额（分）
 * @returns 格式化后的金额字符串（元，带¥符号）
 * @example
 * formatMoney(10000) // "¥100.00"
 * formatMoney(0) // "¥0.00"
 * formatMoney(null) // "--"
 */
export function formatMoney(cents: number | undefined | null): string {
  if (cents === undefined || cents === null) {
    return '--'
  }
  return `¥${(cents / 100).toFixed(2)}`
}

/**
 * 元转分 - 用于提交API
 * @param yuan 金额（元）
 * @returns 金额（分）
 * @example
 * yuanToCents(100) // 10000
 * yuanToCents("100.50") // 10050
 * yuanToCents(0.01) // 1
 */
export function yuanToCents(yuan: number | string): number {
  const amount = typeof yuan === 'string' ? parseFloat(yuan) : yuan
  if (isNaN(amount)) {
    return 0
  }
  // 使用 Math.round 避免浮点数精度问题
  return Math.round(amount * 100)
}

/**
 * 检查金额是否有效（大于0）
 * @param cents 金额（分）
 * @returns 是否有效
 * @example
 * isValidAmount(100) // true
 * isValidAmount(0) // false
 * isValidAmount(null) // false
 */
export function isValidAmount(cents: number | undefined | null): boolean {
  return cents !== undefined && cents !== null && cents > 0
}

/**
 * 分转元（数字类型）- 用于计算
 * @param cents 金额（分）
 * @returns 金额（元）
 * @example
 * centsToYuanNumber(10000) // 100
 * centsToYuanNumber(null) // 0
 */
export function centsToYuanNumber(cents: number | undefined | null): number {
  if (cents === undefined || cents === null) {
    return 0
  }
  return cents / 100
}

