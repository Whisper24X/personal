import { post } from "./request"
import Taro from "@tarojs/taro"
import { useUserStore } from "../store/userStore"

// 接口类型定义
interface LoginResponse {
  userWxId: string
  token: {
    token: string
    expiredAt: string
    refreshAt: string
  }
}

interface PhoneLoginResponse {
  token: {
    token: string
    expiredAt: string
    refreshAt: string
  }
}

interface SmsCodeResponse {
  smsCodeId: string
}

/**
 * 小程序登录
 * 使用 Taro.login 获取 code，然后调用后端接口
 */
export const xcxLogin = async (): Promise<LoginResponse> => {
  try {
    // 获取微信登录凭证
    const loginResult = await Taro.login()

    if (!loginResult.code) {
      throw new Error("获取微信登录凭证失败")
    }

    // 调用后端登录接口
    const response = await post<LoginResponse>("/yanxue/wechat/v1/auth/login_xcx", {
      code: loginResult.code
    })

    return response
  } catch (error) {
    console.error("小程序登录失败:", error)
    throw error
  }
}

/**
 * 发送短信验证码
 */
export const sendSmsCode = async (
  phone: string,
  countryCode: string = "86",
  userWxId: string
): Promise<SmsCodeResponse> => {
  return post<SmsCodeResponse>("/yanxue/wechat/v1/auth/sms_code", {
    userWxId,
    countryCode,
    phone
  })
}

/**
 * 手机号登录
 */
export const phoneLogin = async (
  smsCodeId: string,
  smsCode: string
): Promise<PhoneLoginResponse> => {
  return post<PhoneLoginResponse>("/yanxue/wechat/v1/auth/phone_login", {
    smsCodeId,
    smsCode
  })
}

/**
 * 处理小程序登录流程
 * 1. 先进行小程序登录获取 userWxId 和 token
 * 2. 如果需要手机号，再进行手机号登录流程
 */
export const handleXcxLogin = async (): Promise<{
  success: boolean
  needPhone: boolean
  userWxId?: string
  token?: string
  message?: string
}> => {
  const response = await xcxLogin()
  const userStore = useUserStore()

  // 使用 userStore 中的方法保存登录信息
  if (response.userWxId) {
    userStore.setUserWxId(response.userWxId)
  } else {
    Taro.showToast({
      title: "无法获取用户信息,请删除小程序重试",
      icon: "none"
    })
  }
  if (response.token?.token) {
    userStore.setToken(response.token.token)

    // 保存token过期和刷新时间
    if (response.token.expiredAt) {
      userStore.setTokenExpiredAt(new Date(response.token.expiredAt).getTime())
    }
    if (response.token.refreshAt) {
      userStore.setTokenRefreshAt(new Date(response.token.refreshAt).getTime())
    }

    return {
      success: true,
      needPhone: false,
      userWxId: response.userWxId,
      token: response.token.token
    }
  } else {
    // 如果没有返回 token，可能需要手机号登录
    return {
      success: false,
      needPhone: true,
      userWxId: response.userWxId,
      message: "需要完善手机号信息"
    }
  }
}

/**
 * 检查登录状态
 * 使用 userStore 中的方法进行检查
 */
export const checkLoginStatus = (): boolean => {
  const userStore = useUserStore()
  return userStore.isLoggedIn
}

/**
 * 退出登录
 * 使用 userStore 中的方法清除认证信息
 */
export const logout = (): void => {
  const userStore = useUserStore()
  userStore.logout()
}
