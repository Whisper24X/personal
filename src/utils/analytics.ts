/**
 * 数据采集分析工具
 *
 * 专为微信小程序设计，封装 wx.reportEvent 实现无痕数据采集分析
 * 支持自动埋点（Vue指令）和手动调用两种方式
 *
 * 注意：此工具仅在微信小程序环境中有效
 * 从基础库 2.31.1 开始，wx.reportAnalytics 停止维护，使用 wx.reportEvent 代替
 */

import * as Taro from "@tarojs/taro"
import type { Directive } from "vue"
import type { TrackEventData, AnalyticsConfig, ReportResult, EventData } from "@/types/analytics"
import { EventType } from "@/types/analytics"

// 声明微信小程序全局变量
declare global {
  const wx: {
    reportEvent?: (eventId: string, data: Record<string, any>) => void
    reportAnalytics?: (eventId: string, data: Record<string, any>) => void
  }
}

/**
 * 全局配置
 */
let globalConfig: AnalyticsConfig = {
  enabled: true,
  enableInDev: true,
  debug: process.env.NODE_ENV === "development"
}

/**
 * 初始化分析配置
 */
export function initAnalytics(config: AnalyticsConfig = {}) {
  globalConfig = {
    ...globalConfig,
    ...config
  }

  if (globalConfig.debug) {
    console.log("[Analytics] 初始化配置:", globalConfig)
  }
}

/**
 * 检查是否启用数据采集
 */
function isEnabled(): boolean {
  if (!globalConfig.enabled) {
    return false
  }

  // 开发环境检查
  if (process.env.NODE_ENV === "development" && !globalConfig.enableInDev) {
    return false
  }

  return true
}

/**
 * 获取当前页面信息
 */
function getCurrentPageInfo(): { path: string; query: Record<string, any> } {
  try {
    const pages = Taro.getCurrentPages()
    if (pages.length === 0) {
      if (globalConfig.debug) {
        console.warn("[Analytics] 当前页面栈为空")
      }
      return { path: "", query: {} }
    }

    const currentPage = pages[pages.length - 1]
    const route = currentPage.route || ""
    // @ts-ignore
    const options = currentPage.options || {}

    const pageInfo = {
      path: `/${route}`,
      query: options
    }

    if (globalConfig.debug) {
      console.log("[Analytics] 获取页面信息:", pageInfo)
    }

    return pageInfo
  } catch (error) {
    if (globalConfig.debug) {
      console.error("[Analytics] 获取页面信息失败:", error)
    }
    return { path: "", query: {} }
  }
}

/**
 * 格式化查询参数为字符串
 */
function formatQuery(query: Record<string, any>): string {
  try {
    const queryStr = Object.keys(query)
      .map(key => `${key}=${query[key]}`)
      .join("&")
    return queryStr
  } catch (error) {
    return ""
  }
}

/**
 * 标准化数据格式
 * wx.reportEvent 支持可被 JSON.stringify 的对象
 * 为了保持兼容性，仍然转换为 string 和 number 类型
 */
function normalizeData(data: Record<string, any>): EventData {
  const normalized: EventData = {}
  let hasConversion = false

  for (const key in data) {
    const value = data[key]

    if (value === null || value === undefined) {
      if (globalConfig.debug) {
        console.log(`[Analytics] 跳过空值字段: ${key}`)
      }
      continue
    }

    if (typeof value === "string" || typeof value === "number") {
      normalized[key] = value
    } else if (typeof value === "boolean") {
      normalized[key] = value ? 1 : 0
      hasConversion = true
      if (globalConfig.debug) {
        console.log(`[Analytics] 转换布尔值: ${key} = ${value} -> ${normalized[key]}`)
      }
    } else if (typeof value === "object") {
      // 对象转 JSON 字符串
      try {
        normalized[key] = JSON.stringify(value)
        hasConversion = true
        if (globalConfig.debug) {
          console.log(`[Analytics] 转换对象为字符串: ${key} = ${normalized[key]}`)
        }
      } catch (error) {
        normalized[key] = String(value)
        if (globalConfig.debug) {
          console.warn(`[Analytics] 对象序列化失败，使用 String(): ${key}`, error)
        }
      }
    } else {
      normalized[key] = String(value)
      hasConversion = true
      if (globalConfig.debug) {
        console.log(`[Analytics] 转换为字符串: ${key} = ${typeof value} -> "${normalized[key]}"`)
      }
    }
  }

  if (globalConfig.debug && hasConversion) {
    console.log("[Analytics] 数据标准化完成，已转换的字段数:", Object.keys(normalized).length)
  }

  return normalized
}

