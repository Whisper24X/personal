import Taro from "@tarojs/taro"
import { useUserStore } from "../store/userStore"
import { BASE_API, CONFIG } from "../config/env"

// 基础配置
const BASE_URL = BASE_API
// 401 白名单：这些接口返回 401 时不触发登录跳转
const UNAUTHORIZED_WHITELIST: string[] = [
  // 可以添加需要忽略 401 的接口路径
  // 例如: "/yanxue/wechat/v1/user/login"
  "/wechat/v1/wx_xcx_qrcode/generate"
]

// 检查 URL 是否在白名单中
const isInWhitelist = (url: string): boolean => {
  return UNAUTHORIZED_WHITELIST.some(whitelistUrl => {
    // 支持完整 URL 或路径匹配
    return url.includes(whitelistUrl)
  })
}
// 不需要token的接口白名单
const NO_TOKEN_WHITELIST: string[] = [
  "/devices-learn/learn-config/v1/queryLearnConfigByKey",
  "/yanxue/wechat/v1/good_recommendation_category/list",
  "/yanxue/wechat/v1/good/info",
  "/yanxue/wechat/v1/coupon/list",
  "/yanxue/wechat/v1/wx_xcx_qrcode/scene",
  // 登录相关接口
  "/yanxue/wechat/v1/auth/login_xcx",
  "/yanxue/wechat/v1/auth/sms_code",
  "/yanxue/wechat/v1/auth/phone_login"
]

// 检查接口是否不需要token
const isNoTokenRequired = (url: string): boolean => {
  return NO_TOKEN_WHITELIST.some(whitelistUrl => {
    // 支持完整 URL 或路径匹配
    return url.includes(whitelistUrl)
  })
}

// 请求配置接口
interface RequestOptions extends Omit<Taro.request.Option, "url"> {
  url: string
  baseUrl?: string
  skipTokenCheck?: boolean
  skipErrorToast?: boolean
  customErrorCallback?: (error: any) => void
}

// 响应数据接口
interface ResponseData<T = any> {
  code: number
  data: T
  message: string
}

// 请求方法
const request = <T = any>(options: RequestOptions): Promise<T> => {
  return new Promise((resolve, reject) => {
    const {
      url,
      baseUrl = BASE_URL,
      skipTokenCheck = false,
      skipErrorToast = false,
      customErrorCallback,
      ...rest
    } = options

    // 完整请求地址
    const fullUrl = `${baseUrl}${url}`

    // Token验证：检查是否需要token但没有token
    const userStore = useUserStore()
    const token = userStore.token

    if (!skipTokenCheck && !isNoTokenRequired(url) && !token) {
      // 需要token但没有token，拦截请求并跳转登录
      console.warn("请求被拦截：缺少token", url)
      if (isInWhitelist(fullUrl)) {
        console.log("401 白名单接口，忽略登录跳转:", fullUrl)
        return
      } else {
        handleUnauthorized()
        reject(new Error("请先登录"))
        return
      }
    }

    // 请求头处理
    const header = { ...options.header } as Record<string, string>

    // 添加token到请求头
    if (!skipTokenCheck && token) {
      header["Authorization"] = `Bearer ${token}`
    }

    // 设置默认内容类型
    if (!header["Content-Type"]) {
      header["Content-Type"] = "application/json"
    }

    // 设置超时时间
    const timeout = CONFIG.REQUEST_TIMEOUT

    Taro.request({
      url: fullUrl,
      header,
      timeout,
      ...rest,
      success: res => {
        const { statusCode } = res
        const responseData = res.data
        // HTTP状态码处理
        if (statusCode >= 200 && statusCode < 300) {
          // 检查是否是错误响应（包含code字段且不是0或200）
          if (responseData.code && responseData.code !== 0 && responseData.code !== 200) {
            // 其他业务错误
            if (!skipErrorToast) {
              Taro.showToast({
                title: responseData.message || "请求失败",
                icon: "none",
                duration: 2000
              })
            }
            console.error("业务错误响应:", responseData)
            reject(new Error(responseData.message || "请求失败"))
          } else {
            // 成功响应
            console.log("成功响应:", responseData)
            resolve(responseData as T)
          }
        } else if (statusCode === 401) {
          // 检查是否在白名单中，如果在白名单中则忽略 401 处理
          handleUnauthorized()
          reject(new Error("请先登录"))
        } else if (statusCode === 409) {
          // 冲突错误，业务逻辑错误
          if (!skipErrorToast) {
            if (customErrorCallback) {
              customErrorCallback(responseData)
            } else {
              Taro.showToast({
                title: responseData.message || "操作失败",
                icon: "none",
                duration: 2000
              })
            }
          }
          reject(responseData)
        } else if (statusCode < 600) {
          console.error("HTTP错误响应:", responseData)
          reject(responseData)
        } else {
          // HTTP错误
          handleHttpError(statusCode, skipErrorToast)
          reject(new Error(`HTTP错误: ${statusCode}`))
        }
      },
      fail: err => {
        // 网络错误等
        if (!skipErrorToast) {
          Taro.showToast({
            title: "网络异常，请稍后重试",
            icon: "none",
            duration: 2000
          })
        }
        console.error("网络请求失败:", err)
        reject(new Error(err.errMsg || "网络请求失败"))
      }
    })
  })
}

