/**
 * 格式化日期为 YYYY-MM-DD 格式
 * @param date 日期对象
 * @returns 格式化后的日期字符串
 */
export const formatDate = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/**
 * 格式化日期时间为YYYY-MM-DD HH:MM:SS格式
 * @param date 日期对象
 * @returns 格式化后的日期时间字符串
 */
export const formatDateTime = (date: Date): string => {
  const dateStr = formatDate(date)
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")
  const seconds = String(date.getSeconds()).padStart(2, "0")
  return `${dateStr} ${hours}:${minutes}:${seconds}`
}

/**
 * 格式化日期为友好显示格式（如：3月15日）
 * @param dateStr 日期字符串 YYYY-MM-DD
 * @returns 友好格式的日期字符串
 */
export const formatFriendlyDate = (dateStr: string): string => {
  if (!dateStr) return ""
  const date = new Date(dateStr)
  const month = date.getMonth() + 1
  const day = date.getDate()
  return `${month}月${day}日`
}

/**
 * 解析日期字符串为Date对象
 * @param dateStr 日期字符串 YYYY-MM-DD
 * @returns Date对象
 */
export const parseDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split("-").map(Number)
  return new Date(year, month - 1, day)
}

/**
 * 获取两个日期之间的天数
 * @param startDate 开始日期
 * @param endDate 结束日期
 * @returns 天数
 */
export const getDaysBetween = (startDate: Date, endDate: Date): number => {
  const oneDay = 24 * 60 * 60 * 1000 // 一天的毫秒数
  const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate())
  return Math.round(Math.abs((start.getTime() - end.getTime()) / oneDay))
}

/**
 * 获取指定天数后的日期
 * @param date 起始日期
 * @param days 天数
 * @returns 结果日期
 */
export const addDays = (date: Date, days: number): Date => {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

/**
 * 获取今天的日期字符串
 * @returns YYYY-MM-DD格式的今天日期
 */
export const getToday = (): string => {
  return formatDate(new Date())
}

/**
 * 判断是否为今天
 * @param dateStr 日期字符串 YYYY-MM-DD
 * @returns 是否为今天
 */
export const isToday = (dateStr: string): boolean => {
  return dateStr === getToday()
}

/**
 * 通用日期格式化函数（兼容旧版本）
 * @param date 日期对象或字符串
 * @param format 格式字符串
 * @returns 格式化后的字符串
 */
export const formatDateCustom = (date: Date | string, format = "YYYY/MM/DD HH:mm:ss") => {
  if (!date) return ""

  const d = typeof date === "object" ? date : new Date(date)

  if (isNaN(d.getTime())) return ""

  const formatObj = {
    YYYY: d.getFullYear(),
    MM: (d.getMonth() + 1).toString().padStart(2, "0"),
    DD: d.getDate().toString().padStart(2, "0"),
    HH: d.getHours().toString().padStart(2, "0"),
    mm: d.getMinutes().toString().padStart(2, "0"),
    ss: d.getSeconds().toString().padStart(2, "0")
  } as any

  return format.replace(/(YYYY|MM|DD|HH|mm|ss)/g, match => formatObj[match])
}