/**
 * 核心上报函数
 * 专为微信小程序设计，在小程序环境中调用 wx.reportEvent
 * 从基础库 2.31.1 开始，使用 wx.reportEvent 代替 wx.reportAnalytics
 */
function reportToWx(eventId: string, data: EventData): Promise<ReportResult> {
  return new Promise(resolve => {
    try {
      // 检查微信小程序基础库版本，选择合适的 API
      const systemInfo = Taro.getSystemInfoSync()
      const SDKVersion = systemInfo.SDKVersion || ""

      // 版本比较函数
      const compareVersion = (v1: string, v2: string) => {
        const v1Arr = v1.split(".")
        const v2Arr = v2.split(".")
        const len = Math.max(v1Arr.length, v2Arr.length)

        while (v1Arr.length < len) v1Arr.push("0")
        while (v2Arr.length < len) v2Arr.push("0")

        for (let i = 0; i < len; i++) {
          const num1 = parseInt(v1Arr[i])
          const num2 = parseInt(v2Arr[i])
          if (num1 > num2) return 1
          if (num1 < num2) return -1
        }
        return 0
      }

      // 如果基础库版本支持 wx.reportEvent（>= 2.14.4），优先使用新 API
      if (compareVersion(SDKVersion, "2.14.4") >= 0) {
        // wx.reportEvent 支持对象类型，直接传入原始数据
        // 由于 Taro 可能还未封装 reportEvent，直接使用微信原生 API
        if (typeof wx !== "undefined" && wx.reportEvent) {
          wx.reportEvent(eventId, data)
        } else {
          // 降级到 Taro.reportAnalytics
          Taro.reportAnalytics?.(eventId, data)
        }
      } else {
        // 兼容旧版本，使用 wx.reportAnalytics
        Taro.reportAnalytics?.(eventId, data)
      }

      if (globalConfig.debug) {
        const apiName =
          compareVersion(SDKVersion, "2.14.4") >= 0 ? "wx.reportEvent" : "wx.reportAnalytics"
        console.log(`[Analytics] 数据上报成功 (${apiName}):`, { eventId, data })
      }

      resolve({ success: true, data: { eventId, ...data } })
    } catch (error: any) {
      if (globalConfig.debug) {
        console.error("[Analytics] 数据上报失败:", error)
      }
      resolve({ success: false, message: error.message || "上报失败" })
    }
  })
}

/**
 * 追踪事件（手动调用）
 *
 * 在小程序中手动上报自定义事件数据
 *
 * @param eventId 事件ID（需要在小程序后台「数据分析-事件分析」中配置）
 * @param customData 自定义数据（会自动添加页面路径、用户信息等基础数据）
 * @param eventType 事件类型（click、page_view、share等）
 * @returns Promise<ReportResult> 上报结果
 *
 * @example
 * // 追踪按钮点击
 * track('btn_submit_order', { orderId: 123, amount: 99 })
 *
 * // 追踪商品浏览
 * track('product_view', { productId: 456, category: 'book' }, EventType.PAGE_VIEW)
 */
