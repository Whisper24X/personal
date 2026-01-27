/**
 * 数据采集分析类型定义
 * 用于封装微信小程序 wx.reportEvent 的数据采集功能
 * 从基础库 2.31.1 开始，wx.reportAnalytics 停止维护，使用 wx.reportEvent 代替
 */

/**
 * 事件类型枚举
 */
export enum EventType {
  // 点击事件
  CLICK = "click",
  // 页面浏览
  PAGE_VIEW = "page_view",
  // 页面离开
  PAGE_LEAVE = "page_leave",
  // 分享事件
  SHARE = "share",
  // 表单提交
  FORM_SUBMIT = "form_submit",
  // 曝光事件
  EXPOSURE = "exposure",
  // 自定义事件
  CUSTOM = "custom"
}

/**
 * 页面信息接口
 */
export interface PageInfo {
  // 页面路径
  path: string
  // 页面参数
  query?: Record<string, any>
  // 页面标题
  title?: string
}

/**
 * 用户信息接口
 */
export interface UserInfo {
  // 用户ID
  userId?: string | number
  // 用户昵称
  nickname?: string
  // 其他自定义用户信息
  [key: string]: any
}

/**
 * 事件数据接口
 * 注意：wx.reportEvent 支持可被 JSON.stringify 的对象
 * 为了保持向下兼容，仍然定义为 string 和 number 类型
 */
export interface EventData {
  [key: string]: string | number
}

/**
 * 追踪事件完整数据接口
 */
export interface TrackEventData {
  // 事件ID（需要在小程序后台配置）
  eventId: string
  // 事件类型
  eventType?: EventType | string
  // 事件名称
  eventName?: string
  // 页面路径
  pagePath?: string
  // 页面参数
  pageQuery?: string
  // 元素类型（如：button, link 等）
  elementType?: string
  // 元素文本内容
  elementText?: string
  // 时间戳
  timestamp?: number
  // 用户ID
  userId?: string | number
  // 自定义数据
  [key: string]: string | number | undefined
}

/**
 * 指令绑定值类型
 */
export type TrackDirectiveValue =
  | string // 简单事件ID
  | {
      // 事件ID
      event: string
      // 自定义数据
      data?: Record<string, any>
      // 事件类型
      type?: EventType | string
    }

/**
 * 分析配置接口
 */
export interface AnalyticsConfig {
  // 是否启用（默认 true）
  enabled?: boolean
  // 是否在开发环境启用（默认 true）
  enableInDev?: boolean
  // 是否打印日志（默认开发环境 true，生产环境 false）
  debug?: boolean
  // 全局用户信息获取函数
  getUserInfo?: () => UserInfo | null
  // 数据预处理函数
  beforeTrack?: (data: TrackEventData) => TrackEventData | null
}

/**
 * 上报结果接口
 */
export interface ReportResult {
  success: boolean
  message?: string
  data?: any
}
