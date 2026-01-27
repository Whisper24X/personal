import { post } from "@/api/request"

// 用户信息更新接口参数类型
export interface UpdateUserInfoParams {
  nickname: string
  avatar: string
  address: string
  birthday: string
}

// 用户信息更新接口响应类型
export interface UpdateUserInfoResponse {
  code: number
  message: string
  data?: any
}

/**
 * 更新用户信息
 * @param params 用户信息参数
 * @returns Promise<UpdateUserInfoResponse>
 */
export const updateUserInfo = (params: UpdateUserInfoParams): Promise<UpdateUserInfoResponse> => {
  return post<UpdateUserInfoResponse>("/yanxue/wechat/v1/user/update", params)
}

/**
 * 更新用户头像
 * @param avatar 头像URL
 * @param userInfo 其他必填的用户信息
 * @returns Promise<UpdateUserInfoResponse>
 */
export const updateUserAvatar = (
  avatar: string,
  userInfo: { nickname: string; address: string; birthday: string }
): Promise<UpdateUserInfoResponse> => {
  return updateUserInfo({
    nickname: userInfo.nickname,
    avatar,
    address: userInfo.address,
    birthday: userInfo.birthday
  })
}

/**
 * 更新用户昵称
 * @param nickname 昵称
 * @param userInfo 其他必填的用户信息
 * @returns Promise<UpdateUserInfoResponse>
 */
export const updateUserNickname = (
  nickname: string,
  userInfo: { avatar: string; address: string; birthday: string }
): Promise<UpdateUserInfoResponse> => {
  return updateUserInfo({
    nickname,
    avatar: userInfo.avatar,
    address: userInfo.address,
    birthday: userInfo.birthday
  })
}

/**
 * 更新用户地址
 * @param address 地址
 * @param userInfo 其他必填的用户信息
 * @returns Promise<UpdateUserInfoResponse>
 */
export const updateUserAddress = (
  address: string,
  userInfo: { nickname: string; avatar: string; birthday: string }
): Promise<UpdateUserInfoResponse> => {
  return updateUserInfo({
    nickname: userInfo.nickname,
    avatar: userInfo.avatar,
    address,
    birthday: userInfo.birthday
  })
}

/**
 * 更新用户生日
 * @param birthday 生日
 * @param userInfo 其他必填的用户信息
 * @returns Promise<UpdateUserInfoResponse>
 */
export const updateUserBirthday = (
  birthday: string,
  userInfo: { nickname: string; avatar: string; address: string }
): Promise<UpdateUserInfoResponse> => {
  return updateUserInfo({
    nickname: userInfo.nickname,
    avatar: userInfo.avatar,
    address: userInfo.address,
    birthday
  })
}

/**
 * 批量更新用户信息
 * @param userInfo 用户信息对象（所有字段必填）
 * @returns Promise<UpdateUserInfoResponse>
 */
export const batchUpdateUserInfo = (userInfo: {
  nickname: string
  avatar: string
  address: string
  birthday: string
}): Promise<UpdateUserInfoResponse> => {
  return updateUserInfo(userInfo)
}