export async function track(
  eventId: string,
  customData: Record<string, any> = {},
  eventType: EventType | string = EventType.CUSTOM
): Promise<ReportResult> {
  if (globalConfig.debug) {
    console.log("[Analytics] ==================== 开始追踪事件 ====================")
    console.log("[Analytics] 事件ID:", eventId)
    console.log("[Analytics] 事件类型:", eventType)
    console.log("[Analytics] 自定义数据:", customData)
  }

  // 检查是否启用
  if (!isEnabled()) {
    if (globalConfig.debug) {
      console.warn("[Analytics] 数据采集未启用，跳过上报")
    }
    return { success: false, message: "数据采集未启用" }
  }

  try {
    // 获取页面信息
    const pageInfo = getCurrentPageInfo()

    // 构建完整事件数据
    let trackData: TrackEventData = {
      eventId,
      eventType,
      pagePath: pageInfo.path,
      pageQuery: formatQuery(pageInfo.query),
      timestamp: Date.now(),
      ...customData
    }

    if (globalConfig.debug) {
      console.log("[Analytics] 构建的追踪数据:", trackData)
    }

    // 获取用户信息
    if (globalConfig.getUserInfo) {
      try {
        const userInfo = globalConfig.getUserInfo()
        if (userInfo && userInfo.userId) {
          trackData.userId = userInfo.userId
          if (globalConfig.debug) {
            console.log("[Analytics] 已添加用户信息:", { userId: userInfo.userId })
          }
        } else if (globalConfig.debug) {
          console.log("[Analytics] 用户信息不可用或未登录")
        }
      } catch (error) {
        if (globalConfig.debug) {
          console.warn("[Analytics] 获取用户信息失败:", error)
        }
      }
    } else if (globalConfig.debug) {
      console.log("[Analytics] 未配置 getUserInfo 方法")
    }

    // 数据预处理
    if (globalConfig.beforeTrack) {
      if (globalConfig.debug) {
        console.log("[Analytics] 执行 beforeTrack 预处理...")
      }
      const processedData = globalConfig.beforeTrack(trackData)
      if (!processedData) {
        if (globalConfig.debug) {
          console.log("[Analytics] 数据被 beforeTrack 拦截，取消上报")
        }
        return { success: false, message: "数据被拦截" }
      }
      trackData = processedData
      if (globalConfig.debug) {
        console.log("[Analytics] beforeTrack 预处理后的数据:", trackData)
      }
    }

    // 标准化数据格式
    if (globalConfig.debug) {
      console.log("[Analytics] 开始标准化数据格式...")
    }
    const normalizedData = normalizeData(trackData)
    if (globalConfig.debug) {
      console.log("[Analytics] 标准化后的数据:", normalizedData)
    }

    // 上报数据
    if (globalConfig.debug) {
      console.log("[Analytics] 准备上报数据到微信...")
    }
    const result = await reportToWx(eventId, normalizedData)

    if (globalConfig.debug) {
      console.log("[Analytics] 上报结果:", result)
      console.log("[Analytics] ==================== 事件追踪结束 ====================")
    }

    return result
  } catch (error: any) {
    if (globalConfig.debug) {
      console.error("[Analytics] track 执行失败:", error)
      console.log("[Analytics] ==================== 事件追踪失败 ====================")
    }
    return { success: false, message: error.message || "执行失败" }
  }
}

/**
 * 追踪页面浏览
 *
 * 用于统计小程序页面的浏览量（PV）
 *
 * @param pagePath 页面路径（可选，默认使用当前页面路径）
 * @param customData 自定义数据
 */
export function trackPageView(pagePath?: string, customData: Record<string, any> = {}) {
  if (globalConfig.debug) {
    console.log("[Analytics] 调用 trackPageView:", { pagePath, customData })
  }
  const pageInfo = getCurrentPageInfo()
  return track(
    "page_view",
    {
      pagePath: pagePath || pageInfo.path,
      pageQuery: formatQuery(pageInfo.query),
      ...customData
    },
    EventType.PAGE_VIEW
  )
}

/**
 * 追踪页面离开
 *
 * 用于统计小程序页面的停留时长
 *
 * @param pagePath 页面路径（可选，默认使用当前页面路径）
 * @param customData 自定义数据
 */
export function trackPageLeave(pagePath?: string, customData: Record<string, any> = {}) {
  if (globalConfig.debug) {
    console.log("[Analytics] 调用 trackPageLeave:", { pagePath, customData })
  }
  const pageInfo = getCurrentPageInfo()
  return track(
    "page_leave",
    {
      pagePath: pagePath || pageInfo.path,
      pageQuery: formatQuery(pageInfo.query),
      ...customData
    },
    EventType.PAGE_LEAVE
  )
}