// 防抖控制变量
let isHandlingUnauthorized = false
let unauthorizedTimer: ReturnType<typeof setTimeout> | null = null

// 处理未授权情况（带防抖）
const handleUnauthorized = () => {
  // 如果正在处理未授权，直接返回
  if (isHandlingUnauthorized) {
    console.log("正在处理登录跳转，忽略重复调用")
    return
  }

  // 设置防抖标志
  isHandlingUnauthorized = true

  // 清除所有认证信息
  const userStore = useUserStore()
  userStore.clearUserInfo()

  // 显示提示
  Taro.showToast({
    title: "登录已过期，请重新登录",
    icon: "none",
    mask: true,
    duration: 2000
  })

  // 延迟跳转到登录页
  if (unauthorizedTimer) {
    clearTimeout(unauthorizedTimer)
  }

  unauthorizedTimer = setTimeout(() => {
    // 修正：Taro.getCurrentPages() 返回页面栈数组，取最后一个页面判断
    const pages = Taro.getCurrentPages()
    const currentPage = pages[pages.length - 1]
    if (currentPage && currentPage.route === "/pages/user/login/index") {
      // 重置防抖标志
      isHandlingUnauthorized = false
      return
    }
    Taro.reLaunch({
      url: "/pages/user/login/index",
      success: () => {
        // 跳转成功后，3秒后重置防抖标志
        setTimeout(() => {
          isHandlingUnauthorized = false
        }, 3000)
      },
      fail: () => {
        // 跳转失败也重置防抖标志
        isHandlingUnauthorized = false
      }
    })
  }, 1500)
}

// 处理HTTP错误
const handleHttpError = (statusCode: number, skipErrorToast: boolean) => {
  if (skipErrorToast) return

  let message = "服务器异常，请稍后重试"

  if (statusCode === 404) {
    message = "请求的资源不存在"
  } else if (statusCode >= 500) {
    message = "服务器错误，请稍后重试"
  } else if (statusCode === 403) {
    message = "访问被拒绝，权限不足"
  }

  Taro.showToast({
    title: message,
    icon: "none",
    duration: 2000
  })
}

// 请求方法简写
const get = <T = any>(
  url: string,
  data?: any,
  options?: Omit<RequestOptions, "url" | "method" | "data">
) => {
  return request<T>({ url, method: "GET", data, ...options })
}

const post = <T = any>(
  url: string,
  data?: any,
  options?: Omit<RequestOptions, "url" | "method" | "data">
) => {
  return request<T>({ url, method: "POST", data, ...options })
}

const put = <T = any>(
  url: string,
  data?: any,
  options?: Omit<RequestOptions, "url" | "method" | "data">
) => {
  return request<T>({ url, method: "PUT", data, ...options })
}

const del = <T = any>(
  url: string,
  data?: any,
  options?: Omit<RequestOptions, "url" | "method" | "data">
) => {
  return request<T>({ url, method: "DELETE", data, ...options })
}

export { request, get, post, put, del }
export default request
