import { get, post } from "./request"

// 用户相关接口类型定义
export interface UserWxInfo {
  id?: string
  unionid?: string
  offiaccountOpenId?: string
  offiaccountFollow?: boolean
  status?: number // -1=禁用 1=开启
  createdAt?: string
  updatedAt?: string
  nickname?: string
  sex?: number
  province?: string
  city?: string
  country?: string
  headimgurl?: string
}

export interface UserAppointmentInfo {
  parentName: string
  parentPhone: string
  parentAccompany: string
}

export interface UserInfo {
  id?: string
  phone?: string
  nickname?: string
  avatar?: string
  address?: string
  birthday?: string
  status?: number // -1=禁用 1=开启
  createdAt?: string
  updatedAt?: string
  userWxInfo?: UserWxInfo
  userAppointmentInfo?: UserAppointmentInfo
}

export interface UserInfoResponse {
  userInfo?: UserInfo
}

/**
 * 获取用户信息
 */
export const getUserInfo = () => {
  return get<UserInfoResponse>("/yanxue/wechat/v1/user/info")
}

/**
 * 更新用户信息
 */
export const updateUserInfo = (data: {
  nickname?: string
  phone?: string
  avatar?: string
  address?: string
  birthday?: string
}) => {
  return post("/yanxue/wechat/v1/user/update", data)
}

/**
 * 更新微信用户信息
 */
export const updateUserWx = (data: {
  userWxId?: string
  nickname?: string
  sex?: number
  province?: string
  city?: string
  country?: string
  headimgurl?: string
}) => {
  return post("/yanxue/wechat/v1/user_wx/update", data)
}