/**
 * 追踪点击事件
 *
 * 用于统计小程序中用户的点击行为
 *
 * @param elementId 元素标识（会自动添加 click_ 前缀作为事件ID）
 * @param customData 自定义数据
 */
export function trackClick(elementId: string, customData: Record<string, any> = {}) {
  if (globalConfig.debug) {
    console.log("[Analytics] 调用 trackClick:", { elementId, customData })
  }
  return track(
    `click_${elementId}`,
    {
      elementId,
      ...customData
    },
    EventType.CLICK
  )
}

/**
 * 追踪分享事件
 *
 * 用于统计小程序的分享行为（转发给朋友、分享到朋友圈等）
 *
 * @param shareType 分享类型（wechat、moments、timeline等）
 * @param customData 自定义数据
 */
export function trackShare(shareType: string, customData: Record<string, any> = {}) {
  if (globalConfig.debug) {
    console.log("[Analytics] 调用 trackShare:", { shareType, customData })
  }
  return track(
    "share",
    {
      shareType,
      ...customData
    },
    EventType.SHARE
  )
}

/**
 * v-track 指令：自动追踪点击事件
 *
 * 在小程序中通过 Vue 指令实现自动埋点，无需手动编写上报代码
 *
 * @使用方式
 * 1. 简单用法：v-track="'btn_submit'"
 * 2. 完整用法：v-track="{ event: 'btn_submit', data: { id: 123 }, type: 'click' }"
 *
 * @example
 * <button v-track="'btn_buy_product'">立即购买</button>
 * <view v-track="{ event: 'tab_home', data: { tabIndex: 0 } }">首页</view>
 */
export const vTrack: Directive = {
  mounted(el, binding) {
    if (globalConfig.debug) {
      console.log("[Analytics] v-track 指令挂载:", binding.value)
    }

    // 解析指令值
    let eventId: string
    let eventData: Record<string, any> = {}
    let eventType: EventType | string = EventType.CLICK

    if (typeof binding.value === "string") {
      eventId = binding.value
    } else if (binding.value && typeof binding.value === "object") {
      eventId = binding.value.event
      eventData = binding.value.data || {}
      eventType = binding.value.type || EventType.CLICK
    } else {
      if (globalConfig.debug) {
        console.warn("[Analytics] v-track 指令值格式错误:", binding.value)
      }
      return
    }

    if (!eventId) {
      if (globalConfig.debug) {
        console.warn("[Analytics] v-track 指令缺少事件ID")
      }
      return
    }

    // 收集元素信息
    const elementInfo: Record<string, any> = {
      elementType: el.tagName?.toLowerCase() || "unknown"
    }

    // 尝试获取元素文本
    try {
      const text = el.innerText || el.textContent
      if (text && text.trim()) {
        elementInfo.elementText = text.trim().substring(0, 50) // 限制长度
      }
    } catch (error) {
      // 忽略错误
    }

    if (globalConfig.debug) {
      console.log("[Analytics] v-track 指令配置:", {
        eventId,
        eventType,
        elementInfo,
        eventData
      })
    }

    // 点击事件处理函数
    const clickHandler = (e?: Event) => {
      if (globalConfig.debug) {
        console.log("[Analytics] v-track 指令触发点击:", eventId, e?.type)
      }
      track(
        eventId,
        {
          ...elementInfo,
          ...eventData
        },
        eventType
      )
    }

    // 在小程序中同时绑定 tap 和 click 事件
    // tap 是小程序的触摸事件，click 是 Web 标准事件
    try {
      el.addEventListener("tap", clickHandler)
      el.addEventListener("click", clickHandler)

      // 保存处理函数，用于卸载时移除
      // @ts-ignore
      el._trackClickHandler = clickHandler

      if (globalConfig.debug) {
        console.log("[Analytics] v-track 指令绑定成功（已绑定 tap 和 click 事件）")
      }
    } catch (error) {
      if (globalConfig.debug) {
        console.error("[Analytics] v-track 指令绑定失败:", error)
      }
    }
  },

  unmounted(el) {
    if (globalConfig.debug) {
      console.log("[Analytics] v-track 指令卸载")
    }
    // 移除事件监听
    // @ts-ignore
    if (el._trackClickHandler) {
      try {
        // @ts-ignore
        el.removeEventListener("tap", el._trackClickHandler)
        // @ts-ignore
        el.removeEventListener("click", el._trackClickHandler)
        // @ts-ignore
        delete el._trackClickHandler

        if (globalConfig.debug) {
          console.log("[Analytics] v-track 指令事件监听已移除")
        }
      } catch (error) {
        if (globalConfig.debug) {
          console.error("[Analytics] v-track 指令卸载失败:", error)
        }
      }
    }
  }
}

