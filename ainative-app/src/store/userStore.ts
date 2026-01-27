import { defineStore } from "pinia"
import { ref } from "vue"
import Taro from "@tarojs/taro"
import type { UserInfo } from "@/api/user"

// 小程序用户信息接口
export interface MiniUserInfo {
  openid: string
  nickname?: string
  headimgurl?: string
  [key: string]: any
}

export const useUserStore = defineStore(
  "user",
  () => {
    const username = ref("")
    const isLoggedIn = ref(false)
    const token = ref<string | null>(Taro.getStorageSync("token") || null)
    const userInfo = ref<MiniUserInfo | null>(null)
    const userDetailInfo = ref<UserInfo | null>(null)
    const userWxId = ref<string | null>(Taro.getStorageSync("userWxId") || null)
    const tokenExpiredAt = ref<number | null>(null)
    const tokenRefreshAt = ref<number | null>(null)

    // 初始化时从本地存储获取用户信息
    const initUserInfo = () => {
      try {
        const savedUserInfo = Taro.getStorageSync("userInfo")
        if (savedUserInfo) {
          userInfo.value = JSON.parse(savedUserInfo)
        }

        const savedUserDetailInfo = Taro.getStorageSync("userDetailInfo")
        if (savedUserDetailInfo) {
          userDetailInfo.value = JSON.parse(savedUserDetailInfo)
        }

        const savedExpiredAt = Taro.getStorageSync("tokenExpiredAt")
        if (savedExpiredAt) {
          tokenExpiredAt.value = Number(savedExpiredAt)
        }

        const savedRefreshAt = Taro.getStorageSync("tokenRefreshAt")
        if (savedRefreshAt) {
          tokenRefreshAt.value = Number(savedRefreshAt)
        }

        // 如果有token，设置登录状态
        if (token.value) {
          isLoggedIn.value = true
        }
      } catch (error) {
        console.error("解析用户信息失败", error)
      }
    }

    const login = (name: string, t: string) => {
      username.value = name
      isLoggedIn.value = true
      token.value = t
      Taro.setStorageSync("token", t)
      // 保存token获取时间戳，用于判断token是否过期
      Taro.setStorageSync("tokenTimestamp", new Date().getTime().toString())
    }

    const clearUserInfo = () => {
      username.value = ""
      isLoggedIn.value = false
      token.value = null
      userInfo.value = null
      userDetailInfo.value = null
      userWxId.value = null
      tokenExpiredAt.value = null
      tokenRefreshAt.value = null

      // 清除小程序存储
      Taro.removeStorageSync("token")
      Taro.removeStorageSync("userInfo")
      Taro.removeStorageSync("userDetailInfo")
      Taro.removeStorageSync("tokenTimestamp")
      Taro.removeStorageSync("userWxId")
      Taro.removeStorageSync("tokenExpiredAt")
      Taro.removeStorageSync("tokenRefreshAt")
    }

    const logout = () => {
      clearUserInfo()
      // 跳转到首页
      Taro.switchTab({
        url: "//pages/recommend/index/index"
      })
    }

    const setToken = (t: string) => {
      token.value = t
      isLoggedIn.value = true
      Taro.setStorageSync("token", t)
      // 保存token获取时间戳
      Taro.setStorageSync("tokenTimestamp", new Date().getTime().toString())
    }
    const setUserWxId = (wxId: string) => {
      userWxId.value = wxId
      Taro.setStorageSync("userWxId", wxId)
    }
    const setUserInfo = (info: MiniUserInfo) => {
      userInfo.value = info
      // 从用户信息中提取昵称作为用户名
      if (info.nickname) {
        username.value = info.nickname
      }
      // 存储用户信息到小程序存储
      Taro.setStorageSync("userInfo", JSON.stringify(info))
      setUserWxId(info.userWxId)
    }

    const setUserDetailInfo = (info: UserInfo) => {
      userDetailInfo.value = info
      // 从用户信息中提取昵称作为用户名
      if (info.nickname) {
        username.value = info.nickname
      }
      // 存储用户信息到小程序存储
      Taro.setStorageSync("userDetailInfo", JSON.stringify(info))
    }

    // todo: 获取用户信息根据实际的数据结构来赋值
    const updateUserInfo = (info: Partial<UserInfo>) => {
      if (userDetailInfo.value) {
        // 合并用户信息
        userDetailInfo.value = { ...userDetailInfo.value, ...info }
        // 从用户信息中提取昵称作为用户名
        if (info.nickname) {
          username.value = info.nickname
        }
        // 存储更新后的用户信息到小程序存储
        Taro.setStorageSync("userDetailInfo", JSON.stringify(userDetailInfo.value))
      }
    }

    const setTokenExpiredAt = (expiredAt: number) => {
      tokenExpiredAt.value = expiredAt
      Taro.setStorageSync("tokenExpiredAt", expiredAt.toString())
    }

    const setTokenRefreshAt = (refreshAt: number) => {
      tokenRefreshAt.value = refreshAt
      Taro.setStorageSync("tokenRefreshAt", refreshAt.toString())
    }

    // 检查token是否过期
    const isTokenExpired = (): boolean => {
      // 优先使用服务器返回的过期时间
      if (tokenExpiredAt.value) {
        const now = new Date().getTime()
        return now > tokenExpiredAt.value
      }

      // 兼容旧逻辑：使用本地时间戳判断（12小时过期）
      const tokenTimestamp = Taro.getStorageSync("tokenTimestamp")
      if (!tokenTimestamp) return true

      const expirationTime = 12 * 60 * 60 * 1000 // 12小时
      const now = new Date().getTime()
      return now - parseInt(tokenTimestamp) > expirationTime
    }

    // 是否需要刷新token
    const needRefreshToken = (): boolean => {
      if (tokenRefreshAt.value) {
        const now = new Date().getTime()
        return now > tokenRefreshAt.value
      }
      return false
    }

    // 刷新token时间戳，用于手动延长token有效期
    const refreshTokenTimestamp = (): void => {
      if (token.value) {
        Taro.setStorageSync("tokenTimestamp", new Date().getTime().toString())
      }
    }

    // 初始化用户信息
    initUserInfo()

    return {
      username,
      isLoggedIn,
      token,
      userInfo,
      userDetailInfo,
      userWxId,
      tokenExpiredAt,
      tokenRefreshAt,
      login,
      logout,
      clearUserInfo,
      setToken,
      setUserInfo,
      setUserDetailInfo,
      updateUserInfo,
      setUserWxId,
      setTokenExpiredAt,
      setTokenRefreshAt,
      isTokenExpired,
      needRefreshToken,
      refreshTokenTimestamp
    }
  },
  {
    persist: true
  }
)
