/**
 * 格式化价格工具方法
 * 最多保留两位小数，去掉末尾的0
 */

/**
 * 分转元
 * @param cents 价格(单位:分)
 * @returns 价格(单位:元)
 */
export const centsToYuan = (cents: number | string): number => {
  const numCents = typeof cents === "string" ? parseFloat(cents) : cents
  if (isNaN(numCents)) return 0
  return numCents / 100
}

/**
 * 格式化价格
 * @param price 价格，可以是数字或字符串
 * @returns 格式化后的价格字符串
 */
export const formatPrice = (price: number | string): string => {
  const numPrice = typeof price === "string" ? parseFloat(price) : price
  if (isNaN(numPrice)) return "0"

  // 如果是整数，直接返回
  if (Number.isInteger(numPrice)) {
    return numPrice.toString()
  }

  // 最多保留两位小数，去掉末尾的0
  return parseFloat(numPrice.toFixed(2)).toString()
}

/**
 * 格式化价格(分转元)
 * @param cents 价格(单位:分)，可以是数字或字符串
 * @returns 格式化后的价格字符串(单位:元)
 */
export const formatPriceFromCents = (cents: number | string): string => {
  return formatPrice(centsToYuan(cents))
}