/**
 * v-track-view 指令：自动追踪元素曝光
 *
 * 在小程序中监听元素进入可视区域，自动上报曝光事件
 * 使用 IntersectionObserver 实现，每个元素仅上报一次
 *
 * @使用方式
 * v-track-view="{ event: 'banner_view', data: { bannerId: 123 } }"
 *
 * @example
 * <view v-track-view="{ event: 'product_exposure', data: { productId: 456 } }">
 *   商品卡片
 * </view>
 */
export const vTrackView: Directive = {
  mounted(el, binding) {
    if (globalConfig.debug) {
      console.log("[Analytics] v-track-view 指令挂载:", binding.value)
    }

    // 解析指令值
    let eventId: string
    let eventData: Record<string, any> = {}

    if (typeof binding.value === "string") {
      eventId = binding.value
    } else if (binding.value && typeof binding.value === "object") {
      eventId = binding.value.event
      eventData = binding.value.data || {}
    } else {
      if (globalConfig.debug) {
        console.warn("[Analytics] v-track-view 指令值格式错误:", binding.value)
      }
      return
    }

    if (!eventId) {
      if (globalConfig.debug) {
        console.warn("[Analytics] v-track-view 指令缺少事件ID")
      }
      return
    }

    if (globalConfig.debug) {
      console.log("[Analytics] v-track-view 指令配置:", { eventId, eventData })
    }

    // 使用 IntersectionObserver 监听元素曝光
    try {
      // 小程序环境中使用 createIntersectionObserver
      const observer = Taro.createIntersectionObserver(el)

      // 保存已曝光状态，避免重复上报
      let hasReported = false

      observer.relativeToViewport({ bottom: 0 }).observe(el, res => {
        if (globalConfig.debug) {
          console.log("[Analytics] v-track-view 元素可见性变化:", {
            eventId,
            intersectionRatio: res?.intersectionRatio,
            hasReported
          })
        }

        if (res && (res.intersectionRatio ?? 0) > 0 && !hasReported) {
          hasReported = true
          if (globalConfig.debug) {
            console.log("[Analytics] v-track-view 触发曝光事件:", eventId)
          }
          track(
            eventId,
            {
              elementType: el.tagName?.toLowerCase() || "unknown",
              ...eventData
            },
            EventType.EXPOSURE
          )
        }
      })

      // 保存 observer，用于卸载时断开
      // @ts-ignore
      el._trackViewObserver = observer

      if (globalConfig.debug) {
        console.log("[Analytics] v-track-view observer 创建成功")
      }
    } catch (error) {
      if (globalConfig.debug) {
        console.warn("[Analytics] v-track-view 创建 observer 失败:", error)
      }
    }
  },

  unmounted(el) {
    if (globalConfig.debug) {
      console.log("[Analytics] v-track-view 指令卸载")
    }
    // 断开 observer
    // @ts-ignore
    if (el._trackViewObserver) {
      try {
        // @ts-ignore
        el._trackViewObserver.disconnect()
        // @ts-ignore
        delete el._trackViewObserver
        if (globalConfig.debug) {
          console.log("[Analytics] v-track-view observer 已断开")
        }
      } catch (error) {
        if (globalConfig.debug) {
          console.warn("[Analytics] v-track-view observer 断开失败:", error)
        }
      }
    }
  }
}

/**
 * 默认导出
 */
export default {
  initAnalytics,
  track,
  trackPageView,
  trackPageLeave,
  trackClick,
  trackShare,
  vTrack,
  vTrackView
}
